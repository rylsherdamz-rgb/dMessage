#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."

RPC="${SOROBAN_RPC:-https://soroban-rpc.testnet.stellar.gateway.fm}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
SECRET="${SOROBAN_SECRET_KEY:?SOROBAN_SECRET_KEY not set}"

CONTRACTS=("user_registry" "social_graph" "messages")

echo "=== dMessage Contract Deployment ==="
echo "Network: $RPC"
echo ""

declare -A DEPLOYED

for contract in "${CONTRACTS[@]}"; do
  WASM_SRC="$REPO_DIR/contracts/target/wasm32v1-none/release/$contract.wasm"

  if [ ! -f "$WASM_SRC" ]; then
    echo "Building $contract..."
    (cd "$REPO_DIR/contracts/$contract" && stellar contract build)
  fi

  # Deployer needs a copy at the old path for `stellar contract deploy` to find
  mkdir -p "$REPO_DIR/contracts/$contract/target/wasm32-unknown-unknown/release"
  cp "$WASM_SRC" "$REPO_DIR/contracts/$contract/target/wasm32-unknown-unknown/release/$contract.wasm"

  WASM_HASH=$(sha256sum "$WASM_SRC" | cut -d' ' -f1)
  echo "Deploying $contract (WASM SHA256: $WASM_HASH)..."
  echo "  If this times out, try a different RPC:"
  echo "    SOROBAN_RPC=https://rpc.ankr.com/stellar_testnet_soroban $0"
  echo ""

  RESULT=$(stellar contract deploy \
    --wasm "$WASM_SRC" \
    --source "$SECRET" \
    --rpc-url "$RPC" \
    --network-passphrase "$PASSPHRASE" 2>&1) || {
    echo "  ✗ deploy failed for $contract"
    echo "  Error: $RESULT"
    exit 1
  }

  CONTRACT_ID=$(echo "$RESULT" | grep -E '^[A-Z][A-Z0-9]{55}$' | head -1)
  DEPLOYED[$contract]=$CONTRACT_ID
  echo "  → $contract: $CONTRACT_ID"
  echo ""
done

echo "============================================"
echo "  DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo "Add to your frontend/.env.local:"
for contract in "${CONTRACTS[@]}"; do
  key="NEXT_PUBLIC_CONTRACT_$(echo "$contract" | tr '[:lower:]' '[:upper:]')"
  echo "$key=${DEPLOYED[$contract]}"
done
echo ""
echo "Explorer links:"
for contract in "${CONTRACTS[@]}"; do
  echo "https://stellar.expert/explorer/testnet/contract/${DEPLOYED[$contract]}"
done
