import { rpc, Networks } from 'stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

export const CONTRACT_IDS = {
  userRegistry: 'CAFHDYYSSR7A5MRMTNY457HDDBBWYJZAQNZ22NT7TOMMBRSNC2OOBYHA',
  socialGraph: 'CCI7DBNILBDTLR2KF24I7647H5JGUSMEJDHXS6D7H6GPSQ3WEBJMUPM7',
  messages: 'CATLF3WXUG3GMD2J4XIOIYVE3ND7PBFYYXHPS4632ZXEPJPNGYNAEZK7',
} as const;

export const NETWORK_PASSPHRASE = Networks.TESTNET;
