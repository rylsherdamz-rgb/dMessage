#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."

RPC="${SOROBAN_RPC:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
SECRET="${SOROBAN_SECRET_KEY:?SOROBAN_SECRET_KEY not set}"

CONTRACTS=("user_registry" "social_graph" "messages")

echo "=== dMessage Contract Deployment ==="
echo "Network: $RPC"
echo ""

declare -A DEPLOYED

for contract in "${CONTRACTS[@]}"; do
  WASM="$REPO_DIR/contracts/$contract/target/wasm32-unknown-unknown/release/$contract.wasm"

  if [ ! -f "$WASM" ]; then
    echo "Building $contract..."
    (cd "$REPO_DIR/contracts/$contract" && cargo build --release --target wasm32-unknown-unknown)
  fi

  WASM_HASH=$(sha256sum "$WASM" | cut -d' ' -f1)
  echo "Deploying $contract (WASM SHA256: $WASM_HASH)..."

  CONTRACT_ID=$(stellar contract deploy \
    --wasm "$WASM" \
    --source "$SECRET" \
    --rpc-url "$RPC" \
    --network-passphrase "$PASSPHRASE" 2>&1 | grep -E '^[A-Z][A-Z0-9]{55}$' | head -1)

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
