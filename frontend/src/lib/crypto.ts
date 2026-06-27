export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey'],
  );
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(plaintext);
  const buf = Uint8Array.from(encoded);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf as BufferSource);
  return { ciphertext, iv };
}

export async function decrypt(
  data: ArrayBuffer | Uint8Array,
  iv: Uint8Array,
  key: CryptoKey,
): Promise<string> {
  const src = data instanceof Uint8Array ? data : new Uint8Array(data);
  const buf = Uint8Array.from(src);
  const params = { name: 'AES-GCM' as const, iv };
  const plain = await crypto.subtle.decrypt(params, key, buf as BufferSource);
  return new TextDecoder().decode(plain);
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', key);
  const view = Uint8Array.from(new Uint8Array(raw));
  const bytes: number[] = [];
  for (let i = 0; i < view.length; i++) bytes.push(view[i]);
  return btoa(String.fromCharCode(...bytes));
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', raw as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
}
