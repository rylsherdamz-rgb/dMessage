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
  /**
   * Position of this message in `inboxOwner`'s on-chain inbox. For messages the
   * current user *received* this is the index into their own inbox, which is the
   * value `mark_as_read(caller, index)` expects. Undefined when not applicable.
   */
  inboxIndex?: number;
}

interface RawInboxMessage {
  sender: string;
  content: Uint8Array;
  timestamp: bigint | number;
  read: boolean;
}

export function messagesQueryKey(address?: string | null, peerAddress?: string) {
  return ['messages-thread', address ?? null, peerAddress ?? null] as const;
}

async function fetchInbox(
  inboxOwner: string,
  source: string,
): Promise<MessageData[]> {
  try {
    const raw = await readContract<RawInboxMessage[]>(
      CONTRACT_IDS.messages,
      'get_messages',
      [arg.address(inboxOwner), arg.u32(0), arg.u32(100)],
      source,
    );
    return (raw ?? []).map((m, i) => ({
      sender: m.sender,
      timestamp: Number(m.timestamp),
      content: new TextDecoder().decode(new Uint8Array(m.content)),
      read: m.read,
      inboxIndex: i,
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

      if (!peerAddress) {
        return await fetchInbox(address, address);
      }

      const [myInbox, peerInbox] = await Promise.all([
        fetchInbox(address, address),
        fetchInbox(peerAddress, address),
      ]);

      const received = myInbox.filter((m) => m.sender === peerAddress);
      const sent = peerInbox.filter((m) => m.sender === address);

      return [...received, ...sent].sort((a, b) => a.timestamp - b.timestamp);
    },
    staleTime: 5_000,
    refetchInterval: 6_000,
  });
}
