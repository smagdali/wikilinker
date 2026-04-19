#!/usr/bin/env bash
#
# Build pageview rankings and bloom filters for all languages.
#
# Usage:
#   bash scripts/build-all-langs.sh                        # all 20 languages
#   bash scripts/build-all-langs.sh --langs en,fr,es       # subset
#   bash scripts/build-all-langs.sh --langs fr --force     # rebuild even if up to date
#
# Steps per language:
#   1. Pageview extraction (all langs at once via --all-langs, or per-lang)
#   2. Bloom filter build
#
# Skips work if the bloom is newer than the TSV (idempotent).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

LANGS_CSV=""
FORCE=false
DAYS=30

while [[ $# -gt 0 ]]; do
  case $1 in
    --langs) LANGS_CSV=$2; shift 2 ;;
    --days) DAYS=$2; shift 2 ;;
    --force) FORCE=true; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Determine target languages
if [[ -n "$LANGS_CSV" ]]; then
  IFS=',' read -r -a LANGS <<< "$LANGS_CSV"
else
  LANGS=($(node -p "require('$ROOT_DIR/i18n/languages.json').languages.map(l => l.code).join(' ')"))
fi

echo "=== build-all-langs ==="
echo "Languages: ${LANGS[*]}"
echo "Days: $DAYS | Force: $FORCE"
echo ""

# Skip logic: bloom exists and is newer than TSV
needs_build() {
  local lang=$1
  local tsv="$ROOT_DIR/i18n/$lang/titles-ranked.tsv"
  local bloom="$ROOT_DIR/i18n/$lang/entities-bloom.bin"

  if $FORCE; then return 0; fi
  if [[ ! -f "$bloom" ]]; then return 0; fi
  if [[ ! -f "$tsv" ]]; then return 0; fi
  if [[ "$tsv" -nt "$bloom" ]]; then return 0; fi
  return 1
}

# Filter to languages that actually need work
LANGS_TO_BUILD=()
for lang in "${LANGS[@]}"; do
  if needs_build "$lang"; then
    LANGS_TO_BUILD+=("$lang")
  else
    echo "  [up-to-date] $lang"
  fi
done

if [[ ${#LANGS_TO_BUILD[@]} -eq 0 ]]; then
  echo ""
  echo "All bloom filters up to date. Use --force to rebuild."
  exit 0
fi

echo ""
echo "Building: ${LANGS_TO_BUILD[*]}"
echo ""

# ===== Pageview extraction =====
# If all 20 are being built, use --all-langs (single-pass extraction).
# Otherwise run per-language.
TOTAL_LANGS=$(node -p "require('$ROOT_DIR/i18n/languages.json').languages.length")

if [[ ${#LANGS_TO_BUILD[@]} -eq "$TOTAL_LANGS" ]]; then
  echo "=== Extracting all languages in one pass ==="
  bash "$SCRIPT_DIR/build-pageview-ranking.sh" --all-langs --days "$DAYS"
else
  for lang in "${LANGS_TO_BUILD[@]}"; do
    echo "=== Extracting $lang ==="
    bash "$SCRIPT_DIR/build-pageview-ranking.sh" --lang "$lang" --days "$DAYS"
  done
fi

# ===== Bloom filter build =====
for lang in "${LANGS_TO_BUILD[@]}"; do
  echo ""
  echo "=== Building bloom for $lang ==="
  node "$SCRIPT_DIR/build-bloom.mjs" --lang "$lang"
done

echo ""
echo "=== Done ==="
echo "Built: ${LANGS_TO_BUILD[*]}"
