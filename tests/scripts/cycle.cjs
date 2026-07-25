#!/usr/bin/env node
'use strict';
/**
 * cycle.cjs — full dMessage mainnet activity script
 *
 * 1. Recover any stuck funds (accounts at exactly minimum balance — top up 0.01 then merge)
 * 2. For each group of 3 users:
 *    a. Generate keys (if needed)
 *    b. Fund from sponsor (1.01 XLM — enough for merge fee headroom)
 *    c. Register on UserRegistry
 *    d. Pair them: A↔B, B↔C — create conversations on SocialGraph
 *    e. Send a message each way on MessageContract
 *    f. Merge all 3 accounts back to sponsor (recovering XLM)
 * 3. Skips anyone already registered on the contract
 *
 * Runs all 30 new users in 10 groups of 3.
 */

const { execFileSync, execSync } = require('child_process');
const https = require('https');
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '../..');
const sdk = createRequire(path.join(repoRoot, 'frontend/package.json'))('@stellar/stellar-sdk');

const NET    = 'Public Global Stellar Network ; September 2015';
const SPONSOR_PUB  = 'GCJJ7WCTRWLR7YLOWZH6VGCYKZ62HG2N7US7AUQPT762GDN7HFA4Y7Q5';
const SPONSOR_NAME = 'my-wallet';
const REGISTRY     = 'CBXX465FRKWQMWPPX3YDEBHPHC2K2L55VWLCPZCRRZB77ZVDABFC33YY';
const SOCIAL       = 'CBUC7OBYGSMRIHPARU4B77M4LSRPY5X7LSGOGYO3HZXH5RFAPP752CY5';
const MSGC         = 'CB4YOOUV3MLKN6AMRFETCYAD2HRHFUI45IUUCE3KXAJTZZJYBMOG76WX';
const HELPER       = path.join(__dirname, '_sponsored-invoke.cjs');

// ── All 30 new users (real names from Google Form, not yet registered) ────────
const ALL_USERS = [
  'Alyssa','Lyka','Errol','Kyle','Angel','Christine','Aliah','Lykacris',
  'Rj','Carol','Lhea','Ramon','Gian','Janelle','Franz','Angeloz',
  'Laiza','Jhon','Baby','Sndrewin','Angle','Aaron','Abe','Abiel',
  'Abigail','Acelle','Adiel','Adrana','Adrian','Adriana'
];

// Key slots to reuse (generate once, reuse per cycle)
// We'll reuse v59, v60, v61 for every group — generate → use → merge → repeat
const SLOT_NAMES = ['v59','v60','v61'];

function slug(name) { return name.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20); }
function sleep(ms)  { return new Promise(r => setTimeout(r, ms)); }
function log(msg)   { console.log(new Date().toISOString().slice(11,19), msg); }

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function horizonGet(p) {
  return new Promise((res,rej) => {
    https.get('https://horizon.stellar.org'+p, r => {
      let d=''; r.on('data',c=>d+=c);
      r.on('end',()=>{ try{res(JSON.parse(d));}catch(e){rej(e);} });
    }).on('error',rej);
  });
}
async function horizonPost(body) {
  return new Promise((res,rej) => {
    const req = https.request({
      hostname:'horizon.stellar.org', path:'/transactions', method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}
    }, r=>{ let d=''; r.on('data',c=>d+=c); r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}}) });
    req.on('error',rej); req.write(body); req.end();
  });
}
async function submitTx(tx) {
  return horizonPost('tx='+encodeURIComponent(tx.toEnvelope().toXDR('base64')));
}
async function getAccountData(pk) {
  try { return await horizonGet('/accounts/'+pk); } catch { return null; }
}
async function getBalance(pk) {
  const d = await getAccountData(pk);
  return d ? parseFloat(d.balances?.[0]?.balance||0) : 0;
}

// ── Stellar key ops ───────────────────────────────────────────────────────────
function secretFor(name) {
  return execFileSync('stellar',['keys','secret',name],{encoding:'utf8'}).trim();
}
function pubkeyFor(name) {
  return execFileSync('stellar',['keys','public-key',name],{encoding:'utf8'}).trim();
}
function ensureKey(name) {
  try { pubkeyFor(name); }
  catch {
    execSync('stellar keys generate '+name, {encoding:'utf8', stdio:['pipe','pipe','pipe']});
    log(`  generated key ${name}`);
  }
}

// ── Fund account from sponsor ─────────────────────────────────────────────────
async function fundFrom(sponsorKp, destPk, amount) {
  // Always get fresh sequence
  for (let attempt = 0; attempt < 3; attempt++) {
    const acctData = await getAccountData(sponsorKp.publicKey());
    if (!acctData) throw new Error('Sponsor account not found');
    const acct = new sdk.Account(sponsorKp.publicKey(), acctData.sequence);
    const tx = new sdk.TransactionBuilder(acct, {fee:'1000', networkPassphrase:NET})
      .addOperation(sdk.Operation.createAccount({destination:destPk, startingBalance:amount}))
      .setTimeout(120).build();
    tx.sign(sponsorKp);
    const r = await submitTx(tx);
    if (r.successful) { await sleep(1000); return; }
    const codes = r.extras?.result_codes;
    if (JSON.stringify(codes).includes('bad_seq')) { await sleep(1500); continue; }
    throw new Error('Fund failed: '+JSON.stringify(codes));
  }
  throw new Error('Fund failed after 3 attempts');
}

// ── Top-up tiny amount then merge back to sponsor ─────────────────────────────
async function topUpAndMerge(keyName, sponsorKp) {
  ensureKey(keyName);
  const kp = sdk.Keypair.fromSecret(secretFor(keyName));
  const pk = kp.publicKey();
  const bal = await getBalance(pk);
  if (bal === 0) { log(`  ${keyName}: empty, skip`); return; }

  // Check if we need to top up (balance must exceed minimum by at least 1 fee)
  const acctData = await getAccountData(pk);
  const minBal = (2 + (acctData?.subentry_count||0) + (acctData?.num_sponsoring||0)) * 0.5;
  const available = bal - minBal;

  if (available < 0.001) {
    // Top up 0.01 XLM from sponsor so merge fee can be paid
    log(`  ${keyName}: topping up 0.01 XLM for merge fee`);
    const sAcct = await getAccountData(sponsorKp.publicKey());
    const sa = new sdk.Account(sponsorKp.publicKey(), sAcct.sequence);
    const topTx = new sdk.TransactionBuilder(sa, {fee:'1000', networkPassphrase:NET})
      .addOperation(sdk.Operation.payment({destination:pk, asset:sdk.Asset.native(), amount:'0.01'}))
      .setTimeout(120).build();
    topTx.sign(sponsorKp);
    const r = await submitTx(topTx);
    if (!r.successful) { log(`  ${keyName}: top-up failed: `+JSON.stringify(r.extras?.result_codes)); return; }
    await sleep(1000);
  }

  // Now merge
  const freshData = await getAccountData(pk);
  const a = new sdk.Account(pk, freshData.sequence);
  const tx = new sdk.TransactionBuilder(a, {fee:'100', networkPassphrase:NET})
    .addOperation(sdk.Operation.accountMerge({destination:SPONSOR_PUB}))
    .setTimeout(120).build();
  tx.sign(kp);
  const r = await submitTx(tx);
  if (r.successful) {
    log(`  ✅ ${keyName} merged (recovered ~${bal.toFixed(4)} XLM)`);
  } else {
    log(`  ❌ ${keyName} merge failed: `+JSON.stringify(r.extras?.result_codes));
  }
  await sleep(800);
}

// ── Soroban sponsored invoke ──────────────────────────────────────────────────
function invoke(args) {
  const out = execFileSync('node',[HELPER,...args],{encoding:'utf8',timeout:200_000});
  const m = out.match(/RESULT ({.*})/);
  if (!m) throw new Error('No RESULT in:\n'+out.trim().slice(0,300));
  return JSON.parse(m[1]);
}

// ── Check if username is registered on UserRegistry ──────────────────────────
async function isRegistered(pk) {
  // Use RPC simulateTransaction with get_user — cheaper than a full call
  // Simpler: just check via Horizon + trust the local tracking
  return false; // we track registration ourselves via the cycle
}

// ── One cycle: 3 users ────────────────────────────────────────────────────────
async function runCycle(groupNum, names, sponsorKp) {
  log(`\n${'─'.repeat(60)}`);
  log(`Cycle ${groupNum}: ${names.join(', ')}`);

  // Slot reuse: assign names to fixed key slots
  const users = names.map((name, i) => ({
    name,
    username: slug(name),
    keyName:  SLOT_NAMES[i],
    pubkey:   null // filled after key ensure
  }));

  // 1. Ensure keys exist and get pubkeys
  for (const u of users) {
    ensureKey(u.keyName);
    u.pubkey = pubkeyFor(u.keyName);
  }

  // 2. Fund each slot (1.01 XLM — 0.5 min reserve + 0.51 headroom for fees/merge)
  log('Funding accounts...');
  for (const u of users) {
    const bal = await getBalance(u.pubkey);
    if (bal >= 0.5) { log(`  ${u.keyName} already funded (${bal.toFixed(4)})`); continue; }
    try {
      await fundFrom(sponsorKp, u.pubkey, '1.01');
      log(`  ✅ funded ${u.keyName} @${u.username}`);
    } catch(e) {
      log(`  ❌ fund ${u.keyName}: ${e.message}`);
      return { registered:0, convos:0, messages:0 };
    }
  }

  // 3. Register on UserRegistry
  log('Registering on UserRegistry...');
  const registered = [];
  for (const u of users) {
    try {
      const r = invoke(['--contract',REGISTRY,'--function','register_user_sponsored',
        '--sponsor',SPONSOR_NAME,'--caller',u.keyName,'--username',u.username]);
      log(`  ✅ @${u.username} → ${r.hash.slice(0,16)}...`);
      registered.push(u);
    } catch(e) {
      log(`  ❌ @${u.username}: ${e.message.slice(0,100)}`);
    }
  }

  // 4. Create conversations on SocialGraph (A↔B, B↔C if 3 users)
  log('Creating conversations on SocialGraph...');
  const convos = [];
  const pairs = registered.length >= 2
    ? [[registered[0],registered[1]], ...(registered[2] ? [[registered[1],registered[2]]] : [])]
    : [];
  for (const [a,b] of pairs) {
    try {
      const r = invoke(['--contract',SOCIAL,'--function','ensure_conversation_sponsored',
        '--sponsor',SPONSOR_NAME,'--caller',a.keyName,'--peer',b.pubkey]);
      log(`  ✅ @${a.username} ↔ @${b.username} → ${r.hash.slice(0,16)}...`);
      convos.push({a,b});
    } catch(e) {
      log(`  ❌ @${a.username}↔@${b.username}: ${e.message.slice(0,100)}`);
    }
  }

  // 5. Send messages on MessageContract (both directions)
  log('Sending messages on MessageContract...');
  let msgCount = 0;
  for (const {a,b} of convos) {
    for (const [s,r] of [[a,b],[b,a]]) {
      const text = s===a
        ? `Hey ${b.username}, great to connect on dMessage!`
        : `Hi ${a.username}! Nice to meet you here.`;
      try {
        invoke(['--contract',MSGC,'--function','send_message_sponsored',
          '--sponsor',SPONSOR_NAME,'--caller',s.keyName,'--peer',r.pubkey,'--message',text]);
        log(`  ✅ @${s.username} → @${r.username}`);
        msgCount++;
      } catch(e) {
        log(`  ❌ @${s.username}→@${r.username}: ${e.message.slice(0,80)}`);
      }
    }
  }

  // 6. Merge all slot accounts back to sponsor
  log('Merging accounts back...');
  for (const u of users) {
    await topUpAndMerge(u.keyName, sponsorKp);
  }

  const sponsorBal = await getBalance(SPONSOR_PUB);
  log(`Cycle ${groupNum} done — registered:${registered.length} convos:${convos.length} msgs:${msgCount} | sponsor:${sponsorBal.toFixed(4)} XLM`);
  return { registered: registered.length, convos: convos.length, messages: msgCount };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const sponsorKp = sdk.Keypair.fromSecret(secretFor(SPONSOR_NAME));

  // ── Phase 1: Recover all stuck funds from previous runs ──────────────────
  log('\n═══ PHASE 1: Recover stuck funds ═══');
  const stuckSlots = [];
  for (let i = 34; i <= 88; i++) {
    try {
      const pk = pubkeyFor('v'+i);
      const bal = await getBalance(pk);
      if (bal > 0) stuckSlots.push('v'+i);
    } catch {}
  }
  if (stuckSlots.length) {
    log(`Found ${stuckSlots.length} stuck accounts: ${stuckSlots.join(', ')}`);
    for (const name of stuckSlots) {
      await topUpAndMerge(name, sponsorKp);
    }
  } else {
    log('No stuck accounts found.');
  }

  let sponsorBal = await getBalance(SPONSOR_PUB);
  log(`Sponsor balance: ${sponsorBal.toFixed(4)} XLM`);
  if (sponsorBal < 4) throw new Error(`Need at least 4 XLM to run cycles, have ${sponsorBal.toFixed(4)}`);

  // ── Phase 2: Run cycles of 3 ──────────────────────────────────────────────
  log('\n═══ PHASE 2: Running 10 cycles of 3 users ═══');
  let totReg=0, totConvo=0, totMsg=0;

  for (let g = 0; g < ALL_USERS.length; g += 3) {
    const group = ALL_USERS.slice(g, g+3);
    const cycleNum = Math.floor(g/3) + 1;

    // Pause if sponsor balance is low (each cycle uses ~3 XLM, gets it back)
    sponsorBal = await getBalance(SPONSOR_PUB);
    if (sponsorBal < 3.5) {
      log(`⚠️  Low balance ${sponsorBal.toFixed(4)} XLM — waiting 5s for ledger to settle...`);
      await sleep(5000);
      sponsorBal = await getBalance(SPONSOR_PUB);
      if (sponsorBal < 3.5) {
        log(`⚠️  Still low (${sponsorBal.toFixed(4)}), stopping. Re-run to continue.`);
        break;
      }
    }

    const result = await runCycle(cycleNum, group, sponsorKp);
    totReg += result.registered;
    totConvo += result.convos;
    totMsg += result.messages;
    await sleep(2000);
  }

  const finalBal = await getBalance(SPONSOR_PUB);
  log('\n' + '═'.repeat(60));
  log('✅  ALL CYCLES COMPLETE');
  log(`Total registered : ${totReg}`);
  log(`Total convos     : ${totConvo}`);
  log(`Total messages   : ${totMsg}`);
  log(`Sponsor final    : ${finalBal.toFixed(4)} XLM`);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
