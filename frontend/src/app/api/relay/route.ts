import { NextResponse } from 'next/server';
import {
  rpc,
  TransactionBuilder,
  Keypair,
  Networks,
  Address,
  xdr,
  scValToNative,
} from 'stellar-sdk';
import { CONTRACT_IDS } from '@/lib/contract-ids';
import { precheck, recordSpend, usageSnapshot } from '@/lib/relay-guard';

/**
 * Fee-sponsorship relayer.
 *
 * The relayer is the **sponsor**: it is the source account (and therefore the
 * fee payer) of the Soroban transaction. The user never needs XLM or even a
 * funded account — they only sign their own Soroban authorization entry on the
 * client (see `lib/gasless.ts`). This endpoint co-signs the transaction envelope
 * with the sponsor key and submits it.
 *
 * Security: the sponsor secret lives only on the server (`SPONSOR_SECRET`). Every
 * inbound transaction is validated before signing — it must be sourced by the
 * sponsor, contain exactly one `invokeHostFunction` operation that calls one of
 * our known contracts via a `*_sponsored` method, and name the sponsor as its
 * first argument. This bounds what the sponsor will ever pay for.
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

/**
 * Optional Origin allowlist. Set `RELAY_ALLOWED_ORIGINS` to a comma-separated
 * list (e.g. "https://dmessage.app,https://www.dmessage.app") to reject requests
 * from other origins. If unset, all origins are allowed (convenient for local
 * dev). This is defense-in-depth against drive-by abuse from other sites; the
 * per-address rate limits and spend cap are the primary protection.
 */
function originAllowed(req: Request): boolean {
  const raw = process.env.RELAY_ALLOWED_ORIGINS;
  if (!raw) return true;
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  const origin = req.headers.get('origin');
  if (!origin) return false; // allowlist configured -> require a known Origin
  return allowed.includes(origin);
}

/** Returns the sponsor public key + current usage so the client can build a sponsor-sourced tx. */
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
    return NextResponse.json(
      { error: 'Relayer not configured (SPONSOR_SECRET unset)' },
      { status: 503 },
    );
  }

  if (!originAllowed(req)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  let body: { xdr?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body.xdr || typeof body.xdr !== 'string') {
    return NextResponse.json({ error: 'Missing transaction xdr' }, { status: 400 });
  }

  // Parse + validate the user-authorized transaction.
  let tx;
  try {
    tx = TransactionBuilder.fromXDR(body.xdr, NETWORK_PASSPHRASE);
  } catch {
    return NextResponse.json({ error: 'Malformed transaction xdr' }, { status: 400 });
  }
  if ('innerTransaction' in tx) {
    return NextResponse.json({ error: 'Fee-bump envelopes are not accepted' }, { status: 400 });
  }

  const validation = validateSponsoredTx(tx, kp.publicKey());
  if (!validation.ok || !validation.caller || !validation.method) {
    return NextResponse.json({ error: validation.reason ?? 'Invalid transaction' }, { status: 400 });
  }

  // Abuse protection: per-address rate limits, per-tx fee cap, daily spend cap.
  const feeStroops = Number((tx as unknown as { fee: string }).fee);
  const guard = precheck({
    caller: validation.caller,
    method: validation.method,
    feeStroops,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.status ?? 429 });
  }

  // Co-sign with the sponsor (source account) and submit.
  try {
    tx.sign(kp);
  } catch {
    return NextResponse.json({ error: 'Sponsor signing failed' }, { status: 500 });
  }

  const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http://') });

  let send;
  try {
    send = await server.sendTransaction(tx);
  } catch (e) {
    return NextResponse.json(
      { error: 'Submission failed', detail: (e as Error).message },
      { status: 502 },
    );
  }

  if (send.status === 'ERROR') {
    // Rejected before inclusion → no fee charged, so nothing to record.
    return NextResponse.json(
      { error: 'Transaction rejected by network', detail: send.errorResult?.toXDR('base64') },
      { status: 502 },
    );
  }

  // The transaction was accepted for inclusion. It is now billed to the sponsor
  // even if the Soroban call ultimately fails, so record the spend + action now.
  recordSpend({ caller: validation.caller, method: validation.method, feeStroops });

  // Best-effort short poll so the client gets a final status.
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
      // keep polling
    }
  }

  const success = finalStatus === 'SUCCESS' || finalStatus === 'PENDING';
  return NextResponse.json({ hash, status: finalStatus, sponsor: kp.publicKey() }, {
    status: success ? 200 : 502,
  });
}

interface Validation {
  ok: boolean;
  reason?: string;
  /** Decoded caller (the sponsored user) — present when ok. */
  caller?: string;
  /** Decoded contract method name — present when ok. */
  method?: string;
}

/**
 * Enforces that the transaction is exactly what a relayer should ever pay for:
 * sourced by the sponsor, a single invoke-contract op against a known contract,
 * a `*_sponsored` method, with the sponsor as the first argument.
 */
function validateSponsoredTx(tx: ReturnType<typeof TransactionBuilder.fromXDR>, sponsor: string): Validation {
  // Narrow away the fee-bump case (already handled by caller).
  const inner = tx as unknown as {
    source: string;
    operations: { type: string; func?: xdr.HostFunction }[];
  };

  if (inner.source !== sponsor) {
    return { ok: false, reason: 'Transaction is not sourced by the sponsor' };
  }
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

  // First contract argument must be the sponsor address (matches the contract's
  // `sponsor.require_auth()` accounting). The second argument is the sponsored
  // user (caller/sender), used for per-address rate limiting.
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
