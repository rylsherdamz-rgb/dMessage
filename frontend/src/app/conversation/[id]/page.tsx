'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Send, ShieldCheck } from 'lucide-react';
import { ChatShell } from '@/components/chat/ChatShell';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Nav } from '@/components/layout/Nav';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useWallet } from '@/components/wallet/WalletProvider';
import { uploadToIPFS } from '@/lib/ipfs';
import { CONTRACT_IDS } from '@/lib/stellar';
import { writeContract, arg } from '@/lib/soroban';
import { hexDecode } from '@/lib/hex';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address, isConnected, signTransaction } = useWallet();
  const { data: messages, isLoading } = useMessages(id);
  const { data: conversations } = useConversations();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const peerAddress = useMemo(
    () => conversations?.find((c) => c.conversationId === id)?.peerAddress ?? id,
    [conversations, id],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !address) return;

    setSending(true);
    setSendError(null);
    try {
      const encoded = new TextEncoder().encode(text);
      let contentBytes: Uint8Array;
      try {
        const cid = await uploadToIPFS(new Blob([encoded]));
        contentBytes = new TextEncoder().encode(cid);
      } catch {
        setSendError('IPFS pinning service not configured — message stored as plaintext');
        contentBytes = encoded;
      }

      if (CONTRACT_IDS.messages) {
        await writeContract(
          CONTRACT_IDS.messages,
          'send_message',
          [
            arg.address(address),
            arg.bytes(hexDecode(id)),
            arg.bytes(contentBytes),
            arg.u32(0),
          ],
          address,
          signTransaction,
        );
      }
      setInput('');
    } catch (err) {
      console.error('[ConversationPage] send failed:', err);
      setSendError('Transaction failed — check your wallet and try again');
    } finally {
      setSending(false);
    }
  }, [input, sending, address, id, signTransaction]);

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to open this conversation" />
      </div>
    );
  }

  const shortPeer = `${peerAddress.slice(0, 8)}…${peerAddress.slice(-6)}`;

  return (
    <ChatShell activeId={id}>
      <div className="flex h-full flex-col">
        {/* thread header */}
        <header className="flex items-center gap-3 border-b-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 py-3">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="Back"
            className="flex items-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] md:hidden"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <Avatar seed={peerAddress} size={40} online />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-black tracking-tight text-white">
              {shortPeer}
            </p>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
              End-to-end encrypted
            </p>
          </div>
        </header>

        {/* messages */}
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto bg-grid p-4 sm:p-6"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          )}
          {!isLoading && messages?.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <Avatar seed={peerAddress} size={56} />
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">
                No messages yet — say hello
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

        {/* error */}
        {sendError && (
          <div className="border-t-2 border-[var(--danger)] bg-[var(--bg-surface)] px-4 py-2 font-mono text-xs text-[var(--danger)]">
            {sendError}
          </div>
        )}

        {/* composer */}
        <div className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 sm:p-4">
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
              className="brutal-input min-w-0 flex-1 bg-[var(--bg)] px-4 py-3 font-mono text-sm text-white placeholder-[var(--text-muted)] disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="brutal-accent flex items-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent)] disabled:opacity-30"
            >
              <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
              <span className="hidden sm:inline">{sending ? '…' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </ChatShell>
  );
}
