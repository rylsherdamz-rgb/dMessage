'use client';

import Link from 'next/link';

const LINKS = [
  {
    heading: 'Protocol',
    items: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Contracts', href: '#contracts' },
    ],
  },
  {
    heading: 'App',
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Connect Wallet', href: '/dashboard' },
    ],
  },
  {
    heading: 'Source',
    items: [
      { label: 'GitHub', href: 'https://github.com/rylsherdamz-rgb/dMessage' },
      { label: 'Stellar Expert', href: 'https://stellar.expert/explorer/testnet' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative w-full border-t-2 border-[var(--border-strong)] bg-[var(--bg-inset)]">
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bg-[var(--accent)]" />
              <span className="font-mono text-lg font-black tracking-tight text-white">
                dMessage
              </span>
            </div>
            <p className="mt-4 max-w-xs font-mono text-xs leading-relaxed text-[var(--text-muted)]">
              Decentralized, end-to-end encrypted messaging on Stellar Soroban.
            </p>
          </div>

          {LINKS.map((col) => (
            <div key={col.heading}>
              <h4 className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--text-faint)]">
                {col.heading}
              </h4>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="font-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider my-10" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
            © {new Date().getFullYear()} dMessage · MIT License
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
            Built with ☯ on Stellar Soroban
          </p>
        </div>
      </div>
    </footer>
  );
}
