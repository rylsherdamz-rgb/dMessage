import { Address } from 'stellar-sdk';

let cached: Map<string, Uint8Array> | undefined;

function getCache(): Map<string, Uint8Array> {
  if (!cached) cached = new Map<string, Uint8Array>();
  return cached;
}

function encodeAddress(addr: string): Uint8Array {
  const scval = new Address(addr).toScVal();
  const xdrBuf = scval.toXDR();
  // Skip 4-byte ScVal type discriminant, inner bytes are the raw Address XDR (40 bytes)
  return new Uint8Array(xdrBuf.slice(4));
}

function compareBytes(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

export async function computeConversationId(a: string, b: string): Promise<Uint8Array> {
  const cache = getCache();
  const cacheKey = a < b ? `${a}:${b}` : `${b}:${a}`;
  const cachedVal = cache.get(cacheKey);
  if (cachedVal) return cachedVal;

  const aBuf = encodeAddress(a);
  const bBuf = encodeAddress(b);

  const [first, second] = compareBytes(aBuf, bBuf) <= 0 ? [aBuf, bBuf] : [bBuf, aBuf];
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first);
  combined.set(second, first.length);

  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', combined));
  cache.set(cacheKey, hash);
  return hash;
}
