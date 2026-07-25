#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '../..');
const req = createRequire(path.join(repoRoot, 'frontend/package.json'));
const sdk = req('@stellar/stellar-sdk');
const { Keypair, TransactionBuilder, Account, Operation, Asset } = sdk;

const HORIZON = 'https://horizon.stellar.org';
const PASSPHRASE = 'Public Global Stellar Network ; September 2015';

function stellarCmd(...args) {
  return execFileSync('stellar', args, { encoding: 'utf8' }).trim();
}

async function httpGet(url) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function httpPost(url, body) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(body).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(qs);
    req.end();
  });
}

async function main() {
  const csvPath = process.argv[2];
  const count = parseInt(process.argv[3], 10) || 20;
  const sponsorName = process.env.SPONSOR_KEY || 'my-wallet';

  if (!csvPath) { console.error('Usage: _recover-accounts.cjs <csv> [count]'); process.exit(2); }

  const sponsorSecret = stellarCmd('keys', 'secret', sponsorName);
  const sponsorKp = Keypair.fromSecret(sponsorSecret);
  const sponsorAddr = sponsorKp.publicKey();
  const EXTRA = '0.001';

  const lines = execFileSync('tail', ['-n', `+2`, csvPath], { encoding: 'utf8' }).split('\n').filter(Boolean);

  // Phase 1: identify which accounts exist
  const funded = [];
  for (let i = 0; i < Math.min(count, lines.length); i++) {
    const fields = lines[i].split(',');
    const identity = fields[0].trim();
    const address = stellarCmd('keys', 'address', identity);
    const data = await httpGet(`${HORIZON}/accounts/${address}`).catch(() => null);
    if (data && data.sequence) {
      funded.push({ identity, address, seq: data.sequence });
    } else {
      console.log(`  ${identity} does not exist, skipping`);
    }
  }
  console.log(`Found ${funded.length} funded accounts`);

  if (funded.length === 0) { console.log('Nothing to recover'); return; }

  // Phase 2: send 0.001 XLM to each funded account to cover merge fee
  console.log('\n--- Phase 2: sending 0.001 XLM each for fee coverage ---');
  const sponsorData = await httpGet(`${HORIZON}/accounts/${sponsorAddr}`);
  let source = new Account(sponsorAddr, sponsorData.sequence);

  const ops = funded.map(a =>
    Operation.payment({ destination: a.address, asset: Asset.native(), amount: EXTRA })
  );

  const tx = new TransactionBuilder(source, {
    fee: String(100 * ops.length),
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(ops[0]);
  for (let j = 1; j < ops.length; j++) tx.addOperation(ops[j]);
  tx.setTimeout(120);
  const built = tx.build();

  built.sign(sponsorKp);
  const result = await httpPost(`${HORIZON}/transactions`, { tx: built.toXDR() });
  if (result.hash) {
    console.log(`  Sent ${EXTRA} XLM to ${funded.length} accounts — ${result.hash}`);
  } else {
    console.error(`  FAILED:`, JSON.stringify(result));
    return;
  }

  // Phase 3: merge each account back to sponsor
  console.log('\n--- Phase 3: merging accounts ---');
  let merged = 0;
  for (const a of funded) {
    // Refresh account seq
    const data = await httpGet(`${HORIZON}/accounts/${a.address}`);
    const sourceAcct = new Account(a.address, data.sequence);

    const mergeTx = new TransactionBuilder(sourceAcct, {
      fee: '100',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(Operation.accountMerge({ destination: sponsorAddr }))
      .setTimeout(120)
      .build();

    const secret = stellarCmd('keys', 'secret', a.identity);
    const kp = Keypair.fromSecret(secret);
    mergeTx.sign(kp);

    const r = await httpPost(`${HORIZON}/transactions`, { tx: mergeTx.toXDR() });
    if (r.hash) {
      console.log(`  [${merged}] Merged ${a.identity} — ${r.hash}`);
      merged++;
    } else {
      console.error(`  [${merged}] FAILED ${a.identity}:`, JSON.stringify(r.result_codes || r));
    }
  }
  console.log(`\nMerged ${merged}/${funded.length} accounts`);

  // Show final sponsor balance
  const finalData = await httpGet(`${HORIZON}/accounts/${sponsorAddr}`);
  const bal = finalData.balances.find(b => b.asset_type === 'native');
  console.log(`Sponsor balance: ${bal.balance} XLM`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
