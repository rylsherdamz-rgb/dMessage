import { NextResponse } from 'next/server';
import {
  rpc,
  TransactionBuilder,
  Keypair,
  Networks,
  Address,
  authorizeEntry,
  xdr,
  scValToNative,
} from 'stellar-sdk';
import { CONTRACT_IDS } from '@/lib/contract-ids';
import { precheck, recordSpend, usageSnapshot } from '@/lib/relay-guard';

/**
 * Fee-sponsorship relayer (fee-bump model).
 *
 * The user is the **source** of the inner Soroban transaction and authorizes it
 * by signing the whole inner transaction in their wallet (`signTransaction`) —
 * the same reliable call the self-paid path uses. The relayer:
 *
 *   - `prepare`: signs the SPONSOR's Soroban auth entry server-side (the sponsor
 *     key never leaves the server), returning the inner tx for the user to sign;
 *   - `submit`: wraps the user-signed inner tx in a Stellar **fee-bump**
 *     transaction whose fee source is the sponsor, so the sponsor pays the fee
 *     and the user spends no XLM.
 *
 * Security: every inbound tx must be a single `invokeHostFunction` op calling one
 * of our known contracts via a `*_sponsored` method whose first argument is the
 * sponsor — this bounds exactly what the sponsor will ever sign/pay for. The
 * user's account must already exist on-chain (Soroban authenticates G-address
 * auth against the ledger account).
 */

export const runtime = 'nodejs';

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

const ALLOWED_CONTRACTS = new Set<string>(
  [CONTRACT_IDS.userRegistry, CONTRACT_IDS.socialGraph, CONTRACT_IDS.messages].filter(Boolean),
);

function sponsorKeypair(): Keypair | null {
  const secret = process.env.SPONSOR_SECRET;
  if (!secret) return null;
  try {
    return Keypair.fromSecret(secret.trim());
  } catch {
    return null;
  }
}

function originAllowed(req: Request): boolean {
  const raw = process.env.RELAY_ALLOWED_ORIGINS;
  if (!raw) return true;
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  return allowed.includes(origin);
}

/** Returns the sponsor public key + current usage so the client can build a sponsored tx. */
export async function GET() {
  const kp = sponsorKeypair();
  if (!kp) {
    return NextResponse.json(
      { enabled: false, error: 'Relayer not configured (SPONSOR_SECRET unset)' },
      { status: 503 },
    );
  }
  return NextResponse.json({ enabled: true, sponsor: kp.publicKey(), usage: usageSnapshot() });
}

export async function POST(req: Request) {
  const kp = sponsorKeypair();
  if (!kp) {
    return NextResponse.json({ error: 'Relayer not configured (SPONSOR_SECRET unset)' }, { status: 503 });
  }
  if (!originAllowed(req)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  let body: { phase?: string; xdr?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.xdr || typeof body.xdr !== 'string') {
    return NextResponse.json({ error: 'Missing transaction xdr' }, { status: 400 });
  }
  const phase = body.phase ?? 'submit';

  if (phase === 'prepare') return handlePrepare(body.xdr, kp);
  if (phase === 'submit') return handleSubmit(body.xdr, kp);
  return NextResponse.json({ error: `Unknown phase '${phase}'` }, { status: 400 });
}

/**
 * Phase 1: validate the inner tx and sign the sponsor's Soroban auth entry.
 * Returns the inner tx XDR (sponsor auth signed) for the user to sign.
 */
async function handlePrepare(innerXdr: string, kp: Keypair) {
  let tx;
  try {
    tx = TransactionBuilder.fromXDR(innerXdr, NETWORK_PASSPHRASE);
  } catch {
    return NextResponse.json({ error: 'Malformed transaction xdr' }, { status: 400 });
  }
  if ('innerTransaction' in tx) {
    return NextResponse.json({ error: 'Fee-bump envelopes are not accepted' }, { status: 400 });
  }
  const validation = validateSponsoredTx(tx, kp.publicKey());
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason ?? 'Invalid transaction' }, { status: 400 });
  }

  // Sign the sponsor's auth entry at the XDR level so the rest of the inner tx
  // (source, sequence, fee, footprint) is preserved byte-for-byte for the user.
  const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  let validUntil: number;
  try {
    const latest = await server.getLatestLedger();
    validUntil = latest.sequence + 100;
  } catch (e) {
    return NextResponse.json({ error: 'RPC unavailable', detail: (e as Error).message }, { status: 502 });
  }

  try {
    const env = xdr.TransactionEnvelope.fromXDR(innerXdr, 'base64');
    const ihf = env.v1().tx().operations()[0].body().invokeHostFunctionOp();
    const entries = ihf.auth();
    const newEntries: xdr.SorobanAuthorizationEntry[] = [];
    for (const entry of entries) {
      const creds = entry.credentials();
      if (creds.switch().name === 'sorobanCredentialsAddress') {
        const addr = Address.fromScAddress(creds.address().address()).toString();
        if (addr === kp.publicKey()) {
          newEntries.push(await authorizeEntry(entry, kp, validUntil, NETWORK_PASSPHRASE));
          continue;
        }
      }
      newEntries.push(entry);
    }
    ihf.auth(newEntries);
    return NextResponse.json({ xdr: env.toXDR('base64') });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to sign sponsor auth', detail: (e as Error).message }, { status: 500 });
  }
}

/**
 * Phase 2: validate the user-signed inner tx, fee-bump it with the sponsor as
 * fee source, and submit. The sponsor pays the fee; the user pays nothing.
 */
async function handleSubmit(innerXdr: string, kp: Keypair) {
  let inner;
  try {
    inner = TransactionBuilder.fromXDR(innerXdr, NETWORK_PASSPHRASE);
  } catch {
    return NextResponse.json({ error: 'Malformed transaction xdr' }, { status: 400 });
  }
  if ('innerTransaction' in inner) {
    return NextResponse.json({ error: 'Fee-bump envelopes are not accepted' }, { status: 400 });
  }

  const validation = validateSponsoredTx(inner, kp.publicKey());
  if (!validation.ok || !validation.caller || !validation.method) {
    return NextResponse.json({ error: validation.reason ?? 'Invalid transaction' }, { status: 400 });
  }

  const innerFee = (inner as unknown as { fee: string }).fee;
  // Fee-bump charges roughly the inner fee again as inclusion headroom; bound by
  // the inner fee which is itself the resource fee + a small buffer.
  const feeStroops = Number(innerFee) * 2;
  const guard = precheck({ caller: validation.caller, method: validation.method, feeStroops });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.status ?? 429 });
  }

  let feeBump;
  try {
    feeBump = TransactionBuilder.buildFeeBumpTransaction(kp, innerFee, inner, NETWORK_PASSPHRASE);
    feeBump.sign(kp);
  } catch (e) {
    return NextResponse.json({ error: 'Fee-bump build failed', detail: (e as Error).message }, { status: 500 });
  }

  const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });
  let send;
  try {
    send = await server.sendTransaction(feeBump);
  } catch (e) {
    return NextResponse.json({ error: 'Submission failed', detail: (e as Error).message }, { status: 502 });
  }
  if (send.status === 'ERROR') {
    return NextResponse.json(
      { error: 'Transaction rejected by network', detail: send.errorResult?.toXDR('base64') },
      { status: 502 },
    );
  }

  // Accepted for inclusion → billed to the sponsor even if the Soroban call later
  // fails, so record the spend + action now.
  recordSpend({ caller: validation.caller, method: validation.method, feeStroops });

  const hash = send.hash;
  let finalStatus: string = send.status;
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const got = await server.getTransaction(hash);
      if (got.status !== 'NOT_FOUND') {
        finalStatus = got.status;
        if (got.status === 'SUCCESS' || got.status === 'FAILED') break;
      }
    } catch {
      // keep polling (SDK can throw on result XDR parsing for some metas)
    }
  }

  const success = finalStatus === 'SUCCESS' || finalStatus === 'PENDING';
  return NextResponse.json(
    { hash, status: finalStatus, sponsor: kp.publicKey() },
    { status: success ? 200 : 502 },
  );
}

interface Validation {
  ok: boolean;
  reason?: string;
  caller?: string;
  method?: string;
}

/**
 * Validates that the inner tx is exactly what a relayer should sign/pay for:
 * a single invoke-contract op against a known contract, a `*_sponsored` method,
 * with the sponsor as the first argument and the caller (sponsored user) second.
 * The inner-tx source is the USER (the fee-bump fee source is the sponsor), so
 * the source is intentionally not required to be the sponsor here.
 */
function validateSponsoredTx(
  tx: ReturnType<typeof TransactionBuilder.fromXDR>,
  sponsor: string,
): Validation {
  const inner = tx as unknown as {
    operations: { type: string; func?: xdr.HostFunction }[];
  };

  if (!Array.isArray(inner.operations) || inner.operations.length !== 1) {
    return { ok: false, reason: 'Exactly one operation is required' };
  }
  const op = inner.operations[0];
  if (op.type !== 'invokeHostFunction' || !op.func) {
    return { ok: false, reason: 'Operation must be invokeHostFunction' };
  }

  let invoke: xdr.InvokeContractArgs;
  try {
    if (op.func.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) {
      return { ok: false, reason: 'Host function must invoke a contract' };
    }
    invoke = op.func.invokeContract();
  } catch {
    return { ok: false, reason: 'Unable to decode invoke-contract args' };
  }

  let contractId: string;
  try {
    contractId = Address.fromScAddress(invoke.contractAddress()).toString();
  } catch {
    return { ok: false, reason: 'Unable to decode contract address' };
  }
  if (!ALLOWED_CONTRACTS.has(contractId)) {
    return { ok: false, reason: `Contract ${contractId} is not sponsored` };
  }

  const fnName = invoke.functionName().toString();
  if (!fnName.endsWith('_sponsored')) {
    return { ok: false, reason: `Method ${fnName} is not a sponsored entry point` };
  }

  const args = invoke.args();
  if (args.length < 2) {
    return { ok: false, reason: 'Sponsored call is missing the sponsor/caller arguments' };
  }
  try {
    const firstArg = scValToNative(args[0]) as string;
    if (firstArg !== sponsor) {
      return { ok: false, reason: 'First argument must be the sponsor address' };
    }
  } catch {
    return { ok: false, reason: 'Unable to decode sponsor argument' };
  }

  let caller: string;
  try {
    caller = scValToNative(args[1]) as string;
    if (typeof caller !== 'string' || !caller.startsWith('G')) {
      return { ok: false, reason: 'Unable to decode caller address' };
    }
  } catch {
    return { ok: false, reason: 'Unable to decode caller address' };
  }

  return { ok: true, caller, method: fnName };
}
