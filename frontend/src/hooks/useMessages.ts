'use client';

import { useQuery } from '@tanstack/react-query';
import { getSorobanServer, CONTRACT_IDS } from '@/lib/stellar';
import { hexDecode, hexEncode } from '@/lib/hex';
import SorobanClient from 'stellar-sdk';

export interface MessageData {
  sender: string;
  timestamp: number;
  contentHash: string;
  contentType: number;
}

function bytesToScVal(bytes: Uint8Array) {
  return SorobanClient.xdr.ScVal.scvBytes(bytes);
}

export function useMessages(conversationId: string, page = 0) {
  return useQuery<MessageData[]>({
    queryKey: ['messages', conversationId, page],
    enabled: !!conversationId,
    queryFn: async () => {
      if (!CONTRACT_IDS.messages) return [];

      try {
        const contract = new SorobanClient.Contract(CONTRACT_IDS.messages);
        const convBytes = hexDecode(conversationId);

        const result = await getSorobanServer().simulateContract(
          contract.call(
            'get_messages',
            bytesToScVal(convBytes),
            SorobanClient.scval.toI32(page),
            SorobanClient.scval.toI32(50),
          ),
        );

        if (!result.result) return [];

        const scVal = result.result.retval;
        const msgs = SorobanClient.scval.toVec(scVal);

        return msgs.map((msg: any) => {
          const map = SorobanClient.scval.toMap(msg);
          return {
            sender: SorobanClient.scval.toAddress(map.sender).toString(),
            timestamp: Number(SorobanClient.scval.toU64(map.timestamp)),
            contentHash: hexEncode(SorobanClient.scval.toBytes(map.content_hash)),
            contentType: Number(SorobanClient.scval.toU32(map.content_type)),
          };
        });
      } catch (err) {
        console.error('[useMessages] query failed:', err);
        return [];
      }
    },
    staleTime: 5_000,
  });
}
