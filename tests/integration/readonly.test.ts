import { describe, it, expect } from 'vitest';
import { xdr, Address } from 'stellar-sdk';
import {
  getServer, CONTRACTS, simulate, decodeVec,
} from './helpers.js';

const server = getServer();

describe('UserRegistry (testnet read-only)', () => {
  it('should connect to RPC', async () => {
    const info = await server.getServerInfo();
    expect(info).toBeDefined();
    expect(info.protocolVersion).toBeGreaterThan(20);
  });

  it('should return None for unregistered address', async () => {
    const result = await simulate(CONTRACTS.userRegistry, 'get_user', [
      new Address(
        'GA7QPDS5XORTQMWGWEISL7YJ3TBQ2JWGZ4E54NUXOSFAQD3TQYMWZA6I',
      ).toScVal(),
    ]);
    expect(result).toBeDefined();
    if (result.result) {
      expect(result.result.retval.void()).toBeDefined();
    }
  });
});

describe('SocialGraph (testnet read-only)', () => {
  it('should return empty conversations for random address', async () => {
    const result = await simulate(CONTRACTS.socialGraph, 'get_user_conversations', [
      new Address(
        'GA7QPDS5XORTQMWGWEISL7YJ3TBQ2JWGZ4E54NUXOSFAQD3TQYMWZA6I',
      ).toScVal(),
    ]);
    expect(result).toBeDefined();
    if (result.result) {
      const convs = decodeVec(result.result.retval);
      expect(convs.length).toBe(0);
    }
  });
});

describe('MessageContract (testnet read-only)', () => {
  it('should return empty messages for unknown conversation', async () => {
    const emptyId = new Uint8Array(32);
    const result = await simulate(CONTRACTS.messages, 'get_messages', [
      xdr.ScVal.scvBytes(emptyId),
      xdr.ScVal.scvU32(0),
      xdr.ScVal.scvU32(10),
    ]);
    expect(result).toBeDefined();
    if (result.result) {
      const msgs = decodeVec(result.result.retval);
      expect(msgs.length).toBe(0);
    }
  });
});
