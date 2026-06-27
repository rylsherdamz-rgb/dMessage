'use client';

import { Asterisk } from 'lucide-react';

/**
 * Infinite horizontal ticker. Renders the item set twice so the
 * `marquee` keyframe (translateX 0 -> -50%) loops seamlessly.
 */
const ITEMS = [
  'END-TO-END ENCRYPTED',
  'STELLAR SOROBAN',
  'ON-CHAIN STORAGE',
  'CENSORSHIP-RESISTANT',
  'X25519 · AES-GCM-256',
  'YOU OWN YOUR KEYS',
  'NO MIDDLEMEN',
  'OPEN SOURCE',
];

export function Marquee() {
  return (
    <div className="relative flex overflow-hidden border-y-2 border-[var(--border-strong)] bg-[var(--accent)] py-3 text-black">
      <div className="flex shrink-0 animate-marquee whitespace-nowrap will-change-transform">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            className="mx-6 flex items-center gap-6 font-mono text-xs font-black uppercase tracking-[0.2em]"
          >
            {item}
            <Asterisk className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
