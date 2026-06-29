'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';
import { computeConversationId } from '@/lib/conv';

export interface MessageData {
  sender: string;
  timestamp: number;
  content: string;
  content_type: number;
}

interface RawMessage {
  sender: string;
  timestamp: bigint | number;
  content_hash: number[];
  content_type: number;
}

export function messagesQueryKey(address?: string | null, peerAddress?: string) {
  return ['messages-thread', address ?? null, peerAddress ?? null] as const;
}

async function fetchConversation(
  convId: Uint8Array,
  source: string,
): Promise<MessageData[]> {
  try {
    const raw = await readContract<RawMessage[]>(
      CONTRACT_IDS.messages,
      'get_messages',
      [arg.bytes(convId), arg.u32(0), arg.u32(50)],
      source,
    );
    return (raw ?? []).map((m) => ({
      sender: m.sender,
      timestamp: Number(m.timestamp),
      content: new TextDecoder().decode(new Uint8Array(m.content_hash)),
      content_type: m.content_type,
    }));
  } catch {
    return [];
  }
}

export function useMessages(peerAddress: string | undefined) {
  const { address } = useWallet();

  return useQuery<MessageData[]>({
    queryKey: messagesQueryKey(address, peerAddress),
    enabled: !!address && !!CONTRACT_IDS.messages,
    queryFn: async () => {
      if (!address || !CONTRACT_IDS.messages) return [];

      if (!peerAddress) return [];

      const convId = await computeConversationId(address, peerAddress);
      const messages = await fetchConversation(convId, address);

      return messages.sort((a, b) => a.timestamp - b.timestamp);
    },
    staleTime: 5_000,
  });
}
