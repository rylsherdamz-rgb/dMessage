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
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className={`max-w-[75%] rounded-[var(--radius)] px-4 py-3 ${
        isOwn
          ? 'self-end bg-[var(--color-accent)] text-white'
          : 'self-start bg-[var(--color-surface)] border border-white/10'
      }`}
    >
      {!isOwn && (
        <p className="mb-1 text-xs text-[var(--color-text-muted)]">
          {sender.slice(0, 8)}…
        </p>
      )}
      {decrypting ? (
        <p className="text-sm italic opacity-60">Decrypting…</p>
      ) : contentType === 2 ? (
        content ? (
          <img src={content} alt="Shared media" className="max-w-full rounded-[var(--radius-sm)]" />
        ) : (
          <p className="text-sm italic opacity-60">Loading media…</p>
        )
      ) : (
        <p className="text-sm">{content ?? ''}</p>
      )}
      <p className="mt-1 text-right text-[10px] opacity-50">
        {new Date(timestamp * 1000).toLocaleTimeString()}
      </p>
    </motion.div>
  );
}
