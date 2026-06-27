import { rpc, Networks } from 'stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    // `allowHttp` lets local/dev RPC endpoints work; testnet is https.
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

export const CONTRACT_IDS = {
  userRegistry: process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY ?? '',
  socialGraph: process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH ?? '',
  messages: process.env.NEXT_PUBLIC_CONTRACT_MESSAGES ?? '',
} as const;

export const NETWORK_PASSPHRASE = Networks.TESTNET;
