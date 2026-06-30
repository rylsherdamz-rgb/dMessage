// End-to-end verification of the gasless (fee-bump + sponsored) flow on testnet.
//
// Proves the exact sequence the production relayer will use:
//   1. Build an invoke tx for `send_message_sponsored(sponsor, sender, recipient, content)`
//      with the USER as the inner-transaction source.
//   2. Simulate, then SERVER-SIGN the sponsor's Soroban auth entry (authorizeEntry)
//      and convert the user's auth entry to source-account credentials.
//   3. USER signs the inner envelope (emulates the wallet's signTransaction).
//   4. SPONSOR wraps it in a fee-bump transaction and submits — sponsor pays the fee.
//
// Asserts: user XLM balance is UNCHANGED (gasless), sponsor balance drops,
// get_sponsored_count(sponsor) increments, and the message lands in the inbox.
//
// Run from the frontend/ dir (so stellar-sdk resolves):  node ../scripts/test-gasless.mjs

import {
  rpc, TransactionBuilder, Contract, Address, xdr,
  Keypair, Operation, authorizeEntry, scValToNative, nativeToScVal,
} from 'stellar-sdk';
import { Buffer } from 'node:buffer';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const PASSPHRASE = 'Test SDF Network ; September 2015';
const MESSAGES_ID = 'CDK2AI4JMCD6I53TCYKL5WISQADKE6VHQKHRWK7NTFJ2TQOSM2RIIYY3';

const server = new rpc.Server(RPC_URL);

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function friendbot(pub) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${pub}`);
  if (!res.ok && res.status !== 400) throw new Error(`friendbot ${res.status}`);
}

async function xlmBalance(pub) {
  const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${pub}`);
  if (!res.ok) return null;
  const j = await res.json();
  const native = j.balances.find((b) => b.asset_type === 'native');
  return native ? Number(native.balance) : 0;
}

async function pollTx(hash, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const r = await server.getTransaction(hash);
    if (r.status === 'SUCCESS') return r;
    if (r.status === 'FAILED') throw new Error(`tx FAILED: ${JSON.stringify(r.resultXdr ?? r)}`);
    await sleep(1000);
  }
  throw new Error('tx poll timeout');
}

// Read-only contract call via simulation.
async function readContract(contractId, method, args, srcPub) {
  let src;
  try { src = await server.getAccount(srcPub); }
  catch { src = new (await import('stellar-sdk')).Account(srcPub, '0'); }
  const tx = new TransactionBuilder(src, { fee: '100', networkPassphrase: PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30).build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  const rv = sim.result?.retval;
  return rv ? scValToNative(rv) : null;
}

async function main() {
  const sponsor = Keypair.random();
  const user = Keypair.random();
  const recipient = Keypair.random(); // recipient address only; no account needed

  log('sponsor :', sponsor.publicKey());
  log('user    :', user.publicKey());
  log('recipient:', recipient.publicKey());

  log('\nFunding sponsor + user via friendbot...');
  await Promise.all([friendbot(sponsor.publicKey()), friendbot(user.publicKey())]);
  await sleep(3000);

  const userBefore = await xlmBalance(user.publicKey());
  const sponsorBefore = await xlmBalance(sponsor.publicKey());
  const countBefore = (await readContract(MESSAGES_ID, 'get_sponsored_count',
    [new Address(sponsor.publicKey()).toScVal()], sponsor.publicKey())) ?? 0;
  log(`\nBEFORE  user=${userBefore} XLM  sponsor=${sponsorBefore} XLM  sponsoredCount=${countBefore}`);

  // 1. Build raw invoke tx, source = USER.
  const content = xdr.ScVal.scvBytes(Buffer.from('gasless hello via fee-bump', 'utf8'));
  const callArgs = [
    new Address(sponsor.publicKey()).toScVal(),
    new Address(user.publicKey()).toScVal(),
    new Address(recipient.publicKey()).toScVal(),
    content,
  ];
  const contract = new Contract(MESSAGES_ID);
  const invokeOp = contract.call('send_message_sponsored', ...callArgs);

  let userAccount = await server.getAccount(user.publicKey());
  const raw = new TransactionBuilder(userAccount, { fee: '1000', networkPassphrase: PASSPHRASE })
    .addOperation(invokeOp).setTimeout(120).build();

  // 2. Simulate.
  const sim = await server.simulateTransaction(raw);
  if (rpc.Api.isSimulationError(sim)) throw new Error('sim error: ' + sim.error);
  log('\nSimulation OK. auth entries:', sim.result.auth.length);

  // 3. Process auth entries: sign sponsor (server-side), user -> source creds.
  const latest = await server.getLatestLedger();
  const validUntil = latest.sequence + 100;
  const finalAuth = [];
  for (const entry of sim.result.auth) {
    const creds = entry.credentials();
    if (creds.switch().name === 'sorobanCredentialsAddress') {
      const addr = Address.fromScAddress(creds.address().address()).toString();
      if (addr === sponsor.publicKey()) {
        log('  - signing SPONSOR auth entry (relayer key)');
        finalAuth.push(await authorizeEntry(entry, sponsor, validUntil, PASSPHRASE));
      } else if (addr === user.publicKey()) {
        log('  - converting USER auth entry -> source-account credentials');
        finalAuth.push(new xdr.SorobanAuthorizationEntry({
          credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
          rootInvocation: entry.rootInvocation(),
        }));
      } else {
        finalAuth.push(entry);
      }
    } else {
      finalAuth.push(entry);
    }
  }

  // 4. Rebuild op with finalized auth, assemble with footprint + resource fee.
  const func = invokeOp.body().invokeHostFunctionOp().hostFunction();
  const opWithAuth = Operation.invokeHostFunction({ func, auth: finalAuth });
  const resourceFee = Number(sim.minResourceFee ?? '0');
  const innerFee = (resourceFee + 100000).toString();

  userAccount = await server.getAccount(user.publicKey()); // fresh seq
  const prepared = new TransactionBuilder(userAccount, { fee: innerFee, networkPassphrase: PASSPHRASE })
    .addOperation(opWithAuth)
    .setSorobanData(sim.transactionData.build())
    .setTimeout(120).build();

  // 5. USER signs inner envelope (emulates wallet.signTransaction).
  prepared.sign(user);
  log('\nUser signed inner tx. Building fee-bump (sponsor pays)...');

  // 6. SPONSOR fee-bumps and submits.
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    sponsor, innerFee, prepared, PASSPHRASE,
  );
  feeBump.sign(sponsor);

  const sent = await server.sendTransaction(feeBump);
  log('submit status:', sent.status, 'hash:', sent.hash);
  if (sent.status === 'ERROR') throw new Error('send ERROR: ' + JSON.stringify(sent.errorResult ?? sent));
  const result = await pollTx(sent.hash);
  log('tx SUCCESS in ledger', result.ledger);

  // 7. Verify outcomes.
  await sleep(2000);
  const userAfter = await xlmBalance(user.publicKey());
  const sponsorAfter = await xlmBalance(sponsor.publicKey());
  const countAfter = (await readContract(MESSAGES_ID, 'get_sponsored_count',
    [new Address(sponsor.publicKey()).toScVal()], sponsor.publicKey())) ?? 0;
  const inbox = await readContract(MESSAGES_ID, 'get_messages',
    [new Address(recipient.publicKey()).toScVal(), nativeToScVal(0, { type: 'u32' }), nativeToScVal(10, { type: 'u32' })],
    sponsor.publicKey());

  log(`\nAFTER   user=${userAfter} XLM  sponsor=${sponsorAfter} XLM  sponsoredCount=${countAfter}`);
  log('inbox length:', Array.isArray(inbox) ? inbox.length : inbox);

  // Assertions.
  const checks = [];
  checks.push(['user paid ZERO (balance unchanged)', userAfter === userBefore]);
  checks.push(['sponsor paid the fee (balance decreased)', sponsorAfter < sponsorBefore]);
  checks.push(['sponsored count incremented by 1', Number(countAfter) === Number(countBefore) + 1]);
  checks.push(['message stored in recipient inbox', Array.isArray(inbox) && inbox.length === 1]);

  log('\n=== RESULTS ===');
  let ok = true;
  for (const [name, pass] of checks) {
    log(`${pass ? 'PASS' : 'FAIL'} — ${name}`);
    if (!pass) ok = false;
  }
  log(ok ? '\n✅ GASLESS FLOW VERIFIED' : '\n❌ VERIFICATION FAILED');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error('\nERROR:', e); process.exit(1); });
