import { useWallet } from '@/components/wallet/WalletProvider';
import { motion } from 'framer-motion';

export function WalletConnector() {
  const { isConnected, isConnecting, address, connect, disconnect } = useWallet();

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => (isConnected ? disconnect() : connect())}
      disabled={isConnecting}
      className="rounded-full bg-[var(--color-accent)] px-6 py-3 font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
    >
      {isConnecting
        ? 'Connecting…'
        : isConnected
          ? truncated
          : 'Connect Wallet'}
    </motion.button>
  );
}
