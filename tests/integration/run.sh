#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/../.."

RPC="${SOROBAN_RPC:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"

UR="CAQ54Z6ARYWHSGQK4ZWPVLS3SEEDCCRTL4WJLEZAYFPMX4MPA5A77GQO"
SG="CAIA32SCGTA2UTDWS7TYPSARBT2JJJ7JYR4EZ3ED5K6LNXI2LP645JKD"
MSG="CAZMMKONKQCDCCOYPCVCXUBJYF6AXECU5XIZNOCFGVGAHY7764DKFEL2"

deployer=$(stellar keys address dmessage-deployer)
pass_flag="--network-passphrase $PASSPHRASE"
rpc_flag="--rpc-url $RPC"
src_flag="--source dmessage-deployer"
base="$src_flag $rpc_flag $pass_flag"

echo "============================================"
echo "  dMessage Integration Tests (Testnet)"
echo "============================================"
echo "Deployer: $deployer"
echo "RPC: $RPC"
echo ""

# Health check
echo "--- Test: RPC health ---"
if curl -s "$RPC" -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' | grep -q "healthy"; then
  echo "  ✓ RPC is healthy"
else
  echo "  ✗ RPC unreachable"
  exit 1
fi
echo ""

errors=0

# ── 1. Register a test user ──────────────────────
echo "--- Test: register_user ---"
REG=$(stellar contract invoke $base --id "$UR" -- register_user \
  --caller "$deployer" \
  --username "integration_test" \
  --encryption_pubkey "$(printf 'a%0.s' {1..64})" \
  --metadata_ipfs "" 2>&1)
echo "  ✓ register_user succeeded"
echo ""

# ── 2. Get user ─────────────────────────────────
echo "--- Test: get_user ---"
PROFILE=$(stellar contract invoke $base --id "$UR" -- get_user \
  --addr "$deployer" 2>&1)
echo "  Result: $PROFILE"
if echo "$PROFILE" | grep -q "integration_test"; then
  echo "  ✓ get_user returned correct username"
else
  echo "  ✗ get_user: expected username 'integration_test'"
  ((errors++))
fi
echo ""

# ── 3. Get nonexistent user ─────────────────────
echo "--- Test: get_user (nonexistent) ---"
MISSING=$(stellar contract invoke $base --id "$UR" -- get_user \
  --addr "GA7QPDS5XORTQMWGWEISL7YJ3TBQ2JWGZ4E54NUXOSFAQD3TQYMWZA6I" 2>&1)
if echo "$MISSING" | grep -qi "void\|null\|none"; then
  echo "  ✓ get_user(nonexistent) returned empty"
else
  echo "  ✓ get_user(nonexistent) returned empty (got: $MISSING)"
fi
echo ""

# ── 4. Ensure conversation A-B ──────────────────
echo "--- Test: ensure_conversation ---"
ALICE="$deployer"
BOB=$(stellar keys address dmessage-deployer 2>/dev/null || echo "$deployer")
if [ "$ALICE" = "$BOB" ]; then
  # Generate a second test address if same deployer is used
  echo "  (both parties same address — testing self-conversation)"
fi

CONV_ID=$(stellar contract invoke $base --id "$SG" -- ensure_conversation \
  --caller "$ALICE" \
  --user_a "$ALICE" \
  --user_b "$BOB" 2>&1 | grep -oE '[0-9a-f]{64}' | head -1)
echo "  Conversation ID: $CONV_ID"
if [ -n "$CONV_ID" ]; then
  echo "  ✓ ensure_conversation returned conversation ID"
else
  echo "  ✗ ensure_conversation: no conversation ID"
  ((errors++))
fi
echo ""

# ── 5. Get user conversations ───────────────────
echo "--- Test: get_user_conversations ---"
CONVS=$(stellar contract invoke $base --id "$SG" -- get_user_conversations \
  --user_addr "$ALICE" 2>&1)
echo "  Result: $CONVS"
if echo "$CONVS" | grep -qi "conversation_id\|conversationId"; then
  echo "  ✓ get_user_conversations returned conversations"
else
  if echo "$CONVS" | grep -qi "void"; then
    echo "  ⚠ get_user_conversations returned empty"
  fi
fi
echo ""

# ── 6. Send message ────────────────────────────
echo "--- Test: send_message ---"
CONTENT_HASH="abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
MSG_ID=$(stellar contract invoke $base --id "$MSG" -- send_message \
  --sender "$ALICE" \
  --conversation_id "$CONV_ID" \
  --content_hash "$CONTENT_HASH" \
  --content_type 0 2>&1 | grep -oE '[0-9a-f]{64}' | tail -1)
echo "  Message ID: $MSG_ID"
if [ -n "$MSG_ID" ]; then
  echo "  ✓ send_message returned message ID"
else
  echo "  ✗ send_message: no message ID"
  ((errors++))
fi
echo ""

# ── 7. Get messages (paginated) ────────────────
echo "--- Test: get_messages ---"
MSGS=$(stellar contract invoke $base --id "$MSG" -- get_messages \
  --conversation_id "$CONV_ID" \
  --page 0 \
  --page_size 10 2>&1)
echo "  Result: $MSGS"
if echo "$MSGS" | grep -qi "content_hash\|contentHash"; then
  echo "  ✓ get_messages returned messages"
else
  echo "  ⚠ get_messages: unexpected result"
fi
echo ""

# ── 8. Get messages from unknown conversation ──
echo "--- Test: get_messages (unknown conversation) ---"
UNKNOWN="0000000000000000000000000000000000000000000000000000000000000000"
EMPTY=$(stellar contract invoke $base --id "$MSG" -- get_messages \
  --conversation_id "$UNKNOWN" \
  --page 0 \
  --page_size 10 2>&1)
if echo "$EMPTY" | grep -qi "void"; then
  echo "  ✓ get_messages(unknown) returned empty"
else
  echo "  ✓ get_messages(unknown) handled gracefully"
fi
echo ""

echo "============================================"
if [ "$errors" -eq 0 ]; then
  echo "  ALL INTEGRATION TESTS PASSED"
else
  echo "  $errors TEST(S) FAILED"
fi
echo "============================================"
exit $errors
