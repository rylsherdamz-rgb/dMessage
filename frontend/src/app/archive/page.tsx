'use client';

import Link from 'next/link';
import { ArchiveRestore, Inbox, MessageSquareText } from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Spinner } from '@/components/ui/Spinner';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useConversations } from '@/hooks/useConversations';
import { useArchive } from '@/hooks/useArchive';

export default function ArchivePage() {
  const { isConnected } = useWallet();
  const { data: conversations, isLoading } = useConversations();
  const { isArchived, toggle } = useArchive();

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to view your archive" />
      </div>
    );
  }

  const archivedConvs = (conversations ?? []).filter((c) => isArchived(c.conversationId));

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <header className="mb-8">
          <h1 className="font-mono text-2xl font-black tracking-tight">Archive</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
            Hidden conversations · stored locally on this device
          </p>
        </header>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        )}

        {!isLoading && archivedConvs.length === 0 && (
          <div className="brutal-static flex flex-col items-center gap-3 bg-[var(--bg-surface)] py-16">
            <Inbox className="h-8 w-8 text-[var(--text-faint)]" strokeWidth={1.5} aria-hidden />
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Nothing archived
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {archivedConvs.map((conv) => (
            <div
              key={conv.conversationId}
              className="group flex items-center justify-between border-2 border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4"
            >
              <Link
                href={`/conversation/${conv.conversationId}`}
                className="flex items-center gap-3 font-mono text-sm font-bold tracking-tight transition-colors hover:text-[var(--accent)]"
              >
                <MessageSquareText className="h-4 w-4 text-[var(--text-muted)]" strokeWidth={2} aria-hidden />
                {conv.peerAddress.slice(0, 8)}…
                <span className="text-[var(--text-muted)]">{conv.peerAddress.slice(-6)}</span>
              </Link>
              <button
                onClick={() => toggle(conv.conversationId)}
                className="flex items-center gap-2 border-2 border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Restore
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
