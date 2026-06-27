'use client';

import { CONTRACT_IDS } from './stellar';
import { writeContract, arg } from './soroban';
import { ensurePublicKeyBytes } from './keystore';

export interface UsernameValidation {
  ok: boolean;
  reason?: string;
}

/**
 * Validates a desired username/handle.
 *
 * Rules (so users pick a real handle, not just digits):
 *  - 3–20 characters
 *  - lowercase letters, digits, underscore only
 *  - must contain at least one letter (rejects all-numeric handles)
 *  - cannot start or end with underscore
 */
export function validateUsername(raw: string): UsernameValidation {
  const name = raw.trim();
  if (name.length < 3) return { ok: false, reason: 'Too short (min 3)' };
  if (name.length > 20) return { ok: false, reason: 'Too long (max 20)' };
  if (!/^[a-z0-9_]+$/.test(name))
    return { ok: false, reason: 'Use a–z, 0–9, _ only (lowercase)' };
  if (/^_|_$/.test(name))
    return { ok: false, reason: 'Cannot start or end with _' };
  if (!/[a-z]/.test(name))
    return { ok: false, reason: 'Must include a letter — not just numbers' };
  return { ok: true };
}

/**
 * Best-effort availability check.
 *
 * NOTE: the current UserRegistry contract is keyed by ADDRESS and has no
 * username -> address index, so global uniqueness cannot be enforced
 * on-chain yet (tracked as future scope). This validates format and is the
 * single seam to later back with a real on-chain/indexer lookup.
 */
export async function checkUsernameAvailable(
  raw: string,
): Promise<{ available: boolean; reason?: string }> {
  const v = validateUsername(raw);
  if (!v.ok) return { available: false, reason: v.reason };
  await new Promise((r) => setTimeout(r, 250));
  return { available: true };
}

/**
 * Registers (or updates) the connected user's profile on the UserRegistry
 * contract: publishes the chosen username and the device's encryption public
 * key. Returns the send-transaction response.
 */
export async function registerUser(
  address: string,
  username: string,
  signTransaction: (xdr: string) => Promise<string>,
) {
  if (!CONTRACT_IDS.userRegistry) {
    throw new Error('UserRegistry contract id is not configured');
  }

  const pubkeyBytes = await ensurePublicKeyBytes();

  return writeContract(
    CONTRACT_IDS.userRegistry,
    'register_user',
    [
      arg.address(address),
      arg.string(username),
      arg.bytes(pubkeyBytes),
      arg.bytes(new Uint8Array()), // metadata_ipfs: empty Bytes
    ],
    address,
    signTransaction,
  );
}
