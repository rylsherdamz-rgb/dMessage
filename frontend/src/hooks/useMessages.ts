'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';

export interface MessageData {
  sender: string;
  timestamp: number;
  content: string;
  read: boolean;
}

interface RawInboxMessage {
  sender: string;
  content: Uint8Array;
  timestamp: bigint | number;
  read: boolean;
}

export function useMessages(peerAddress: string | undefined) {
  const { address } = useWallet();

  return useQuery<MessageData[]>({
    queryKey: ['messages-inbox', address],
    enabled: !!address && !!CONTRACT_IDS.messages,
    queryFn: async () => {
      if (!address || !CONTRACT_IDS.messages) return [];

      try {
        const raw = await readContract<RawInboxMessage[]>(
          CONTRACT_IDS.messages,
          'get_messages',
          [arg.address(address), arg.u32(0), arg.u32(100)],
          address,
        );

        const all = (raw ?? []).map((m) => ({
          sender: m.sender,
          timestamp: Number(m.timestamp),
          content: new TextDecoder().decode(new Uint8Array(m.content)),
          read: m.read,
        }));

        if (peerAddress) {
          return all.filter((m) => m.sender === peerAddress);
        }
        return all;
      } catch (err) {
        console.error('[useMessages] query failed:', err);
        return [];
      }
    },
    staleTime: 5_000,
  });
}
