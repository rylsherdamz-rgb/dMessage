'use client';

/** App id shared by every Stranger Mode room (Trystero namespace). */
export const STRANGER_APP_ID = 'dmessage.stranger.v1';

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

export function clearBlocked() {
  try {
    localStorage.removeItem(BLOCK_KEY);
  } catch {
    /* ignore */
  }
}
