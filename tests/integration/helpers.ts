import { rpc, Contract, Address, xdr, Keypair, TransactionBuilder } from 'stellar-sdk';
import crypto from 'crypto';

export const RPC_URL = process.env.SOROBAN_RPC ?? 'https://soroban-testnet.stellar.org';
export const PASSPHRASE = 'Test SDF Network ; September 2015';

export const CONTRACTS = {
  userRegistry: process.env.CONTRACT_USER_REGISTRY ?? 'CCYE3GXN7X4HIDNIEZCPE5WFWELS3SKSLBSHSENBPLNSWVSWFSOMRLIS',
  socialGraph: process.env.CONTRACT_SOCIAL_GRAPH ?? 'CBQJMPSMYNURVLSLG6FPILRCHDSSBB3EAFFOWWPRMJ4FTUR5H4XWUNL6',
  messages: process.env.CONTRACT_MESSAGES ?? 'CAFAAKQR56MO63IFCI7GSITV6J3FS47DGHJHQBTVITHIB57IPQ74LZB7',
} as const;

const server = new rpc.Server(RPC_URL, { allowHttp: true });

export function getServer() {
  return server;
}

export function createKeypair(): Keypair {
  return Keypair.random();
}

export async function fundAccount(pubKey: string): Promise<void> {
  try {
    const res = await fetch(`https://friendbot.stellar.org?addr=${pubKey}`);
    if (!res.ok) throw new Error(`friendbot: ${res.status}`);
    await res.json();
  } catch (e) {
    console.warn('friendbot funding failed:', (e as Error).message);
  }
}

export function scvalBytes(val: Uint8Array) {
  return xdr.ScVal.scvBytes(val);
}

export function scvalString(s: string) {
  return xdr.ScVal.scvString(s);
}

export function scvalU32(n: number) {
  return xdr.ScVal.scvU32(n);
}

export function scvalAddress(addr: string) {
  return new Address(addr).toScVal();
}

export async function simulate(contractId: string, method: string, args: xdr.ScVal[]) {
  const contract = new Contract(contractId);
  return server.simulateContract(contract.call(method, ...args));
}

export async function submit(
  kp: Keypair,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
): Promise<rpc.Api.GetSuccessfulTransaction> {
  const contract = new Contract(contractId);
  const sim = await server.simulateContract(contract.call(method, ...args));
  if (!sim.result) throw new Error(`simulation failed for ${method}: no result`);

  const fee = Number((sim as any).minResourceFee ?? 100_000);
  const source = await server.getAccount(kp.publicKey());
  const tx = TransactionBuilder.fromXdr(
    sim.transactionData!.toXDR('base64'),
    PASSPHRASE as any,
  ).build();

  const prepared = TransactionBuilder.cloneFrom(tx, {
    fee: (Number(tx.fee) + fee).toString(),
    timebounds: { minTime: 0, maxTime: 0 },
    sourceAccount: source,
  }).build();

  prepared.sign(kp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'PENDING' || sent.status === 'DUPLICATE') {
    return pollTx(sent.hash);
  }
  throw new Error(`send failed: ${sent.status} — ${JSON.stringify(sent)}`);
}

async function pollTx(hash: string, retries = 30): Promise<rpc.Api.GetSuccessfulTransaction> {
  for (let i = 0; i < retries; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === 'SUCCESS') return res;
    if (res.status === 'FAILED') throw new Error(`tx ${hash} failed: ${JSON.stringify(res)}`);
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`tx ${hash} timeout`);
}

export function decodeVec(scVal: xdr.ScVal): xdr.ScVal[] {
  return scVal.vec() ?? [];
}

export function decodeBytes(scVal: xdr.ScVal): Uint8Array {
  return scVal.bytes() ?? Buffer.alloc(0);
}

export function decodeU64(scVal: xdr.ScVal): bigint {
  const v = scVal.u64();
  return v ? BigInt(v.toString()) : BigInt(0);
}

export function decodeU32(scVal: xdr.ScVal): number {
  return scVal.u32() ?? 0;
}

export function decodeAddress(scVal: xdr.ScVal): string {
  return Address.fromScVal(scVal).toString();
}

export function decodeString(scVal: xdr.ScVal): string {
  return scVal.str() ?? '';
}

export function randomBytes32(): Uint8Array {
  return crypto.randomBytes(32);
}
