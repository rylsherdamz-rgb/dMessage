'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';

interface RawInboxMessage {
  sender: string;
  read: boolean;
}

export function useUnreadCount(peerAddress?: string) {
  const { address } = useWallet();

  return useQuery<number>({
    queryKey: ['unread-count', address, peerAddress],
    enabled: !!address && !!peerAddress && !!CONTRACT_IDS.messages,
    queryFn: async () => {
      if (!address || !peerAddress || !CONTRACT_IDS.messages) return 0;
      const raw = await readContract<RawInboxMessage[]>(
        CONTRACT_IDS.messages,
        'get_messages',
        [arg.address(address), arg.u32(0), arg.u32(100)],
        address,
      );
      return (raw ?? []).filter((m) => m.sender === peerAddress && !m.read).length;
    },
    staleTime: 5_000,
    refetchInterval: 6_000,
  });
}
