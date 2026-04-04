#!/usr/bin/env sh
# One-time migration if plc_samples predates Total_ChooeyChocoLine_kWh.
# Default DB path matches Node-RED sqlitedb config (plc-energy-v2.sqlite).
# Usage: ./backend/scripts/sqlite-add-chooey-column.sh [path/to/plc-energy-v2.sqlite]

set -eu
DB="${1:-${NODE_RED_HOME:-$HOME/.node-red}/plc-energy-v2.sqlite}"
if [ ! -f "$DB" ]; then
  echo "Database not found: $DB" >&2
  echo "Pass the path to plc-energy-v2.sqlite as the first argument." >&2
  exit 1
fi

sqlite3 "$DB" "ALTER TABLE plc_samples ADD COLUMN Total_ChooeyChocoLine_kWh REAL;" && echo "Added column Total_ChooeyChocoLine_kWh."
echo "If you see 'duplicate column name', the column already exists — that is OK."
