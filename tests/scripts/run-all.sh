#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CSV="${1:-/home/richie/Projects/test/test/identity_data_59.csv}"
COUNT="${2:-12}"

echo "=== Step 1: Fix CSV line endings ==="
sed -i 's/\r$//' "$CSV"
echo "Done."

SPONSOR_KEY="${SPONSOR_KEY:-my-wallet}"
SPONSOR_ADDR="$(stellar keys address "$SPONSOR_KEY")"
export SPONSOR_KEY

echo ""
echo "=== Step 2: Generate missing Stellar keys ==="
while IFS=, read -r id name _ pk; do
  [[ "$id" == "identity" ]] && continue
  [[ -z "$id" ]] && continue
  stellar keys generate "$id" 2>/dev/null && echo "  Generated $id" || echo "  $id already exists"
done < "$CSV"

echo ""
echo "=== Step 3: Fund accounts (1.01 XLM each from sponsor) ==="
STARTING_BALANCE=1.01 node "$SCRIPT_DIR/_fund-accounts.cjs" "$CSV" "$COUNT"

echo ""
echo "=== Step 4: Register users ==="
"$SCRIPT_DIR/register-users-mainnet.sh" --execute "$CSV" "$COUNT"

echo ""
echo "=== Step 5: Create conversations ==="
"$SCRIPT_DIR/create-conversations-mainnet.sh" --execute

echo ""
echo "=== Step 6: Send messages ==="
"$SCRIPT_DIR/send-messages-mainnet.sh" --execute

echo ""
echo "=== Step 7: Recover funds (merge accounts back to sponsor) ==="
STARTING_BALANCE=1.01 node "$SCRIPT_DIR/_merge-accounts.cjs" "$CSV" "$COUNT"

echo ""
echo "=== All done ==="
ls -la "$SCRIPT_DIR/data/"
echo "Sponsor balance check:"
curl -s "https://horizon.stellar.org/accounts/$SPONSOR_ADDR" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  XLM:', [b['balance'] for b in d.get('balances',[]) if b.get('asset_type')=='native'])"
