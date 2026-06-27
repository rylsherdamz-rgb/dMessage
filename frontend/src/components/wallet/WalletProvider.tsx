'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  StellarWalletsKit,
  Networks,
  KitEventType,
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
import type { ReactNode } from 'react';

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

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
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    StellarWalletsKit.init({
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
        new HanaModule(),
      ],
      network: NETWORK,
    });

    const sub = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (e) => {
      const addr = e.payload.address ?? null;
      setAddress(addr);
    });

    const rehydrate = async () => {
      try {
        const { address: addr } = await StellarWalletsKit.getAddress();
        if (addr) { setAddress(addr); return; }
      } catch { /* not in memory */ }

      try {
        const freighter = new FreighterModule();
        const { address: addr } = await freighter.getAddress({ skipRequestAccess: true });
        if (addr) {
          StellarWalletsKit.setWallet('freighter');
          setAddress(addr);
        }
      } catch {
        setAddress(null);
      }
    };
    rehydrate();

    cleanupRef.current = () => { sub(); };

    return () => { cleanupRef.current?.(); };
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const { address: addr } = await StellarWalletsKit.authModal();
      setAddress(addr);
    } catch {
      setAddress(null);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    StellarWalletsKit.disconnect();
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: NETWORK,
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
