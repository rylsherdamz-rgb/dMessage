'use client';

import { useWallet } from '@/components/wallet/WalletProvider';
import { useConversations } from '@/hooks/useConversations';
import { Spinner } from '@/components/ui/Spinner';
import Link from 'next/link';
import { useState } from 'react';
import { getSorobanServer, CONTRACT_IDS, NETWORK_PASSPHRASE } from '@/lib/stellar';
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
          contract.call('ensure_conversation', userAddr.toScVal(), peerAddr.toScVal()).toXDR(),
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
      <section className="flex min-h-screen flex-col items-center justify-center gap-8 px-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-4 w-4 bg-[var(--accent)]" />
          <h1 className="font-mono text-xl font-black tracking-tight">Connect Wallet</h1>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
          Authenticate to start messaging
        </p>
        <div className="h-[1px] w-16 bg-[var(--border)]" />
      </section>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <nav className="flex items-center justify-between border-b-3 border-[var(--border)] px-8 py-5">
        <Link href="/" className="group flex items-center gap-3">
          <div className="h-5 w-5 bg-[var(--accent)]" />
          <span className="font-mono text-lg font-black tracking-tight">dMessage</span>
        </Link>
      </nav>

      <main className="flex flex-col gap-8 p-8">
        <div className="neobrutalist bg-[var(--bg-surface)] p-6">
          <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.15em] text-[var(--accent)]">
            New Conversation
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); handleNewConversation(); }}
            className="flex gap-3"
          >
            <input
              value={newPeer}
              onChange={(e) => setNewPeer(e.target.value)}
              placeholder="G... stellar address"
              className="neobrutalist-input flex-1 bg-[var(--bg)] px-4 py-3 font-mono text-sm text-white"
            />
            <button
              type="submit"
              disabled={creating || !newPeer.trim()}
              className="neobrutalist-accent bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-[var(--accent)] disabled:opacity-30"
            >
              {creating ? '...' : 'Start'}
            </button>
          </form>
        </div>

        <div className="neobrutalist bg-[var(--bg-surface)] p-6">
          <h2 className="mb-5 font-mono text-xs uppercase tracking-[0.15em] text-[var(--accent)]">
            Conversations
          </h2>

          {isLoading && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}

          {conversations?.length === 0 && !isLoading && (
            <p className="py-10 text-center font-mono text-xs text-[var(--text-muted)]">
              No conversations yet
            </p>
          )}

          <div className="flex flex-col gap-2">
            {conversations?.map((conv) => (
              <Link
                key={conv.conversationId}
                href={`/conversation/${conv.conversationId}`}
                className="group flex items-center justify-between border-2 border-[var(--border)] bg-[var(--bg)] px-5 py-4 transition-all hover:border-[var(--accent)]"
              >
                <span className="font-mono text-sm font-bold tracking-tight">
                  {conv.peerAddress.slice(0, 8)}...
                  <span className="text-[var(--text-muted)]">{conv.peerAddress.slice(-6)}</span>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  {new Date(conv.lastUpdated * 1000).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
