#!/usr/bin/env node
'use strict';

/**
 * Submit one gasless mainnet call. The sponsor is the transaction source and
 * pays the fee; the caller signs only their Soroban authorization entry.
 *
 * Uses Contract.call() matching the frontend gasless.ts pattern — the deprecated
 * Operation.invokeContractFunction doesn't exist in @stellar/stellar-sdk v14.
 */
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { createRequire } = require('node:module');

const repoRoot = path.resolve(__dirname, '../..');
const requireFrontend = createRequire(path.join(repoRoot, 'frontend/package.json'));
const {
  Account,
  Address,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  authorizeEntry,
  nativeToScVal,
  rpc,
  xdr,
} = requireFrontend('@stellar/stellar-sdk');
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest();
}

const MAINNET_RPC = 'https://soroban-rpc.mainnet.stellar.gateway.fm';
const MAINNET_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
const POLL_MS = 1_000;
const TIMEOUT_MS = 90_000;

function usage() {
  console.error(
    'Usage: _sponsored-invoke.cjs --contract C... --function name --sponsor key-name --caller key-name [--username name] [--peer G...] [--message text]',
  );
  process.exit(2);
}

function options(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key?.startsWith('--')) usage();
    const name = key.slice(2);
    // --message consumes the rest of argv as one value (supports spaces)
    if (name === 'message') {
      values[name] = argv.slice(i + 1).join(' ');
      break;
    }
    const value = argv[i + 1];
    if (value === undefined) usage();
    values[name] = value;
    i++; // skip value token
  }
  return values;
}

function secretFor(keyName) {
  return execFileSync('stellar', ['keys', 'secret', keyName], { encoding: 'utf8' }).trim();
}

function keypairFor(keyName) {
  return Keypair.fromSecret(secretFor(keyName));
}

async function waitForFinalStatus(server, hash) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = await server.getTransaction(hash);
    if (result.status === 'SUCCESS') return result;
    if (result.status === 'FAILED') throw new Error(`Transaction ${hash} failed on-chain`);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`Transaction ${hash} was not confirmed within ${TIMEOUT_MS / 1000}s`);
}

async function main() {
  const args = options(process.argv.slice(2));
  const { contract: contractId, function: functionName, sponsor: sponsorName, caller: callerName } = args;
  if (!contractId || !functionName || !sponsorName || !callerName) usage();

  const sponsor = keypairFor(sponsorName);
  const caller = keypairFor(callerName);
  const userAddress = caller.publicKey();

  let callerArgs;
  if (functionName === 'register_user_sponsored') {
    if (!args.username) usage();
    callerArgs = [
      new Address(userAddress).toScVal(),
      nativeToScVal(args.username, { type: 'string' }),
      nativeToScVal(Buffer.alloc(32), { type: 'bytes' }),
      nativeToScVal(Buffer.alloc(0), { type: 'bytes' }),
    ];
  } else if (functionName === 'ensure_conversation_sponsored') {
    if (!args.peer) usage();
    const peer = new Address(args.peer).toScVal();
    callerArgs = [
      new Address(userAddress).toScVal(),
      new Address(userAddress).toScVal(),
      peer,
    ];
  } else if (functionName === 'send_message_sponsored') {
    if (!args.peer || args.message === undefined) usage();
    callerArgs = [
      new Address(userAddress).toScVal(),
      new Address(args.peer).toScVal(),
      nativeToScVal(Buffer.from(args.message, 'utf8'), { type: 'bytes' }),
    ];
  } else {
    throw new Error(`Unsupported sponsored function: ${functionName}`);
  }

  const server = new rpc.Server(MAINNET_RPC);
  const contract = new Contract(contractId);
  const fullArgs = [new Address(sponsor.publicKey()).toScVal(), ...callerArgs];
  const op = contract.call(functionName, ...fullArgs);

  // Simulate from sponsor as source
  const simSource = new Account(sponsor.publicKey(), '0');
  const simTx = new TransactionBuilder(simSource, {
    fee: '1000000',
    networkPassphrase: MAINNET_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(simTx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }

  const { sequence: latestLedger } = await server.getLatestLedger();
  const validUntil = latestLedger + 100;

  // Sign auth entries — sponsor gets source-account creds, caller signs theirs
  const rawEntries = sim.result?.auth ?? [];
  const signedEntries = [];
  for (const entry of rawEntries) {
    const creds = entry.credentials();
    if (
      creds.switch().value ===
      xdr.SorobanCredentialsType.sorobanCredentialsSourceAccount().value
    ) {
      signedEntries.push(entry);
      continue;
    }

    const entryAddr = Address.fromScAddress(creds.address().address()).toString();

    if (entryAddr === sponsor.publicKey()) {
      signedEntries.push(
        new xdr.SorobanAuthorizationEntry({
          credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
          rootInvocation: entry.rootInvocation(),
        }),
      );
    } else if (entryAddr === userAddress) {
      const signed = await authorizeEntry(entry, caller, validUntil, MAINNET_PASSPHRASE);
      signedEntries.push(signed);
    } else {
      signedEntries.push(entry);
    }
  }

  // Rebuild operation with signed auth
  const hostFn = op.body().invokeHostFunctionOp().hostFunction();
  const finalOp = Operation.invokeHostFunction({ func: hostFn, auth: signedEntries });

  const sponsorAccount = await server.getAccount(sponsor.publicKey());
  const rawTx = new TransactionBuilder(sponsorAccount, {
    fee: '100000',
    networkPassphrase: MAINNET_PASSPHRASE,
  })
    .addOperation(finalOp)
    .setTimeout(120)
    .build();

  const assembled = rpc.assembleTransaction(rawTx, sim);
  const finalTx = assembled.build();

  finalTx.sign(sponsor);

  const submitted = await server.sendTransaction(finalTx);
  if (submitted.status === 'ERROR') {
    throw new Error(
      `Network rejected transaction: ${submitted.errorResult?.toXDR?.('base64') ?? 'unknown error'}`,
    );
  }
  await waitForFinalStatus(server, submitted.hash);
  console.log(`RESULT ${JSON.stringify({ hash: submitted.hash, status: 'SUCCESS' })}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});