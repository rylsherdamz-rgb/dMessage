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
  const startingBalance = process.env.STARTING_BALANCE || '1';

  if (!csvPath) { console.error('Usage: _fund-accounts.cjs <csv> [count]'); process.exit(2); }

  const sponsorSecret = stellarCmd('keys', 'secret', sponsorName);
  const sponsorKp = Keypair.fromSecret(sponsorSecret);
  const sponsorAddr = sponsorKp.publicKey();

  const { execFileSync: exec } = require('child_process');
  const lines = exec('tail', ['-n', `+2`, csvPath], { encoding: 'utf8' }).split('\n').filter(Boolean);
  let funded = 0;

  for (let i = 0; i < Math.min(count, lines.length); i++) {
    const fields = lines[i].split(',');
    const identity = fields[0].trim();
    const address = stellarCmd('keys', 'address', identity);

    // Check if already exists
    const existing = await httpGet(`${HORIZON}/accounts/${address}`).catch(() => null);
    if (existing && existing.sequence) {
      console.log(`  ${identity} (${address}) already exists, skipping`);
      funded++;
      continue;
    }

    // Fetch sponsor seq
    const sponsorData = await httpGet(`${HORIZON}/accounts/${sponsorAddr}`);
    const source = new Account(sponsorAddr, sponsorData.sequence);

    const tx = new TransactionBuilder(source, {
      fee: '100',
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(Operation.createAccount({
        destination: address,
        startingBalance,
      }))
      .setTimeout(120)
      .build();

    tx.sign(sponsorKp);
    const result = await httpPost(`${HORIZON}/transactions`, { tx: tx.toXDR() });

    if (result.hash) {
      console.log(`  [${funded}] Created ${identity} (${address}) — ${result.hash}`);
      funded++;
    } else {
      console.error(`  [${funded}] FAILED ${identity}:`, JSON.stringify(result.result_codes || result));
      // Account might have been created by a prior attempt — check
      const check = await httpGet(`${HORIZON}/accounts/${address}`).catch(() => null);
      if (check && check.sequence) {
        console.log(`  → actually exists, counting`);
        funded++;
      }
    }
  }
  console.log(`Funded ${funded} accounts`);
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
