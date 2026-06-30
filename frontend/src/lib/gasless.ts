'use client';

import {
  rpc,
  TransactionBuilder,
  Contract,
  Account,
  Operation,
  Address,
  xdr,
} from 'stellar-sdk';
import { getSorobanServer, NETWORK_PASSPHRASE } from './stellar';
import { writeContract } from './soroban';

/**
 * Legacy auth-entry signer type, kept so existing call sites compile unchanged.
 * The fee-bump relay flow below no longer needs it — the user signs the whole
 * inner transaction via `signTransaction` instead — but callers still pass it.
 */
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
 * Builds the **inner** Soroban transaction for the fee-bump gasless flow:
 *
 *  - source account = the USER (so the user authorizes by signing the whole
 *    inner transaction with `signTransaction` — the same reliable call the
 *    self-paid path uses, instead of the fragile `signAuthEntry`);
 *  - the user's Soroban auth entry is converted to *source-account* credentials
 *    (satisfied by the user's envelope signature);
 *  - the sponsor's auth entry is left unsigned here — the relayer signs it
 *    server-side in the `prepare` phase (the sponsor key never touches the
 *    browser).
 *
 * Returns the unsigned inner-tx XDR (with footprint + resource fee attached).
 */
async function buildInnerTxXdr(
  sponsor: string,
  contractId: string,
  sponsoredMethod: string,
  userAddress: string,
  callerArgs: xdr.ScVal[],
): Promise<string> {
  const server = getSorobanServer();
  const contract = new Contract(contractId);

  // (sponsor, caller, ...rest)
  const fullArgs = [new Address(sponsor).toScVal(), ...callerArgs];
  const op = contract.call(sponsoredMethod, ...fullArgs);

  const sourceForSim = await server.getAccount(userAddress);
  const simTx = new TransactionBuilder(sourceForSim, {
    fee: '1000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(simTx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  // Convert the user's auth to source-account creds; leave the sponsor's (and
  // any other) entry for the relayer to sign server-side.
  const rawEntries = sim.result?.auth ?? [];
  const auth: xdr.SorobanAuthorizationEntry[] = [];
  for (const entry of rawEntries) {
    const creds = entry.credentials();
    if (
      creds.switch().value ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount().value
    ) {
      auth.push(entry);
      continue;
    }
    const entryAddr = Address.fromScAddress(creds.address().address()).toString();
    if (entryAddr === userAddress) {
      auth.push(
        new xdr.SorobanAuthorizationEntry({
          credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
          rootInvocation: entry.rootInvocation(),
        }),
      );
    } else {
      auth.push(entry);
    }
  }

  const hostFn = op.body().invokeHostFunctionOp().hostFunction();
  const opWithAuth = Operation.invokeHostFunction({ func: hostFn, auth });

  // Inner-tx fee must cover the Soroban resource fee; the fee-bump adds the
  // inclusion fee on top. The sponsor pays both via the fee-bump envelope.
  const innerFee = (Number(sim.minResourceFee) + 100_000).toString();

  const source = await server.getAccount(userAddress);
  const innerTx = new TransactionBuilder(source, {
    fee: innerFee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(opWithAuth)
    .setSorobanData(sim.transactionData.build())
    .setTimeout(180)
    .build();

  return innerTx.toXDR();
}

interface RelayResult {
  hash: string;
  status: string;
  sponsor: string;
}

async function relayPost<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/relay', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Relayer error (${res.status})`);
  }
  return data as T;
}

/**
 * Writes to a contract using the gasless / fee-sponsored (fee-bump) path when a
 * relayer is configured, otherwise falls back to the user-paid path. Drop-in
 * replacement for `writeContract`.
 *
 * Flow:
 *   1. Build the inner tx (user = source) and simulate.
 *   2. `prepare`: relayer signs the sponsor's Soroban auth entry server-side.
 *   3. User signs the prepared inner tx with their wallet (`signTransaction`).
 *   4. `submit`: relayer wraps it in a fee-bump (sponsor pays) and submits.
 *
 * @param method      the *self-paid* method name (e.g. "send_message"); the
 *                    "_sponsored" variant is used automatically when sponsored
 * @param callerArgs  args for the self-paid method (caller address first)
 * @param _signAuthEntry kept for call-site compatibility; unused in this flow
 */
export async function writeMaybeSponsored(
  contractId: string,
  method: string,
  callerArgs: xdr.ScVal[],
  userAddress: string,
  signTransaction: (xdr: string) => Promise<string>,
  _signAuthEntry?: AuthEntrySigner,
): Promise<{ hash: string; sponsored: boolean }> {
  const sponsor = await getSponsorAddress();

  if (sponsor) {
    try {
      const innerXdr = await buildInnerTxXdr(
        sponsor,
        contractId,
        `${method}_sponsored`,
        userAddress,
        callerArgs,
      );

      // Phase 1 — relayer signs the sponsor's auth entry (sponsor key stays server-side).
      const prepared = await relayPost<{ xdr: string }>({ phase: 'prepare', xdr: innerXdr });

      // Phase 2 — user signs the prepared inner transaction with their wallet.
      const signedInnerXdr = await signTransaction(prepared.xdr);

      // Phase 3 — relayer fee-bumps (sponsor pays) and submits.
      const result = await relayPost<RelayResult>({ phase: 'submit', xdr: signedInnerXdr });
      return { hash: result.hash, sponsored: true };
    } catch (err) {
      // Fall back to self-paid so a funded user is never blocked. Logged loudly
      // so a misconfigured/failing relayer is diagnosable rather than silent.
      console.warn('[gasless] sponsored path failed, falling back to self-paid:', err);
    }
  }

  const res = await writeContract(contractId, method, callerArgs, userAddress, signTransaction);
  return { hash: res.hash, sponsored: false };
}
