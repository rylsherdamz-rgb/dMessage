#!/usr/bin/env node
'use strict';
/**
 * Batch register 30 new dMessage users on mainnet in 3 batches of 10.
 * Each batch: fund 10 local keypairs → register → convo → messages → merge back.
 * Runs 3 batches sequentially to keep sponsor balance healthy.
 */
const { execFileSync } = require('child_process');
const https = require('https');
const path = require('path');
const { createRequire } = require('module');

const repoRoot = path.resolve(__dirname, '../..');
const req = createRequire(path.join(repoRoot, 'frontend/package.json'));
const sdk = req('@stellar/stellar-sdk');

const NET_PASS     = 'Public Global Stellar Network ; September 2015';
const SPONSOR_PUB  = 'GCJJ7WCTRWLR7YLOWZH6VGCYKZ62HG2N7US7AUQPT762GDN7HFA4Y7Q5';
const SPONSOR_NAME = 'my-wallet';
const HORIZON      = 'https://horizon.stellar.org';
const REGISTRY     = 'CBXX465FRKWQMWPPX3YDEBHPHC2K2L55VWLCPZCRRZB77ZVDABFC33YY';
const SOCIAL       = 'CBUC7OBYGSMRIHPARU4B77M4LSRPY5X7LSGOGYO3HZXH5RFAPP752CY5';
const MSGC         = 'CB4YOOUV3MLKN6AMRFETCYAD2HRHFUI45IUUCE3KXAJTZZJYBMOG76WX';
const HELPER       = path.join(__dirname, '_sponsored-invoke.cjs');
const FUND_AMOUNT  = '1.0'; // 1 XLM per user — sponsor gets it all back after merge

// 30 new users (not yet registered)
const ALL_USERS = [
  'Alyssa','Lyka','Errol','Kyle','Angel','Christine','Aliah','Lykacris',
  'Rj','Carol','Lhea','Ramon','Gian','Janelle','Franz','Angeloz',
  'Laiza','Jhon','Baby','Sndrewin','Angle','Aaron','Abe','Abiel',
  'Abigail','Acelle','Adiel','Adrana','Adrian','Adriana'
];

function slug(name) { return name.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,20); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function horizonGet(p) {
  return new Promise((res,rej) => {
    https.get(HORIZON + p, r => {
      let d=''; r.on('data',c=>d+=c);
      r.on('end', ()=>{ try{ res(JSON.parse(d)); }catch(e){ rej(e); } });
    }).on('error', rej);
  });
}
async function getBalance(pk) {
  try{ const d=await horizonGet('/accounts/'+pk); return parseFloat(d.balances?.[0]?.balance||0); }catch{return 0;}
}
async function horizonPost(path, body) {
  return new Promise((res,rej)=>{
    const r=https.request({hostname:'horizon.stellar.org',path,method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)}
    }, r=>{ let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch(e){rej(e);} }); });
    r.on('error',rej); r.write(body); r.end();
  });
}
async function submit(tx) {
  const r = await horizonPost('/transactions','tx='+encodeURIComponent(tx.toEnvelope().toXDR('base64')));
  return r;
}

async function mergeAccount(keyName) {
  let kp;
  try{ kp=sdk.Keypair.fromSecret(execFileSync('stellar',['keys','secret',keyName],{encoding:'utf8'}).trim()); }
  catch{ return; }
  const bal=await getBalance(kp.publicKey());
  if(bal<0.001){ return; }
  const acct=await horizonGet('/accounts/'+kp.publicKey());
  const a=new sdk.Account(kp.publicKey(),acct.sequence);
  const tx=new sdk.TransactionBuilder(a,{fee:'1000',networkPassphrase:NET_PASS})
    .addOperation(sdk.Operation.accountMerge({destination:SPONSOR_PUB}))
    .setTimeout(120).build();
  tx.sign(kp);
  const r=await submit(tx);
  if(r.successful) console.log(`  ✅ merged ${keyName} (~${bal.toFixed(3)} XLM)`);
  else console.log(`  ❌ merge ${keyName} failed:`, r.extras?.result_codes);
  await sleep(800);
}

async function fundAccount(destPk) {
  const sponsorKp=sdk.Keypair.fromSecret(execFileSync('stellar',['keys','secret',SPONSOR_NAME],{encoding:'utf8'}).trim());
  const acct=await horizonGet('/accounts/'+sponsorKp.publicKey());
  const a=new sdk.Account(sponsorKp.publicKey(),acct.sequence);
  const tx=new sdk.TransactionBuilder(a,{fee:'1000',networkPassphrase:NET_PASS})
    .addOperation(sdk.Operation.createAccount({destination:destPk,startingBalance:FUND_AMOUNT}))
    .setTimeout(120).build();
  tx.sign(sponsorKp);
  const r=await submit(tx);
  if(!r.successful) throw new Error('Fund failed: '+JSON.stringify(r.extras?.result_codes));
  await sleep(1500);
}

function invoke(args) {
  const out=execFileSync('node',[HELPER,...args],{encoding:'utf8',timeout:200_000});
  const m=out.match(/RESULT ({.*})/);
  if(!m) throw new Error('No RESULT: '+out.trim().slice(0,200));
  return JSON.parse(m[1]);
}

async function runBatch(batchNum, userNames, startKeyIndex) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`BATCH ${batchNum}: users ${userNames.join(', ')}`);
  console.log(`${'═'.repeat(60)}`);

  // Fund accounts
  console.log(`\n— Funding ${userNames.length} accounts —`);
  const users = [];
  for (let i = 0; i < userNames.length; i++) {
    const keyName = 'v' + (startKeyIndex + i);
    const username = slug(userNames[i]);
    try { execFileSync('stellar',['keys','generate',keyName],{encoding:'utf8',stdio:['pipe','pipe','pipe']}); }
    catch(e) {
      // "already exists" is OK, anything else re-throw
      if (!e.stderr?.includes('already') && !e.message?.includes('already')) {
        // try again silently — key might already exist
      }
    }
    const pubkey = execFileSync('stellar',['keys','public-key',keyName],{encoding:'utf8'}).trim();
    const existing = await getBalance(pubkey);
    if (existing < 0.1) {
      try { await fundAccount(pubkey); console.log(`  ✅ funded ${keyName} @${username}`); }
      catch(e) { console.log(`  ❌ fund ${keyName}: ${e.message}`); continue; }
    } else {
      console.log(`  already funded ${keyName} @${username}`);
    }
    users.push({ keyName, username, pubkey });
  }

  // Register
  console.log(`\n— Registering ${users.length} users on UserRegistry —`);
  const registered = [];
  for (const u of users) {
    try {
      const r = invoke(['--contract',REGISTRY,'--function','register_user_sponsored',
        '--sponsor',SPONSOR_NAME,'--caller',u.keyName,'--username',u.username]);
      console.log(`  ✅ @${u.username} → ${r.hash.slice(0,18)}...`);
      registered.push(u);
    } catch(e) { console.log(`  ❌ @${u.username}: ${e.message.slice(0,100)}`); }
  }

  // Conversations (pair up)
  console.log(`\n— Creating conversations on SocialGraph —`);
  const convos = [];
  for (let i = 0; i + 1 < registered.length; i += 2) {
    const a = registered[i], b = registered[i+1];
    try {
      const r = invoke(['--contract',SOCIAL,'--function','ensure_conversation_sponsored',
        '--sponsor',SPONSOR_NAME,'--caller',a.keyName,'--peer',b.pubkey]);
      console.log(`  ✅ @${a.username} ↔ @${b.username} → ${r.hash.slice(0,18)}...`);
      convos.push({ a, b });
    } catch(e) { console.log(`  ❌ @${a.username}↔@${b.username}: ${e.message.slice(0,100)}`); }
  }

  // Messages
  console.log(`\n— Sending messages on MessageContract —`);
  let sent = 0;
  for (const { a, b } of convos) {
    for (const [s, r] of [[a,b],[b,a]]) {
      const text = s===a
        ? `Hey ${b.username}, great to connect with you on dMessage!`
        : `Hi ${a.username}! Nice to meet you here on dMessage.`;
      try {
        invoke(['--contract',MSGC,'--function','send_message_sponsored',
          '--sponsor',SPONSOR_NAME,'--caller',s.keyName,'--peer',r.pubkey,'--message',text]);
        console.log(`  ✅ @${s.username} → @${r.username}`);
        sent++;
      } catch(e) { console.log(`  ❌ @${s.username}→@${r.username}: ${e.message.slice(0,80)}`); }
    }
  }

  // Merge back
  console.log(`\n— Merging ${users.length} accounts back to sponsor —`);
  for (const u of users) await mergeAccount(u.keyName);

  const sponsorBal = await getBalance(SPONSOR_PUB);
  console.log(`\nBatch ${batchNum} done. Registered:${registered.length} Convos:${convos.length} Messages:${sent}`);
  console.log(`Sponsor balance now: ${sponsorBal.toFixed(4)} XLM`);
  return { registered: registered.length, convos: convos.length, messages: sent };
}

async function main() {
  // Step 0: merge old v34-v44 first
  console.log('\n═══ MERGING OLD ACCOUNTS v34-v44 ═══');
  for (let i = 34; i <= 44; i++) {
    await mergeAccount('v' + i);
  }
  const startBal = await getBalance(SPONSOR_PUB);
  console.log(`Sponsor balance after merges: ${startBal.toFixed(4)} XLM`);

  // Run 3 batches of 10
  const batches = [
    ALL_USERS.slice(0, 10),   // v59-v68
    ALL_USERS.slice(10, 20),  // v69-v78
    ALL_USERS.slice(20, 30),  // v79-v88
  ];

  let totReg=0, totConvo=0, totMsg=0;
  for (let b = 0; b < batches.length; b++) {
    // wait for sponsor to have enough (each batch needs ~10 XLM)
    let bal = await getBalance(SPONSOR_PUB);
    if (bal < 12) {
      console.log(`\nWARNING: low balance ${bal.toFixed(4)} XLM before batch ${b+1}. Waiting...`);
      await sleep(5000);
      bal = await getBalance(SPONSOR_PUB);
    }
    const result = await runBatch(b+1, batches[b], 59 + b*10);
    totReg+=result.registered; totConvo+=result.convos; totMsg+=result.messages;
    if (b < batches.length-1) {
      console.log('\nPausing 3s before next batch...');
      await sleep(3000);
    }
  }

  const finalBal = await getBalance(SPONSOR_PUB);
  console.log('\n' + '═'.repeat(60));
  console.log('✅  ALL 3 BATCHES COMPLETE');
  console.log(`Total registered : ${totReg}`);
  console.log(`Total convos     : ${totConvo}`);
  console.log(`Total messages   : ${totMsg}`);
  console.log(`Sponsor final    : ${finalBal.toFixed(4)} XLM`);
}

main().catch(e => { console.error('\nFATAL:', e.message); process.exit(1); });
