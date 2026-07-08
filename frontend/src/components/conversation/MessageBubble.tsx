'use client';

import { useEffect, useState } from 'react';
import { Check, CheckCheck, File, Download, Loader2, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { useProfile } from '@/hooks/useProfile';
import { relativeTime } from '@/lib/time';
import { fetchPayload, getIpfsUrl } from '@/lib/ipfs';
import type { MessagePayload } from '@/lib/ipfs';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'];

function isImageFile(filename?: string): boolean {
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.includes(ext) : false;
}

interface MessageBubbleProps {
  timestamp: number;
  content: string;
  isOwn: boolean;
  index: number;
  senderAddress: string;
  read?: boolean;
}

export function MessageBubble({
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

  const isCid = content.startsWith('Qm') || content.startsWith('bafy');
  const [payload, setPayload] = useState<MessagePayload | null>(null);
  const [loadingPayload, setLoadingPayload] = useState(!!isCid);
  const [payloadError, setPayloadError] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isCid) return;
    let cancelled = false;
    setPayloadError(false);
    fetchPayload(content).then((p) => {
      if (cancelled) return;
      if (p) { setPayload(p); setLoadingPayload(false); }
      else { setPayloadError(true); setLoadingPayload(false); }
    });
    return () => { cancelled = true; };
  }, [content, isCid]);

  const displayText = payload?.t ?? (isCid ? '' : content);

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
          {loadingPayload && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-faint)]" strokeWidth={2} />
          )}
          {payloadError && (
            <p className="font-mono text-xs italic text-[var(--text-faint)]">Failed to load message</p>
          )}
          {!loadingPayload && displayText && (
            <p className="font-mono text-sm leading-relaxed break-words">{displayText}</p>
          )}
          {!loadingPayload && payload?.f && (
            <div className={`${displayText ? 'mt-2' : ''}`}>
              {isImageFile(payload.n) ? (
                <a
                  href={getIpfsUrl(payload.f)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="group relative block overflow-hidden border border-[var(--border)]"
                >
                  <img
                    src={getIpfsUrl(payload.f)}
                    alt={payload.n ?? 'Image'}
                    className="max-h-64 w-full object-cover transition-opacity group-hover:opacity-90"
                    loading="lazy"
                  />
                  <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    <Download className="h-3 w-3" strokeWidth={2} />
                    {payload.n}
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-3">
                  <File className="h-8 w-8 shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold">{payload.n ?? payload.f.slice(0, 12)}</p>
                    <a
                      href={getIpfsUrl(payload.f)}
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
