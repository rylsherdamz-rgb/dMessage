#!/usr/bin/env bash
set -euo pipefail

RPC="https://soroban-rpc.mainnet.stellar.gateway.fm"
PASSPHRASE="Public Global Stellar Network ; September 2015"
HORIZON="https://horizon.stellar.org"
UR="CBXX465FRKWQMWPPX3YDEBHPHC2K2L55VWLCPZCRRZB77ZVDABFC33YY"
SG="CBUC7OBYGSMRIHPARU4B77M4LSRPY5X7LSGOGYO3HZXH5RFAPP752CY5"
MSG="CB4YOOUV3MLKN6AMRFETCYAD2HRHFUI45IUUCE3KXAJTZZJYBMOG76WX"
DEPLOYER="my-wallet"
CSV="/home/richie/Downloads/dMessage FeedBack  (Responses) - Form Responses 1.csv"
MODE="${1:-sim}"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

# ── Extract names from CSV ────────────────────────────────────────────────────
mapfile -t NAMES < <(python3 -c "
import csv
with open('$CSV') as f:
    reader = csv.DictReader(f)
    for row in reader:
        first = row['3. Name'].split()[0].lower().replace('.','').replace(\"'\",'')
        print(first)
")
NUM_NAMES=${#NAMES[@]}

# ── Deployer info ─────────────────────────────────────────────────────────────
DEPLOYER_ADDR=$(stellar keys address $DEPLOYER)
echo "Deployer: $DEPLOYER_ADDR"
BAL=$(curl -s "$HORIZON/accounts/$DEPLOYER_ADDR" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for b in d.get('balances',[]):
        if b.get('asset_type')=='native': print(b['balance']); break
except: print('0')" 2>/dev/null || echo "0")
echo "Balance : $BAL XLM"
echo "Names   : $NUM_NAMES loaded"

base="--source $DEPLOYER --rpc-url $RPC"

# ── Estimate costs ────────────────────────────────────────────────────────────
echo ""
echo "═══ COST ESTIMATE ═══"
echo "  register_user (standard):     15,000 stroops = 0.0015 XLM"
echo "  ensure_conversation (std):    20,000 stroops = 0.0020 XLM"  
echo "  send_message (standard):      18,000 stroops = 0.0018 XLM"
echo "  ───────────────────────────────────────────────"
echo "  Per user (reg+conv+msg):      53,000 stroops = 0.0053 XLM"
echo "  $NUM_NAMES users:             $((NUM_NAMES * 53000)) stroops = $(echo "scale=4; $NUM_NAMES * 0.0053" | bc) XLM"
echo "  + funding $NUM_NAMES × 0.5:   $(echo "scale=1; $NUM_NAMES * 0.5" | bc) XLM"
echo "  TOTAL needed:                  $(echo "scale=4; $NUM_NAMES * 0.5 + $NUM_NAMES * 0.0053" | bc) XLM"
echo "  Your balance:                  $BAL XLM"
NEEDED=$(echo "scale=1; $NUM_NAMES * 0.5 + 0.5" | bc)
if (( $(echo "$BAL > $NEEDED" | bc -l) )); then
  green "  ✓ Enough XLM"
else
  red "  ✗ Only $(echo "scale=1; $NUM_NAMES * 0.5 + 0.5" | bc) XLM needed, you have $BAL"
fi

if [[ "$MODE" == "sim" ]]; then
  echo ""
  bold "Simulate first invocation cost on mainnet..."
  for sim in "register_user --caller $DEPLOYER_ADDR --username sim_user --encryption_pubkey $(printf 'a%.0s' {1..64}) --metadata_ipfs ''" \
             "ensure_conversation --caller $DEPLOYER_ADDR --user_a $DEPLOYER_ADDR --user_b $DEPLOYER_ADDR" \
             "send_message --sender $DEPLOYER_ADDR --recipient $DEPLOYER_ADDR --content 'hello'"; do
    op="${sim%% *}"
    echo ""
    echo "--- $op ---"
    eval "stellar contract invoke $base --id $UR --send no -- $sim 2>&1 | grep -i 'fee\|resource\|cost\|min' | head -5 || echo '(no fee info shown)'"
  done
  echo ""
  bold "Run: $0 verify  (3-user functional test)"
  bold "    : $0 full    (all $NUM_NAMES users)"
  exit 0
fi

# ── Check test-user keys ──────────────────────────────────────────────────────
bold ""
echo "═══ Checking test-user keys ═══"
USE_USERS=$NUM_NAMES
[[ "$MODE" == "verify" ]] && USE_USERS=3

declare -a USER_KEYS
for i in $(seq 0 $((USE_USERS - 1))); do
  name="test-user-$i"
  if addr=$(stellar keys address "$name" 2>/dev/null); then
    USER_KEYS+=("$addr")
  else
    red "  ✗ $name not found. Run: stellar keys generate $name"
    exit 1
  fi
done
echo "  ✓ ${#USER_KEYS[@]} test users ready"

# ── Fund users ────────────────────────────────────────────────────────────────
bold ""
echo "═══ Funding $USE_USERS users (0.5 XLM each) ═══"
FUND_COUNT=0
for i in $(seq 0 $((USE_USERS - 1))); do
  addr="${USER_KEYS[$i]}"
  bal=$(curl -s "$HORIZON/accounts/$addr" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for b in d.get('balances',[]):
        if b.get('asset_type')=='native': print(b['balance']); break
except: print('0')" 2>/dev/null || echo "0")
  
  if (( $(echo "$bal > 0" | bc -l) )); then
    echo "  user$i ($addr): already has $bal XLM"
    continue
  fi
  
  echo -n "  funding user$i (${NAMES[$i]})... "
  out=$(stellar payment send --source $DEPLOYER --rpc-url $RPC --network-passphrase "$PASSPHRASE" --destination "$addr" --amount 0.5 2>&1) || true
  if echo "$out" | grep -qi "error"; then
    red "FAIL: $(echo "$out" | head -1)"
  else
    green "ok"
    FUND_COUNT=$((FUND_COUNT + 1))
    sleep 1
  fi
done
echo "  Funded $FUND_COUNT accounts"
[[ $FUND_COUNT -gt 0 ]] && { echo "  Waiting 15s..."; sleep 15; }

# ── Register users ────────────────────────────────────────────────────────────
bold ""
echo "═══ Registering $USE_USERS users ═══"
REG_OK=0
for i in $(seq 0 $((USE_USERS - 1))); do
  keyname="test-user-$i"
  addr="${USER_KEYS[$i]}"
  uname="${NAMES[$i]}"
  echo -n "  $uname ($addr)... "
  out=$(stellar contract invoke --source "$keyname" --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $UR -- register_user --caller "$addr" --username "$uname" --encryption_pubkey "$(printf 'a%.0s' {1..64})" --metadata_ipfs '' 2>&1) || true
  if echo "$out" | grep -qi "error\|Exception\|Failed\|panic"; then
    # Check if already registered
    check=$(stellar contract invoke --source $DEPLOYER --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $UR -- get_user --addr "$addr" 2>&1) || true
    if echo "$check" | grep -qi "$uname"; then
      green "already registered"
      REG_OK=$((REG_OK + 1))
    else
      red "FAIL"
      echo "    $(echo "$out" | head -3)"
    fi
  else
    green "✓"
    REG_OK=$((REG_OK + 1))
  fi
done
echo "  Registered: $REG_OK/$USE_USERS"

# ── Verify registrations ──────────────────────────────────────────────────────
echo "  Verifying..."
VERIFY_OK=0
for i in $(seq 0 $((USE_USERS - 1))); do
  addr="${USER_KEYS[$i]}"
  out=$(stellar contract invoke --source $DEPLOYER --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $UR -- get_user --addr "$addr" 2>&1) || true
  if echo "$out" | grep -qi "username"; then
    VERIFY_OK=$((VERIFY_OK + 1))
  fi
done
echo "  Verified: $VERIFY_OK/$USE_USERS"

# ── Create conversations (ring) ───────────────────────────────────────────────
bold ""
echo "═══ Creating conversation ring ═══"
CONV_OK=0
for i in $(seq 0 $((USE_USERS - 1))); do
  a="${USER_KEYS[$i]}"
  b="${USER_KEYS[$(( (i + 1) % USE_USERS ))]}"
  caller_name="test-user-$i"
  echo -n "  ${NAMES[$i]} ↔ ${NAMES[$(( (i + 1) % USE_USERS ))]}... "
  out=$(stellar contract invoke --source "$caller_name" --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $SG -- ensure_conversation --caller "$a" --user_a "$a" --user_b "$b" 2>&1) || true
  if echo "$out" | grep -qi "error\|Exception\|Failed\|panic"; then
    red "FAIL"
    echo "    $(echo "$out" | head -2)"
  else
    green "✓"
    CONV_OK=$((CONV_OK + 1))
  fi
done
echo "  Conversations: $CONV_OK/$USE_USERS"

# ── Check conversation refs ───────────────────────────────────────────────────
echo "  Checking refs..."
CONV_REF_OK=0
for i in $(seq 0 $((USE_USERS - 1))); do
  addr="${USER_KEYS[$i]}"
  out=$(stellar contract invoke --source $DEPLOYER --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $SG -- get_user_conversations --user_addr "$addr" 2>&1) || true
  if echo "$out" | grep -qi "conversation_id\|peer_address"; then
    CONV_REF_OK=$((CONV_REF_OK + 1))
  fi
done
echo "  Users with conv refs: $CONV_REF_OK/$USE_USERS"

# ── Send messages ─────────────────────────────────────────────────────────────
bold ""
echo "═══ Sending messages ═══"
MSG_OK=0
for i in $(seq 0 $((USE_USERS - 1))); do
  sender_name="test-user-$i"
  sender="${USER_KEYS[$i]}"
  recipient="${USER_KEYS[$(( (i + 1) % USE_USERS ))]}"
  echo -n "  ${NAMES[$i]} → ${NAMES[$(( (i + 1) % USE_USERS ))]}... "
  out=$(stellar contract invoke --source "$sender_name" --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $MSG -- send_message --sender "$sender" --recipient "$recipient" --content "hello from ${NAMES[$i]}" 2>&1) || true
  if echo "$out" | grep -qi "error\|Exception\|Failed\|panic"; then
    red "FAIL"
    echo "    $(echo "$out" | head -2)"
  else
    green "✓"
    MSG_OK=$((MSG_OK + 1))
  fi
done
echo "  Messages sent: $MSG_OK/$USE_USERS"

# ── Verify messages ───────────────────────────────────────────────────────────
echo "  Checking inboxes..."
INBOX_OK=0
for i in $(seq 0 $((USE_USERS - 1))); do
  addr="${USER_KEYS[$i]}"
  out=$(stellar contract invoke --source $DEPLOYER --rpc-url $RPC --network-passphrase "$PASSPHRASE" --id $MSG -- get_messages --user "$addr" --page 0 --page_size 10 2>&1) || true
  if echo "$out" | grep -qi "sender\|content"; then
    INBOX_OK=$((INBOX_OK + 1))
  fi
done
echo "  Inboxes with messages: $INBOX_OK/$USE_USERS"

# ── Summary ───────────────────────────────────────────────────────────────────
bold ""
echo "═══════════════════════════════════════════════════"
echo "  RESULTS"
echo "═══════════════════════════════════════════════════"
echo "  Users           : $USE_USERS"
echo "  Registered      : $REG_OK"
echo "  Conversations   : $CONV_OK"
echo "  Messages sent   : $MSG_OK"
echo "  Inboxes verified: $INBOX_OK"

BAL_END=$(curl -s "$HORIZON/accounts/$DEPLOYER_ADDR" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    for b in d.get('balances',[]):
        if b.get('asset_type')=='native': print(b['balance']); break
except: print('0')" 2>/dev/null || echo "0")
echo ""
echo "  Deployer balance: $BAL_END XLM (was $BAL XLM)"
SPENT=$(echo "scale=7; $BAL - $BAL_END" | bc 2>/dev/null)
echo "  Spent: ~$SPENT XLM"

if [[ $REG_OK -eq $USE_USERS && $MSG_OK -eq $USE_USERS ]]; then
  green ""
  echo "  ✅ ALL CONTRACTS WORKING ON MAINNET"
else
  red ""
  echo "  ❌ Some operations failed (see above)"
fi
echo ""
echo "  UserRegistry : $UR"
echo "  SocialGraph  : $SG"
echo "  Messages     : $MSG"
echo ""
