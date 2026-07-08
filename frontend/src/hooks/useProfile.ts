'use client';

import { useQuery } from '@tanstack/react-query';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';

export interface UserProfile {
  username: string;
  encryptionPubkey: Uint8Array;
}

interface RawProfile {
  username: string;
  encryption_pubkey: Uint8Array | number[];
  metadata_ipfs: Uint8Array | number[];
}

/**
 * Reads a user's on-chain profile from the UserRegistry contract.
 * Returns `null` when the address has never registered.
 */
export function useProfile(address?: string | null) {
  return useQuery<UserProfile | null>({
    queryKey: ['profile', address],
    enabled: !!address && !!CONTRACT_IDS.userRegistry,
    queryFn: async () => {
      if (!address || !CONTRACT_IDS.userRegistry) return null;

      try {
        const raw = await readContract<RawProfile>(
          CONTRACT_IDS.userRegistry,
          'get_user',
          [arg.address(address)],
          address,
        );
        if (!raw) return null;

        return {
          username: raw.username,
          encryptionPubkey: new Uint8Array(raw.encryption_pubkey),
        };
      } catch (err) {
        console.error('[useProfile] query failed:', err);
        return null;
      }
    },
    staleTime: 30_000,
  });
}
