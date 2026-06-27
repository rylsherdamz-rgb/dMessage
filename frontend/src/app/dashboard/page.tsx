'use client';

import { useWallet } from '@/components/wallet/WalletProvider';
import { useConversations } from '@/hooks/useConversations';
import { WalletConnector } from '@/components/wallet/WalletConnector';
import { Nav } from '@/components/layout/Nav';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { useState } from 'react';
import { getSorobanServer, CONTRACT_IDS, NETWORK_PASSPHRASE } from '@/lib/stellar';
import { hexEncode } from '@/lib/hex';
import SorobanClient from 'stellar-sdk';

export default function DashboardPage() {
  const { isConnected, address, signTransaction } = useWallet();
  const { data: conversations, isLoading } = useConversations();
  const [newPeer, setNewPeer] = useState('');
  const [creating, setCreating] = useState(false);

  const handleNewConversation = async () => {
    const peer = newPeer.trim();
    if (!peer || creating || !address || !CONTRACT_IDS.socialGraph) return;

    setCreating(true);
    try {
      const contract = new SorobanClient.Contract(CONTRACT_IDS.socialGraph);
      const userAddr = new SorobanClient.Address(address);
      const peerAddr = new SorobanClient.Address(peer);

      const tx = await getSorobanServer().prepareTransaction(
        SorobanClient.TransactionBuilder.fromXdr(
          contract
            .call('ensure_conversation', userAddr.toScVal(), peerAddr.toScVal())
            .toXDR(),
          NETWORK_PASSPHRASE,
        ),
        address,
      );

      const signed = await signTransaction(tx.toXDR());
      const result = await getSorobanServer().sendTransaction(signed);

      if (result.status === 'SUCCESS') {
        setNewPeer('');
      }
    } catch (err) {
      console.error('[Dashboard] new conversation failed:', err);
    } finally {
      setCreating(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6">
        <h1 className="text-[var(--text-lg)] font-semibold">Connect to start messaging</h1>
        <WalletConnector />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col">
      <Nav />

      <main className="flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-white/10 bg-[var(--color-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">
            New Conversation
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleNewConversation();
            }}
            className="flex gap-3"
          >
            <input
              value={newPeer}
              onChange={(e) => setNewPeer(e.target.value)}
              placeholder="Enter Stellar address…"
              className="flex-1 rounded-[var(--radius-sm)] bg-[var(--background)] px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={creating || !newPeer.trim()}
              className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
            >
              {creating ? 'Creating…' : 'Start'}
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-white/10 bg-[var(--color-surface)] p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)]">Conversations</h2>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )}

          {conversations?.length === 0 && !isLoading && (
            <p className="py-8 text-center text-[var(--color-text-muted)]">
              No conversations yet. Enter a Stellar address above to start one.
            </p>
          )}

          {conversations?.map((conv) => (
            <Link
              key={conv.conversationId}
              href={`/conversation/${conv.conversationId}`}
              className="flex items-center justify-between rounded-[var(--radius-sm)] px-4 py-3 transition-colors hover:bg-white/5"
            >
              <span className="font-mono text-sm">{conv.peerAddress.slice(0, 12)}…</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {new Date(conv.lastUpdated * 1000).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
