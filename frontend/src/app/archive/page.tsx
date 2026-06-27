'use client';

import Link from 'next/link';
import { ArchiveRestore, Inbox } from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useConversations } from '@/hooks/useConversations';
import { useArchive } from '@/hooks/useArchive';
import { useProfile } from '@/hooks/useProfile';

export default function ArchivePage() {
  const { isConnected } = useWallet();
  const { data: conversations, isLoading } = useConversations();
  const { isArchived, restore } = useArchive();

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to view your archive" />
      </div>
    );
  }

  const archivedConvs = (conversations ?? []).filter((c) => isArchived(c.peerAddress));

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
            <ArchivedRow
              key={conv.conversationId}
              peerAddress={conv.peerAddress}
              onRestore={() => restore(conv.peerAddress)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function ArchivedRow({
  peerAddress,
  onRestore,
}: {
  peerAddress: string;
  onRestore: () => void;
}) {
  const { data: profile } = useProfile(peerAddress);

  return (
    <div className="group flex items-center justify-between border-2 border-[var(--border)] bg-[var(--bg-surface)] px-5 py-4">
      <Link
        href={`/conversation/${peerAddress}`}
        className="flex items-center gap-3 font-mono text-sm font-bold tracking-tight transition-colors hover:text-[var(--accent)]"
      >
        <Avatar seed={peerAddress} size={36} />
        {profile?.username ? (
          <span>@{profile.username}</span>
        ) : (
          <>
            {peerAddress.slice(0, 8)}…
            <span className="text-[var(--text-muted)]">{peerAddress.slice(-6)}</span>
          </>
        )}
      </Link>
      <button
        onClick={onRestore}
        className="flex items-center gap-2 border-2 border-[var(--border)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        Restore
      </button>
    </div>
  );
}
