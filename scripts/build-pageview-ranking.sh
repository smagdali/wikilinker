#!/bin/bash
#
# Build pageview ranking from N days of Wikimedia pageview_complete dumps.
#
# Usage: bash scripts/build-pageview-ranking.sh [--days 30] [--concurrency 4]
#
# Downloads daily pageview dumps, extracts en.wikipedia entries,
# aggregates counts across all days, and writes titles-ranked.tsv.
#
# Dependencies: curl, bzcat, awk, sort, python3
#
set -euo pipefail

# Defaults
DAYS=30
CONCURRENCY=4

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --days) DAYS=$2; shift 2 ;;
    --concurrency) CONCURRENCY=$2; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CACHE_DIR="$SCRIPT_DIR/../../whitelabel.org/wikiproxy-data/pageviews-cache"
OUTPUT="$SCRIPT_DIR/../../whitelabel.org/wikiproxy-data/titles-ranked.tsv"
WORK_DIR="$CACHE_DIR/work"
USER_AGENT="Wikilinker/1.0 (https://github.com/smagdali/wikilinker; stefan@whitelabel.org)"

mkdir -p "$CACHE_DIR" "$WORK_DIR"

echo "=== Pageview Ranking Builder ==="
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
# Concurrency flag only applies to the extract phase now.
for d in "${dates[@]}"; do
  download_one "$d" || true
  sleep 2
done

# Retry any missing files (one more pass with longer backoff)
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

# Final check
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

# === Phase 2: Extract en.wikipedia entries (one sorted file per day) ===
echo "=== Phase 2: Extracting en.wikipedia entries ==="

extract_one() {
  local d=$1
  local infile="$CACHE_DIR/pageviews-$d-user.bz2"
  local outfile="$WORK_DIR/$d.tsv"

  if [[ ! -f "$infile" ]]; then
    return 0
  fi

  if [[ -f "$outfile" ]]; then
    echo "  [cached] $d"
    return 0
  fi

  echo "  [processing] $d ..."
  bzcat "$infile" \
    | awk '$1 == "en.wikipedia" { print $2 "\t" $(NF-1) }' \
    | sort -t$'\t' -k1,1 \
    > "$outfile.tmp"
  mv "$outfile.tmp" "$outfile"
  local count=$(wc -l < "$outfile" | tr -d ' ')
  echo "  [done] $d ($count lines)"
}

export -f extract_one
export WORK_DIR

printf '%s\n' "${dates[@]}" | xargs -P"$CONCURRENCY" -I{} bash -c 'extract_one "$@"' _ {}

echo ""

# === Phase 3: Merge and aggregate ===
echo "=== Phase 3: Merging and aggregating ==="

# Build list of per-day files (only those that exist)
day_files=()
for d in "${dates[@]}"; do
  if [[ -f "$WORK_DIR/$d.tsv" ]]; then
    day_files+=("$WORK_DIR/$d.tsv")
  fi
done

echo "  Merging ${#day_files[@]} day files..."

# Merge pre-sorted files and sum counts per title
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

echo ""

# === Phase 4: Decode titles and sort by count ===
echo "=== Phase 4: Decoding titles and sorting by count ==="

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

echo ""
echo "=== Done ==="
echo "Output: $OUTPUT"
echo "Total titles: $total"
echo ""
echo "Top 10:"
head -10 "$OUTPUT"
echo ""

# Stats at key marks
for mark in 100000 500000 1000000; do
  if [[ $total -ge $mark ]]; then
    line=$(sed -n "${mark}p" "$OUTPUT")
    echo "  #$mark: $line"
  fi
done

# Cleanup work dir
echo ""
echo "Cleaning up work directory..."
rm -rf "$WORK_DIR"

echo "Done! Run 'node scripts/build-bloom.mjs' next to rebuild the bloom filter."
