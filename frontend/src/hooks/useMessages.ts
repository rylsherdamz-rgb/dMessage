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

/** React Query key for a conversation thread; exported so callers can invalidate. */
export function messagesQueryKey(address?: string | null, peerAddress?: string) {
  return ['messages-thread', address ?? null, peerAddress ?? null] as const;
}

async function fetchInbox(
  inboxOwner: string,
  source: string,
): Promise<MessageData[]> {
  const raw = await readContract<RawInboxMessage[]>(
    CONTRACT_IDS.messages,
    'get_messages',
    [arg.address(inboxOwner), arg.u32(0), arg.u32(100)],
    source,
  );
  return (raw ?? []).map((m) => ({
    sender: m.sender,
    timestamp: Number(m.timestamp),
    content: new TextDecoder().decode(new Uint8Array(m.content)),
    read: m.read,
  }));
}

/**
 * Loads a conversation thread between the connected user and `peerAddress`.
 *
 * The messages contract is an inbox model keyed by recipient: a message I send
 * to the peer lands in the PEER's inbox, and a message the peer sends me lands
 * in MY inbox. So a full two-sided thread requires reading both inboxes:
 *   - my inbox, keeping messages whose sender is the peer   (peer -> me)
 *   - peer's inbox, keeping messages whose sender is me      (me -> peer)
 * The two halves are merged and sorted by timestamp.
 *
 * With no `peerAddress`, returns the connected user's full inbox.
 */
export function useMessages(peerAddress: string | undefined) {
  const { address } = useWallet();

  return useQuery<MessageData[]>({
    queryKey: messagesQueryKey(address, peerAddress),
    enabled: !!address && !!CONTRACT_IDS.messages,
    queryFn: async () => {
      if (!address || !CONTRACT_IDS.messages) return [];

      try {
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
      } catch (err) {
        console.error('[useMessages] query failed:', err);
        return [];
      }
    },
    staleTime: 5_000,
  });
}
