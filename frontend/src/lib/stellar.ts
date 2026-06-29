import { rpc, Networks } from 'stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

// Current deployment: gasless / fee-sponsored contracts.
// Previous non-gasless contracts are deprecated — see README "Deprecated Contracts".
export const CONTRACT_IDS = {
  userRegistry: 'CD3SG54U3XKT4SOK2T25HZRF244Q5KWSXCKTNCIQH44ZPBB2OZ4F6YZG',
  socialGraph: 'CCEOAERFEEVPFRVKMIXYBWQGS5H5N7ZYNY2JJ37TG4AI4V2W5XGFGB2Q',
  messages: 'CDK2AI4JMCD6I53TCYKL5WISQADKE6VHQKHRWK7NTFJ2TQOSM2RIIYY3',
} as const;

export const NETWORK_PASSPHRASE = Networks.TESTNET;
