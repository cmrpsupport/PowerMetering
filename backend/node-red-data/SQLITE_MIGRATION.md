# SQLite: `Total_ChooeyChocoLine_kWh` column

## Error: `SQLITE_ERROR: no such column: Total_ChooeyChocoLine_kWh`

`plc_samples` was created before this column existed. `CREATE TABLE IF NOT EXISTS` does **not** alter existing tables.

### Automatic fix (recommended)

Redeploy Node-RED flows from this repo. On startup, the **SQLite init** inject runs:

1. Create schema (batch)
2. **Pragma check** for `Total_ChooeyChocoLine_kWh`
3. **`ALTER TABLE ... ADD COLUMN`** only if the column is missing

### Manual fix

If you cannot redeploy yet, run once (adjust path to your `plc-energy-v2.sqlite`):

```sh
chmod +x backend/scripts/sqlite-add-chooey-column.sh
./backend/scripts/sqlite-add-chooey-column.sh /path/to/plc-energy-v2.sqlite
```

Or:

```sh
sqlite3 "$HOME/.node-red/plc-energy-v2.sqlite" \
  "ALTER TABLE plc_samples ADD COLUMN Total_ChooeyChocoLine_kWh REAL;"
```

---

## Error: `connect ENETUNREACH 192.168.x.x:102`

The S7 PLC at that IP is not reachable from the machine running Node-RED (wrong subnet, cable, PLC off, or firewall). Fix the network or **S7 endpoint** IP in Node-RED; this is unrelated to SQLite.
