'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@/components/wallet/WalletProvider';
import { CONTRACT_IDS } from '@/lib/stellar';
import { readContract, arg } from '@/lib/soroban';
import { writeMaybeSponsored } from '@/lib/gasless';

const TYPING_DEBOUNCE = 2000;

export function useTypingIndicator(peerAddress?: string) {
  const { address, signTransaction, signAuthEntry } = useWallet();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(true);

  const { data: isTyping } = useQuery({
    queryKey: ['typing', peerAddress, address],
    enabled: !!address && !!peerAddress && !!CONTRACT_IDS.messages,
    queryFn: async (): Promise<boolean> => {
      if (!address || !peerAddress || !CONTRACT_IDS.messages) return false;
      try {
        return (await readContract<boolean>(
          CONTRACT_IDS.messages,
          'get_typing',
          [arg.address(peerAddress), arg.address(address)],
          address,
        )) ?? false;
      } catch { return false; }
    },
    refetchInterval: 3_000,
    staleTime: 2_000,
  });

  const sendTyping = useCallback(async () => {
    if (!address || !peerAddress || !CONTRACT_IDS.messages || !stoppedRef.current) return;
    stoppedRef.current = false;
    try {
      await writeMaybeSponsored(
        CONTRACT_IDS.messages,
        'set_typing',
        [arg.address(address), arg.address(peerAddress), arg.bool(true)],
        address,
        signTransaction,
        signAuthEntry,
      );
    } catch { /* ignore */ }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      stoppedRef.current = true;
      try {
        await writeMaybeSponsored(
          CONTRACT_IDS.messages,
          'set_typing',
          [arg.address(address), arg.address(peerAddress), arg.bool(false)],
          address,
          signTransaction,
          signAuthEntry,
        );
      } catch { /* ignore */ }
    }, TYPING_DEBOUNCE);
  }, [address, peerAddress, signTransaction, signAuthEntry]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isTyping: isTyping ?? false, sendTyping };
}
