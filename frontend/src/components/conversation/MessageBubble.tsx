'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fetchFromIPFS } from '@/lib/ipfs';
import { decrypt, importPublicKey, deriveSharedKey } from '@/lib/crypto';

interface MessageBubbleProps {
  sender: string;
  timestamp: number;
  contentHash: string;
  contentType: number;
  isOwn: boolean;
  ownPrivateKey?: CryptoKey;
  peerPublicKey?: string;
  index: number;
}

export function MessageBubble({
  sender,
  timestamp,
  contentHash,
  contentType,
  isOwn,
  ownPrivateKey,
  peerPublicKey,
  index,
}: MessageBubbleProps) {
  const [content, setContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  useEffect(() => {
    if (!contentHash || contentHash === '0000000000000000000000000000000000000000000000000000000000000000') {
      setContent('[placeholder]');
      return;
    }

    let cancelled = false;

    async function load() {
      setDecrypting(true);
      try {
        const blob = await fetchFromIPFS(contentHash);
        const ciphertext = await blob.arrayBuffer();

        if (contentType === 0) {
          setContent(new TextDecoder().decode(ciphertext));
        } else if (contentType === 1 && ownPrivateKey && peerPublicKey) {
          const peerKey = await importPublicKey(peerPublicKey);
          const sharedKey = await deriveSharedKey(ownPrivateKey, peerKey);
          const iv = ciphertext.slice(0, 12);
          const data = ciphertext.slice(12);
          const plain = await decrypt(data, new Uint8Array(iv), sharedKey);
          if (!cancelled) setContent(plain);
        } else if (contentType === 2) {
          const url = URL.createObjectURL(blob);
          setContent(url);
        } else {
          setContent('[encrypted]');
        }
      } catch {
        if (!cancelled) setContent('[unable to decrypt]');
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [contentHash, contentType, ownPrivateKey, peerPublicKey]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={`max-w-[70%] ${
        isOwn
          ? 'self-end'
          : 'self-start'
      }`}
    >
      {!isOwn && (
        <p className="mb-1.5 ml-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          {sender.slice(0, 6)}...
        </p>
      )}
      <div
        className={`border-3 px-5 py-3 ${
          isOwn
            ? 'border-[var(--accent)] bg-black text-[var(--accent)]'
            : 'border-[var(--border)] bg-[var(--bg-surface)] text-white'
        }`}
      >
        {decrypting ? (
          <p className="font-mono text-sm italic opacity-40">decrypting...</p>
        ) : contentType === 2 ? (
          content ? (
            <img src={content} alt="media" className="max-w-full" />
          ) : (
            <p className="font-mono text-sm italic opacity-40">loading...</p>
          )
        ) : (
          <p className="font-mono text-sm leading-relaxed">{content ?? ''}</p>
        )}
      </div>
      <p className={`mt-1.5 font-mono text-[10px] text-[var(--text-muted)] ${isOwn ? 'text-right' : 'text-left'}`}>
        {new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </motion.div>
  );
}
