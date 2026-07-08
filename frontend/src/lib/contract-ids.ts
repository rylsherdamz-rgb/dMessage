// Resolved from env (injected from deployment.json via next.config.ts, or set in
// .env.local); fallbacks are the current audited (security-hardened) gasless
// testnet addresses. Previous contracts are deprecated — see deployment.json / README.
export const CONTRACT_IDS = {
  userRegistry:
    process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY ??
    'CDHJHY3LQWJM3PPKGFA6QRDUK2JQU5DQEBFKL42I3UEZNNM6IRFF76DJ',
  socialGraph:
    process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH ??
    'CC3SRPHPKC4WIEJUSQY5KKUSHCBO2Y77VDXIDRKX6XVZLHKTIOQEPULK',
  messages:
    process.env.NEXT_PUBLIC_CONTRACT_MESSAGES ??
    'CBZJY5T4YWK6MAMLX7H6OQU2OM4B5PITOVXV5CXXSJ7R4YCHSHCVNQIE',
} as const;
