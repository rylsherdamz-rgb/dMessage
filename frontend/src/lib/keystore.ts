'use client';

import { generateKeyPair } from './crypto';

/**
 * Local encryption-key storage.
 *
 * The X25519/P-256 ECDH keypair used for E2EE lives only in this browser.
 * The PUBLIC key is published on-chain (UserRegistry) so peers can encrypt to
 * you; the PRIVATE key never leaves the device.
 *
 * NOTE: localStorage is convenient but not hardware-backed. A production build
 * should consider WebCrypto non-extractable keys + IndexedDB, or a wallet-
 * derived key. This is acceptable for the testnet build only.
 */
const PRIV_KEY = 'dmessage:privkey:jwk';
const PUB_KEY = 'dmessage:pubkey:spki';

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function hasLocalKey(): boolean {
  try {
    return !!localStorage.getItem(PRIV_KEY) && !!localStorage.getItem(PUB_KEY);
  } catch {
    return false;
  }
}

export function getStoredPublicKeyB64(): string | null {
  try {
    return localStorage.getItem(PUB_KEY);
  } catch {
    return null;
  }
}

/** Generates a fresh keypair and persists it, returning the public key (spki bytes + b64). */
export async function createAndStoreKeyPair(): Promise<{
  publicKeyBytes: Uint8Array;
  publicKeyB64: string;
}> {
  const pair = await generateKeyPair();

  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const b64 = bytesToB64(spki);

  localStorage.setItem(PRIV_KEY, JSON.stringify(jwk));
  localStorage.setItem(PUB_KEY, b64);

  return { publicKeyBytes: spki, publicKeyB64: b64 };
}

/** Loads the stored public key as spki bytes, or creates a keypair if none exists. */
export async function ensurePublicKeyBytes(): Promise<Uint8Array> {
  const existing = getStoredPublicKeyB64();
  if (existing) {
    return Uint8Array.from(atob(existing), (c) => c.charCodeAt(0));
  }
  const { publicKeyBytes } = await createAndStoreKeyPair();
  return publicKeyBytes;
}

/** Imports the stored private key for ECDH key derivation. */
export async function loadPrivateKey(): Promise<CryptoKey | null> {
  try {
    const raw = localStorage.getItem(PRIV_KEY);
    if (!raw) return null;
    const jwk = JSON.parse(raw) as JsonWebKey;
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey'],
    );
  } catch {
    return null;
  }
}
