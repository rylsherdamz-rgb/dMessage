'use client';

import { Check, CheckCheck, File, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { useProfile } from '@/hooks/useProfile';
import { relativeTime } from '@/lib/time';
import { parseFileMessage, getIpfsUrl } from '@/lib/ipfs';

interface MessageBubbleProps {
  sender: string;
  timestamp: number;
  content: string;
  isOwn: boolean;
  index: number;
  senderAddress: string;
  read?: boolean;
}

export function MessageBubble({
  sender,
  timestamp,
  content,
  isOwn,
  index,
  senderAddress,
  read,
}: MessageBubbleProps) {
  const { data: senderProfile } = useProfile(senderAddress);
  const displayName = senderProfile?.username
    ? `@${senderProfile.username}`
    : `${senderAddress.slice(0, 6)}…`;

  const file = parseFileMessage(content);
  const textBefore = file ? content.replace(/\[f:[a-zA-Z0-9]+\]/, '').trim() : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={`flex max-w-[80%] items-end gap-2 ${
        isOwn ? 'flex-row-reverse self-end' : 'self-start'
      }`}
    >
      {!isOwn && <Avatar seed={senderAddress} size={28} className="mb-5" />}
      <div className="min-w-0">
        {!isOwn && (
          <p className="mb-1.5 ml-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {displayName}
          </p>
        )}
        <div
          className={`border-2 px-4 py-2.5 ${
            isOwn
              ? 'border-[var(--accent)] bg-black text-[var(--accent)]'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text)]'
          }`}
        >
          {textBefore && (
            <p className="font-mono text-sm leading-relaxed break-words">{textBefore}</p>
          )}
          {file && (
            <div className={`flex items-center gap-3 ${textBefore ? 'mt-2' : ''}`}>
              <File className="h-8 w-8 shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-bold">{file.cid.slice(0, 12)}…</p>
                <a
                  href={getIpfsUrl(file.cid)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="h-3 w-3" strokeWidth={2} />
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
        <div className={`mt-1 flex items-center gap-1 font-mono text-[10px] text-[var(--text-faint)] ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span>{relativeTime(timestamp)}</span>
          {isOwn && (
            read
              ? <CheckCheck className="h-3 w-3 text-[var(--accent)]" strokeWidth={2} />
              : <Check className="h-3 w-3 text-[var(--text-faint)]" strokeWidth={2} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
