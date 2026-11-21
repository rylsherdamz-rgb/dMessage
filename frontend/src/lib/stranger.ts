'use client';

/**
 * Stranger mode — serverless random matchmaking (Omegle-style).
 *
 * How it stays fully decentralized:
 *  - Discovery/signaling goes over public Nostr relays via Trystero. Relays only
 *    see encrypted WebRTC handshakes for a random topic; dMessage runs no server.
 *  - Every waiting user joins a shared "lobby" room. Peers pair themselves with a
 *    deterministic protocol (lower peerId proposes), then both leave the lobby and
 *    meet in a private room whose id + password were exchanged over the direct,
 *    DTLS-encrypted lobby connection.
 *  - Chat runs over a direct WebRTC data channel, with an extra app-level E2EE
 *    layer (ephemeral ECDH P-256 → AES-GCM-256, same primitives as dMessage DMs).
 *  - Nothing is stored. When the chat ends, the keys are gone.
 */

import { joinRoom, type Room } from 'trystero';
import { decrypt, deriveSharedKey, encrypt, exportPublicKey, generateKeyPair, importPublicKey } from './crypto';

const APP_ID = 'dmessage.stranger.v1';
const LOBBY = 'lobby';
const STRICT_INTEREST_MS = 8_000;
const PAIR_TICK_MS = 1_200;
const MEET_TIMEOUT_MS = 20_000;

export type StrangerPhase = 'idle' | 'searching' | 'connecting' | 'chatting' | 'ended';

export interface StrangerMessage {
  id: string;
  from: 'me' | 'stranger' | 'system';
  text: string;
  at: number;
}

export type EndReason = 'you-left' | 'stranger-left' | 'timeout' | 'auto-moderation' | 'error';

interface Events {
  phase: StrangerPhase;
  message: StrangerMessage;
  typing: boolean;
  stream: MediaStream | null;
  safetyCode: string;
  common: string[];
  contact: string;
  ended: EndReason;
  lobby: number;
  error: string;
}

type Handler<K extends keyof Events> = (v: Events[K]) => void;

interface SeekState {
  interests: string[];
  t: number;
}

interface PairProposal {
  room: string;
  pw: string;
}

interface Sealed {
  iv: string;
  ct: string;
}

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function randomId(bytes = 16): string {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  return Array.from(u, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function normalizeInterests(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,#\n]/)
        .map((s) => s.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter((s) => s.length > 0 && s.length <= 32),
    ),
  ).slice(0, 10);
}

function roomConfig(password?: string) {
  const relays = process.env.NEXT_PUBLIC_STRANGER_RELAYS?.split(',').map((s) => s.trim()).filter(Boolean);
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  return {
    appId: APP_ID,
    // Persistent *anonymous* keypair per browser (not linked to your wallet).
    // Lets you block someone so you never get re-matched with them.
    identity: 'local' as const,
    ...(password ? { password, maxUsers: 2 } : {}),
    ...(relays?.length ? { relayConfig: { urls: relays } } : {}),
    ...(turnUrl
      ? {
          turnConfig: [
            {
              urls: turnUrl,
              username: process.env.NEXT_PUBLIC_TURN_USERNAME,
              credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
            },
          ],
        }
      : {}),
  };
}

export class StrangerSession {
  phase: StrangerPhase = 'idle';
  strangerUserId: string | null = null;

  private handlers = new Map<keyof Events, Set<(v: never) => void>>();
  private lobby: Room | null = null;
  private chat: Room | null = null;
  private pairTimer: ReturnType<typeof setInterval> | null = null;
  private meetTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private searchStarted = 0;
  private selfPeerId = '';
  private recentlySkipped = new Set<string>();
  private aesKey: CryptoKey | null = null;
  private sendMsg: ((d: Sealed) => Promise<void>) | null = null;
  private sendTyping: ((d: boolean) => Promise<void>) | null = null;
  private sendContact: ((d: Sealed) => Promise<void>) | null = null;
  private sendBye: ((d: null) => Promise<void>) | null = null;

  constructor(
    private interests: string[],
    private localStream: MediaStream | null,
    private isBlocked: (userId: string) => boolean,
  ) {}

  on<K extends keyof Events>(event: K, h: Handler<K>) {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(h as (v: never) => void);
    return () => set.delete(h as (v: never) => void);
  }

  private emit<K extends keyof Events>(event: K, v: Events[K]) {
    this.handlers.get(event)?.forEach((h) => (h as Handler<K>)(v));
  }

  private setPhase(p: StrangerPhase) {
    this.phase = p;
    this.emit('phase', p);
  }

  private system(text: string) {
    this.emit('message', { id: randomId(6), from: 'system', text, at: Date.now() });
  }

  // ── Lobby / matchmaking ─────────────────────────────────────────────────────

  async start() {
    if (this.phase === 'searching' || this.phase === 'connecting') return;
    this.cleanupChat();
    this.busy = false;
    this.searchStarted = Date.now();
    this.setPhase('searching');

    const lobby = joinRoom(roomConfig(), LOBBY);
    this.lobby = lobby;
    lobby.onError((e) => {
      if (e.code === 'relay-failed') this.emit('error', 'Could not reach any relay. Check your connection.');
    });

    const seek = lobby.makeUserState<SeekState>('seek', { interests: this.interests, t: Date.now() });
    const pair = lobby.makeAction<PairProposal, boolean>('pair', { kind: 'request' });

    void lobby.getSelf().then((s) => {
      this.selfPeerId = s.peerId;
    });

    const countPeers = () => this.emit('lobby', Object.keys(lobby.getPeers()).length);
    lobby.onPeerJoin(countPeers);
    lobby.onPeerLeave(countPeers);

    // Incoming proposal: accept if we're free and the proposer isn't blocked.
    pair.onRequest(async (proposal, ctx) => {
      if (this.busy || this.phase !== 'searching' || this.isBlocked(ctx.userId)) return false;
      const theirs = seek.get(ctx.userId)?.interests ?? [];
      const common = this.interests.filter((i) => theirs.includes(i));
      if (!this.interestOk(common.length)) return false;
      this.busy = true;
      void this.meet(proposal, ctx.userId, common);
      return true;
    });

    const tick = async () => {
      if (this.busy || this.phase !== 'searching' || !this.selfPeerId) return;
      const peers = lobby.getPeers();
      const candidates = Object.entries(peers)
        .filter(([peerId, info]) => {
          if (peerId <= this.selfPeerId) return false; // lower id proposes
          if (this.isBlocked(info.userId) || this.recentlySkipped.has(info.userId)) return false;
          return seek.has(info.userId);
        })
        .map(([peerId, info]) => {
          const theirs = seek.get(info.userId)?.interests ?? [];
          const common = this.interests.filter((i) => theirs.includes(i));
          return { peerId, userId: info.userId, common };
        })
        .filter((c) => this.interestOk(c.common.length))
        .sort((a, b) => b.common.length - a.common.length || Math.random() - 0.5);

      const pick = candidates[0];
      if (!pick) return;
      this.busy = true;
      const proposal: PairProposal = { room: randomId(), pw: randomId(24) };
      try {
        const ok = await pair.request(proposal, { target: pick.peerId, timeoutMs: 4000 });
        if (ok && this.phase === 'searching') {
          void this.meet(proposal, pick.userId, pick.common);
          return;
        }
      } catch {
        /* timeout / disconnected — try someone else */
      }
      this.busy = false;
    };

    this.pairTimer = setInterval(() => void tick(), PAIR_TICK_MS);
  }

  /** With interests set, only match on overlap for the first few seconds. */
  private interestOk(commonCount: number) {
    if (!this.interests.length) return true;
    if (commonCount > 0) return true;
    return Date.now() - this.searchStarted > STRICT_INTEREST_MS;
  }

  private leaveLobby() {
    if (this.pairTimer) clearInterval(this.pairTimer);
    this.pairTimer = null;
    const l = this.lobby;
    this.lobby = null;
    void l?.leave();
  }

  // ── Private chat room ───────────────────────────────────────────────────────

  private async meet(proposal: PairProposal, strangerUserId: string, common: string[]) {
    this.leaveLobby();
    this.setPhase('connecting');
    this.strangerUserId = strangerUserId;
    this.emit('common', common);

    const room = joinRoom(roomConfig(proposal.pw), proposal.room);
    this.chat = room;
    const keyPair = await generateKeyPair();
    const myPub = await exportPublicKey(keyPair.publicKey);

    const keyAction = room.makeAction<string>('key');
    const msg = room.makeAction<Sealed>('msg');
    const typing = room.makeAction<boolean>('typing');
    const contact = room.makeAction<Sealed>('contact');
    const bye = room.makeAction<null>('bye');
    this.sendMsg = (d) => msg.send(d);
    this.sendTyping = (d) => typing.send(d);
    this.sendContact = (d) => contact.send(d);
    this.sendBye = (d) => bye.send(d);

    this.meetTimer = setTimeout(() => {
      if (this.phase === 'connecting') this.finish('timeout');
    }, MEET_TIMEOUT_MS);

    room.onPeerJoin(({ peerId, userId }) => {
      if (userId !== strangerUserId) return;
      void keyAction.send(myPub, { target: peerId });
      if (this.localStream) void room.addStream(this.localStream, { target: peerId });
    });

    keyAction.onMessage(async (theirPub, ctx) => {
      if (ctx.userId !== strangerUserId || this.aesKey) return;
      const pub = await importPublicKey(theirPub);
      this.aesKey = await deriveSharedKey(keyPair.privateKey, pub);
      this.emit('safetyCode', await safetyCode(myPub, theirPub));
      if (this.meetTimer) clearTimeout(this.meetTimer);
      this.setPhase('chatting');
      this.system(
        common.length
          ? `You're now chatting with a random stranger. You both like: ${common.join(', ')}.`
          : "You're now chatting with a random stranger. Say hi!",
      );
    });

    msg.onMessage(async (sealed, ctx) => {
      if (ctx.userId !== strangerUserId) return;
      const text = await this.open(sealed);
      if (text !== null) this.emit('message', { id: randomId(6), from: 'stranger', text, at: Date.now() });
    });

    typing.onMessage((t, ctx) => {
      if (ctx.userId === strangerUserId) this.emit('typing', !!t);
    });

    contact.onMessage(async (sealed, ctx) => {
      if (ctx.userId !== strangerUserId) return;
      const addr = await this.open(sealed);
      if (addr && /^G[A-Z2-7]{55}$/.test(addr)) this.emit('contact', addr);
    });

    bye.onMessage((_d, ctx) => {
      if (ctx.userId === strangerUserId) this.finish('stranger-left');
    });

    room.onPeerLeave(({ userId }) => {
      if (userId === strangerUserId && (this.phase === 'chatting' || this.phase === 'connecting')) {
        this.finish('stranger-left');
      }
    });

    room.onPeerStream((stream, ctx) => {
      if (ctx.userId === strangerUserId) this.emit('stream', stream);
    });
  }

  private async seal(text: string): Promise<Sealed | null> {
    if (!this.aesKey) return null;
    const { ciphertext, iv } = await encrypt(text, this.aesKey);
    return { iv: b64(iv), ct: b64(ciphertext) };
  }

  private async open(sealed: Sealed): Promise<string | null> {
    if (!this.aesKey || typeof sealed?.ct !== 'string' || typeof sealed?.iv !== 'string') return null;
    try {
      return await decrypt(unb64(sealed.ct), unb64(sealed.iv), this.aesKey);
    } catch {
      return null;
    }
  }

  // ── Public actions ──────────────────────────────────────────────────────────

  async send(text: string) {
    if (this.phase !== 'chatting' || !this.sendMsg) return false;
    const sealed = await this.seal(text);
    if (!sealed) return false;
    await this.sendMsg(sealed);
    this.emit('message', { id: randomId(6), from: 'me', text, at: Date.now() });
    return true;
  }

  setTyping(on: boolean) {
    if (this.phase === 'chatting') void this.sendTyping?.(on);
  }

  async shareContact(stellarAddress: string) {
    if (this.phase !== 'chatting' || !this.sendContact) return;
    const sealed = await this.seal(stellarAddress);
    if (sealed) await this.sendContact(sealed);
    this.system('You shared your dMessage address with the stranger.');
  }

  /** End the current chat (if any) and start looking for someone new. */
  async next() {
    if (this.strangerUserId) this.recentlySkipped.add(this.strangerUserId);
    await this.endChat('you-left');
    await this.start();
  }

  /** Disconnect completely. */
  async stop(reason: EndReason = 'you-left') {
    this.leaveLobby();
    await this.endChat(reason);
    this.setPhase('ended');
  }

  private async endChat(reason: EndReason) {
    if (this.chat && (this.phase === 'chatting' || this.phase === 'connecting')) {
      try {
        await this.sendBye?.(null);
      } catch {
        /* ignore */
      }
      this.emit('ended', reason);
    }
    this.cleanupChat();
  }

  private finish(reason: EndReason) {
    this.emit('ended', reason);
    this.cleanupChat();
    this.setPhase('ended');
  }

  private cleanupChat() {
    if (this.meetTimer) clearTimeout(this.meetTimer);
    this.meetTimer = null;
    const c = this.chat;
    this.chat = null;
    this.aesKey = null;
    this.sendMsg = this.sendTyping = this.sendContact = this.sendBye = null;
    this.emit('stream', null);
    this.emit('typing', false);
    void c?.leave();
  }

  destroy() {
    void this.stop();
    this.handlers.clear();
  }
}

/** Short code both sides can compare to rule out a man-in-the-middle. */
async function safetyCode(a: string, b: string): Promise<string> {
  const [x, y] = [a, b].sort();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x + y) as BufferSource));
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) {
    const n = ((digest[i * 2] << 8) | digest[i * 2 + 1]) % 100000;
    groups.push(n.toString().padStart(5, '0'));
  }
  return groups.join(' ');
}

// ── Local block list (never leaves the device) ────────────────────────────────

const BLOCK_KEY = 'dmessage:stranger:blocked';

export function loadBlocked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(BLOCK_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function blockUser(userId: string) {
  const s = loadBlocked();
  s.add(userId);
  try {
    localStorage.setItem(BLOCK_KEY, JSON.stringify(Array.from(s).slice(-500)));
  } catch {
    /* ignore */
  }
}
