'use client';

import { Wallet } from 'lucide-react';
import { WalletConnector } from '@/components/wallet/WalletConnector';

export function ConnectGate({ message }: { message?: string }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24">
      <div className="brutal flex h-14 w-14 items-center justify-center bg-[var(--bg-surface)]">
        <Wallet className="h-6 w-6 text-[var(--accent)]" strokeWidth={2} aria-hidden />
      </div>
      <div className="text-center">
        <h1 className="font-mono text-xl font-black tracking-tight">Connect Wallet</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
          {message ?? 'Authenticate to continue'}
        </p>
      </div>
      <WalletConnector />
    </section>
  );
}
