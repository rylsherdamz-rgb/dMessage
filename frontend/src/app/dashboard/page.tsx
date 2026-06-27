'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, MessageSquareText, Archive, MessagesSquare } from 'lucide-react';
import { Nav } from '@/components/layout/Nav';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Spinner } from '@/components/ui/Spinner';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useConversations } from '@/hooks/useConversations';
import { useArchive } from '@/hooks/useArchive';
import { CONTRACT_IDS } from '@/lib/stellar';
import { writeContract, arg } from '@/lib/soroban';

export default function DashboardPage() {
  const { isConnected, address, signTransaction } = useWallet();
  const { data: conversations, isLoading } = useConversations();
  const { isArchived, toggle } = useArchive();
  const [newPeer, setNewPeer] = useState('');
  const [creating, setCreating] = useState(false);

  const handleNewConversation = async () => {
    const peer = newPeer.trim();
    if (!peer || creating || !address || !CONTRACT_IDS.socialGraph) return;

    setCreating(true);
    try {
      // ensure_conversation(caller, user_a, user_b)
      await writeContract(
        CONTRACT_IDS.socialGraph,
        'ensure_conversation',
        [arg.address(address), arg.address(address), arg.address(peer)],
        address,
        signTransaction,
      );
      setNewPeer('');
    } catch (err) {
      console.error('[Dashboard] new conversation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to start messaging" />
      </div>
    );
  }

  const activeConvs = (conversations ?? []).filter(
    (c) => !isArchived(c.conversationId),
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        {/* New conversation */}
        <section className="brutal-static bg-[var(--bg-surface)] p-6">
          <h2 className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-[var(--accent)]">
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            New Conversation
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNewConversation();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              value={newPeer}
              onChange={(e) => setNewPeer(e.target.value)}
              placeholder="G… stellar address"
              className="brutal-input flex-1 bg-[var(--bg)] px-4 py-3 font-mono text-sm text-white"
            />
            <button
              type="submit"
              disabled={creating || !newPeer.trim()}
              className="brutal-accent bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)] disabled:opacity-30"
            >
              {creating ? '…' : 'Start'}
            </button>
          </form>
        </section>

        {/* Conversations */}
        <section className="brutal-static bg-[var(--bg-surface)] p-6">
          <h2 className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-[var(--accent)]">
            <MessagesSquare className="h-4 w-4" strokeWidth={2} aria-hidden />
            Conversations
          </h2>

          {isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}

          {!isLoading && activeConvs.length === 0 && (
            <p className="py-10 text-center font-mono text-xs text-[var(--text-muted)]">
              No conversations yet
            </p>
          )}

          <div className="flex flex-col gap-2">
            {activeConvs.map((conv) => (
              <div
                key={conv.conversationId}
                className="group flex items-center justify-between border-2 border-[var(--border)] bg-[var(--bg)] px-5 py-4 transition-colors hover:border-[var(--accent)]"
              >
                <Link
                  href={`/conversation/${conv.conversationId}`}
                  className="flex flex-1 items-center gap-3 font-mono text-sm font-bold tracking-tight"
                >
                  <MessageSquareText
                    className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  {conv.peerAddress.slice(0, 8)}…
                  <span className="text-[var(--text-muted)]">
                    {conv.peerAddress.slice(-6)}
                  </span>
                </Link>
                <div className="flex items-center gap-4">
                  <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)] sm:inline">
                    {new Date(conv.lastUpdated * 1000).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => toggle(conv.conversationId)}
                    aria-label="Archive conversation"
                    className="text-[var(--text-faint)] transition-colors hover:text-[var(--accent)]"
                  >
                    <Archive className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
