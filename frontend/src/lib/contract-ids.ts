// Resolved from env (injected from deployment.json via next.config.ts, or set in
// .env.local); fallbacks are the current audited (security-hardened) gasless
// testnet addresses. Previous contracts are deprecated — see deployment.json / README.
export const CONTRACT_IDS = {
  userRegistry:
    process.env.NEXT_PUBLIC_CONTRACT_USER_REGISTRY ??
    'CCJO373LK257MCNEEQ24NWLL34RN34HBASNN3ASP7SBZKCA4YSUAKOF2',
  socialGraph:
    process.env.NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH ??
    'CC3SRPHPKC4WIEJUSQY5KKUSHCBO2Y77VDXIDRKX6XVZLHKTIOQEPULK',
  messages:
    process.env.NEXT_PUBLIC_CONTRACT_MESSAGES ??
    'CAGETMAVXLCMB7NLZFF6TPHVAXJAQY4DQ2CTJWPQP5TL32PLQT7IVBEO',
} as const;
