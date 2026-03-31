# Power monitor backend (Node-RED + Siemens S7)

This folder runs **Node-RED** with **`node-red-contrib-s7`**, which speaks the **S7 / ISO-on-TCP** protocol (TCP port **102**) to a Siemens **S7-1500** CPU over Ethernet.

### Profinet vs what this stack uses

**PROFINET** is the industrial Ethernet system on your plant network (devices, IO, topology). **Node-RED does not replace a PROFINET controller**; it typically connects to the PLC as an **S7 client** (PG/HMI style) on the same Ethernet subnet as the CPU.

Application access to the S7-1500 is therefore **S7comm over ISO-on-TCP**, not raw PROFINET cyclic IO. If you need pure PROFINET device integration without the PLC, that is a different toolchain (e.g. specialized gateways or vendor stacks).

### Prerequisites (TIA Portal / PLC)

For S7-1200/1500, the contrib README and Siemens practice require:

1. **Data blocks** used from Node-RED must **not** use *optimized block access* (use “standard” / non-optimized DBs for byte-addressable access), or map data accordingly.
2. CPU **Protection** → enable **Permit access with PUT/GET communication from remote partner** (wording varies by TIA version).
3. Set the CPU’s **Ethernet** interface to an IP reachable from the machine running Node-RED (same VLAN/subnet or routed).
4. **Rack / slot**: often `0 / 1` for a standalone S7-1500 CPU; confirm in TIA (device overview / CPU properties).

### Install and run

```bash
cd backend
npm install
npm start
```

- **Node-RED editor**: [http://127.0.0.1:1880](http://127.0.0.1:1880)  
- Optional: `PORT=1880` is the default; set `PORT` in the environment to change the port (`settings.js` reads `process.env.PORT`).

### HTTP API (for the React app)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Liveness JSON: `{ ok, service, ts }` |
| `GET` | `/api/plc/snapshot` | Last read from the PLC: `{ ts, values }` where `values` is an object of named tags from the S7 Endpoint |

`values` is `null` until the first successful read. If there is no PLC, you will see a `warning` field in the JSON.

CORS is enabled for browser calls from the Vite dev server (`httpNodeCors` in `node-red-data/settings.js`).

### Editing tags and PLC IP

1. Open the editor → flow **“S7-1500 → HTTP API”**.
2. Double-click **“S7-1500 (edit IP)”** (S7 Endpoint): set **PLC IP**, **rack**, **slot**, **cycle time**.
3. Under **Variables**, align **addresses** with your TIA DB (example uses `DB100,REAL0` … — change DB number and offsets to match your program).
4. **Deploy** (red button).

The **Function** node “Cache for HTTP” stores each successful `s7 in` payload in global context for the HTTP routes.

### Connecting the Vite frontend

In the frontend `.env` (or `.env.local`):

```bash
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:1880
```

You will need small API client changes (or a BFF) if the React app expects paths like `/api/meters` instead of `/api/plc/snapshot` — wire your queries to these endpoints or add a proxy flow in Node-RED.

### Files

| Path | Purpose |
|------|---------|
| `package.json` | `node-red`, `node-red-contrib-s7` |
| `node-red-data/settings.js` | Port, CORS, stable `flowFile` |
| `node-red-data/flows.json` | Committed starter flow (S7 read + HTTP API) |

After you use the editor, Node-RED may create extra files under `node-red-data/` (e.g. credentials). Add a `credentialSecret` in `settings.js` for repeatable credential encryption if you deploy to production.
