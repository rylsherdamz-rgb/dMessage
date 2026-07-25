#!/usr/bin/env bash
set -euo pipefail

# Sends one readable sponsored message in each direction for every locally
# recorded conversation, retaining exactly who sent and received each message.
#
# Usage:
#   tests/scripts/send-messages-mainnet.sh --execute [conversations.tsv]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
HELPER="$SCRIPT_DIR/_sponsored-invoke.cjs"
MESSAGES="${MESSAGES_CONTRACT:-CB4YOOUV3MLKN6AMRFETCYAD2HRHFUI45IUUCE3KXAJTZZJYBMOG76WX}"
SPONSOR_KEY="${SPONSOR_KEY:-my-wallet}"

if [[ "${1:-}" != "--execute" ]]; then
  echo "Usage: $0 --execute [conversations.tsv]" >&2
  exit 2
fi
CONVERSATIONS_FILE="${2:-$DATA_DIR/conversations.tsv}"
MESSAGES_FILE="$DATA_DIR/messages.tsv"

[[ -f "$CONVERSATIONS_FILE" ]] || { echo "Conversations file not found: $CONVERSATIONS_FILE" >&2; exit 1; }
mkdir -p "$DATA_DIR"
echo "conversation\tsender\trecipient\tmessage\ttx_hash" > "$MESSAGES_FILE"
sent=0

while IFS=$'\t' read -r pair caller_index caller_name caller_identity caller_address peer_index peer_name peer_identity peer_address _; do
  [[ "$pair" == "pair" || "$pair" =~ ^pair ]] && continue
  forward="Hey $peer_name, great to connect with you on dMessage."
  reply="Hi $caller_name! Nice to meet you here."

  for direction in forward reply; do
    if [[ "$direction" == "forward" ]]; then
      sender_name="$caller_name"; sender_identity="$caller_identity"; recipient_name="$peer_name"; recipient_address="$peer_address"; text="$forward"
    else
      sender_name="$peer_name"; sender_identity="$peer_identity"; recipient_name="$caller_name"; recipient_address="$caller_address"; text="$reply"
    fi
    echo "[$((sent + 1))] @$sender_name → @$recipient_name: $text"
    output="$(node "$HELPER" --contract "$MESSAGES" --function send_message_sponsored --sponsor "$SPONSOR_KEY" --caller "$sender_identity" --peer "$recipient_address" --message "$text")"
    echo "  $output"
    tx_hash="$(sed -n 's/^RESULT .*"hash":"\([^"]*\)".*/\1/p' <<< "$output")"
    printf '%s\t%s\t%s\t%s\t%s\n' "$pair" "$sender_name" "$recipient_name" "$text" "$tx_hash" >> "$MESSAGES_FILE"
    ((sent += 1))
  done
done < "$CONVERSATIONS_FILE"

echo "Saved $sent messages to $MESSAGES_FILE"
