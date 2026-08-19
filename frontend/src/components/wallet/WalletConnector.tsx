'use client';

import { useWallet } from '@/components/wallet/WalletProvider';
import { useProfile } from '@/hooks/useProfile';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';

interface WalletConnectorProps {
  /** Use compact styling (smaller padding/text) for tight layouts like the nav bar */
  compact?: boolean;
}

export function WalletConnector({ compact = false }: WalletConnectorProps) {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();
  const { data: profile } = useProfile(isConnected ? address : null);

  const truncated = address
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : '';
  const label = profile?.username ? `@${profile.username}` : truncated;

  if (compact) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => (isConnected ? disconnect() : connect())}
        disabled={isConnecting}
        className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-3 py-2 font-bold transition-colors sm:gap-2 sm:px-5 sm:py-2.5 sm:text-xs ${
          isConnected
            ? 'neobrutalist-accent bg-black text-[var(--accent)]'
            : 'neobrutalist bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]'
        } disabled:opacity-40`}
      >
        <Wallet className="h-3.5 w-3.5 sm:hidden" strokeWidth={2} aria-hidden />
        {isConnecting ? (
          <span>…</span>
        ) : isConnected ? (
          <>
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{truncated ? `${address!.slice(0, 4)}…` : '✓'}</span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline">Connect Wallet</span>
            <span className="sm:hidden">Connect</span>
          </>
        )}
      </motion.button>
    );
  }

  // Full-size button (landing page, hero sections)
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => (isConnected ? disconnect() : connect())}
      disabled={isConnecting}
      className={`font-mono text-sm uppercase tracking-wider px-8 py-4 font-bold transition-colors ${
        isConnected
          ? 'neobrutalist-accent bg-black text-[var(--accent)]'
          : 'neobrutalist bg-[var(--accent)] text-black hover:bg-[var(--accent-dim)]'
      } disabled:opacity-40`}
    >
      {isConnecting ? 'Connecting...' : isConnected ? label : 'Connect Wallet'}
    </motion.button>
  );
}
