'use client';

import { Reveal } from './Reveal';
import {
  Lock,
  Globe,
  ShieldCheck,
  Users,
  Code2,
  Orbit,
} from 'lucide-react';

/* ─── Mission pillars ─────────────────────────────────────────────────────── */
const PILLARS = [
  {
    no: '01',
    Icon: Lock,
    accent: 'var(--accent)',
    title: 'Privacy is a right, not a feature',
    body: 'Big tech treats your private conversations as free training data. Every message you send on a centralised platform is scraped, analysed, and monetised — without your consent. dMessage was built to end that.',
  },
  {
    no: '02',
    Icon: Globe,
    accent: 'var(--cyan)',
    title: 'Decentralised by design',
    body: 'There is no dMessage server that can be subpoenaed, breached, or shut down. Encrypted message content lives on IPFS; only cryptographic hashes and metadata touch the Stellar Soroban blockchain, which no single entity controls.',
  },
  {
    no: '03',
    Icon: ShieldCheck,
    accent: 'var(--violet)',
    title: 'Military-grade encryption',
    body: 'Messages are sealed on your device using X25519 ECDH key exchange combined with AES-GCM-256 — the same standards relied on by security professionals worldwide. Your private keys never leave your browser.',
  },
  {
    no: '04',
    Icon: Users,
    accent: 'var(--amber)',
    title: 'Community-first',
    body: 'dMessage is open source and community-driven. Real users tested the platform and shaped every major feature — from dark mode and QR codes to read receipts and emoji reactions. Your feedback drives the roadmap.',
  },
  {
    no: '05',
    Icon: Code2,
    accent: 'var(--accent)',
    title: 'Fully auditable',
    body: 'Every line of smart-contract code and every cryptographic primitive is publicly available on GitHub. We invite independent review and operate a responsible-disclosure policy. Trust the code, not a company.',
  },
  {
    no: '06',
    Icon: Orbit,
    accent: 'var(--cyan)',
    title: 'Built on Stellar Soroban',
    body: 'Stellar offers fast finality, low transaction fees, and a thriving developer ecosystem. Soroban smart contracts give dMessage a programmable, uncensorable backbone that is easy to verify and extend.',
  },
];

/* ─── Timeline milestones ────────────────────────────────────────────────── */
const MILESTONES = [
  { year: '2024', label: 'Concept & first on-chain prototype on Stellar Testnet' },
  { year: 'Q1 2025', label: 'X25519 ECDH + AES-GCM-256 encryption pipeline shipped' },
  { year: 'Q2 2025', label: 'Gasless / fee-sponsored contracts deployed; real users onboarded' },
  { year: 'Q3 2025', label: 'Security audit completed; contracts hardened and redeployed' },
  { year: 'Q4 2025', label: 'Mainnet launch on Stellar · 20-user feedback round shipped' },
  { year: '2026+', label: 'Group chats, mobile app, DAO governance — see the roadmap' },
];

/* ─── Component ──────────────────────────────────────────────────────────── */
export function AboutUs() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="relative w-full border-b-2 border-[var(--border-strong)] bg-[var(--bg-inset)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 md:py-32">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="status-dot bg-[var(--accent)] text-[var(--accent)]" />
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                About dMessage
              </span>
            </div>
            <h1 className="mt-5 max-w-3xl font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight text-[var(--text)]">
              Escape the surveillance.
              <br />
              <span className="text-stroke-accent">Own your conversations.</span>
            </h1>
            <p className="mt-8 max-w-2xl font-mono text-sm leading-relaxed text-[var(--text-muted)]">
              dMessage is a decentralised, end-to-end encrypted messaging platform built on the
              Stellar blockchain. We exist so you can talk without being listened to, mined, traded,
              or fed into someone&apos;s AI training pipeline.
            </p>
            <p className="mt-4 max-w-2xl font-mono text-sm leading-relaxed text-[var(--text-muted)]">
              Your data is not their product. Your words are not their training set.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Mission pillars ── */}
      <section className="relative mx-auto w-full max-w-6xl px-6 py-24">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="status-dot bg-[var(--violet)] text-[var(--violet)]" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Our principles
            </span>
          </div>
          <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-xl)] font-black leading-[0.95] tracking-tight text-[var(--text)]">
            What we stand for.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.no} delay={(i % 3) * 0.08}>
              <article className="brutal group h-full bg-[var(--bg-surface)] p-6">
                <div className="flex items-start justify-between">
                  <p.Icon
                    className="h-6 w-6 transition-transform duration-300 group-hover:-translate-y-0.5"
                    style={{ color: p.accent }}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <span
                    className="font-mono text-xs font-black tracking-widest"
                    style={{ color: p.accent }}
                  >
                    {p.no}
                  </span>
                </div>
                <h3 className="mt-6 font-mono text-base font-black tracking-tight text-[var(--text)]">
                  {p.title}
                </h3>
                <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                  {p.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Story / timeline ── */}
      <section className="relative w-full border-y-2 border-[var(--border-strong)] bg-[var(--bg-inset)]">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="status-dot bg-[var(--cyan)] text-[var(--cyan)]" />
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
                Our story
              </span>
            </div>
            <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-xl)] font-black leading-[0.95] tracking-tight text-[var(--text)]">
              Built in the open,
              <br />
              shipped to the world.
            </h2>
          </Reveal>

          <div className="mt-14 flex flex-col gap-px overflow-hidden border-2 border-[var(--border-strong)] bg-[var(--border-strong)]">
            {MILESTONES.map((m, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <div className="group flex flex-col gap-2 bg-[var(--bg-surface)] px-7 py-6 transition-colors hover:bg-[var(--bg-elevated)] sm:flex-row sm:items-center sm:gap-10">
                  <span className="w-24 shrink-0 font-mono text-xs font-black tracking-widest text-[var(--accent)]">
                    {m.year}
                  </span>
                  <span className="font-mono text-sm text-[var(--text-muted)]">{m.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision ── */}
      <section className="relative mx-auto w-full max-w-6xl px-6 py-24">
        <Reveal>
          <div className="flex items-center gap-3">
            <span className="status-dot bg-[var(--amber)] text-[var(--amber)]" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
              Our vision
            </span>
          </div>
          <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-xl)] font-black leading-[0.95] tracking-tight text-[var(--text)]">
            A world where privacy
            <br />
            is the default.
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {[
            {
              heading: 'Your identity is your wallet',
              body: 'No login tied to your real name, phone number, or email — just a cryptographic key pair you own.',
            },
            {
              heading: 'Messages are private by default',
              body: 'End-to-end encrypted before they leave your device. No one — not even us — can read them.',
            },
            {
              heading: 'Your data stays yours',
              body: 'No one can resell, train on, or monetise your conversations. Not today, not ever.',
            },
            {
              heading: 'Communication is uncensorable',
              body: 'No intermediary can decide who you are allowed to talk to or silence a conversation.',
            },
          ].map((item, i) => (
            <Reveal key={i} delay={i * 0.07}>
              <div className="brutal h-full bg-[var(--bg-surface)] p-6">
                <h3 className="font-mono text-sm font-black tracking-tight text-[var(--accent)]">
                  {item.heading}
                </h3>
                <p className="mt-3 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
