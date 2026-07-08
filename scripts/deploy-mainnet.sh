#!/usr/bin/env bash
#
# deploy-mainnet.sh — deploy the dMessage gasless contracts to Stellar MAINNET,
# write deployment.mainnet.json, and append/update a "Mainnet" section in README.md.
#
# ─────────────────────────────────────────────────────────────────────────────
#  SAFETY: this spends REAL XLM and deploys to a public network. Nothing is
#  deployed until you type the confirmation phrase. The deployer SECRET KEY is
#  read from an environment variable and is NEVER written to any file.
# ─────────────────────────────────────────────────────────────────────────────
#
# USAGE:
#   # 1. Fill in the deployer keys below (or export them before running):
#   export MAINNET_DEPLOYER_SECRET="S...your 56-char secret..."
#   export MAINNET_DEPLOYER_PUBLIC="G...your public address..."
#
#   # 2. (optional) preview without deploying:
#   ./scripts/deploy-mainnet.sh --dry-run
#
#   # 3. deploy for real:
#   ./scripts/deploy-mainnet.sh
#
# REQUIREMENTS: stellar-cli, a mainnet-funded deployer account, python3, sha256sum.

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
# Placeholders — replace, or export the same-named env vars before running.
# The SECRET is only used in-memory to sign; it is never persisted.
MAINNET_DEPLOYER_SECRET="${MAINNET_DEPLOYER_SECRET:-SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX}"
MAINNET_DEPLOYER_PUBLIC="${MAINNET_DEPLOYER_PUBLIC:-GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX}"

# Public live URL shown as the "visit" link in the README (edit as needed).
LIVE_URL="${MAINNET_LIVE_URL:-https://dmessage.vercel.app}"

NETWORK="mainnet"
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
EXPLORER_BASE="https://stellar.expert/explorer/public"

# Repo paths (script lives in <repo>/scripts/).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GASLESS_DIR="$REPO_ROOT/contracts/gasless"
WASM_DIR="$GASLESS_DIR/target/wasm32v1-none/release"
MANIFEST="$REPO_ROOT/deployment.mainnet.json"
README="$REPO_ROOT/README.md"

# Contract crate dir -> json key.
declare -a CRATES=("user_registry_gasless" "social_graph_gasless" "messages_gasless")
declare -A JSON_KEY=(
  [user_registry_gasless]="user_registry"
  [social_graph_gasless]="social_graph"
  [messages_gasless]="messages"
)
declare -A NICE_NAME=(
  [user_registry_gasless]="UserRegistry"
  [social_graph_gasless]="SocialGraph"
  [messages_gasless]="MessageContract"
)

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y)  ASSUME_YES=1 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

red()   { printf '\033[31m%b\033[0m\n' "$*"; }
green() { printf '\033[32m%b\033[0m\n' "$*"; }
bold()  { printf '\033[1m%b\033[0m\n' "$*"; }

# ── Preflight checks ─────────────────────────────────────────────────────────
command -v stellar  >/dev/null || { red "stellar CLI not found"; exit 1; }
command -v python3  >/dev/null || { red "python3 not found"; exit 1; }
command -v sha256sum >/dev/null || { red "sha256sum not found"; exit 1; }

if [[ "$DRY_RUN" != "1" ]]; then
  if [[ "$MAINNET_DEPLOYER_SECRET" == SXXXX* || -z "$MAINNET_DEPLOYER_SECRET" ]]; then
    red "MAINNET_DEPLOYER_SECRET is not set (still the placeholder)."
    echo "  export MAINNET_DEPLOYER_SECRET=\"S...\"  # the deployer's secret key"
    exit 1
  fi
  if [[ ! "$MAINNET_DEPLOYER_SECRET" =~ ^S[A-Z2-7]{55}$ ]]; then
    red "MAINNET_DEPLOYER_SECRET does not look like a valid Stellar secret (S... 56 chars)."
    exit 1
  fi
  if [[ "$MAINNET_DEPLOYER_PUBLIC" == GXXXX* || -z "$MAINNET_DEPLOYER_PUBLIC" ]]; then
    red "MAINNET_DEPLOYER_PUBLIC is not set (still the placeholder)."
    echo "  export MAINNET_DEPLOYER_PUBLIC=\"G...\"  # the deployer's public address"
    exit 1
  fi
fi

bold "dMessage — MAINNET contract deployment"
echo "  network   : $NETWORK"
echo "  deployer  : $MAINNET_DEPLOYER_PUBLIC"
echo "  live URL  : $LIVE_URL"
echo "  manifest  : $MANIFEST"

# Best-effort balance check (non-fatal).
BAL="$(curl -s "https://horizon.stellar.org/accounts/$MAINNET_DEPLOYER_PUBLIC" \
  | python3 -c "import sys,json
try:
    d=json.load(sys.stdin); n=[b for b in d.get('balances',[]) if b.get('asset_type')=='native']
    print(n[0]['balance'] if n else 'unknown')
except Exception:
    print('account not found / not funded')" 2>/dev/null || echo "lookup failed")"
echo "  XLM bal.  : $BAL"

# ── Build ────────────────────────────────────────────────────────────────────
bold "\nBuilding contracts (wasm32v1-none)…"
for crate in "${CRATES[@]}"; do
  echo "  • $crate"
  ( cd "$GASLESS_DIR/$crate" && stellar contract build >/dev/null )
done
green "Build complete."

if [[ "$DRY_RUN" == "1" ]]; then
  bold "\n[dry-run] wasm artifacts + hashes (nothing deployed):"
  for crate in "${CRATES[@]}"; do
    h="$(sha256sum "$WASM_DIR/$crate.wasm" | awk '{print $1}')"
    echo "  ${NICE_NAME[$crate]}: $h"
  done
  green "\n[dry-run] complete. Re-run without --dry-run to deploy to mainnet."
  exit 0
fi

# ── Confirmation ─────────────────────────────────────────────────────────────
if [[ "$ASSUME_YES" != "1" ]]; then
  red "\nThis will deploy to MAINNET and spend REAL XLM from $MAINNET_DEPLOYER_PUBLIC."
  read -r -p "Type 'DEPLOY MAINNET' to continue: " CONFIRM
  [[ "$CONFIRM" == "DEPLOY MAINNET" ]] || { echo "Aborted."; exit 1; }
fi

# ── Deploy ───────────────────────────────────────────────────────────────────
declare -A ADDR HASH
bold "\nDeploying…"
for crate in "${CRATES[@]}"; do
  wasm="$WASM_DIR/$crate.wasm"
  HASH[$crate]="$(sha256sum "$wasm" | awk '{print $1}')"
  echo "  • ${NICE_NAME[$crate]} (wasm ${HASH[$crate]:0:12}…)"
  # --source accepts a secret key directly; it is not persisted anywhere.
  id="$(stellar contract deploy \
        --wasm "$wasm" \
        --source "$MAINNET_DEPLOYER_SECRET" \
        --network "$NETWORK" 2>&1 | tail -1 | tr -d '[:space:]')"
  if [[ ! "$id" =~ ^C[A-Z2-7]{55}$ ]]; then
    red "    Deployment did not return a contract id. Output: $id"
    exit 1
  fi
  ADDR[$crate]="$id"
  green "    deployed: $id"
done

# ── Write deployment.mainnet.json (NO secret is ever written) ────────────────
bold "\nWriting $MANIFEST…"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_COMMIT="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
python3 - "$MANIFEST" "$NOW" "$GIT_COMMIT" "$MAINNET_DEPLOYER_PUBLIC" \
  "${ADDR[user_registry_gasless]}" "${HASH[user_registry_gasless]}" \
  "${ADDR[social_graph_gasless]}" "${HASH[social_graph_gasless]}" \
  "${ADDR[messages_gasless]}" "${HASH[messages_gasless]}" <<'PY'
import json, sys
(_, path, now, commit, deployer,
 ur_id, ur_hash, sg_id, sg_hash, msg_id, msg_hash) = sys.argv
data = {
    "network": "mainnet",
    "network_passphrase": "Public Global Stellar Network ; September 2015",
    "deployed_at": now,
    "git_commit": commit,
    "feature": "Gasless / fee-sponsored contracts (security-hardened, audited build).",
    "deployer": deployer,
    "contracts": {
        "user_registry": {"id": ur_id, "wasm_sha256": ur_hash,
                           "src": "contracts/gasless/user_registry_gasless/src/lib.rs"},
        "social_graph":  {"id": sg_id, "wasm_sha256": sg_hash,
                           "src": "contracts/gasless/social_graph_gasless/src/lib.rs"},
        "messages":      {"id": msg_id, "wasm_sha256": msg_hash,
                           "src": "contracts/gasless/messages_gasless/src/lib.rs"},
    },
    "build": {"command": "stellar contract build", "target": "wasm32v1-none"},
    "note": "Secret keys are never stored here. Frontend env vars: "
            "NEXT_PUBLIC_CONTRACT_USER_REGISTRY / _SOCIAL_GRAPH / _MESSAGES.",
}
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print("  wrote", path)
PY

# ── Append / update the Mainnet section in README.md ─────────────────────────
bold "Updating README.md Mainnet section…"
python3 - "$README" "$NOW" "$LIVE_URL" "$EXPLORER_BASE" "$MAINNET_DEPLOYER_PUBLIC" \
  "${ADDR[user_registry_gasless]}" "${HASH[user_registry_gasless]}" \
  "${ADDR[social_graph_gasless]}" "${HASH[social_graph_gasless]}" \
  "${ADDR[messages_gasless]}" "${HASH[messages_gasless]}" <<'PY'
import sys
(_, readme, now, live, base, deployer,
 ur_id, ur_hash, sg_id, sg_hash, msg_id, msg_hash) = sys.argv

BEGIN = "<!-- MAINNET-DEPLOYMENT:BEGIN (auto-generated by scripts/deploy-mainnet.sh) -->"
END   = "<!-- MAINNET-DEPLOYMENT:END -->"

section = f"""{BEGIN}
## Mainnet Deployment

**Live (mainnet):** [{live}]({live})

The gasless / fee-sponsored contracts are deployed on **Stellar Mainnet** (deployed
{now} by [`{deployer}`]({base}/account/{deployer})).

| Contract | Address | WASM Hash (SHA256) |
|----------|---------|-------------------|
| UserRegistry (gasless) | `{ur_id}` | `{ur_hash}` |
| SocialGraph (gasless) | `{sg_id}` | `{sg_hash}` |
| MessageContract (gasless) | `{msg_id}` | `{msg_hash}` |

Explorer: [UserRegistry]({base}/contract/{ur_id}) · [SocialGraph]({base}/contract/{sg_id}) · [Messages]({base}/contract/{msg_id})

Full metadata: [`deployment.mainnet.json`](deployment.mainnet.json).
{END}"""

with open(readme, "r", encoding="utf-8") as f:
    text = f.read()

if BEGIN in text and END in text:
    pre = text[: text.index(BEGIN)]
    post = text[text.index(END) + len(END):]
    text = pre + section + post
    action = "updated"
else:
    text = text.rstrip() + "\n\n" + section + "\n"
    action = "appended"

with open(readme, "w", encoding="utf-8") as f:
    f.write(text)
print(f"  README Mainnet section {action}.")
PY

green "\n✅ Mainnet deployment complete."
echo ""
bold "Frontend env (set these for the mainnet build):"
echo "  NEXT_PUBLIC_STELLAR_NETWORK=mainnet"
echo "  NEXT_PUBLIC_SOROBAN_RPC=https://soroban-rpc.mainnet.stellar.gateway.fm"
echo "  NEXT_PUBLIC_CONTRACT_USER_REGISTRY=${ADDR[user_registry_gasless]}"
echo "  NEXT_PUBLIC_CONTRACT_SOCIAL_GRAPH=${ADDR[social_graph_gasless]}"
echo "  NEXT_PUBLIC_CONTRACT_MESSAGES=${ADDR[messages_gasless]}"
echo ""
echo "Review the README Mainnet section and deployment.mainnet.json, then commit."
