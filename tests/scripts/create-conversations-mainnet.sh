#!/usr/bin/env bash
set -euo pipefail

# Pairs the locally recorded users and creates their mainnet SocialGraph
# conversations through ensure_conversation_sponsored.
#
# Usage:
#   tests/scripts/create-conversations-mainnet.sh --execute [users.tsv] [pair-count]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
HELPER="$SCRIPT_DIR/_sponsored-invoke.cjs"
SOCIAL_GRAPH="${SOCIAL_GRAPH_CONTRACT:-CBUC7OBYGSMRIHPARU4B77M4LSRPY5X7LSGOGYO3HZXH5RFAPP752CY5}"
SPONSOR_KEY="${SPONSOR_KEY:-my-wallet}"

if [[ "${1:-}" != "--execute" ]]; then
  echo "Usage: $0 --execute [users.tsv] [pair-count]" >&2
  exit 2
fi
USERS_FILE="${2:-$DATA_DIR/users.tsv}"
PAIR_LIMIT="${3:-60}"
CONVERSATIONS_FILE="$DATA_DIR/conversations.tsv"

[[ -f "$USERS_FILE" ]] || { echo "Users file not found: $USERS_FILE" >&2; exit 1; }
mkdir -p "$DATA_DIR"
mapfile -t USERS < <(tail -n +2 "$USERS_FILE")
(( ${#USERS[@]} >= 2 )) || { echo "Need at least two registered users" >&2; exit 1; }

echo "pair\tcaller_index\tcaller_name\tcaller_identity\tcaller_address\tpeer_index\tpeer_name\tpeer_identity\tpeer_address\ttx_hash" > "$CONVERSATIONS_FILE"
mapfile -t SHUFFLED < <(printf '%s\n' "${!USERS[@]}" | shuf)
created=0

for ((position = 0; position + 1 < ${#SHUFFLED[@]} && created < PAIR_LIMIT; position += 2)); do
  IFS=$'\t' read -r caller_index caller_name caller_identity caller_address _ <<< "${USERS[${SHUFFLED[$position]}]}"
  IFS=$'\t' read -r peer_index peer_name peer_identity peer_address _ <<< "${USERS[${SHUFFLED[$((position + 1))]}]}"
  echo "[$((created + 1))/$PAIR_LIMIT] @$caller_name ↔ @$peer_name"
  output="$(node "$HELPER" --contract "$SOCIAL_GRAPH" --function ensure_conversation_sponsored --sponsor "$SPONSOR_KEY" --caller "$caller_identity" --peer "$peer_address")"
  echo "  $output"
  tx_hash="$(sed -n 's/^RESULT .*"hash":"\([^"]*\)".*/\1/p' <<< "$output")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$created" "$caller_index" "$caller_name" "$caller_identity" "$caller_address" \
    "$peer_index" "$peer_name" "$peer_identity" "$peer_address" "$tx_hash" >> "$CONVERSATIONS_FILE"
  ((created += 1))
done

echo "Saved $created conversations to $CONVERSATIONS_FILE"
