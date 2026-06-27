'use client';

import { Reveal } from './Reveal';
import { ArrowRight } from 'lucide-react';

type Step = {
  no: string;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    no: '01',
    title: 'Connect',
    body: 'Link your Stellar wallet. Your address becomes your identity — no signup, no server-side account.',
  },
  {
    no: '02',
    title: 'Register',
    body: 'Publish your X25519 public key to the UserRegistry contract so others can encrypt messages to you.',
  },
  {
    no: '03',
    title: 'Encrypt',
    body: 'Messages are sealed in your browser with a shared secret derived via ECDH, then pinned to IPFS.',
  },
  {
    no: '04',
    title: 'Anchor',
    body: 'The content hash is written to Soroban, ordered within your conversation. Tamper-evident, forever.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      className="relative w-full border-y-2 border-[var(--border-strong)] bg-[var(--bg-inset)] bg-noise"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-28">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="status-dot bg-[var(--cyan)] text-[var(--cyan)]" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              How it works
            </span>
          </div>
          <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight">
            Four steps from
            <br />
            wallet to whisper.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--border-strong)] md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.no} delay={i * 0.08}>
              <div className="group relative h-full bg-[var(--bg-surface)] p-7 transition-colors hover:bg-[var(--bg-elevated)]">
                <span className="font-mono text-5xl font-black leading-none text-[var(--border-strong)] transition-colors group-hover:text-[var(--accent)]">
                  {s.no}
                </span>
                <h3 className="mt-6 font-mono text-lg font-black tracking-tight text-white">
                  {s.title}
                </h3>
                <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                  {s.body}
                </p>
                {i < STEPS.length - 1 && (
                  <ArrowRight
                    aria-hidden
                    className="absolute right-4 top-7 hidden text-[var(--accent)] lg:block"
                    strokeWidth={2}
                  />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
