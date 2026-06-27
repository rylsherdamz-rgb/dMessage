'use client';

import { useParams } from 'next/navigation';
import { useMessages } from '@/hooks/useMessages';
import { useWallet } from '@/components/wallet/WalletProvider';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { Spinner } from '@/components/ui/Spinner';
import { uploadToIPFS } from '@/lib/ipfs';
import { getSorobanServer, CONTRACT_IDS, NETWORK_PASSPHRASE } from '@/lib/stellar';
import { hexDecode, hexEncode } from '@/lib/hex';
import SorobanClient from 'stellar-sdk';
import { motion } from 'framer-motion';
import Link from 'next/link';

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
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-white"
          >
            &larr; Back
          </Link>
          <h2 className="font-mono text-lg font-semibold">{id.slice(0, 16)}…</h2>
        </div>
      </header>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-6">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        )}
        {messages?.length === 0 && !isLoading && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[var(--color-text-muted)]">No messages yet. Start the conversation!</p>
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

      <div className="border-t border-white/10 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message…"
            disabled={sending}
            className="flex-1 rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-4 py-3 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-[var(--color-accent)] disabled:opacity-50"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            disabled={sending || !input.trim()}
            className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-6 py-3 font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {sending ? <Spinner className="h-4 w-4" /> : 'Send'}
          </motion.button>
        </form>
      </div>
    </div>
  );
}
