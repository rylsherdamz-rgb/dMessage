# Stellar Sponsored Batch Scripts - Fix Summary

## Problem

The `_sponsored-invoke.cjs` script was failing to submit Soroban transactions due to incorrect transaction assembly:

1. **Manual auth signing issue**: The script was manually constructing Soroban authorization entries using raw XDR, which was incompatible with newer SDK versions
2. **Fee calculation issue**: The transaction builder was not correctly setting Soroban resource fees, causing `txInsufficientBalance` errors even with adequate account balance

## Root Cause

- The manual auth signing code created `ScVal` signature fields, but the SDK expected different signature formats
- `TransactionBuilder.setSorobanData()` with manual fee setting doubled the resource fee (set both in envelope and SorobanData)
- The correct approach is to use `sdk.rpc.assembleTransaction()` which handles all Soroban-specific transaction assembly

## Solution Applied

Updated `/home/richie/Projects/dMessage/tests/scripts/_sponsored-invoke.cjs`:

### 1. Import `authorizeEntry` from SDK
```javascript
const {
  // ... other imports
  authorizeEntry,  // Added
  // ...
} = requireFrontend('@stellar/stellar-sdk');
```

### 2. Replace manual auth signing with SDK method
**Before:**
```javascript
// Manual signing code that created ScVal signatures
const clone = xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR());
// ... complex manual signing logic
```

**After:**
```javascript
const signed = await authorizeEntry(entry, caller, validUntil, MAINNET_PASSPHRASE);
signedEntries.push(signed);
```

### 3. Use `assembleTransaction` for proper fee/data handling
**Before:**
```javascript
const totalFee = (Number(sim.minResourceFee) + inclusionFee).toString();
const finalTx = new TransactionBuilder(sponsorAccount, {
  fee: totalFee,  // This doubled the resource fee
  networkPassphrase: MAINNET_PASSPHRASE,
})
  .addOperation(finalOp)
  .setSorobanData(sim.transactionData.build())  // Resource fee set here too
  .setTimeout(120)
  .build();
```

**After:**
```javascript
const rawTx = new TransactionBuilder(sponsorAccount, {
  fee: '100000',  // Just inclusion fee
  networkPassphrase: MAINNET_PASSPHRASE,
})
  .addOperation(finalOp)
  .setTimeout(120)
  .build();

const assembled = rpc.assembleTransaction(rawTx, sim);
const finalTx = assembled.build();
```

## Verification

After the fix:
- ✅ User registration (`register_user_sponsored`) works - 7 users registered successfully (v34-v40)
- ✅ Conversation creation (`ensure_conversation_sponsored`) works - v34↔v35 conversation created
- ✅ Transactions properly signed and submitted to Stellar mainnet

## Technical Details

**Protocol**: Stellar Protocol 22 on mainnet
**SDK**: @stellar/stellar-sdk v14.6.1+
**Network**: Public Global Stellar Network (mainnet)

The `assembleTransaction` method properly handles:
1. Setting `SorobanTransactionData` with correct Protocol 22 structure (separate `resourceFee` field, `diskReadBytes` instead of `readBytes`)
2. Calculating total envelope fee = inclusion fee + resource fee
3. Preserving auth entries from simulation
4. Setting correct footprint and resource limits

## Related Files

- `/home/richie/Projects/dMessage/tests/scripts/_sponsored-invoke.cjs` - Main helper script (FIXED)
- `/home/richie/Projects/dMessage/tests/scripts/register-users-mainnet.sh` - Uses fixed helper
- `/home/richie/Projects/dMessage/tests/scripts/create-conversations-mainnet.sh` - Uses fixed helper
- `/home/richie/Projects/dMessage/tests/scripts/send-messages-mainnet.sh` - Uses fixed helper
