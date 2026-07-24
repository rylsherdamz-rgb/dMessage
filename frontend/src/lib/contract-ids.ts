// ── Hardcoded addresses per network ─────────────────────────────────────────
const TESTNET = {
  userRegistry: 'CDHJHY3LQWJM3PPKGFA6QRDUK2JQU5DQEBFKL42I3UEZNNM6IRFF76DJ',
  socialGraph: 'CC3SRPHPKC4WIEJUSQY5KKUSHCBO2Y77VDXIDRKX6XVZLHKTIOQEPULK',
  messages: 'CB6A3AMUSDIH7KKZRQ4Y2MT6PSBFQPJND5T5USLQJGTQAPTQ4IIX3QEE',
} as const;

const MAINNET = {
  userRegistry: 'CBXX465FRKWQMWPPX3YDEBHPHC2K2L55VWLCPZCRRZB77ZVDABFC33YY',
  socialGraph: 'CBUC7OBYGSMRIHPARU4B77M4LSRPY5X7LSGOGYO3HZXH5RFAPP752CY5',
  messages: 'CB4YOOUV3MLKN6AMRFETCYAD2HRHFUI45IUUCE3KXAJTZZJYBMOG76WX',
} as const;

// ── Runtime override (localStorage — switched by NetworkBadge) ──────────────
let _runtimeMainnet: boolean | null = null;
try {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('dmessage:network');
    _runtimeMainnet = stored === 'mainnet';
  }
} catch { /* localStorage unavailable */ }

const ENV_MAINNET = process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet';

// When runtime override is active (user toggled via NetworkBadge), ignore env
// vars entirely — use hardcoded addresses matching the selected network.
// Otherwise fall back to env vars (from deployment.json / .env.local).
export const CONTRACT_IDS: { readonly [K in keyof typeof TESTNET]: string } = _runtimeMainnet !== null
  ? (_runtimeMainnet ? MAINNET : TESTNET)
  : {
      userRegistry: process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY ?? TESTNET.userRegistry,
      socialGraph: process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH ?? TESTNET.socialGraph,
      messages: process.env.NEXT_PUBLIC_CONTRACT_MESSAGES ?? TESTNET.messages,
    };
