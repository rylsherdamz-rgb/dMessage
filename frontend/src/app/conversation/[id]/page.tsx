'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMessages } from '@/hooks/useMessages';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { Spinner } from '@/components/ui/Spinner';
import { uploadToIPFS } from '@/lib/ipfs';
import { getSorobanServer, CONTRACT_IDS, NETWORK_PASSPHRASE } from '@/lib/stellar';
import { hexDecode } from '@/lib/hex';
import SorobanClient from 'stellar-sdk';

function bytesScVal(bytes: Uint8Array) {
  return SorobanClient.xdr.ScVal.scvBytes(bytes);
}

function stringTo32Bytes(s: string): Uint8Array {
  const encoded = new TextEncoder().encode(s);
  const out = new Uint8Array(32);
  out.set(encoded.slice(0, 32));
  return out;
}

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address, signTransaction } = useWallet();
  const { data: messages, isLoading } = useMessages(id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !address) return;

    setSending(true);
    try {
      const encoded = new TextEncoder().encode(text);
      const cid = await uploadToIPFS(new Blob([encoded]));

      if (CONTRACT_IDS.messages) {
        const contract = new SorobanClient.Contract(CONTRACT_IDS.messages);
        const convBytes = hexDecode(id);
        const contentHash = stringTo32Bytes(cid);

        const call = contract.call(
          'send_message',
          bytesScVal(convBytes),
          bytesScVal(contentHash),
          SorobanClient.scval.toI32(0),
        );

        const tx = await getSorobanServer().prepareTransaction(
          SorobanClient.TransactionBuilder.fromXdr(call.toXDR(), NETWORK_PASSPHRASE),
          address,
        );

        const signed = await signTransaction(tx.toXDR());
        await getSorobanServer().sendTransaction(signed);
      }

      setInput('');
    } catch (err) {
      console.error('[ConversationPage] send failed:', err);
    } finally {
      setSending(false);
    }
  }, [input, sending, address, id, signTransaction]);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col">
      <header className="flex items-center justify-between border-b-3 border-[var(--border)] px-8 py-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="neobrutalist bg-[var(--bg-surface)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            &larr;
          </button>
          <h2 className="font-mono text-sm font-bold tracking-tight">
            {id.slice(0, 8)}...
            <span className="text-[var(--text-muted)]">{id.slice(-6)}</span>
          </h2>
        </div>
      </header>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        )}
        {messages?.length === 0 && !isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
              No messages yet
            </p>
          </div>
        )}
        {messages?.map((msg, i) => (
          <MessageBubble
            key={`${msg.timestamp}-${i}`}
            sender={msg.sender}
            timestamp={msg.timestamp}
            contentHash={msg.contentHash}
            contentType={msg.contentType}
            isOwn={msg.sender === address}
            index={i}
          />
        ))}
      </div>

      <div className="border-t-3 border-[var(--border)] p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            className="neobrutalist-input flex-1 bg-[var(--bg-surface)] px-5 py-4 font-mono text-sm text-white placeholder-[var(--text-muted)] disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="neobrutalist-accent bg-black px-8 py-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent)] disabled:opacity-30"
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
