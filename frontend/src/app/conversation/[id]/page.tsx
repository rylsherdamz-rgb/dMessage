'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Send, ShieldCheck, X, Paperclip, Loader2 } from 'lucide-react';
import { ChatShell } from '@/components/chat/ChatShell';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Nav } from '@/components/layout/Nav';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useMessages, messagesQueryKey } from '@/hooks/useMessages';
import { useProfile } from '@/hooks/useProfile';
import { useArchive } from '@/hooks/useArchive';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { writeContract, arg } from '@/lib/soroban';
import { uploadToIpfs } from '@/lib/ipfs';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address, isConnected, signTransaction } = useWallet();
  const queryClient = useQueryClient();
  const peerAddress = id;
  const { hide } = useArchive();
  const { data: messages, isLoading } = useMessages(peerAddress);
  const { data: peerProfile } = useProfile(peerAddress);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!sendError) return;
    const t = setTimeout(() => setSendError(null), 6000);
    return () => clearTimeout(t);
  }, [sendError]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  const handleCopyAddress = useCallback(async () => {
    if (!peerAddress) return;
    await navigator.clipboard.writeText(peerAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 1500);
  }, [peerAddress]);

  const sendMessage = useCallback(async (text: string) => {
    if (!address || !peerAddress || !CONTRACT_IDS.messages) return;
    const contentBytes = new TextEncoder().encode(text);
    await writeContract(
      CONTRACT_IDS.messages,
      'send_message',
      [arg.address(address), arg.address(peerAddress), arg.bytes(contentBytes)],
      address,
      signTransaction,
    );
    const key = messagesQueryKey(address, peerAddress);
    queryClient.invalidateQueries({ queryKey: key });
    setTimeout(() => queryClient.invalidateQueries({ queryKey: key }), 6000);
  }, [address, peerAddress, signTransaction, queryClient]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading || !address || !peerAddress) return;

    setUploading(true);
    setSendError(null);
    try {
      const result = await uploadToIpfs(file);
      if (!result) {
        setSendError('File upload failed — check Pinata API key');
        return;
      }
      const msg = `[file:${result.cid}:${file.name}:${file.size}]`;
      await sendMessage(msg);
    } catch (err) {
      console.error('[ConversationPage] file upload error:', err);
      setSendError('File upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !address || !peerAddress) return;

    setSending(true);
    setSendError(null);
    try {
      await sendMessage(text);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      console.error('[ConversationPage] send failed:', err);
      setSendError('Transaction failed — check your wallet and try again');
    } finally {
      setSending(false);
    }
  }, [input, sending, address, peerAddress, sendMessage]);

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <ConnectGate message="Authenticate to open this conversation" />
      </div>
    );
  }

  const displayName = peerProfile?.username
    ? `@${peerProfile.username}`
    : `${peerAddress.slice(0, 6)}…${peerAddress.slice(-4)}`;

  return (
    <ChatShell activeId={peerAddress}>
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-2 border-b-2 border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <Avatar seed={peerAddress} size={40} online />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-mono text-sm font-black tracking-tight text-[var(--text)]">
                {displayName}
              </p>
              <button
                onClick={handleCopyAddress}
                aria-label="Copy peer address"
                className="shrink-0 text-[var(--text-faint)] transition-colors hover:text-[var(--accent)]"
              >
                {copiedAddress ? (
                  <Check className="h-3.5 w-3.5 text-[var(--accent)]" strokeWidth={2} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
            </div>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
              <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
              End-to-end encrypted
            </p>
          </div>
          <button
            onClick={() => {
              hide(peerAddress);
              router.push('/dashboard');
            }}
            aria-label="Close conversation"
            title="Close conversation"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-2 overflow-y-auto bg-grid p-2 sm:gap-3 sm:p-6"
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
              content={msg.content}
              isOwn={msg.sender === address}
              index={i}
              senderAddress={msg.sender}
              read={msg.read}
            />
          ))}
        </div>

        {sendError && (
          <div className="border-t-2 border-[var(--danger)] bg-[var(--bg-surface)] px-4 py-2 font-mono text-xs text-[var(--danger)]">
            {sendError}
          </div>
        )}

        <div className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-surface)] p-2 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-3"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoResize();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message… (Shift+Enter for new line)"
                disabled={sending}
                rows={1}
                className="brutal-input min-w-0 w-full resize-none bg-[var(--bg)] px-4 py-3 font-mono text-sm text-[var(--text)] placeholder-[var(--text-muted)] disabled:opacity-40"
              />
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Attach file"
              className="brutal flex items-center bg-[var(--bg)] px-3 py-3 font-mono text-xs text-[var(--text-muted)] disabled:opacity-30"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Paperclip className="h-4 w-4" strokeWidth={2} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,application/pdf,.txt"
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
