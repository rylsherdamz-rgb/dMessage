'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'dmessage:archived';

/**
 * Client-side conversation archiving. The Soroban contracts don't model an
 * "archived" state, so this is intentionally local-only (per browser/device).
 */
export function useArchive() {
  const [archived, setArchived] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setArchived(JSON.parse(raw));
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((next: string[]) => {
    setArchived(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const isArchived = useCallback(
    (id: string) => archived.includes(id),
    [archived],
  );

  const toggle = useCallback(
    (id: string) => {
      setArchived((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  return { archived, isArchived, toggle, persist };
}
