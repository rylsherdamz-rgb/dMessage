'use client';

import Link from 'next/link';
import { Reveal } from './Reveal';
import { WalletConnector } from '@/components/wallet/WalletConnector';

export function CTA() {
  return (
    <section className="relative w-full overflow-hidden px-6 py-32">
      {/* grid backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-60" />

      <Reveal className="relative mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-8 flex w-fit items-center gap-2 border-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-2">
          <span className="status-dot animate-pulse-glow bg-[var(--accent)] text-[var(--accent)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Live on Stellar Testnet
          </span>
        </div>

        <h2 className="font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight sm:text-[3.25rem]">
          Take back your
          <br />
          <span className="text-glow text-[var(--accent)]">conversations.</span>
        </h2>

        <p className="mx-auto mt-6 max-w-md font-mono text-sm leading-relaxed text-[var(--text-muted)]">
          No accounts. No servers. No surveillance. Just your wallet and the people
          you choose to talk to.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <WalletConnector />
          <Link
            href="/dashboard"
            className="brutal-static bg-[var(--bg-surface)] px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-white transition-colors hover:text-[var(--accent)]"
          >
            Open App →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
