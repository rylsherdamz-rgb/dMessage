'use client';

export type StellarNetwork = 'testnet';

export function getStoredNetwork(): StellarNetwork {
  return 'testnet';
}

export function setStoredNetwork(_n: StellarNetwork): void {
  // No-op - network is fixed to testnet
}
