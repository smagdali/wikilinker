#!/bin/bash
#
# Build pageview ranking from N days of Wikimedia pageview_complete dumps.
#
# Usage:
#   bash scripts/build-pageview-ranking.sh [--lang en] [--days 30] [--concurrency 4]
#   bash scripts/build-pageview-ranking.sh --all-langs [--days 30] [--concurrency 4]
#
# Downloads daily pageview dumps, extracts per-language entries, aggregates
# counts across all days, and writes i18n/{lang}/titles-ranked.tsv.
#
# --all-langs does a single bzcat pass per dump, splitting output across all
# 20 languages simultaneously (the dumps contain every language in one file).
# Without --all-langs, only the one requested language is extracted.
#
# Dependencies: curl, bzcat, awk, sort, python3, node
#
set -euo pipefail

# Defaults
LANG_CODE=en
DAYS=30
CONCURRENCY=4
ALL_LANGS=false

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --lang) LANG_CODE=$2; shift 2 ;;
    --all-langs) ALL_LANGS=true; shift ;;
    --days) DAYS=$2; shift 2 ;;
    --concurrency) CONCURRENCY=$2; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$SCRIPT_DIR/../../whitelabel.org/wikiproxy-data/pageviews-cache"
USER_AGENT="Wikilinker/1.0 (https://github.com/smagdali/wikilinker; stefan@whitelabel.org)"

# Determine target languages
if $ALL_LANGS; then
  # Read codes from i18n/languages.json
  TARGET_LANGS=($(node -p "require('$ROOT_DIR/i18n/languages.json').languages.map(l => l.code).join(' ')"))
else
  TARGET_LANGS=("$LANG_CODE")
fi

mkdir -p "$CACHE_DIR"
for lang in "${TARGET_LANGS[@]}"; do
  mkdir -p "$ROOT_DIR/i18n/$lang/.work"
done

echo "=== Pageview Ranking Builder ==="
if $ALL_LANGS; then
  echo "Mode: all-langs (${#TARGET_LANGS[@]} languages)"
  echo "Languages: ${TARGET_LANGS[*]}"
else
  echo "Mode: single-lang ($LANG_CODE)"
fi
echo "Days: $DAYS | Concurrency: $CONCURRENCY"

# Generate date list (yesterday back N days)
dates=()
for ((i=1; i<=DAYS; i++)); do
  if date -v-1d +%Y%m%d >/dev/null 2>&1; then
    dates+=("$(date -v-${i}d +%Y%m%d)")
  else
    dates+=("$(date -d "$i days ago" +%Y%m%d)")
  fi
done

echo "Date range: ${dates[$((DAYS-1))]} to ${dates[0]}"
echo ""

# === Phase 1: Download ===
echo "=== Phase 1: Downloading $DAYS files ==="

download_one() {
  local d=$1
  local y=${d:0:4}
  local ym="${y}-${d:4:2}"
  local url="https://dumps.wikimedia.org/other/pageview_complete/$y/$ym/pageviews-$d-user.bz2"
  local file="$CACHE_DIR/pageviews-$d-user.bz2"

  if [[ -f "$file" ]]; then
    echo "  [cached] $d"
    return 0
  fi

  echo "  [downloading] $d ..."
  if curl -sS -L -f --retry 5 --retry-delay 10 --retry-all-errors \
       --limit-rate 50M \
       --user-agent "$USER_AGENT" \
       -o "$file.tmp" "$url"; then
    mv "$file.tmp" "$file"
    echo "  [done] $d ($(du -h "$file" | cut -f1))"
  else
    rm -f "$file.tmp"
    echo "  [FAILED] $d" >&2
    return 1
  fi
}

export -f download_one
export CACHE_DIR USER_AGENT

# Download sequentially with a delay to avoid Wikimedia 503 rate-limiting.
for d in "${dates[@]}"; do
  download_one "$d" || true
  sleep 2
done

# Retry any missing files
missing_dates=()
for d in "${dates[@]}"; do
  if [[ ! -f "$CACHE_DIR/pageviews-$d-user.bz2" ]]; then
    missing_dates+=("$d")
  fi
done

if [[ ${#missing_dates[@]} -gt 0 ]]; then
  echo ""
  echo "  Retrying ${#missing_dates[@]} failed downloads (30s backoff)..."
  for d in "${missing_dates[@]}"; do
    sleep 30
    download_one "$d" || true
  done
fi

missing=0
for d in "${dates[@]}"; do
  if [[ ! -f "$CACHE_DIR/pageviews-$d-user.bz2" ]]; then
    echo "WARNING: Missing file for $d (skipping)" >&2
    missing=$((missing + 1))
  fi
done
if [[ $missing -gt 0 ]]; then
  echo "  $missing files still missing — proceeding with available data"
fi

echo ""

# === Phase 2: Extract per-language entries ===
echo "=== Phase 2: Extracting ==="

# Work file path helper
work_file() {
  local lang=$1
  local d=$2
  echo "$ROOT_DIR/i18n/$lang/.work/$d.tsv"
}

if $ALL_LANGS; then
  # Single-pass extraction: one bzcat per dump, awk splits to per-language files
  extract_all_one() {
    local d=$1
    local infile="$CACHE_DIR/pageviews-$d-user.bz2"

    if [[ ! -f "$infile" ]]; then
      return 0
    fi

    # Check if all per-lang outputs exist — skip if so
    local all_cached=true
    for lang in "${TARGET_LANGS[@]}"; do
      if [[ ! -f "$ROOT_DIR/i18n/$lang/.work/$d.tsv" ]]; then
        all_cached=false
        break
      fi
    done
    if $all_cached; then
      echo "  [cached] $d"
      return 0
    fi

    echo "  [processing] $d ..."
    # Pass languages to awk; writes one unsorted temp file per language per day
    local langs_csv
    langs_csv=$(IFS=,; echo "${TARGET_LANGS[*]}")
    bzcat "$infile" | awk \
      -v langs="$langs_csv" \
      -v root="$ROOT_DIR" \
      -v d="$d" '
      BEGIN {
        n = split(langs, a, ",")
        for (i = 1; i <= n; i++) {
          wanted[a[i] ".wikipedia"] = a[i]
        }
      }
      $1 in wanted {
        lang = wanted[$1]
        outfile = root "/i18n/" lang "/.work/" d ".tsv.tmp"
        print $2 "\t" $(NF-1) > outfile
      }
    '

    # Sort each per-lang temp file
    for lang in "${TARGET_LANGS[@]}"; do
      local tmpfile="$ROOT_DIR/i18n/$lang/.work/$d.tsv.tmp"
      local outfile="$ROOT_DIR/i18n/$lang/.work/$d.tsv"
      if [[ -f "$tmpfile" ]]; then
        sort -t$'\t' -k1,1 -o "$outfile" "$tmpfile"
        rm -f "$tmpfile"
      fi
    done

    echo "  [done] $d"
  }

  # Serial: awk writing to 20 files is CPU-bound on bzcat; parallelising
  # multiple bzcats hammers disk. Stick to CONCURRENCY=1 for all-langs.
  for d in "${dates[@]}"; do
    extract_all_one "$d"
  done
else
  # Per-language extraction (original behaviour)
  WIKI_PREFIX="$LANG_CODE.wikipedia"
  extract_one() {
    local d=$1
    local infile="$CACHE_DIR/pageviews-$d-user.bz2"
    local outfile="$ROOT_DIR/i18n/$LANG_CODE/.work/$d.tsv"

    if [[ ! -f "$infile" ]]; then
      return 0
    fi
    if [[ -f "$outfile" ]]; then
      echo "  [cached] $d"
      return 0
    fi

    echo "  [processing] $d ..."
    bzcat "$infile" \
      | awk -v prefix="$WIKI_PREFIX" '$1 == prefix { print $2 "\t" $(NF-1) }' \
      | sort -t$'\t' -k1,1 \
      > "$outfile.tmp"
    mv "$outfile.tmp" "$outfile"
    local count=$(wc -l < "$outfile" | tr -d ' ')
    echo "  [done] $d ($count lines)"
  }

  export -f extract_one
  export WIKI_PREFIX LANG_CODE ROOT_DIR

  printf '%s\n' "${dates[@]}" | xargs -P"$CONCURRENCY" -I{} bash -c 'extract_one "$@"' _ {}
fi

echo ""

# === Phase 3 & 4: Per-language merge, aggregate, decode ===
for lang in "${TARGET_LANGS[@]}"; do
  WORK_DIR="$ROOT_DIR/i18n/$lang/.work"
  OUTPUT="$ROOT_DIR/i18n/$lang/titles-ranked.tsv"

  echo "=== $lang: merge, aggregate, decode ==="

  # Per-day files that exist
  day_files=()
  for d in "${dates[@]}"; do
    if [[ -f "$WORK_DIR/$d.tsv" ]]; then
      day_files+=("$WORK_DIR/$d.tsv")
    fi
  done

  if [[ ${#day_files[@]} -eq 0 ]]; then
    echo "  No day files for $lang — skipping"
    continue
  fi

  echo "  Merging ${#day_files[@]} day files..."

  sort -t$'\t' -k1,1 -m "${day_files[@]}" \
    | awk -F'\t' '
      {
        if ($1 == prev) {
          sum += $2
        } else {
          if (prev != "") print prev "\t" sum
          prev = $1
          sum = $2
        }
      }
      END { if (prev != "") print prev "\t" sum }
    ' > "$WORK_DIR/aggregated.tsv"

  unique=$(wc -l < "$WORK_DIR/aggregated.tsv" | tr -d ' ')
  echo "  Unique titles: $unique"

  python3 -c "
import sys, urllib.parse

lines = []
for line in sys.stdin:
    parts = line.rstrip('\n').split('\t', 1)
    if len(parts) != 2:
        continue
    title = urllib.parse.unquote(parts[0].replace('_', ' '))
    try:
        count = int(parts[1])
    except ValueError:
        continue
    lines.append((title, count))

lines.sort(key=lambda x: -x[1])
for title, count in lines:
    sys.stdout.write(f'{title}\t{count}\n')
" < "$WORK_DIR/aggregated.tsv" > "$OUTPUT"

  total=$(wc -l < "$OUTPUT" | tr -d ' ')
  echo "  Wrote $OUTPUT ($total titles)"

  rm -rf "$WORK_DIR"
done

echo ""
echo "=== Done ==="
echo ""
if $ALL_LANGS; then
  echo "Run 'bash scripts/build-all-langs.sh' to rebuild all bloom filters."
else
  echo "Run 'node scripts/build-bloom.mjs --lang $LANG_CODE' next to rebuild the bloom filter."
fi
