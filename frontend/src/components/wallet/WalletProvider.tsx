'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter';
import { xBullModule } from '@creit.tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr';
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana';
import {
  getAddress,
  isConnected,
  requestAccess,
  signTransaction as freighterSign,
  signAuthEntry as freighterSignAuthEntry,
  WatchWalletChanges,
} from '@stellar/freighter-api';
import { Buffer } from 'buffer';
import type { ReactNode } from 'react';

/** Signature returned by a wallet over a Soroban auth-entry preimage. */
export interface AuthEntrySignature {
  signature: Buffer;
  publicKey: string;
}

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
  /**
   * Signs a Soroban authorization-entry preimage (base64 XDR of the
   * HashIdPreimage) with the connected wallet. Used for gasless / fee-sponsored
   * transactions where the user authorizes the contract invocation without being
   * the transaction source. Returns the raw signature + the signer's public key.
   */
  signAuthEntry: (preimageXdrBase64: string) => Promise<AuthEntrySignature>;
}

const Ctx = createContext<WalletContext>({
  address: null,
  publicKey: null,
  isConnected: false,
  isConnecting: false,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => '',
  signAuthEntry: async () => {
    throw new Error('Wallet not connected');
  },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const watcher = useRef<WatchWalletChanges | null>(null);

  // Original Freighter sync + WatchWalletChanges (proven working)
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

  useEffect(() => {
    // Init Stellar Wallet Kit for multi-wallet auth modal
    StellarWalletsKit.init({
      modules: [
        new FreighterModule(),
        new xBullModule(),
        new LobstrModule(),
        new HanaModule(),
      ],
      network: NETWORK,
    });

    // Original Freighter auto-detect
    (async () => {
      await sync();
    })();
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
      // Try Stellar Wallet Kit auth modal first (multi-wallet)
      const { address: addr } = await StellarWalletsKit.authModal();
      setAddress(addr);
    } catch {
      // Fallback: Freighter direct connect
      try {
        await requestAccess();
        await sync();
      } catch {
        setAddress(null);
      }
    } finally {
      setIsConnecting(false);
    }
  }, [sync]);

  const disconnect = useCallback(() => {
    StellarWalletsKit.disconnect();
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    try {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: NETWORK,
      });
      return signedTxXdr;
    } catch {
      const { signedTxXdr } = await freighterSign(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      return signedTxXdr;
    }
  }, []);

  const signAuthEntry = useCallback(
    async (preimageXdrBase64: string): Promise<AuthEntrySignature> => {
      if (!address) throw new Error('Wallet not connected');
      // Prefer the multi-wallet kit; fall back to Freighter directly.
      try {
        const res = await StellarWalletsKit.signAuthEntry(preimageXdrBase64, {
          networkPassphrase: NETWORK,
          address,
        });
        if (!res.signedAuthEntry) throw new Error('Empty auth-entry signature');
        return {
          signature: Buffer.from(res.signedAuthEntry, 'base64'),
          publicKey: res.signerAddress ?? address,
        };
      } catch {
        const res = await freighterSignAuthEntry(preimageXdrBase64, { address });
        if (res.error) throw new Error(res.error.message ?? 'Auth-entry signing failed');
        if (!res.signedAuthEntry) throw new Error('Empty auth-entry signature');
        return {
          signature: Buffer.from(res.signedAuthEntry, 'base64'),
          publicKey: res.signerAddress ?? address,
        };
      }
    },
    [address],
  );

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
        signAuthEntry,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet() {
  return useContext(Ctx);
}
