'use client';

import { useWallet } from '@/components/wallet/WalletProvider';
import { motion } from 'framer-motion';

export function WalletConnector() {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

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
      {isConnecting ? 'Connecting...' : isConnected ? truncated : 'Connect Wallet'}
    </motion.button>
  );
}
