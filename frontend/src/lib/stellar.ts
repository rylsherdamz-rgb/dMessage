import { rpc, Networks } from 'stellar-sdk';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

// Current deployment: security-hardened gasless / fee-sponsored contracts.
// Resolved from env (injected from deployment.json via next.config.ts, or set in
// .env.local); the fallbacks are the current audited testnet addresses so the app
// works even without env. Previous contracts are deprecated — see README.
export const CONTRACT_IDS = {
  userRegistry:
    process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY ??
    'CDHJHY3LQWJM3PPKGFA6QRDUK2JQU5DQEBFKL42I3UEZNNM6IRFF76DJ',
  socialGraph:
    process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH ??
    'CC3SRPHPKC4WIEJUSQY5KKUSHCBO2Y77VDXIDRKX6XVZLHKTIOQEPULK',
  messages:
    process.env.NEXT_PUBLIC_CONTRACT_MESSAGES ??
    'CAGETMAVXLCMB7NLZFF6TPHVAXJAQY4DQ2CTJWPQP5TL32PLQT7IVBEO',
} as const;

export const NETWORK_PASSPHRASE = Networks.TESTNET;
