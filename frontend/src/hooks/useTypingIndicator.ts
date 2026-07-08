'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';

export function useTypingIndicator(peerAddress?: string) {
  const { address } = useWallet();

  const { data: isTyping } = useQuery({
    queryKey: ['typing', peerAddress, address],
    enabled: !!address && !!peerAddress && !!CONTRACT_IDS.messages,
    queryFn: async (): Promise<boolean> => {
      if (!address || !peerAddress || !CONTRACT_IDS.messages) return false;
      try {
        return (await readContract<boolean>(
          CONTRACT_IDS.messages,
          'get_typing',
          [arg.address(peerAddress), arg.address(address)],
          address,
        )) ?? false;
      } catch { return false; }
    },
    refetchInterval: 3_000,
    staleTime: 2_000,
  });

  return { isTyping: isTyping ?? false };
}
