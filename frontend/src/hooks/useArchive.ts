'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dmessage:hidden-peers';

/**
 * Client-side "close / hide" state for conversations, keyed by the PEER's
 * Stellar address. The Soroban contracts don't model an archived/deleted
 * state (and on-chain messages can't be deleted), so hiding a conversation is
 * intentionally local-only (per browser/device) and fully reversible.
 *
 * Keyed by peer address (not conversationId) so a conversation can be closed
 * from anywhere — the sidebar, the archive list, or the open chat header —
 * all of which know the peer address.
 */
export function useArchive() {
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHidden(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const write = useCallback((next: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const isArchived = useCallback(
    (peer: string) => hidden.includes(peer),
    [hidden],
  );

  /** Hide (close) a conversation. */
  const hide = useCallback(
    (peer: string) => {
      setHidden((prev) => {
        if (prev.includes(peer)) return prev;
        const next = [...prev, peer];
        write(next);
        return next;
      });
    },
    [write],
  );

  /** Restore a previously hidden conversation. */
  const restore = useCallback(
    (peer: string) => {
      setHidden((prev) => {
        const next = prev.filter((x) => x !== peer);
        write(next);
        return next;
      });
    },
    [write],
  );

  /** Toggle hidden state for a conversation. */
  const toggle = useCallback(
    (peer: string) => {
      setHidden((prev) => {
        const next = prev.includes(peer)
          ? prev.filter((x) => x !== peer)
          : [...prev, peer];
        write(next);
        return next;
      });
    },
    [write],
  );

  /** Hide every conversation in the given list of peer addresses. */
  const hideAll = useCallback(
    (peers: string[]) => {
      setHidden((prev) => {
        const next = Array.from(new Set([...prev, ...peers]));
        write(next);
        return next;
      });
    },
    [write],
  );

  return { hidden, isArchived, hide, restore, toggle, hideAll };
}
