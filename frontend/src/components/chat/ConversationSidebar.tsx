'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useConversations } from '@/hooks/useConversations';
import { useProfile } from '@/hooks/useProfile';
import { useArchive } from '@/hooks/useArchive';
import { CONTRACT_IDS } from '@/lib/stellar';
import { writeContract, arg } from '@/lib/soroban';

export function ConversationSidebar({ activeId }: { activeId?: string }) {
  const { address, signTransaction } = useWallet();
  const { data: conversations, isLoading, refetch } = useConversations();
  const { isArchived, hide, hideAll } = useArchive();

  const [newPeer, setNewPeer] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const active = (conversations ?? []).filter((c) => !isArchived(c.peerAddress));

  const handleCreate = async () => {
    const peer = newPeer.trim();
    if (!peer || creating || !address || !CONTRACT_IDS.socialGraph) return;
    setCreating(true);
    try {
      await writeContract(
        CONTRACT_IDS.socialGraph,
        'ensure_conversation',
        [arg.address(address), arg.address(address), arg.address(peer)],
        address,
        signTransaction,
      );
      setNewPeer('');
      setShowNew(false);
      await refetch();
    } catch (err) {
      console.error('[Sidebar] new conversation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between border-b-2 border-[var(--border-strong)] px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="status-dot bg-[var(--accent)] text-[var(--accent)]" />
          <h2 className="font-mono text-xs font-black uppercase tracking-[0.2em] text-white">
            Messages
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {active.length > 0 && (
            <button
              onClick={() => hideAll(active.map((c) => c.peerAddress))}
              title="Close all conversations"
              className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
            >
              Close all
            </button>
          )}
          <button
            onClick={() => setShowNew((s) => !s)}
            aria-label="New conversation"
            className="brutal flex h-8 w-8 items-center justify-center bg-[var(--accent)] text-black"
          >
            {showNew ? <X className="h-4 w-4" strokeWidth={2.5} /> : <Plus className="h-4 w-4" strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {showNew && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="flex gap-2 border-b-2 border-[var(--border)] p-3"
        >
          <input
            autoFocus
            value={newPeer}
            onChange={(e) => setNewPeer(e.target.value)}
            placeholder="G… address"
            className="brutal-input min-w-0 flex-1 bg-[var(--bg)] px-3 py-2 font-mono text-xs text-white"
          />
          <button
            type="submit"
            disabled={creating || !newPeer.trim()}
            className="brutal-accent flex items-center bg-black px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] disabled:opacity-30"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Start'}
          </button>
        </form>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}

        {!isLoading && active.length === 0 && (
          <p className="px-4 py-10 text-center font-mono text-xs text-[var(--text-muted)]">
            No conversations yet.
            <br />
            Hit + to start one.
          </p>
        )}

        {active.map((conv) => {
          const isActive = conv.peerAddress === activeId;
          return (
            <div
              key={conv.conversationId}
              className={`group flex items-center gap-2 border-l-2 px-4 py-3 transition-colors ${
                isActive
                  ? 'border-[var(--accent)] bg-[var(--bg-elevated)]'
                  : 'border-transparent hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Link
                href={`/conversation/${conv.peerAddress}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <Avatar seed={conv.peerAddress} size={40} />
                <PeerName address={conv.peerAddress} lastUpdated={conv.lastUpdated} />
              </Link>
              <button
                onClick={() => hide(conv.peerAddress)}
                aria-label="Close conversation"
                title="Close conversation"
                className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--text-faint)] transition-colors hover:text-[var(--danger)] md:opacity-0 md:group-hover:opacity-100"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeerName({ address, lastUpdated }: { address: string; lastUpdated: number }) {
  const { data: profile } = useProfile(address);
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-mono text-sm font-bold tracking-tight text-white">
        {profile?.username ? `@${profile.username}` : `${address.slice(0, 6)}…${address.slice(-4)}`}
      </p>
      <p className="truncate font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {new Date(lastUpdated * 1000).toLocaleDateString()}
      </p>
    </div>
  );
}
