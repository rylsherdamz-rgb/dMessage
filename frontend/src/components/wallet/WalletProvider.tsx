'use client';

import { WalletProvider as KitProvider, useWallet as useKitWallet } from 'stellar-wallet-kit';
import { NetworkType } from 'stellar-wallet-kit';
import type { ReactNode } from 'react';

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <KitProvider
      config={{
        network: NetworkType.TESTNET,
        theme: { mode: 'dark' },
      }}
    >
      {children}
    </KitProvider>
  );
}

export function useWallet() {
  const ctx = useKitWallet();
  return {
    address: ctx.account?.address ?? null,
    publicKey: ctx.account?.publicKey ?? null,
    isConnected: ctx.isConnected,
    isConnecting: ctx.isConnecting,
    connect: (walletType?: string) => ctx.connect(walletType as any),
    disconnect: () => ctx.disconnect(),
    signTransaction: async (xdr: string) => {
      const res = await ctx.signTransaction(xdr);
      return res.signedTxXdr;
    },
  };
}
