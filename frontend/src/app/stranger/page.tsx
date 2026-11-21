'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  Send,
  ShieldCheck,
  Shuffle,
  Square,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useModerationState } from '@/hooks/useModeration';
import {
  describeLabels,
  getMlPreference,
  getModerator,
  PII_TEXT,
  setMlPreference,
  type ModerationVerdict,
} from '@/lib/moderation';
import {
  blockUser,
  loadBlocked,
  normalizeInterests,
  StrangerSession,
  type EndReason,
  type StrangerMessage,
  type StrangerPhase,
} from '@/lib/stranger';

const AGE_KEY = 'dmessage:stranger:18plus';
const STRIKES_TO_AUTOSKIP = 3;

interface ChatLine extends StrangerMessage {
  verdict?: ModerationVerdict | null;
  revealed?: boolean;
  contact?: string;
}

interface PendingSend {
  text: string;
  reason: string;
  allowOverride: boolean;
}

const END_TEXT: Record<EndReason, string> = {
  'you-left': 'You disconnected.',
  'stranger-left': 'Stranger has disconnected.',
  timeout: 'Could not connect to that stranger.',
  'auto-moderation': 'Disconnected automatically: on-device AI flagged repeated abuse. The stranger was blocked on this device.',
  error: 'Connection error.',
};

export default function StrangerPage() {
  const { address } = useWallet();
  const modState = useModerationState();

  const [ageOk, setAgeOk] = useState(false);
  const [interestsRaw, setInterestsRaw] = useState('');
  const [videoOn, setVideoOn] = useState(false);
  const [mlOn, setMlOn] = useState(false);

  const [phase, setPhase] = useState<StrangerPhase>('idle');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [typing, setTyping] = useState(false);
  const [safety, setSafety] = useState('');
  const [lobbyCount, setLobbyCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteRevealed, setRemoteRevealed] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingSend | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmNext, setConfirmNext] = useState(false);
  const [hasLocalVideo, setHasLocalVideo] = useState(false);

  const session = useRef<StrangerSession | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const strikes = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore preferences on the client.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setAgeOk(localStorage.getItem(AGE_KEY) === '1');
    } catch {
      /* ignore */
    }
    setMlOn(getMlPreference());
    getModerator();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines, typing]);

  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
  }, [remoteStream]);

  // The local preview element only exists on the chat screen.
  useEffect(() => {
    if (localVideo.current && localVideo.current.srcObject !== localStream.current) {
      localVideo.current.srcObject = localStream.current;
    }
  }, [phase, remoteStream]);

  useEffect(
    () => () => {
      session.current?.destroy();
      localStream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const addLine = useCallback((line: ChatLine) => setLines((prev) => [...prev, line]), []);
  const patchLine = useCallback(
    (id: string, patch: Partial<ChatLine>) =>
      setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l))),
    [],
  );

  const autoModerate = useCallback(() => {
    const s = session.current;
    if (!s?.strangerUserId) return;
    blockUser(s.strangerUserId);
    void s.stop('auto-moderation');
  }, []);

  const handleIncoming = useCallback(
    async (m: StrangerMessage) => {
      if (m.from !== 'stranger') {
        addLine(m);
        return;
      }
      // Hold the message until the local verdict arrives (usually a few ms).
      addLine({ ...m, verdict: null });
      const verdict = (await getModerator()?.classify(m.text)) ?? null;
      patchLine(m.id, { verdict: verdict ?? { action: 'allow', severe: false, labels: [], pii: [] } });
      if (verdict?.severe) {
        strikes.current += 1;
        if (strikes.current >= STRIKES_TO_AUTOSKIP) autoModerate();
      }
    },
    [addLine, patchLine, autoModerate],
  );

  const start = useCallback(async () => {
    setError(null);
    setLines([]);
    setSafety('');
    strikes.current = 0;
    setRemoteRevealed(false);

    if (videoOn && !localStream.current) {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasLocalVideo(true);
      } catch {
        setError('Camera/mic permission denied — continuing with text only.');
      }
    }

    const s = new StrangerSession(
      normalizeInterests(interestsRaw),
      localStream.current,
      (uid) => loadBlocked().has(uid),
    );
    session.current?.destroy();
    session.current = s;

    s.on('phase', (p) => {
      setPhase(p);
      if (p === 'searching') {
        setLines([]);
        setSafety('');
        strikes.current = 0;
        setRemoteRevealed(false);
      }
    });
    s.on('message', (m) => void handleIncoming(m));
    s.on('typing', setTyping);
    s.on('safetyCode', setSafety);
    s.on('lobby', setLobbyCount);
    s.on('error', setError);
    s.on('stream', setRemoteStream);
    s.on('contact', (addr) =>
      addLine({
        id: `c-${addr}`,
        from: 'system',
        text: 'The stranger shared their dMessage address.',
        at: Date.now(),
        contact: addr,
      }),
    );
    s.on('ended', (r) =>
      addLine({ id: `end-${Date.now()}`, from: 'system', text: END_TEXT[r], at: Date.now() }),
    );
    await s.start();
  }, [videoOn, interestsRaw, handleIncoming, addLine]);

  const stopAll = useCallback(async () => {
    await session.current?.stop();
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    setHasLocalVideo(false);
    setPhase('idle');
    setConfirmNext(false);
  }, []);

  const next = useCallback(async () => {
    setConfirmNext(false);
    const s = session.current;
    if (!s) return start();
    if (s.phase === 'ended' || s.phase === 'idle') return s.start();
    await s.next();
  }, [start]);

  const blockAndNext = useCallback(async () => {
    const uid = session.current?.strangerUserId;
    if (uid) blockUser(uid);
    await next();
  }, [next]);

  const reallySend = useCallback(async (text: string) => {
    const ok = await session.current?.send(text);
    if (ok) setInput('');
    setPending(null);
  }, []);

  // Outgoing: check locally BEFORE anything is sent.
  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text || phase !== 'chatting') return;
    setChecking(true);
    const v = await getModerator()?.classify(text);
    setChecking(false);
    session.current?.setTyping(false);
    if (v?.action === 'block') {
      setPending({
        text,
        reason: `On-device AI held this message (${describeLabels(v.labels)}). Please rephrase.`,
        allowOverride: false,
      });
      return;
    }
    if (v?.pii.length) {
      setPending({
        text,
        reason: `You're about to share ${v.pii.map((p) => PII_TEXT[p] ?? p).join(' and ')} with a stranger.`,
        allowOverride: true,
      });
      return;
    }
    if (v?.action === 'warn') {
      setPending({
        text,
        reason: `This may come across as ${describeLabels(v.labels)}.`,
        allowOverride: true,
      });
      return;
    }
    await reallySend(text);
  }, [input, phase, reallySend]);

  const onInputChange = (v: string) => {
    setInput(v);
    setPending(null);
    session.current?.setTyping(v.length > 0);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => session.current?.setTyping(false), 3000);
  };

  // Esc → next (press twice while chatting, like the classic).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || phase === 'idle') return;
      if (phase === 'chatting' && !confirmNext) setConfirmNext(true);
      else void next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, confirmNext, next]);

  // ── Setup screen ───────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <main id="main-content" className="bg-grid flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
          <div className="brutal w-full max-w-lg bg-[var(--bg-surface)] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Shuffle className="h-6 w-6 text-[var(--accent)]" strokeWidth={2} aria-hidden />
              <h1 className="font-mono text-xl font-black tracking-tight">Talk to a stranger</h1>
            </div>
            <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
              Get matched with a random person, peer-to-peer. No servers, no accounts, no logs. Chats are
              end-to-end encrypted and vanish when you leave. Safety checks run on your device — your
              messages are never sent anywhere to be moderated.
            </p>

            <label className="mt-6 block font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              Interests (optional)
            </label>
            <input
              value={interestsRaw}
              onChange={(e) => setInterestsRaw(e.target.value)}
              placeholder="music, stellar, anime"
              className="mt-2 w-full border-2 border-[var(--border-strong)] bg-[var(--bg-inset)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[var(--accent)]"
            />
            <p className="mt-1.5 font-mono text-[10px] text-[var(--text-faint)]">
              We try people with shared interests first, then anyone.
            </p>

            <div className="mt-6 space-y-3">
              <Toggle
                checked={videoOn}
                onChange={setVideoOn}
                icon={<Video className="h-4 w-4" aria-hidden />}
                label="Video chat"
                hint="Stranger video starts blurred until you choose to reveal it."
              />
              <Toggle
                checked={mlOn}
                onChange={(v) => {
                  setMlOn(v);
                  setMlPreference(v);
                }}
                icon={<Cpu className="h-4 w-4" aria-hidden />}
                label="On-device AI moderation"
                hint={
                  mlOn
                    ? modelHint(modState.status, modState.progress)
                    : 'Off: only instant built-in safety rules run. Turn on for full AI toxicity detection (~110 MB one-time download, cached).'
                }
              />
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 font-mono text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={ageOk}
                onChange={(e) => {
                  setAgeOk(e.target.checked);
                  try {
                    localStorage.setItem(AGE_KEY, e.target.checked ? '1' : '0');
                  } catch {
                    /* ignore */
                  }
                }}
                className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
              />
              <span>
                I am 18 or older and I&apos;ll be respectful. Never share personal info with strangers.
              </span>
            </label>

            {error && <p className="mt-4 font-mono text-xs text-[var(--danger)]">{error}</p>}

            <button
              disabled={!ageOk}
              onClick={() => void start()}
              className="brutal mt-6 flex w-full items-center justify-center gap-2 bg-[var(--accent)] px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-black transition-colors hover:bg-[var(--accent-dim)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Shuffle className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Start
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Chat screen ────────────────────────────────────────────────────────────
  const showVideo = videoOn && (remoteStream || hasLocalVideo);

  return (
    <div className="flex h-screen flex-col">
      <Nav />
      <main id="main-content" className="flex min-h-0 flex-1 flex-col md:flex-row">
        {showVideo && (
          <section className="flex shrink-0 flex-row gap-2 border-b-2 border-[var(--border-strong)] bg-[var(--bg-inset)] p-2 md:w-[42%] md:flex-col md:border-b-0 md:border-r-2">
            <div className="relative aspect-video flex-1 overflow-hidden bg-black">
              {remoteStream ? (
                <>
                  <video
                    ref={remoteVideo}
                    autoPlay
                    playsInline
                    className={`h-full w-full object-cover transition-[filter] ${remoteRevealed ? '' : 'blur-2xl'}`}
                  />
                  <button
                    onClick={() => setRemoteRevealed((r) => !r)}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white"
                  >
                    {remoteRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {remoteRevealed ? 'Blur' : 'Reveal stranger'}
                  </button>
                </>
              ) : (
                <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">
                  No stranger video
                </div>
              )}
            </div>
            <div className="relative aspect-video w-1/3 overflow-hidden bg-black md:w-full md:flex-1">
              <video ref={localVideo} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" />
              <span className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 font-mono text-[10px] uppercase text-white">
                You
              </span>
            </div>
          </section>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Status bar */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em]">
            <StatusPill phase={phase} lobby={lobbyCount} />
            {safety && (
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]" title="Compare this code with the stranger to confirm nobody is in the middle.">
                <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden />
                E2EE · {safety}
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5 text-[var(--text-faint)]">
              <Cpu className="h-3.5 w-3.5" aria-hidden />
              {modState.status === 'ready' ? 'AI moderation · on-device' : modState.status === 'loading' ? `AI loading ${Math.round(modState.progress * 100)}%` : 'Safety rules · on-device'}
            </span>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
            {(phase === 'searching' || phase === 'connecting') && (
              <div className="m-auto flex flex-col items-center gap-3 text-center font-mono text-xs text-[var(--text-muted)]">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" aria-hidden />
                {phase === 'searching' ? 'Looking for someone to chat with…' : 'Connecting peer-to-peer…'}
                {error && <span className="text-[var(--danger)]">{error}</span>}
              </div>
            )}
            {lines.map((l) => (
              <Line key={l.id} line={l} onReveal={() => patchLine(l.id, { revealed: true })} />
            ))}
            {typing && phase === 'chatting' && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-faint)]">Stranger is typing…</p>
            )}
          </div>

          {/* Outgoing moderation prompt */}
          {pending && (
            <div className="flex flex-wrap items-center gap-3 border-t-2 border-[var(--amber)] bg-[var(--bg-elevated)] px-4 py-2.5 font-mono text-xs">
              <span className="flex-1 text-[var(--amber)]">{pending.reason}</span>
              {pending.allowOverride && (
                <button onClick={() => void reallySend(pending.text)} className="border-2 border-[var(--amber)] px-3 py-1 font-bold uppercase text-[var(--amber)]">
                  Send anyway
                </button>
              )}
              <button onClick={() => setPending(null)} aria-label="Dismiss" className="text-[var(--text-muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-end gap-2 border-t-2 border-[var(--border-strong)] bg-[var(--bg-surface)] p-3">
            <div className="flex flex-col gap-2">
              <button
                onClick={() => (phase === 'chatting' && !confirmNext ? setConfirmNext(true) : void next())}
                className="brutal flex items-center gap-1.5 bg-[var(--bg)] px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
                title="Esc"
              >
                <Shuffle className="h-4 w-4" aria-hidden />
                {phase === 'chatting' ? (confirmNext ? 'Sure?' : 'Next') : phase === 'ended' ? 'New' : 'Skip'}
              </button>
              <button
                onClick={() => void stopAll()}
                className="flex items-center justify-center gap-1.5 border-2 border-[var(--border-strong)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <Square className="h-3 w-3" aria-hidden /> Stop
              </button>
            </div>

            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              disabled={phase !== 'chatting'}
              placeholder={phase === 'chatting' ? 'Type a message…' : '…'}
              rows={2}
              className="min-h-[3.25rem] flex-1 resize-none border-2 border-[var(--border-strong)] bg-[var(--bg-inset)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
            />

            <div className="flex flex-col gap-2">
              <button
                onClick={() => void submit()}
                disabled={phase !== 'chatting' || !input.trim() || checking}
                aria-label="Send"
                className="brutal-accent flex h-11 w-11 items-center justify-center bg-black text-[var(--accent)] disabled:opacity-40"
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
              <div className="flex gap-1">
                {address && (
                  <button
                    onClick={() => void session.current?.shareContact(address)}
                    disabled={phase !== 'chatting'}
                    title="Share your dMessage address to keep chatting privately"
                    aria-label="Share your dMessage address"
                    className="flex h-6 w-5 items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-30"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void blockAndNext()}
                  disabled={phase !== 'chatting' && phase !== 'ended'}
                  title="Block this stranger (on this device) and find someone new"
                  aria-label="Block and next"
                  className="flex h-6 w-5 items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] disabled:opacity-30"
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function modelHint(status: string, progress: number) {
  switch (status) {
    case 'loading':
      return `Downloading model to this device… ${Math.round(progress * 100)}% (one time, then cached)`;
    case 'ready':
      return 'Ready. Runs entirely in your browser — messages never leave your device.';
    case 'error':
      return 'Model failed to load; built-in safety rules are still active.';
    default:
      return 'Starting…';
  }
}

function Toggle({
  checked,
  onChange,
  icon,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 border-2 p-3 text-left transition-colors ${
        checked ? 'border-[var(--accent)]' : 'border-[var(--border)]'
      }`}
    >
      <span className={checked ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>{icon}</span>
      <span className="flex-1">
        <span className="block font-mono text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="mt-1 block font-mono text-[10px] leading-relaxed text-[var(--text-muted)]">{hint}</span>
      </span>
      <span
        className={`mt-0.5 h-4 w-7 shrink-0 border-2 p-px ${checked ? 'border-[var(--accent)]' : 'border-[var(--border-strong)]'}`}
      >
        <span className={`block h-full w-1/2 transition-transform ${checked ? 'translate-x-full bg-[var(--accent)]' : 'bg-[var(--text-faint)]'}`} />
      </span>
    </button>
  );
}

function StatusPill({ phase, lobby }: { phase: StrangerPhase; lobby: number }) {
  const map: Record<StrangerPhase, [string, string]> = {
    idle: ['Idle', 'var(--text-faint)'],
    searching: [`Searching · ${lobby} online`, 'var(--amber)'],
    connecting: ['Connecting', 'var(--cyan)'],
    chatting: ['Connected · P2P', 'var(--accent)'],
    ended: ['Disconnected', 'var(--danger)'],
  };
  const [text, color] = map[phase];
  return (
    <span className="flex items-center gap-1.5" style={{ color }}>
      <span className="h-2 w-2" style={{ background: color }} />
      {text}
    </span>
  );
}

function Line({ line, onReveal }: { line: ChatLine; onReveal: () => void }) {
  if (line.from === 'system') {
    return (
      <div className="self-center text-center font-mono text-[11px] text-[var(--text-muted)]">
        {line.text}
        {line.contact && (
          <Link
            href={`/conversation/${line.contact}`}
            className="mt-2 flex items-center justify-center gap-1.5 border-2 border-[var(--accent)] px-3 py-1.5 font-bold uppercase tracking-wider text-[var(--accent)]"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            Continue on dMessage
          </Link>
        )}
      </div>
    );
  }

  const own = line.from === 'me';
  const v = line.verdict;
  const pendingCheck = !own && v === null;
  const hidden = !own && v && v.action !== 'allow' && !line.revealed;

  return (
    <div className={`flex max-w-[85%] flex-col ${own ? 'self-end items-end' : 'self-start items-start'}`}>
      <span className="mb-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: own ? 'var(--cyan)' : 'var(--danger)' }}>
        {own ? 'You' : 'Stranger'}
      </span>
      {pendingCheck ? (
        <div className="border-2 border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--text-faint)]">
          <Loader2 className="inline h-3 w-3 animate-spin" aria-label="Checking on-device" />
        </div>
      ) : hidden ? (
        <button
          onClick={onReveal}
          className="flex items-center gap-2 border-2 border-dashed border-[var(--amber)] px-3 py-2 text-left font-mono text-xs text-[var(--amber)]"
        >
          <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Hidden by on-device AI ({describeLabels(v.labels)}). Tap to show.
        </button>
      ) : (
        <div
          className={`whitespace-pre-wrap break-words border-2 px-3 py-2 font-mono text-sm ${
            own ? 'border-[var(--cyan)] bg-[var(--bg-elevated)]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
          }`}
        >
          {line.text}
        </div>
      )}
    </div>
  );
}
