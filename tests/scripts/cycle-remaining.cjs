#!/usr/bin/env node
'use strict';
/**
 * cycle-remaining.cjs
 * Run 3-user cycles for the 21 remaining unregistered users.
 * Each cycle: fund 3 local key slots → register → convo → messages → merge back.
 * Reuses key slots v59/v60/v61 for every cycle.
 */
const { execFileSync, execSync } = require('child_process');
const https = require('https');
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '../..');
const sdk = createRequire(path.join(repoRoot, 'frontend/package.json'))('@stellar/stellar-sdk');

const NET          = 'Public Global Stellar Network ; September 2015';
const SPONSOR_PUB  = 'GCJJ7WCTRWLR7YLOWZH6VGCYKZ62HG2N7US7AUQPT762GDN7HFA4Y7Q5';
const SPONSOR_NAME = 'my-wallet';
const REGISTRY     = 'CBXX465FRKWQMWPPX3YDEBHPHC2K2L55VWLCPZCRRZB77ZVDABFC33YY';
const SOCIAL       = 'CBUC7OBYGSMRIHPARU4B77M4LSRPY5X7LSGOGYO3HZXH5RFAPP752CY5';
const MSGC         = 'CB4YOOUV3MLKN6AMRFETCYAD2HRHFUI45IUUCE3KXAJTZZJYBMOG76WX';
const HELPER       = path.join(__dirname, '_sponsored-invoke.cjs');
const SLOTS        = ['v59','v60','v61'];  // reused every cycle
const FUND_AMOUNT  = '1.01';              // 1.01 XLM: 0.5 min + 0.51 headroom

// 21 remaining users (in groups of 3)
const REMAINING = [
  // group 1: were attempted but failed registration
  ['Aliah','Lykacris','Ramon'],
  // groups 2-7: never run
  ['Gian','Janelle','Franz'],
  ['Angeloz','Laiza','Jhon'],
  ['Baby','Sndrewin','Angle'],
  ['Aaron','Abe','Abiel'],
  ['Abigail','Acelle','Adiel'],
  ['Adrana','Adrian','Adriana'],
];

function slug(n) { return n.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function log(m)  { console.log(new Date().toISOString().slice(11,19), m); }

// ── Horizon helpers ───────────────────────────────────────────────────────────
function horizonGet(p) {
  return new Promise((res,rej)=>{
    https.get('https://horizon.stellar.org'+p,r=>{
      let d='';r.on('data',c=>d+=c);
      r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});
    }).on('error',rej);
  });
}
function horizonPost(body) {
  return new Promise((res,rej)=>{
    const r=https.request({
      hostname:'horizon.stellar.org',path:'/transactions',method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}
    },r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d));}catch(e){rej(e);}});});
    r.on('error',rej);r.write(body);r.end();
  });
}
async function submit(tx) {
  return horizonPost('tx='+encodeURIComponent(tx.toEnvelope().toXDR('base64')));
}
async function getAcct(pk) {
  try{return await horizonGet('/accounts/'+pk);}catch{return null;}
}
async function getBalance(pk) {
  const d=await getAcct(pk);
  return d ? parseFloat(d.balances?.[0]?.balance||0) : 0;
}

// ── Key helpers ───────────────────────────────────────────────────────────────
function secretFor(name) {
  return execFileSync('stellar',['keys','secret',name],{encoding:'utf8'}).trim();
}
function pubkeyFor(name) {
  return execFileSync('stellar',['keys','public-key',name],{encoding:'utf8'}).trim();
}
function ensureKey(name) {
  try { pubkeyFor(name); return; } catch {}
  execSync('stellar keys generate '+name,{encoding:'utf8',stdio:['pipe','pipe','pipe']});
}

// ── Fund from sponsor ─────────────────────────────────────────────────────────
async function fund(sponsorKp, destPk) {
  for (let attempt=0; attempt<3; attempt++) {
    const d = await getAcct(sponsorKp.publicKey());
    if (!d) throw new Error('Sponsor not found');
    const acct = new sdk.Account(sponsorKp.publicKey(), d.sequence);
    const tx = new sdk.TransactionBuilder(acct,{fee:'1000',networkPassphrase:NET})
      .addOperation(sdk.Operation.createAccount({destination:destPk,startingBalance:FUND_AMOUNT}))
      .setTimeout(120).build();
    tx.sign(sponsorKp);
    const r = await submit(tx);
    if (r.successful) { await sleep(1200); return; }
    const codes = JSON.stringify(r.extras?.result_codes||{});
    if (codes.includes('bad_seq')||codes.includes('tx_bad_seq')) { await sleep(1500); continue; }
    throw new Error('Fund failed: '+codes);
  }
  throw new Error('Fund failed after 3 retries');
}

// ── Merge account back to sponsor ────────────────────────────────────────────
async function mergeBack(keyName) {
  let kp;
  try { kp = sdk.Keypair.fromSecret(secretFor(keyName)); } catch { return; }
  const pk = kp.publicKey();
  const d = await getAcct(pk);
  if (!d) return;
  const bal = parseFloat(d.balances?.[0]?.balance||0);
  if (bal < 0.001) return;
  const acct = new sdk.Account(pk, d.sequence);
  const tx = new sdk.TransactionBuilder(acct,{fee:'100',networkPassphrase:NET})
    .addOperation(sdk.Operation.accountMerge({destination:SPONSOR_PUB}))
    .setTimeout(120).build();
  tx.sign(kp);
  const r = await submit(tx);
  if (r.successful) log(`  ✅ merged ${keyName} (~${bal.toFixed(4)} XLM back)`);
  else log(`  ❌ merge ${keyName}: `+JSON.stringify(r.extras?.result_codes));
  await sleep(800);
}

// ── Soroban call ──────────────────────────────────────────────────────────────
function invoke(args) {
  const out = execFileSync('node',[HELPER,...args],{encoding:'utf8',timeout:200_000});
  const m = out.match(/RESULT ({.*})/);
  if (!m) throw new Error('No RESULT:\n'+out.trim().slice(0,300));
  return JSON.parse(m[1]);
}

// ── One cycle of 3 ───────────────────────────────────────────────────────────
async function runCycle(num, names, sponsorKp) {
  log(`\n${'─'.repeat(55)}`);
  log(`Cycle ${num}/7 — ${names.join(', ')}`);

  // Assign names to slots
  const users = names.map((name,i)=>({
    name, username:slug(name), slot:SLOTS[i], pubkey:null
  }));
  for (const u of users) { ensureKey(u.slot); u.pubkey = pubkeyFor(u.slot); }

  // Fund
  log('Funding...');
  const funded = [];
  for (const u of users) {
    const bal = await getBalance(u.pubkey);
    if (bal >= 0.5) { log(`  ${u.slot} already funded`); funded.push(u); continue; }
    try {
      await fund(sponsorKp, u.pubkey);
      log(`  ✅ funded ${u.slot} @${u.username}`);
      funded.push(u);
    } catch(e) { log(`  ❌ fund ${u.slot}: ${e.message}`); }
  }
  if (funded.length === 0) { log('  No accounts funded, skipping cycle'); return {reg:0,conv:0,msg:0}; }

  // Register
  log('Registering...');
  const registered = [];
  for (const u of funded) {
    try {
      const r = invoke(['--contract',REGISTRY,'--function','register_user_sponsored',
        '--sponsor',SPONSOR_NAME,'--caller',u.slot,'--username',u.username]);
      log(`  ✅ @${u.username} ${r.hash.slice(0,16)}...`);
      registered.push(u);
    } catch(e) { log(`  ❌ @${u.username}: ${e.message.slice(0,100)}`); }
  }

  // Conversations (A↔B, B↔C)
  log('Conversations...');
  const convos = [];
  const pairs = registered.length>=2
    ? [[registered[0],registered[1]],...(registered[2]?[[registered[1],registered[2]]]:[]) ]
    : [];
  for (const [a,b] of pairs) {
    try {
      const r = invoke(['--contract',SOCIAL,'--function','ensure_conversation_sponsored',
        '--sponsor',SPONSOR_NAME,'--caller',a.slot,'--peer',b.pubkey]);
      log(`  ✅ @${a.username} ↔ @${b.username} ${r.hash.slice(0,16)}...`);
      convos.push({a,b});
    } catch(e) { log(`  ❌ @${a.username}↔@${b.username}: ${e.message.slice(0,100)}`); }
  }

  // Messages (both directions per convo)
  log('Messages...');
  let msgs = 0;
  for (const {a,b} of convos) {
    for (const [s,r] of [[a,b],[b,a]]) {
      const text = s===a
        ? `Hey ${b.username}, great to connect on dMessage!`
        : `Hi ${a.username}! Nice to meet you here.`;
      try {
        invoke(['--contract',MSGC,'--function','send_message_sponsored',
          '--sponsor',SPONSOR_NAME,'--caller',s.slot,'--peer',r.pubkey,'--message',text]);
        log(`  ✅ @${s.username} → @${r.username}`);
        msgs++;
      } catch(e) { log(`  ❌ @${s.username}→@${r.username}: ${e.message.slice(0,80)}`); }
    }
  }

  // Merge all back
  log('Merging back...');
  for (const u of users) await mergeBack(u.slot);

  const bal = await getBalance(SPONSOR_PUB);
  log(`Cycle ${num} done: reg=${registered.length} conv=${convos.length} msg=${msgs} | sponsor=${bal.toFixed(4)} XLM`);
  return {reg:registered.length, conv:convos.length, msg:msgs};
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  const sponsorKp = sdk.Keypair.fromSecret(secretFor(SPONSOR_NAME));

  let totReg=0, totConv=0, totMsg=0;
  for (let i=0; i<REMAINING.length; i++) {
    const bal = await getBalance(SPONSOR_PUB);
    log(`Sponsor balance: ${bal.toFixed(4)} XLM`);
    if (bal < 4) { log('⚠️  Balance too low to continue'); break; }

    const r = await runCycle(i+1, REMAINING[i], sponsorKp);
    totReg += r.reg; totConv += r.conv; totMsg += r.msg;
    if (i < REMAINING.length-1) await sleep(2000);
  }

  const final = await getBalance(SPONSOR_PUB);
  log('\n' + '═'.repeat(55));
  log(`✅  DONE  registered=${totReg}  convos=${totConv}  messages=${totMsg}`);
  log(`Sponsor final: ${final.toFixed(4)} XLM`);
  log(`Total on mainnet: ${7+9+totReg} users registered`);
}

main().catch(e=>{ console.error('FATAL:', e.message); process.exit(1); });
