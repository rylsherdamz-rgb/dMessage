'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowLeft, Check, Copy, Send, ShieldCheck, X, Paperclip, Loader2, Search, ChevronUp, ChevronDown } from 'lucide-react';
import Fuse from 'fuse.js';
import { ChatShell } from '@/components/chat/ChatShell';
import { ConnectGate } from '@/components/layout/ConnectGate';
import { Nav } from '@/components/layout/Nav';
import { MessageBubble } from '@/components/conversation/MessageBubble';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { useMessages, messagesQueryKey, type MessageData } from '@/hooks/useMessages';
import { useProfile } from '@/hooks/useProfile';
import { useArchive } from '@/hooks/useArchive';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { arg } from '@/lib/soroban';
import { writeMaybeSponsored } from '@/lib/gasless';
import { uploadToIpfs, uploadPayload } from '@/lib/ipfs';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address, isConnected, signTransaction, signAuthEntry } = useWallet();
  const queryClient = useQueryClient();
  const peerAddress = id;
  const { hide } = useArchive();
  const { data: messages, isLoading } = useMessages(peerAddress);
  const { data: peerProfile } = useProfile(peerAddress);
  const { isTyping } = useTypingIndicator(peerAddress);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const previewUrl = useMemo(() => {
    if (!attachedFile || !attachedFile.type.startsWith('image/')) return null;
    return URL.createObjectURL(attachedFile);
  }, [attachedFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const [uploading, setUploading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => {
    if (!messages) return null;
    return new Fuse(messages, {
      keys: ['content'],
      threshold: 0.4,
      includeMatches: true,
    });
  }, [messages]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !fuse) return null;
    return fuse.search(searchQuery.trim());
  }, [searchQuery, fuse]);

  const searchMatches = searchResults ?? [];
  const matchedIndices = useMemo(() => searchMatches.map((r) => r.item ? messages?.indexOf(r.item) ?? -1 : -1).filter((i) => i >= 0), [searchMatches, messages]);
  const displayMessages = useMemo(() => {
    if (searchResults && searchQuery.trim()) return searchResults.map((r) => r.item);
    return messages ?? [];
  }, [searchResults, searchQuery, messages]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: displayMessages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    await writeMaybeSponsored(
      CONTRACT_IDS.messages,
      'send_message',
      [arg.address(address), arg.address(peerAddress), arg.bytes(contentBytes)],
      address,
      signTransaction,
      signAuthEntry,
    );
    const key = messagesQueryKey(CONTRACT_IDS.messages, address, peerAddress);
    queryClient.invalidateQueries({ queryKey: key });
    setTimeout(() => queryClient.invalidateQueries({ queryKey: key }), 6000);
  }, [CONTRACT_IDS.messages, address, peerAddress, signTransaction, signAuthEntry, queryClient]);

  // When the thread is open, optimistically mark all messages as read locally.
  // No contract write — no wallet popup, no gas fee.
  useEffect(() => {
    if (!address || !peerAddress || !messages?.length) return;

    const hasUnread = messages.some((m) => m.sender === peerAddress && !m.read);
    if (!hasUnread) return;

    queryClient.setQueryData<MessageData[]>(
      messagesQueryKey(CONTRACT_IDS.messages, address, peerAddress),
      (prev) => prev?.map((m) => (m.sender === peerAddress ? { ...m, read: true } : m)),
    );
  }, [messages, CONTRACT_IDS.messages, address, peerAddress, queryClient]);

  const attachFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if ((!text && !attachedFile) || sending || !address || !peerAddress) return;

    setSending(true);
    setSendError(null);

    try {
      if (attachedFile) {
        setUploading(true);
        const fileResult = await uploadToIpfs(attachedFile);
        if (!fileResult) {
          setSendError('File upload failed — check Pinata API key');
          setUploading(false);
          setSending(false);
          return;
        }
        const payloadCid = await uploadPayload({ t: text || undefined, f: fileResult.cid, n: attachedFile.name });
        if (!payloadCid) {
          setSendError('Message upload failed');
          setUploading(false);
          setSending(false);
          return;
        }
        setUploading(false);
        await sendMessage(payloadCid.cid);
      } else {
        await sendMessage(text);
      }
      setInput('');
      setAttachedFile(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err) {
      console.error('[ConversationPage] send failed:', err);
      setSendError('Transaction failed — check your wallet and try again');
    } finally {
      setUploading(false);
      setSending(false);
    }
  }, [input, attachedFile, sending, address, peerAddress, sendMessage]);

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
            {isTyping ? (
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--amber)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--amber)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--amber)]" />
                </span>
                typing…
              </p>
            ) : (
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
                <ShieldCheck className="h-3 w-3" strokeWidth={2} aria-hidden />
                End-to-end encrypted
              </p>
            )}
          </div>
          <button
            onClick={() => { setShowSearch((s) => !s); setSearchQuery(''); }}
            aria-label="Search messages"
            title="Search messages"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            <Search className="h-4 w-4" strokeWidth={2} />
          </button>
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

        {showSearch && (
          <div className="flex items-center gap-2 border-b-2 border-[var(--border)] bg-[var(--bg)] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-faint)]" strokeWidth={2} />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchMatchIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) setSearchMatchIdx((i) => i > 0 ? i - 1 : matchedIndices.length - 1);
                  else setSearchMatchIdx((i) => i < matchedIndices.length - 1 ? i + 1 : 0);
                }
              }}
              placeholder="Search this conversation…"
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-[var(--text)] outline-none placeholder-[var(--text-faint)]"
              autoFocus
            />
            {searchQuery.trim() && (
              <span className="shrink-0 font-mono text-[10px] text-[var(--text-faint)]">
                {matchedIndices.length > 0
                  ? `${searchMatchIdx + 1}/${matchedIndices.length}`
                  : '0/0'}
              </span>
            )}
            {matchedIndices.length > 1 && (
              <>
                <button
                  onClick={() => setSearchMatchIdx((i) => i > 0 ? i - 1 : matchedIndices.length - 1)}
                  className="text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={2} />
                </button>
                <button
                  onClick={() => setSearchMatchIdx((i) => i < matchedIndices.length - 1 ? i + 1 : 0)}
                  className="text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  <ChevronDown className="h-4 w-4" strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        )}
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-2 overflow-y-auto bg-grid p-2 sm:gap-3 sm:p-6"
          role="log"
          aria-live="polite"
          aria-label="Messages"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Spinner />
            </div>
          )}
          {!isLoading && messages?.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
              <Avatar seed={peerAddress} size={64} />
              <PeerProfile address={peerAddress} />
              <p className="font-mono text-xs text-[var(--text-muted)]">
                This conversation is empty — send the first message
              </p>
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-[var(--text-faint)]">
                <span className="rounded border border-[var(--border)] px-2 py-1">Messages are end-to-end encrypted</span>
              </div>
            </div>
          )}
          {displayMessages.length > 0 && (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const msg = displayMessages[virtualItem.index];
                const origIdx = messages?.indexOf(msg) ?? virtualItem.index;
                const isSearchMatch = matchedIndices.includes(origIdx) && searchQuery.trim();
                const isActiveMatch = isSearchMatch && matchedIndices[searchMatchIdx] === origIdx;
                return (
                  <div
                    key={`${msg.timestamp}-${origIdx}`}
                    ref={(el) => {
                      virtualizer.measureElement(el);
                      if (isActiveMatch && el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    data-index={virtualItem.index}
                    className={`absolute left-0 w-full ${isActiveMatch ? 'ring-2 ring-[var(--accent)] ring-inset' : ''}`}
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
                  >
                    <MessageBubble
                      timestamp={msg.timestamp}
                      content={msg.content}
                      isOwn={msg.sender === address}
                      index={virtualItem.index}
                      senderAddress={msg.sender}
                      read={msg.read}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {sendError && (
          <div className="border-t-2 border-[var(--danger)] bg-[var(--bg-surface)] px-4 py-2 font-mono text-xs text-[var(--danger)]">
            {sendError}
          </div>
        )}

        <div className="border-t-2 border-[var(--border-strong)] bg-[var(--bg-surface)] p-2 sm:p-4">
          {attachedFile && (
            <div className="mb-2 flex items-center gap-3 border-2 border-[var(--border)] bg-[var(--bg-inset)] p-2">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 border border-[var(--border)] bg-black object-cover"
                />
              )}
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text)]">
                {attachedFile.name} ({(attachedFile.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={() => { setAttachedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="shrink-0 text-[var(--text-faint)] hover:text-[var(--danger)]"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          )}
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
                autoFocus
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
              disabled={sending}
              aria-label="Attach file"
              className="brutal flex items-center bg-[var(--bg)] px-3 py-3 font-mono text-xs text-[var(--text-muted)] disabled:opacity-30"
            >
              <Paperclip className="h-4 w-4" strokeWidth={2} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={attachFile}
              className="hidden"
              accept="image/*,application/pdf,.txt"
            />
            <button
              type="submit"
              disabled={sending || (!input.trim() && !attachedFile)}
              aria-label="Send"
              className="brutal-accent flex items-center gap-2 bg-black px-5 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--accent)] disabled:opacity-30"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <Send className="h-4 w-4" strokeWidth={2} aria-hidden />}
              <span className="hidden sm:inline">{uploading ? 'Uploading…' : sending ? '…' : 'Send'}</span>
            </button>
          </form>
        </div>
      </div>
    </ChatShell>
  );
}

function PeerProfile({ address }: { address: string }) {
  const { data: profile } = useProfile(address);
  return (
    <div className="text-center">
      <p className="font-mono text-sm font-black tracking-tight text-[var(--text)]">
        {profile?.username ? `@${profile.username}` : `${address.slice(0, 6)}…${address.slice(-4)}`}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-[var(--text-faint)]">{address}</p>
    </div>
  );
}
