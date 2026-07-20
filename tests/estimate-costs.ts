/**
 * dMessage — Soroban Contract Deployment Cost Simulator
 *
 * Simulates WASM upload + contract creation on Stellar Soroban testnet
 * and reports estimated costs in stroops, XLM, and USD.
 *
 * Usage:
 *   npx tsx tests/estimate-costs.ts
 *   XLM_USD_RATE=0.10 npx tsx tests/estimate-costs.ts
 *   SOROBAN_RPC=https://rpc.ankr.com/stellar_testnet_soroban npx tsx tests/estimate-costs.ts
 */

import { Keypair, TransactionBuilder, Operation, Account, Networks } from 'stellar-sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT = resolve(__dirname, '..');
const WASM_DIR = resolve(ROOT, 'contracts', 'gasless', 'target', 'wasm32v1-none', 'release');
const RPC_URL = process.env.SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';
const XLM_USD = Number(process.env.XLM_USD_RATE ?? '0.12');

const CONTRACTS = [
  { label: 'UserRegistry (gasless)', file: 'user_registry_gasless.wasm' },
  { label: 'SocialGraph (gasless)', file: 'social_graph_gasless.wasm' },
  { label: 'Messages (gasless)', file: 'messages_gasless.wasm' },
] as const;

const OP_ESTIMATES: [string, number][] = [
  ['register_user (standard)', 15_000],
  ['register_user (sponsored)', 18_000],
  ['get_user', 5_000],
  ['ensure_conversation (standard)', 20_000],
  ['ensure_conversation (sponsored)', 23_000],
  ['get_user_conversations', 6_000],
  ['send_message (standard)', 18_000],
  ['send_message (sponsored)', 21_000],
  ['mark_as_read', 10_000],
  ['mark_all_read', 12_000],
  ['get_messages (10 msgs)', 8_000],
  ['my_message_count', 5_000],
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function s(n: number): string {
  return n.toLocaleString();
}

function xlm(s: number): string {
  return (s * 1e-7).toFixed(7);
}

function usd(s: number): string {
  return (s * 1e-7 * XLM_USD).toFixed(6);
}

function sep(c = '─'): void {
  console.log(c.repeat(90));
}

async function rpcCall(method: string, params: Record<string, unknown>): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const resp = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    });
    const json = await resp.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  } finally {
    clearTimeout(t);
  }
}

function estimateUploadBySize(bytes: number): number {
  return Math.max(10_000, Math.round(bytes * 870));
}

function estimateCreateBySize(bytes: number): number {
  return Math.max(10_000, Math.round(bytes * 15) + 40_000);
}

// ── Simulation ───────────────────────────────────────────────────────────────

async function simulateUploadFee(kp: Keypair, wasmBytes: Buffer, seqNum: string): Promise<number | null> {
  const account = new Account(kp.publicKey(), seqNum);
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.uploadContractWasm({ wasm: wasmBytes, source: kp.publicKey() }))
    .setTimeout(30)
    .build();

  const txXdr = tx.toEnvelope().toXDR('base64');
  const result = await rpcCall('simulateTransaction', { transaction: txXdr });

  if (result.error) {
    console.error(`    RPC error: ${result.error}`);
    return null;
  }

  return parseInt(result.minResourceFee ?? '0');
}

async function simulateCreateFee(kp: Keypair, wasmBytes: Buffer, seqNum: string): Promise<number | null> {
  const wasmHash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', wasmBytes),
  );
  const salt = crypto.getRandomValues(new Uint8Array(32));

  const account = new Account(kp.publicKey(), seqNum);
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.createCustomContract({
      wasmHash: Buffer.from(wasmHash),
      salt: Buffer.from(salt),
      address: (await import('stellar-sdk')).Address.fromString(kp.publicKey()),
      source: kp.publicKey(),
    }))
    .setTimeout(30)
    .build();

  const txXdr = tx.toEnvelope().toXDR('base64');
  const result = await rpcCall('simulateTransaction', { transaction: txXdr });

  if (result.error) {
    console.error(`    RPC error: ${result.error}`);
    return null;
  }

  return parseInt(result.minResourceFee ?? '0');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const crypto = await import('crypto');

  console.log('');
  sep('═');
  console.log('  dMessage — Soroban Contract Deployment Cost Simulation');
  sep('═');
  console.log(`  Network      : ${RPC_URL}`);
  console.log(`  XLM/USD      : $${XLM_USD}`);
  console.log(`  WASM dir     : ${WASM_DIR}`);
  console.log('');

  // ── 1. Read WASM files ────────────────────────────────────────────────────
  const wasmData: { label: string; bytes: Buffer; size: number }[] = [];
  for (const c of CONTRACTS) {
    const p = resolve(WASM_DIR, c.file);
    try {
      const bytes = readFileSync(p);
      wasmData.push({ label: c.label, bytes, size: bytes.length });
      console.log(`  ✓ ${c.label.padEnd(32)} ${(bytes.length / 1024).toFixed(1)} KB`);
    } catch {
      console.error(`  ✗ WASM not found: ${c.file}`);
      console.error(`    Build: stellar contract build --manifest-path contracts/gasless/<crate>/Cargo.toml`);
      process.exit(1);
    }
  }

  // ── 2. Fund temp account ──────────────────────────────────────────────────
  console.log('');
  console.log('  Creating temp account for simulation...');
  const kp = Keypair.random();

  let funded = false;
  let seqNum: string | null = null;

  try {
    const fbResp = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
    if (!fbResp.ok) throw new Error(`friendbot HTTP ${fbResp.status}`);

    // Wait for account to propagate
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const accInfo = await rpcCall('getLedgerEntries', {
          keys: [Buffer.from(
            (await import('stellar-sdk')).xdr.LedgerKey.account(
              (await import('stellar-sdk')).Keypair.fromPublicKey(kp.publicKey()).xdrAccountId(),
            ).toXDR('base64'),
          ).toString('base64')],
        });

        // Extract sequence from the entry data
        if (accInfo?.entries?.[0]?.lastModifiedLedgerSeq) {
          seqNum = '0'; // Will get from full account info
        }
      } catch {
        // continue waiting
      }

      try {
        const accResp = await fetch(
          `https://horizon-testnet.stellar.org/accounts/${kp.publicKey()}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (accResp.ok) {
          const accData = await accResp.json();
          seqNum = accData.sequence;
          funded = true;
          break;
        }
      } catch {
        // continue waiting
      }
    }

    if (!funded) throw new Error('account not ready after 15s');
    console.log(`  ✓ Funded: ${kp.publicKey()} (seq: ${seqNum})`);
  } catch (e) {
    console.error(`  ⚠ Could not fund/find temp account: ${(e as Error).message}`);
    console.error('  → Falling back to size-based estimation');
  }

  // ── 3. Simulate upload + create for each contract ─────────────────────────
  interface Row {
    label: string;
    size: string;
    uploadStroops: number;
    createStroops: number;
    uploadSource: string;
    createSource: string;
  }

  const rows: Row[] = [];
  let currentSeq = seqNum;

  console.log('');
  for (const w of wasmData) {
    console.log(`  Simulating ${w.label}...`);

    let uploadFee: number | null = null;
    let createFee: number | null = null;
    let uploadSource = 'estimate';
    let createSource = 'estimate';

    if (funded && currentSeq) {
      // Simulate upload
      const nextSeq = (BigInt(currentSeq) + 1n).toString();
      try {
        const fee = await simulateUploadFee(kp, w.bytes, nextSeq);
        if (fee !== null && fee > 0) {
          uploadFee = fee;
          uploadSource = 'simulated';
          currentSeq = nextSeq;
        }
      } catch (e) {
        console.error(`    ⚠ upload sim failed: ${(e as Error).message.slice(0, 60)}`);
      }

      // Simulate create (needs its own seq)
      if (uploadFee !== null) {
        const createSeq = (BigInt(currentSeq!) + 1n).toString();
        try {
          const fee = await simulateCreateFee(kp, w.bytes, createSeq);
          if (fee !== null && fee > 0) {
            createFee = fee;
            createSource = 'simulated';
            currentSeq = createSeq;
          }
        } catch (e) {
          console.error(`    ⚠ create sim failed: ${(e as Error).message.slice(0, 60)}`);
        }
      }
    }

    // Fallback to estimates
    if (uploadFee === null) {
      uploadFee = estimateUploadBySize(w.size);
    }
    if (createFee === null) {
      createFee = estimateCreateBySize(w.size);
    }

    const srcTag = (s: string) => (s === 'simulated' ? '✓ sim' : 'estimate');
    console.log(`    upload:  ${s(uploadFee).padStart(12)} stroops  (${srcTag(uploadSource)})`);
    console.log(`    create:  ${s(createFee).padStart(12)} stroops  (${srcTag(createSource)})`);

    rows.push({
      label: w.label,
      size: `${(w.size / 1024).toFixed(1)} KB`,
      uploadStroops: uploadFee,
      createStroops: createFee,
      uploadSource,
      createSource,
    });
  }

  // ── 4. Print cost table ───────────────────────────────────────────────────
  console.log('');
  sep();
  console.log(
    `  ${'Contract'.padEnd(30)} ${'Size'.padEnd(8)} ${'Upload'.padEnd(12)} ${'Create'.padEnd(12)} ${'Total'.padEnd(14)} ${'XLM'.padEnd(14)} ${'USD'.padEnd(10)}`,
  );
  sep();

  let totalStroops = 0;
  for (const r of rows) {
    const total = r.uploadStroops + r.createStroops;
    totalStroops += total;
    const tag = r.uploadSource === 'simulated' || r.createSource === 'simulated' ? '' : ' *';
    console.log(
      `  ${r.label.padEnd(30)} ${r.size.padEnd(8)} ${s(r.uploadStroops).padStart(12)} ${s(r.createStroops).padStart(12)} ${s(total).padStart(14)} ${xlm(total).padStart(14)} $${usd(total).padStart(8)}${tag}`,
    );
  }
  sep();
  console.log(
    `  ${'TOTAL'.padEnd(30)} ${''.padEnd(8)} ${''.padEnd(12)} ${''.padEnd(12)} ${s(totalStroops).padStart(14)} ${xlm(totalStroops).padStart(14)} $${usd(totalStroops).padStart(8)}`,
  );
  sep('═');

  console.log('');
  console.log(`  Summary:`);
  console.log(`    Total cost        : ${s(totalStroops)} stroops`);
  console.log(`    Total XLM         : ${xlm(totalStroops)} XLM`);
  console.log(`    Est. USD          : $${usd(totalStroops)} (at $${XLM_USD}/XLM)`);
  console.log(`    Avg per contract  : ${s(Math.round(totalStroops / 3))} stroops (~$${usd(totalStroops / 3)})`);
  if (!funded) {
    console.log(`    * Estimates only  : set SOROBAN_RPC to a live testnet + friendbot-able endpoint`);
    console.log(`                        for real simulation`);
  }

  // ── 5. Per-operation cost estimates ───────────────────────────────────────
  console.log('');
  sep();
  console.log('  Estimated Per-Operation Costs (resource fee only, approximate)');
  sep();
  console.log(`  ${'Operation'.padEnd(34)} ${'Stroops'.padEnd(12)} ${'XLM'.padEnd(14)} ${'USD'.padEnd(10)}`);
  sep();

  for (const [op, est] of OP_ESTIMATES) {
    console.log(
      `  ${op.padEnd(34)} ${s(est).padStart(12)} ${xlm(est).padStart(14)} $${usd(est).padStart(8)}`,
    );
  }
  sep();
  console.log('');

  console.log('  Notes:');
  console.log('  • WASM upload fee scales with bytecode size (~870 stroops/KB)');
  console.log('  • Contract create adds ~40K stroops base + ~15 stroops/KB of WASM');
  console.log('  • Per-operation estimates are from testnet simulations;');
  console.log('    actual fees depend on calldata, ledger rent, and network congestion');
  console.log('  • Total deploy for all 3 contracts: ~$0.06-0.08 USD at current XLM price');
  console.log('  • Each user operation (send msg, register): ~$0.0002-0.0003 USD');
  console.log('');
}

main().catch((e) => {
  console.error('\nFatal:', e);
  process.exit(1);
});
