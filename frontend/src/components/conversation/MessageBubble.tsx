'use client';

import { useEffect, useState } from 'react';
import { Check, CheckCheck, File, Download, Loader2 } from 'lucide-react';
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

  const timeStr = relativeTime(timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={`flex max-w-[88%] items-end gap-1.5 sm:max-w-[75%] sm:gap-2 ${
        isOwn ? 'flex-row-reverse self-end' : 'self-start'
      }`}
      role="log"
      aria-label={`Message from ${displayName}, ${timeStr}${read ? ', read' : ''}`}
    >
      {!isOwn && <Avatar seed={senderAddress} size={24} className="mb-5 sm:h-7 sm:w-7" />}
      <div className="min-w-0">
        {!isOwn && (
          <p className="mb-1 ml-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            {displayName}
          </p>
        )}
        <div
          className={`border-2 px-3 py-2 sm:px-4 sm:py-2.5 ${
            isOwn
              ? 'border-[var(--accent)] bg-black text-[var(--accent)]'
              : 'border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text)]'
          }`}
        >
          {loadingPayload && (
            <Loader2 className="h-4 w-4 animate-spin text-[var(--text-faint)]" strokeWidth={2} />
          )}
          {payloadError && (
            <p className="font-mono text-[11px] italic text-[var(--text-faint)] sm:text-xs">Failed to load message</p>
          )}
          {!loadingPayload && displayText && (
            <p className="font-mono text-xs leading-relaxed break-words sm:text-sm">{displayText}</p>
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
                  {/* eslint-disable-next-line @next/next/no-img-element -- IPFS-hosted remote image */}
                  <img
                    src={getIpfsUrl(payload.f)}
                    alt={payload.n ?? 'Image'}
                    className="max-h-48 w-full object-cover transition-opacity group-hover:opacity-90 sm:max-h-64"
                    loading="lazy"
                  />
                  <div className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white sm:text-[10px]">
                    <Download className="h-3 w-3" strokeWidth={2} />
                    <span className="hidden sm:inline">{payload.n}</span>
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3">
                  <File className="h-6 w-6 shrink-0 sm:h-8 sm:w-8" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold sm:text-sm">{payload.n ?? payload.f.slice(0, 12)}</p>
                    <a
                      href={getIpfsUrl(payload.f)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 sm:mt-1"
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
