'use client';

import { Reveal } from './Reveal';

type Contract = {
  name: string;
  role: string;
  body: string;
  methods: string[];
  accent: string;
};

const CONTRACTS: Contract[] = [
  {
    name: 'UserRegistry',
    role: 'Identity',
    body: 'Stores user profiles: usernames, X25519 encryption public keys, and IPFS metadata links.',
    methods: ['register_user()', 'get_user()'],
    accent: 'var(--accent)',
  },
  {
    name: 'SocialGraph',
    role: 'Conversations',
    body: 'Derives deterministic conversation IDs (SHA-256 of sorted addresses) and tracks per-user threads.',
    methods: ['ensure_conversation()', 'get_user_conversations()'],
    accent: 'var(--cyan)',
  },
  {
    name: 'MessageContract',
    role: 'Messages',
    body: 'Anchors ordered message hashes per conversation with cheap, paginated retrieval.',
    methods: ['send_message()', 'get_messages()'],
    accent: 'var(--violet)',
  },
];

export function Contracts() {
  return (
    <section id="contracts" className="relative mx-auto w-full max-w-6xl px-6 py-28">
      <Reveal>
        <div className="flex items-center gap-3">
          <span className="status-dot bg-[var(--violet)] text-[var(--violet)]" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
            On-chain
          </span>
        </div>
        <h2 className="mt-5 max-w-2xl font-mono text-[var(--text-2xl)] font-black leading-[0.95] tracking-tight">
          Three contracts.
          <br />
          <span className="text-stroke-accent">Zero middlemen.</span>
        </h2>
        <p className="mt-5 max-w-xl font-mono text-xs leading-relaxed text-[var(--text-muted)]">
          The entire protocol runs on three interlocking Soroban smart contracts,
          deployed to the Stellar network and auditable by anyone.
        </p>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {CONTRACTS.map((c, i) => (
          <Reveal key={c.name} delay={i * 0.1}>
            <article className="brutal flex h-full flex-col bg-[var(--bg-surface)]">
              {/* Window chrome bar */}
              <div className="flex items-center justify-between border-b-2 border-[var(--border-strong)] px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber)]" />
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.accent }}
                  />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  {c.role}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3
                  className="font-mono text-lg font-black tracking-tight"
                  style={{ color: c.accent }}
                >
                  {c.name}
                </h3>
                <p className="mt-3 flex-1 font-mono text-xs leading-relaxed text-[var(--text-muted)]">
                  {c.body}
                </p>

                <div className="mt-6 flex flex-col gap-2">
                  {c.methods.map((m) => (
                    <code
                      key={m}
                      className="border border-[var(--border)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-[11px] text-[var(--text)]"
                    >
                      <span className="text-[var(--text-faint)]">fn </span>
                      {m}
                    </code>
                  ))}
                </div>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
