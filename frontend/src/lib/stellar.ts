import { rpc, Networks } from 'stellar-sdk';
import { CONTRACT_IDS as FALLBACK_IDS } from './contract-ids';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

export const CONTRACT_IDS = {
  userRegistry: process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY || FALLBACK_IDS.userRegistry,
  socialGraph: process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH || FALLBACK_IDS.socialGraph,
  messages: process.env.NEXT_PUBLIC_CONTRACT_MESSAGES || FALLBACK_IDS.messages,
} as const;

export const NETWORK_PASSPHRASE = Networks.TESTNET;
