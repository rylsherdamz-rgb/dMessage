import { rpc, Networks } from '@stellar/stellar-sdk';
export { CONTRACT_IDS } from './contract-ids';

// ── Runtime override (localStorage — switched by NetworkBadge) ──────────────
let _runtimeMainnet: boolean | null = null;
try {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('dmessage:network');
    _runtimeMainnet = stored === 'mainnet' ? true : stored === 'testnet' ? false : null;
  }
} catch { /* localStorage unavailable */ }

const ENV_MAINNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet';
const IS_MAINNET = _runtimeMainnet ?? ENV_MAINNET;

const RPC_URL = _runtimeMainnet === true
  ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
  : _runtimeMainnet === false
    ? 'https://soroban-testnet.stellar.org'
    : process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';

let _server: rpc.Server | null = null;

export function getSorobanServer(): rpc.Server {
  if (!_server) {
    _server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  }
  return _server;
}

export const NETWORK_PASSPHRASE = IS_MAINNET ? Networks.PUBLIC : Networks.TESTNET;
