'use client';

import { useSyncExternalStore } from 'react';
import { getStoredNetwork, setStoredNetwork, type StellarNetwork } from '@/lib/network';

const NETWORK_CHANGE_EVENT = 'dmessage:network-change';

function subscribeToNetwork(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(NETWORK_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(NETWORK_CHANGE_EVENT, callback);
  };
}

function getDeploymentNetwork(): StellarNetwork {
  return process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

export function NetworkBadge() {
  const network = useSyncExternalStore(
    subscribeToNetwork,
    getStoredNetwork,
    getDeploymentNetwork,
  );

  const toggle = () => {
    const next: StellarNetwork = network === 'mainnet' ? 'testnet' : 'mainnet';
    setStoredNetwork(next);
    window.dispatchEvent(new Event(NETWORK_CHANGE_EVENT));
    window.location.reload();
  };

  const isMainnet = network === 'mainnet';

  return (
    <button
      onClick={toggle}
      title={`Switch to ${isMainnet ? 'testnet' : 'mainnet'}`}
      className="flex items-center gap-1.5 rounded-sm border border-[var(--border)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          isMainnet ? 'bg-[var(--accent)]' : 'bg-amber-400'
        }`}
      />
      {isMainnet ? 'Mainnet' : 'Testnet'}
    </button>
  );
}
