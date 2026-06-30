'use client';

import { Buffer } from 'buffer';
import {
  rpc,
  TransactionBuilder,
  Contract,
  Account,
  Operation,
  Address,
  authorizeEntry,
  xdr,
} from 'stellar-sdk';
import { getSorobanServer, NETWORK_PASSPHRASE } from './stellar';
import { writeContract } from './soroban';

/** Signs a Soroban auth-entry preimage (base64 XDR) and returns the signature. */
export type AuthEntrySigner = (
  preimageXdrBase64: string,
) => Promise<{ signature: Buffer; publicKey: string }>;

interface RelayerInfo {
  enabled: boolean;
  sponsor?: string;
}

let _sponsorCache: { value: string | null; at: number } | null = null;
const SPONSOR_TTL_MS = 60_000;

/**
 * Returns the sponsor/relayer public key if the gasless relayer is configured,
 * or `null` otherwise. Cached briefly to avoid hammering the endpoint.
 */
export async function getSponsorAddress(): Promise<string | null> {
  if (_sponsorCache && Date.now() - _sponsorCache.at < SPONSOR_TTL_MS) {
    return _sponsorCache.value;
  }
  try {
    const res = await fetch('/api/relay', { method: 'GET' });
    if (!res.ok) {
      _sponsorCache = { value: null, at: Date.now() };
      return null;
    }
    const info = (await res.json()) as RelayerInfo;
    const value = info.enabled && info.sponsor ? info.sponsor : null;
    _sponsorCache = { value, at: Date.now() };
    return value;
  } catch {
    _sponsorCache = { value: null, at: Date.now() };
    return null;
  }
}

/**
 * Builds a sponsor-sourced Soroban transaction that invokes a `*_sponsored`
 * contract method, has the connected user sign *only* their own authorization
 * entry, and returns the resulting transaction XDR (still unsigned by the
 * sponsor). The sponsor's own auth is satisfied via source-account credentials,
 * so the relayer only needs to sign the envelope.
 *
 * @param sponsor         sponsor/relayer public key (tx source + fee payer)
 * @param contractId      target contract
 * @param sponsoredMethod e.g. "register_user_sponsored"
 * @param userAddress     the connected user (the `caller`/`sender`)
 * @param callerArgs      the args used by the *self-paid* method (caller first);
 *                        the sponsor address is prepended automatically
 * @param signAuthEntry   wallet callback to sign the user's auth entry
 */
async function buildSponsoredXdr(
  sponsor: string,
  contractId: string,
  sponsoredMethod: string,
  userAddress: string,
  callerArgs: xdr.ScVal[],
  signAuthEntry: AuthEntrySigner,
): Promise<string> {
  const server = getSorobanServer();
  const contract = new Contract(contractId);

  // (sponsor, caller, ...rest)
  const fullArgs = [new Address(sponsor).toScVal(), ...callerArgs];
  const op = contract.call(sponsoredMethod, ...fullArgs);

  // Simulate from the sponsor as source (sequence irrelevant for simulation).
  const simSource = new Account(sponsor, '0');
  const simTx = new TransactionBuilder(simSource, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(simTx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const { sequence: latestLedger } = await server.getLatestLedger();
  const validUntil = latestLedger + 100;

  // Sign / convert each required authorization entry.
  const rawEntries = sim.result?.auth ?? [];
  const signedEntries: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of rawEntries) {
    const creds = entry.credentials();
    // Source-account credentials need no signature (covered by the envelope).
    if (
      creds.switch().value ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount().value
    ) {
      signedEntries.push(entry);
      continue;
    }

    const entryAddr = Address.fromScAddress(creds.address().address()).toString();

    if (entryAddr === sponsor) {
      // The sponsor is the tx source → use source-account credentials so the
      // relayer's envelope signature satisfies sponsor.require_auth().
      signedEntries.push(
        new xdr.SorobanAuthorizationEntry({
          credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
          rootInvocation: entry.rootInvocation(),
        }),
      );
    } else if (entryAddr === userAddress) {
      const signed = await authorizeEntry(
        entry,
        async (preimage: xdr.HashIdPreimage) => signAuthEntry(preimage.toXDR('base64')),
        validUntil,
        NETWORK_PASSPHRASE,
      );
      signedEntries.push(signed);
    } else {
      // Unexpected third-party auth requirement — leave untouched (will fail
      // loudly at submission rather than silently mis-signing).
      signedEntries.push(entry);
    }
  }

  // Rebuild the operation with the signed auth, attach the simulated Soroban
  // resource footprint, and set a fee that covers the resource cost.
  const hostFn = op.body().invokeHostFunctionOp().hostFunction();
  const finalOp = Operation.invokeHostFunction({ func: hostFn, auth: signedEntries });

  const inclusionFee = 200_000; // 0.02 XLM buffer on top of the resource fee
  const totalFee = (Number(sim.minResourceFee) + inclusionFee).toString();

  const sponsorAccount = await server.getAccount(sponsor);
  const finalTx = new TransactionBuilder(sponsorAccount, {
    fee: totalFee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(finalOp)
    .setSorobanData(sim.transactionData.build())
    .setTimeout(120)
    .build();

  return finalTx.toXDR();
}

interface RelayResult {
  hash: string;
  status: string;
  sponsor: string;
}

/** Submits a user-authorized sponsored transaction to the relayer for co-signing. */
async function submitToRelayer(txXdr: string): Promise<RelayResult> {
  const res = await fetch('/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ xdr: txXdr }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Relayer error (${res.status})`);
  }
  return data as RelayResult;
}

/**
 * Writes to a contract using the gasless / fee-sponsored path when a relayer is
 * configured, otherwise falls back to the user-paid path. Drop-in replacement
 * for `writeContract` with two extra arguments.
 *
 * @param method      the *self-paid* method name (e.g. "register_user"); the
 *                    "_sponsored" variant is used automatically when sponsored
 * @param callerArgs  args for the self-paid method (caller address first)
 */
export async function writeMaybeSponsored(
  contractId: string,
  method: string,
  callerArgs: xdr.ScVal[],
  userAddress: string,
  signTransaction: (xdr: string) => Promise<string>,
  signAuthEntry: AuthEntrySigner,
): Promise<{ hash: string; sponsored: boolean }> {
  const sponsor = await getSponsorAddress();

  if (sponsor) {
    try {
      const txXdr = await buildSponsoredXdr(
        sponsor,
        contractId,
        `${method}_sponsored`,
        userAddress,
        callerArgs,
        signAuthEntry,
      );
      const result = await submitToRelayer(txXdr);
      return { hash: result.hash, sponsored: true };
    } catch (err) {
      // If the sponsored path fails for any reason, fall back to self-paid so a
      // funded user is never blocked. (An unfunded user will still see the
      // underlying error from the self-paid attempt below.)
      console.warn('[gasless] sponsored path failed, falling back to self-paid:', err);
    }
  }

  const res = await writeContract(contractId, method, callerArgs, userAddress, signTransaction);
  return { hash: res.hash, sponsored: false };
}
