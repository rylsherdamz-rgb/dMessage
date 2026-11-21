'use client';

import Link from 'next/link';
import { ArrowRight, Cpu, Radio, Shuffle, type LucideIcon } from 'lucide-react';
import { Reveal } from './Reveal';

const POINTS: { title: string; body: string; Icon: LucideIcon; accent: string }[] = [
  {
    title: 'Random, peer-to-peer',
    body: 'Get matched with a random person instantly. Matchmaking and chat run browser-to-browser over WebRTC — public Nostr relays only pass encrypted handshakes. No dMessage server exists to log anything.',
    Icon: Shuffle,
    accent: 'var(--accent)',
  },
  {
    title: 'AI moderation that never sees your data',
    body: 'A toxicity model runs inside your browser. It hides abusive messages, warns before you overshare personal info, and auto-skips repeat abusers — without a single word leaving your device.',
    Icon: Cpu,
    accent: 'var(--cyan)',
  },
  {
    title: 'Ephemeral by design',
    body: 'Each chat uses fresh ECDH keys, a safety code you can compare, and nothing is stored. Liked the conversation? Swap dMessage addresses and continue in your encrypted inbox.',
    Icon: Radio,
    accent: 'var(--violet)',
  },
];

export function StrangerMode() {
  return (
    <section id="stranger" className="relative mx-auto w-full max-w-6xl px-6 py-24">
      <Reveal>
        <div className="flex items-center gap-3">
          <span className="status-dot bg-[var(--cyan)] text-[var(--cyan)]" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Stranger mode
          </span>
        </div>
        <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight">
          Talk to anyone.
          <br />
          <span className="text-stroke-accent">Trust no server.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <Reveal key={p.title} delay={i * 0.08}>
            <article className="brutal h-full bg-[var(--bg-surface)] p-6">
              <p.Icon className="h-6 w-6" style={{ color: p.accent }} strokeWidth={2} aria-hidden />
              <h3 className="mt-5 font-mono text-base font-black tracking-tight">{p.title}</h3>
              <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">{p.body}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.2}>
        <Link
          href="/stranger"
          className="brutal mt-10 inline-flex items-center gap-2 bg-[var(--accent)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-black hover:bg-[var(--accent-dim)]"
        >
          Start a random chat
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        </Link>
      </Reveal>
    </section>
  );
}
