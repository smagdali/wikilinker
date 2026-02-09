#!/bin/bash
# Send daily wikilinker match digest via email.
# Intended to run via cron at 9am:
#   0 9 * * * /opt/wikilinker/scripts/send-log-email.sh

LOG="/var/cache/wikilinker/logs/matches.tsv"
RECIPIENT="stefan@whitelabel.org"
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

if [ ! -f "$LOG" ]; then
  exit 0
fi

# Extract yesterday's entries
MATCHES=$(grep "^${YESTERDAY}" "$LOG")

if [ -z "$MATCHES" ]; then
  exit 0
fi

COUNT=$(echo "$MATCHES" | wc -l)

# Format as aligned columns: context | match | wiki URL | proxy URL
BODY=$(echo "$MATCHES" | awk -F'\t' '{printf "%-50s %-25s %s\n%s\n\n", $2, $3, $4, $5}')

echo -e "Wikilinker matches for ${YESTERDAY} (${COUNT} total)\n\n${BODY}" | \
  mail -s "Wikilinker matches — ${YESTERDAY} (${COUNT})" "$RECIPIENT"
