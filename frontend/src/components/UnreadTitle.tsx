'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';

interface RawInboxMessage {
  sender: string;
  read: boolean;
}

export function UnreadTitle() {
  const { address, isConnected } = useWallet();
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!address || !isConnected || !CONTRACT_IDS.messages) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const raw = await readContract<RawInboxMessage[]>(
          CONTRACT_IDS.messages,
          'get_messages',
          [arg.address(address), arg.u32(0), arg.u32(100)],
          address,
        );
        if (cancelled) return;
        const count = (raw ?? []).filter((m) => m.sender !== address && !m.read).length;
        setTotal(count);
      } catch { /* ignore */ }
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address, isConnected]);

  useEffect(() => {
    document.title = total > 0
      ? `(${total > 99 ? '99+' : total}) dMessage`
      : 'dMessage — Decentralized Messaging on Stellar';
  }, [total]);

  return null;
}
