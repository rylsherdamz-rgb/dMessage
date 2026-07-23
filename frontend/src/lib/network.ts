'use client';

const STORAGE_KEY = 'dmessage:network';

export type StellarNetwork = 'testnet' | 'mainnet';

export function getStoredNetwork(): StellarNetwork {
  if (typeof window === 'undefined') return 'testnet';
  return (localStorage.getItem(STORAGE_KEY) as StellarNetwork) ?? 'testnet';
}

export function setStoredNetwork(n: StellarNetwork): void {
  localStorage.setItem(STORAGE_KEY, n);
}
