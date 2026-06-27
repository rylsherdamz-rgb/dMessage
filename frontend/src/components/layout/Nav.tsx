'use client';

import Link from 'next/link';
import { WalletConnector } from '@/components/wallet/WalletConnector';

export function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-white/10 px-6 py-4">
      <Link href="/" className="font-mono text-xl font-bold tracking-tight">
        dMessage
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-white"
        >
          Dashboard
        </Link>
        <WalletConnector />
      </div>
    </nav>
  );
}
