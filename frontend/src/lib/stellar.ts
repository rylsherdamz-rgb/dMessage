import SorobanClient from 'stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: any = null;

export function getSorobanServer() {
  if (!_server) {
    _server = new SorobanClient.SorobanRpc.Server(RPC_URL);
  }
  return _server;
}

export const CONTRACT_IDS = {
  userRegistry: process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY ?? '',
  socialGraph: process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH ?? '',
  messages: process.env.NEXT_PUBLIC_CONTRACT_MESSAGES ?? '',
} as const;

export const NETWORK_PASSPHRASE = SorobanClient.Networks.TESTNET;
