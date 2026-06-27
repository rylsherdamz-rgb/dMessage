'use client';

import Link from 'next/link';
import { WalletConnector } from '@/components/wallet/WalletConnector';

export function Nav() {
  return (
    <nav className="flex items-center justify-between border-b-3 border-[var(--border)] px-8 py-5">
      <Link href="/" className="group flex items-center gap-3">
        <div className="h-5 w-5 bg-[var(--accent)]" />
        <span className="font-mono text-lg font-black tracking-tight">dMessage</span>
      </Link>
      <div className="flex items-center gap-6">
        <Link
          href="/dashboard"
          className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
        >
          Dashboard
        </Link>
        <WalletConnector />
      </div>
    </nav>
  );
}
