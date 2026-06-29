'use client';

import { MessagesSquare, QrCode, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Nav } from '@/components/layout/Nav';
import { ChatShell } from '@/components/chat/ChatShell';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { useWallet } from '@/components/wallet/WalletProvider';

export default function DashboardPage() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to start messaging" />
      </div>
    );
  }

  return (
    <ChatShell>
      <div className="bg-grid flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10 text-center">
        <div className="brutal flex h-16 w-16 items-center justify-center bg-[var(--bg-surface)]">
          <MessagesSquare className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h1 className="font-mono text-xl font-black tracking-tight text-white">
            Welcome to dMessage
          </h1>
          <p className="mt-2 max-w-xs font-mono text-xs leading-relaxed text-[var(--text-muted)]">
            All messages are end-to-end encrypted. No servers, no surveillance.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/settings"
            className="brutal-accent flex items-center gap-3 bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)]"
          >
            <QrCode className="h-4 w-4" strokeWidth={2} />
            Share your QR code
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <p className="font-mono text-[10px] text-[var(--text-faint)]">
            or paste a Stellar address in the sidebar (+ button) to start chatting
          </p>
        </div>
      </div>
    </ChatShell>
  );
}
