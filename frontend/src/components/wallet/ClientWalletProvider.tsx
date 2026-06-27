'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const WalletProviderInner = dynamic(
  () => import('@/components/wallet/WalletProvider').then((m) => ({ default: m.WalletProvider })),
  { ssr: false },
);

export function ClientWalletProvider({ children }: { children: ReactNode }) {
  return <WalletProviderInner>{children}</WalletProviderInner>;
}
