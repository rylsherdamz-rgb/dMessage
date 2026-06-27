'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';
import { hexDecode, hexEncode } from '@/lib/hex';

export interface MessageData {
  sender: string;
  timestamp: number;
  contentHash: string;
  contentType: number;
}

interface RawMessage {
  sender: string;
  timestamp: bigint | number;
  content_hash: Uint8Array;
  content_type: number;
}

export function useMessages(conversationId: string, page = 0) {
  const { address } = useWallet();

  return useQuery<MessageData[]>({
    queryKey: ['messages', conversationId, page, address],
    enabled: !!conversationId && !!address,
    queryFn: async () => {
      if (!address || !CONTRACT_IDS.messages) return [];

      try {
        const raw = await readContract<RawMessage[]>(
          CONTRACT_IDS.messages,
          'get_messages',
          [arg.bytes(hexDecode(conversationId)), arg.u32(page), arg.u32(50)],
          address,
        );

        return (raw ?? []).map((m) => ({
          sender: m.sender,
          timestamp: Number(m.timestamp),
          contentHash: hexEncode(new Uint8Array(m.content_hash)),
          contentType: Number(m.content_type),
        }));
      } catch (err) {
        console.error('[useMessages] query failed:', err);
        return [];
      }
    },
    staleTime: 5_000,
  });
}
