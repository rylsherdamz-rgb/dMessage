'use client';

import { Buffer } from 'buffer';
import {
  rpc,
  TransactionBuilder,
  Contract,
  Account,
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from 'stellar-sdk';
import { getSorobanServer, NETWORK_PASSPHRASE } from './stellar';

/** ScVal argument builders for contract calls. */
export const arg = {
  address: (a: string): xdr.ScVal => new Address(a).toScVal(),
  string: (s: string): xdr.ScVal => nativeToScVal(s, { type: 'string' }),
  u32: (n: number): xdr.ScVal => nativeToScVal(n, { type: 'u32' }),
  bytes: (b: Uint8Array): xdr.ScVal => xdr.ScVal.scvBytes(Buffer.from(b)),
  none: (): xdr.ScVal => xdr.ScVal.scvVoid(),
};

/**
 * Read-only contract call via transaction simulation. No signing or funding
 * required for view methods; `sourceAddress` just provides a valid source.
 * Returns the decoded native value, or `null` for void/None results.
 */
export async function readContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string,
): Promise<T | null> {
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const source = new Account(sourceAddress, '0');

  const tx = new TransactionBuilder(source, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const retval = sim.result?.retval;
  if (!retval) return null;
  const native = scValToNative(retval);
  return (native ?? null) as T | null;
}

/**
 * State-changing contract call: build -> prepare (resource/footprint) ->
 * sign via wallet -> submit. `sourceAddress` must be a funded account.
 */
export async function writeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourceAddress: string,
  signTransaction: (xdr: string) => Promise<string>,
): Promise<rpc.Api.SendTransactionResponse> {
  const server = getSorobanServer();
  const contract = new Contract(contractId);
  const account = await server.getAccount(sourceAddress);

  const built = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(built);
  const signedXdr = await signTransaction(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  return server.sendTransaction(signedTx);
}
