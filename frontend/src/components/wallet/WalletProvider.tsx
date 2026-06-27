'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction as freighterSign,
  WatchWalletChanges,
} from '@stellar/freighter-api';
import type { ReactNode } from 'react';

interface WalletContext {
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const Ctx = createContext<WalletContext>({
  address: null,
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => '',
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const watcher = useRef<WatchWalletChanges | null>(null);

  const sync = useCallback(async () => {
    try {
      const { isConnected: connected } = await isConnected();
      if (connected) {
        const { address: addr } = await getAddress();
        setAddress(addr);
      } else {
        setAddress(null);
      }
    } catch {
      setAddress(null);
    }
  }, []);

  // Initial check + watch wallet changes
  useEffect(() => {
    sync();
    const w = new WatchWalletChanges(3000);
    watcher.current = w;
    w.watch(({ address: addr, error }) => {
      if (error) {
        setAddress(null);
      } else {
        setAddress(addr || null);
      }
    });
    return () => w.stop();
  }, [sync]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      await requestAccess();
      await sync();
    } finally {
      setIsConnecting(false);
    }
  }, [sync]);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const { signedTxXdr } = await freighterSign(xdr, {
      networkPassphrase: 'Test SDF Network ; September 2015',
    });
    return signedTxXdr;
  }, []);

  return (
    <Ctx.Provider
      value={{
        address,
        publicKey: address,
        isConnected: !!address,
        isConnecting,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  return useContext(Ctx);
}
