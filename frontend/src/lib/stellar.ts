import { rpc, Networks } from '@stellar/stellar-sdk';
export { CONTRACT_IDS } from './contract-ids';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

export const NETWORK_PASSPHRASE = Networks.TESTNET;
