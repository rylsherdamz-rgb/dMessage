'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { getSorobanServer, CONTRACT_IDS } from '@/lib/stellar';
import { hexEncode } from '@/lib/hex';
import SorobanClient from 'stellar-sdk';

export interface ConversationRef {
  conversationId: string;
  peerAddress: string;
  lastUpdated: number;
}

export function useConversations() {
  const { address, isConnected } = useWallet();

  return useQuery<ConversationRef[]>({
    queryKey: ['conversations', address],
    enabled: isConnected && !!address,
    queryFn: async () => {
      if (!address) return [];
      if (!CONTRACT_IDS.socialGraph) return [];

      try {
        const contract = new SorobanClient.Contract(CONTRACT_IDS.socialGraph);
        const addr = new SorobanClient.Address(address);

        const result = await getSorobanServer().simulateContract(
          contract.call('get_user_conversations', addr.toScVal()),
        );

        if (!result.result) return [];

        const scVal = result.result.retval;
        const convs = SorobanClient.scval.toVec(scVal);

        return convs.map((conv: any) => {
          const map = SorobanClient.scval.toMap(conv);
          return {
            conversationId: hexEncode(SorobanClient.scval.toBytes(map.conversation_id)),
            peerAddress: SorobanClient.scval.toAddress(map.peer_address).toString(),
            lastUpdated: Number(SorobanClient.scval.toU64(map.last_updated)),
          };
        });
      } catch (err) {
        console.error('[useConversations] query failed:', err);
        return [];
      }
    },
    staleTime: 10_000,
  });
}
