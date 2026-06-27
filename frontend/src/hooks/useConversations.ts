'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';
import { hexEncode } from '@/lib/hex';

export interface ConversationRef {
  conversationId: string;
  peerAddress: string;
  lastUpdated: number;
}

interface RawConversationRef {
  conversation_id: Uint8Array;
  peer_address: string;
  last_updated: bigint | number;
}

export function useConversations() {
  const { address, isConnected } = useWallet();

  return useQuery<ConversationRef[]>({
    queryKey: ['conversations', address],
    enabled: isConnected && !!address,
    queryFn: async () => {
      if (!address || !CONTRACT_IDS.socialGraph) return [];

      try {
        const raw = await readContract<RawConversationRef[]>(
          CONTRACT_IDS.socialGraph,
          'get_user_conversations',
          [arg.address(address)],
          address,
        );

        return (raw ?? []).map((c) => ({
          conversationId: hexEncode(new Uint8Array(c.conversation_id)),
          peerAddress: c.peer_address,
          lastUpdated: Number(c.last_updated),
        }));
      } catch (err) {
        console.error('[useConversations] query failed:', err);
        return [];
      }
    },
    staleTime: 10_000,
  });
}
