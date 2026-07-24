'use client';

const STORAGE_KEY = 'dmessage:network';

export type StellarNetwork = 'testnet' | 'mainnet';

export function getStoredNetwork(): StellarNetwork {
  const fallback: StellarNetwork =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  if (typeof window === 'undefined') return fallback;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'mainnet' || stored === 'testnet' ? stored : fallback;
}

export function setStoredNetwork(n: StellarNetwork): void {
  localStorage.setItem(STORAGE_KEY, n);
}
