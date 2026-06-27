#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR/.."

RPC="${SOROBAN_RPC:-https://soroban-testnet.stellar.org}"
PASSPHRASE="${SOROBAN_PASSPHRASE:-Test SDF Network ; September 2015}"
SECRET="${SOROBAN_SECRET_KEY:?SOROBAN_SECRET_KEY not set}}

CONTRACTS=("user_registry" "social_graph" "messages")

echo "=== dMessage Contract Deployment ==="
echo "Network: $RPC"
echo ""

for contract in "${CONTRACTS[@]}"; do
  WASM="$REPO_DIR/contracts/$contract/target/wasm32-unknown-unknown/release/$contract.wasm"

  if [ ! -f "$WASM" ]; then
    echo "Building $contract..."
    (cd "$REPO_DIR/contracts/$contract" && cargo build --release --target wasm32-unknown-unknown)
  fi

  echo "Deploying $contract..."
  HASH=$(soroban contract deploy \
    --wasm "$WASM" \
    --source "$SECRET" \
    --rpc-url "$RPC" \
    --network-passphrase "$PASSPHRASE" 2>&1 | tail -1)

  echo "  -> $contract: $HASH"
  echo ""
done

echo "=== Deployment complete ==="
echo "Add these to your .env:"
for contract in "${CONTRACTS[@]}"; do
  echo "NEXT_PUBLIC_CONTRACT_${contract^^}=<ID>"
done
