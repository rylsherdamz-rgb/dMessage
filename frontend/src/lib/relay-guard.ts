/**
 * Abuse protection for the gasless relayer.
 *
 * The relayer pays real XLM on mainnet, so an open endpoint with no limits is a
 * direct path to draining the sponsor wallet. This module enforces, per UTC day:
 *
 *  - a per-address cap on total sponsored actions,
 *  - a per-address cap on registrations (registration is the cheapest action to
 *    spam from fresh keypairs),
 *  - a per-transaction maximum fee (so one call can't burn a huge amount),
 *  - a global daily XLM spend ceiling (a hard stop for the whole relayer).
 *
 * State is in-memory: it is best-effort and resets on redeploy / cold start, and
 * is NOT shared across multiple serverless instances. For a multi-instance
 * production deployment, back `recordSpend`/counters with a shared store
 * (e.g. Vercel KV / Upstash Redis) — the function boundaries here are designed to
 * make that swap straightforward.
 */

const STROOPS_PER_XLM = 10_000_000;

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function stroopsFromXlmEnv(name: string, fallbackXlm: number): number {
  const raw = process.env[name];
  const xlm = raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : fallbackXlm;
  return Math.round(xlm * STROOPS_PER_XLM);
}

/** Limits are read lazily so env changes are picked up without a rebuild. */
export function getLimits() {
  return {
    maxActionsPerAddress: intFromEnv('RELAY_MAX_ACTIONS_PER_ADDRESS_PER_DAY', 30),
    maxRegistrationsPerAddress: intFromEnv('RELAY_MAX_REGISTRATIONS_PER_ADDRESS_PER_DAY', 3),
    maxFeePerTxStroops: stroopsFromXlmEnv('RELAY_MAX_FEE_PER_TX_XLM', 0.5),
    dailyCapStroops: stroopsFromXlmEnv('RELAY_DAILY_XLM_CAP', 50),
  };
}

interface DayState {
  day: string;
  totalFeeStroops: number;
  actionsByAddress: Map<string, number>;
  registrationsByAddress: Map<string, number>;
}

let state: DayState | null = null;

function utcDay(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function currentState(): DayState {
  const day = utcDay();
  if (!state || state.day !== day) {
    state = {
      day,
      totalFeeStroops: 0,
      actionsByAddress: new Map(),
      registrationsByAddress: new Map(),
    };
  }
  return state;
}

export interface GuardInput {
  /** The user (caller/sender) address being sponsored. */
  caller: string;
  /** Contract method name, e.g. "register_user_sponsored". */
  method: string;
  /** The transaction's max fee in stroops. */
  feeStroops: number;
}

export interface GuardDecision {
  ok: boolean;
  /** HTTP status to return when not ok. */
  status?: number;
  reason?: string;
}

/**
 * Checks whether a sponsored transaction is allowed *without* mutating counters.
 * Call this before submitting. On success, call {@link recordSpend} after the
 * transaction is submitted (a submitted-but-failed Soroban tx still costs fees).
 */
export function precheck({ caller, method, feeStroops }: GuardInput): GuardDecision {
  const limits = getLimits();
  const s = currentState();

  if (!Number.isFinite(feeStroops) || feeStroops <= 0) {
    return { ok: false, status: 400, reason: 'Invalid transaction fee' };
  }
  if (feeStroops > limits.maxFeePerTxStroops) {
    return {
      ok: false,
      status: 400,
      reason: `Transaction fee exceeds per-tx cap (${(limits.maxFeePerTxStroops / STROOPS_PER_XLM).toFixed(4)} XLM)`,
    };
  }
  if (s.totalFeeStroops + feeStroops > limits.dailyCapStroops) {
    return {
      ok: false,
      status: 503,
      reason: 'Relayer daily spend cap reached — try again tomorrow',
    };
  }

  const actions = s.actionsByAddress.get(caller) ?? 0;
  if (actions >= limits.maxActionsPerAddress) {
    return {
      ok: false,
      status: 429,
      reason: `Daily action limit reached for this address (${limits.maxActionsPerAddress})`,
    };
  }

  if (method.startsWith('register_user')) {
    const regs = s.registrationsByAddress.get(caller) ?? 0;
    if (regs >= limits.maxRegistrationsPerAddress) {
      return {
        ok: false,
        status: 429,
        reason: `Daily registration limit reached for this address (${limits.maxRegistrationsPerAddress})`,
      };
    }
  }

  return { ok: true };
}

/**
 * Records a submitted transaction's spend + action counts. Call this only after
 * the network has accepted the transaction for inclusion (status !== ERROR),
 * because a submitted transaction is charged even if the Soroban call fails.
 */
export function recordSpend({ caller, method, feeStroops }: GuardInput): void {
  const s = currentState();
  s.totalFeeStroops += Math.max(0, feeStroops);
  s.actionsByAddress.set(caller, (s.actionsByAddress.get(caller) ?? 0) + 1);
  if (method.startsWith('register_user')) {
    s.registrationsByAddress.set(caller, (s.registrationsByAddress.get(caller) ?? 0) + 1);
  }
}

/** Diagnostics for the GET endpoint (no secrets). */
export function usageSnapshot() {
  const limits = getLimits();
  const s = currentState();
  return {
    day: s.day,
    spentXlm: +(s.totalFeeStroops / STROOPS_PER_XLM).toFixed(4),
    dailyCapXlm: +(limits.dailyCapStroops / STROOPS_PER_XLM).toFixed(4),
    distinctAddresses: s.actionsByAddress.size,
    limits: {
      maxActionsPerAddress: limits.maxActionsPerAddress,
      maxRegistrationsPerAddress: limits.maxRegistrationsPerAddress,
      maxFeePerTxXlm: +(limits.maxFeePerTxStroops / STROOPS_PER_XLM).toFixed(4),
    },
  };
}
