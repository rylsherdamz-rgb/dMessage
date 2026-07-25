#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '../..');
const req = createRequire(path.join(repoRoot, 'frontend/package.json'));
const { Keypair, TransactionBuilder, Account, Operation } = req('@stellar/stellar-sdk');

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

  if (!csvPath) { console.error('Usage: _merge-accounts.cjs <csv> [count]'); process.exit(2); }

  const sponsorAddr = stellarCmd('keys', 'address', sponsorName);
  const { execFileSync: exec } = require('child_process');
  const lines = exec('tail', ['-n', `+2`, csvPath], { encoding: 'utf8' }).split('\n').filter(Boolean);
  let merged = 0;

  for (let i = 0; i < Math.min(count, lines.length); i++) {
    const fields = lines[i].split(',');
    const identity = fields[0].trim();
    const address = stellarCmd('keys', 'address', identity);

    // Check if account exists to merge
    const data = await httpGet(`${HORIZON}/accounts/${address}`).catch(() => null);
    if (!data || !data.sequence) {
      console.log(`  ${identity} does not exist, skipping merge`);
      continue;
    }

    const secret = stellarCmd('keys', 'secret', identity);
    const kp = Keypair.fromSecret(secret);
    const source = new Account(address, data.sequence);

    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(Operation.accountMerge({ destination: sponsorAddr }))
      .setTimeout(120)
      .build();

    tx.sign(kp);
    const result = await httpPost(`${HORIZON}/transactions`, { tx: tx.toXDR() });

    if (result.hash) {
      console.log(`  [${merged}] Merged ${identity} → sponsor — ${result.hash}`);
      merged++;
    } else {
      console.error(`  [${merged}] FAILED ${identity}:`, JSON.stringify(result.result_codes || result));
    }
  }
  console.log(`Merged ${merged} accounts`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
