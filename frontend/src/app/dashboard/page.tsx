'use client';

import { MessagesSquare } from 'lucide-react';
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
      <div className="bg-grid flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="brutal flex h-16 w-16 items-center justify-center bg-[var(--bg-surface)]">
          <MessagesSquare className="h-7 w-7 text-[var(--accent)]" strokeWidth={1.75} aria-hidden />
        </div>
        <div>
          <h1 className="font-mono text-xl font-black tracking-tight text-white">
            Select a conversation
          </h1>
          <p className="mt-2 max-w-xs font-mono text-xs leading-relaxed text-[var(--text-muted)]">
            Pick a chat from the left, or hit + to start a new encrypted thread with a Stellar address.
          </p>
        </div>
      </div>
    </ChatShell>
  );
}
