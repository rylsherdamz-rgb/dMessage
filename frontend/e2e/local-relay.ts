// Minimal in-memory NIP-01 Nostr relay so Stranger Mode can be tested end to
// end without public relays. Used by e2e/global-setup.ts.
import { WebSocketServer, type WebSocket } from 'ws';

type NostrEvent = { id: string; pubkey: string; kind: number; created_at: number; tags: string[][] };
type Filter = Record<string, unknown> & {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
};

const matches = (ev: NostrEvent, f: Filter) =>
  (!f.ids || f.ids.includes(ev.id)) &&
  (!f.authors || f.authors.includes(ev.pubkey)) &&
  (!f.kinds || f.kinds.includes(ev.kind)) &&
  (!f.since || ev.created_at >= f.since) &&
  (!f.until || ev.created_at <= f.until) &&
  Object.keys(f)
    .filter((k) => k.startsWith('#'))
    .every((k) => ev.tags.some((t) => t[0] === k.slice(1) && (f[k] as string[]).includes(t[1])));

export function startLocalRelay(port = 7777) {
  const wss = new WebSocketServer({ port });
  const events: NostrEvent[] = [];
  const subs = new Map<WebSocket, Map<string, Filter[]>>();

  wss.on('connection', (ws) => {
    subs.set(ws, new Map());
    ws.on('message', (raw) => {
      let m: unknown[];
      try {
        m = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (m[0] === 'EVENT') {
        const ev = m[1] as NostrEvent;
        events.push(ev);
        if (events.length > 5000) events.shift();
        ws.send(JSON.stringify(['OK', ev.id, true, '']));
        for (const [client, s] of subs)
          for (const [id, fs] of s)
            if (fs.some((f) => matches(ev, f)) && client.readyState === 1)
              client.send(JSON.stringify(['EVENT', id, ev]));
      } else if (m[0] === 'REQ') {
        const [, id, ...fs] = m as [string, string, ...Filter[]];
        subs.get(ws)?.set(id, fs);
        for (const ev of events) if (fs.some((f) => matches(ev, f))) ws.send(JSON.stringify(['EVENT', id, ev]));
        ws.send(JSON.stringify(['EOSE', id]));
      } else if (m[0] === 'CLOSE') {
        subs.get(ws)?.delete(m[1] as string);
      }
    });
    ws.on('close', () => subs.delete(ws));
  });

  return () => new Promise<void>((resolve) => wss.close(() => resolve()));
}
