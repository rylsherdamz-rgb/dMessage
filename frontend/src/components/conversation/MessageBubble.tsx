'use client';

import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { useProfile } from '@/hooks/useProfile';

interface MessageBubbleProps {
  timestamp: number;
  content: string;
  isOwn: boolean;
  index: number;
  senderAddress: string;
}

export function MessageBubble({
  timestamp,
  content,
  isOwn,
  index,
  senderAddress,
}: MessageBubbleProps) {
  const { data: senderProfile } = useProfile(senderAddress);
  const displayName = senderProfile?.username
    ? `@${senderProfile.username}`
    : `${senderAddress.slice(0, 6)}…`;

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
              : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-white'
          }`}
        >
          <p className="font-mono text-sm leading-relaxed break-words">{content}</p>
        </div>
        <p className={`mt-1 font-mono text-[10px] text-[var(--text-faint)] ${isOwn ? 'text-right' : 'text-left'}`}>
          {new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}
