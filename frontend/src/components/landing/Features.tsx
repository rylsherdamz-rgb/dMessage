'use client';

import { Reveal } from './Reveal';

type Feature = {
  no: string;
  title: string;
  body: string;
  glyph: string;
  accent: string;
};

const FEATURES: Feature[] = [
  {
    no: '01',
    title: 'End-to-End Encrypted',
    body: 'X25519 ECDH key exchange with AES-GCM-256. Messages are sealed client-side — only you and the recipient hold the keys.',
    glyph: '🔒',
    accent: 'var(--accent)',
  },
  {
    no: '02',
    title: 'Wallet Identity',
    body: 'No emails, no passwords. Your Stellar wallet is your identity. Connect Freighter, Albedo, or any Wallet Kit signer.',
    glyph: '🔑',
    accent: 'var(--cyan)',
  },
  {
    no: '03',
    title: 'Decentralized Storage',
    body: 'Encrypted blobs live on IPFS, message hashes and metadata on-chain. No central server to seize, censor, or shut down.',
    glyph: '🌐',
    accent: 'var(--violet)',
  },
  {
    no: '04',
    title: 'On-Chain Integrity',
    body: 'Every message hash is anchored to Soroban. Tamper-evident, ordered, and verifiable without trusting any intermediary.',
    glyph: '⛓',
    accent: 'var(--amber)',
  },
  {
    no: '05',
    title: 'Low Gas Costs',
    body: 'A read-heavy storage pattern keeps writes cheap. Only hashes hit the chain — the heavy payload stays off-chain.',
    glyph: '⚡',
    accent: 'var(--accent)',
  },
  {
    no: '06',
    title: 'Fully Open Source',
    body: 'Auditable contracts and frontend, end to end. Verify the cryptography yourself — trust the code, not a company.',
    glyph: '◇',
    accent: 'var(--cyan)',
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-6xl px-6 py-28">
      <Reveal>
        <div className="flex items-center gap-3">
          <span className="status-dot bg-[var(--accent)] text-[var(--accent)]" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            Why dMessage
          </span>
        </div>
        <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight">
          Private by default.
          <br />
          <span className="text-stroke-accent">Yours by design.</span>
        </h2>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.no} delay={(i % 3) * 0.08}>
            <article className="brutal group h-full bg-[var(--bg-surface)] p-6">
              <div className="flex items-start justify-between">
                <span
                  className="text-2xl leading-none transition-transform duration-300 group-hover:-translate-y-0.5"
                  aria-hidden
                >
                  {f.glyph}
                </span>
                <span
                  className="font-mono text-xs font-black tracking-widest"
                  style={{ color: f.accent }}
                >
                  {f.no}
                </span>
              </div>
              <h3 className="mt-6 font-mono text-base font-black tracking-tight text-white">
                {f.title}
              </h3>
              <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                {f.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
