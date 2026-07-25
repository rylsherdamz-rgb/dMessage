#!/usr/bin/env bash
set -euo pipefail

# Registers identities from identity_data_59.csv using the mainnet UserRegistry
# sponsored entry point. Retains identities, names, and public keys for later scripts.
#
# PREREQUISITE: each identity in the CSV (v34, v35, ...) must be a local Stellar
# key. Generate missing ones with:
#   while IFS=, read -r id name _ pk; do
#     [[ "$id" == "identity" ]] && continue
#     stellar keys generate "$id" || true
#   done < identity_data_59.csv
#
# Usage:
#   tests/scripts/register-users-mainnet.sh --execute /path/to/identity_data_59.csv [count]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
HELPER="$SCRIPT_DIR/_sponsored-invoke.cjs"
REGISTRY="${USER_REGISTRY_CONTRACT:-CBXX465FRKWQMWPPX3YDEBHPHC2K2L55VWLCPZCRRZB77ZVDABFC33YY}"
SPONSOR_KEY="${SPONSOR_KEY:-my-wallet}"

if [[ "${1:-}" != "--execute" || -z "${2:-}" ]]; then
  echo "Usage: $0 --execute /path/to/identity_data_59.csv [count]" >&2
  exit 2
fi
CSV="$2"
COUNT="${3:-60}"
USERS_FILE="$DATA_DIR/users.tsv"

command -v stellar >/dev/null || { echo "stellar CLI is required" >&2; exit 1; }
[[ -f "$CSV" ]] || { echo "CSV not found: $CSV" >&2; exit 1; }
mkdir -p "$DATA_DIR"

echo "index	username	identity	stellar_address	source_address" > "$USERS_FILE"
registered=0

# CSV columns: identity, first_name, email, public_key
while IFS=, read -r identity first_name _email public_key _rest; do
  [[ "$identity" == "identity" ]] && continue
  [[ -z "$first_name" ]] && continue
  [[ "$registered" -ge "$COUNT" ]] && break

  username="$(printf '%s' "$first_name" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_')"
  [[ -n "$username" ]] || { echo "Skipping row with invalid name: $first_name" >&2; continue; }

  # Verify the Stellar identity exists locally (needed for --caller signing)
  if ! stellar keys address "$identity" &>/dev/null; then
    echo "Skipping $identity: local Stellar key not found — generate it first" >&2
    continue
  fi

  address="$(stellar keys address "$identity")"
  echo "[$registered/$COUNT] Registering @$username ($identity → $address)"

  output="$(node "$HELPER" --contract "$REGISTRY" --function register_user_sponsored --sponsor "$SPONSOR_KEY" --caller "$identity" --username "$username")"
  echo "  $output"
  printf '%s\t%s\t%s\t%s\t%s\n' "$registered" "$username" "$identity" "$address" "$public_key" >> "$USERS_FILE"
  ((registered += 1))
done < "$CSV"

echo "Saved $registered registered users to $USERS_FILE"