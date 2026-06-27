#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."

# ── Config ──────────────────────────────────────────────
RPC="${SOROBAN_RPC:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
NETWORK="${SOROBAN_NETWORK:-testnet}"   # testnet | pubnet
# ────────────────────────────────────────────────────────

CONTRACTS=(
  "user_registry:CCYE3GXN7X4HIDNIEZCPE5WFWELS3SKSLBSHSENBPLNSWVSWFSOMRLIS"
  "social_graph:CBQJMPSMYNURVLSLG6FPILRCHDSSBB3EAFFOWWPRMJ4FTUR5H4XWUNL6"
  "messages:CAFAAKQR56MO63IFCI7GSITV6J3FS47DGHJHQBTVITHIB57IPQ74LZB7"
)

echo "=== dMessage Contract Verification ==="
echo "Network: $NETWORK ($RPC)"
echo ""

for entry in "${CONTRACTS[@]}"; do
  name="${entry%%:*}"
  id="${entry##*:}"

  WASM="$REPO_DIR/contracts/$name/target/wasm32-unknown-unknown/release/$name.wasm"
  if [ ! -f "$WASM" ]; then
    echo "✗ $name: WASM not found at $WASM (run 'make build-wasm' first)"
    continue
  fi

  # Compute local WASM hash
  WASM_HASH=$(stellar contract id --wasm "$WASM" 2>/dev/null || sha256sum "$WASM" | cut -d' ' -f1)

  # Fetch on-chain WASM hash
  echo "  » $name ($id)"
  echo "    Local WASM hash:  $WASM_HASH"

  # Verify against block explorer
  echo "    Explorer: https://stellar.expert/explorer/$NETWORK/contract/$id"
  echo "    Lab:      https://lab.stellar.org/r/$NETWORK/contract/$id"
  echo ""

  # Generate bindings for verification (optional)
  if [ -n "${GENERATE_BINDINGS:-}" ]; then
    echo "    Generating bindings..."
    mkdir -p "$REPO_DIR/bindings/$name"
    stellar contract bindings rust \
      --wasm "$WASM" \
      --output-dir "$REPO_DIR/bindings/$name" \
      --rpc-url "$RPC" \
      --network-passphrase "$PASSPHRASE" \
      --contract-id "$id" 2>/dev/null && echo "    ✓ Bindings generated" || echo "    ✗ Bindings failed"
  fi
done

echo ""
echo "=== Verification Instructions ==="
echo "To verify source code on Stellar Expert:"
echo "  1. Go to the contract's Explorer page"
echo "  2. Click 'Verify Contract'"
echo "  3. Upload the contract source from: contracts/<name>/src/"
echo "  4. Select build SDK version: soroban-sdk 21.7.7"
echo ""
echo "Or use the Stellar Lab API:"
echo "  curl -X POST https://api.stellar.expert/verification/v1/contracts \\
echo "    -H 'Content-Type: multipart/form-data' \\
echo "    -F \"contract_id=<ID>\" \\
echo "    -F \"network=$NETWORK\" \\
echo "    -F \"source=@contracts/<name>/src/lib.rs\" \\
echo "    -F \"cargo_toml=@contracts/<name>/Cargo.toml\""
