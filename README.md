# Power Monitor Frontend

React + TypeScript + Vite frontend for a power monitoring dashboard (meters, alerts, power quality, and energy views). Uses mock data by default, with an option to point at a real backend API.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

## Configuration

Create a `.env` file (or copy `.env.example`) in the repo root.

- **`VITE_USE_MOCK`**: `true` (default) to use in-browser mock APIs, `false` to call your backend.
- **`VITE_API_BASE_URL`**: Base URL for your backend, e.g. `http://localhost:8080`. When unset, requests are sent to relative `/api/...` paths.

Example:

```bash
VITE_USE_MOCK=true
VITE_API_BASE_URL=
```

## Routes (current)

- **`/`**: Dashboard
- **`/meters`**: Meter list
- **`/meters/:meterId`**: Meter details
- **`/alerts`**: Alerts
- **`/settings`**: UI + API config hints

## Backend API contract (when `VITE_USE_MOCK=false`)

Requests are made via `fetch()` with `Accept: application/json` and expect JSON responses.

- **Meters**: `/api/meters`, `/api/meters/:meterId`, `/api/meters/:meterId/latest`, `/api/meters/:meterId/readings?minutes=60`
- **Alerts**: `/api/alerts`
- **Sites / feeders**: `/api/sites`, `/api/sites/:siteId`, `/api/feeders?siteId=...`
- **Power quality**: `/api/power-quality/events?meterId=...`, `/api/power-quality/harmonics/:meterId`, `/api/power-quality/waveforms?meterId=...`, `/api/power-quality/waveforms/:waveformId`
- **Incidents / SOE**: `/api/incidents`, `/api/soe`
- **Energy**: `/api/energy/intervals?hours=24`, `/api/energy/rates`, `/api/energy/load-profiles`, `/api/energy/load-profiles/:meterId`
- **Reports / KPIs**: `/api/reports/templates`, `/api/reports/templates/:templateId`, `/api/reports/schedules`, `/api/reports/schedules/:scheduleId/toggle`, `/api/reports/kpis`
- **Devices / safety**: `/api/devices`, `/api/devices/:deviceId`, `/api/breakers`, `/api/capacity`

## Scripts

```bash
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run preview  # preview the production build locally
npm run lint     # eslint
```

## Tech stack

- **UI**: React, Tailwind CSS, `lucide-react`
- **Routing**: `react-router-dom`
- **Data fetching**: `@tanstack/react-query`
- **State**: `zustand`
- **Charts**: `recharts`
- **Validation**: `zod`

## Domain reference: PME (Power Monitoring Expert) feature map

The UI in this repo is modeled after common PME/SCADA-style capabilities. This section is a living checklist for feature parity and roadmap discussions.

### 1. Real-time monitoring & visualization

- Live monitoring of electrical parameters (kW, kWh, voltage, current, power factor)
- Web-based multi-user dashboards
- Single-line diagrams with real-time status
- Trend graphs for load and energy usage

> Acts as the SCADA layer for power systems.

### 2. Power quality analysis

- Detect:
  - Voltage sags and swells
  - Harmonics
  - Transients
- Waveform capture and analysis
- Event correlation and disturbance tracking

> Useful for troubleshooting trips and equipment issues.

### 3. Alarms & event management

- Real-time alarms with prioritization
- Event grouping into incidents
- Alarm history and sequence-of-events analysis
- Notifications for abnormal conditions

> Enables faster response and minimizes downtime.

### 4. Energy management & cost analysis

- Energy dashboards per feeder, building, or process
- Cost allocation and billing support
- Load profiling (peak demand tracking)
- Identification of inefficiencies

> Focus on reducing energy costs.

### 5. Reporting & compliance

- Pre-configured and custom reports
- Supports ISO 50001 / 50002 / 50006
- Automated report scheduling
- KPI tracking and benchmarking

> Useful for audits and energy compliance.

### 6. Data logging & analytics

- High-resolution historical data logging
- Trend comparisons (daily, weekly, monthly, yearly)
- Advanced analytics for optimization
- Data aggregation from multiple devices

> Enables predictive insights and performance analysis.

### 7. System integration & connectivity

- Supports (typical):
  - Modbus RTU / TCP
  - OPC
  - SNMP
  - XML / FTP
- Integrates (typical):
  - Power meters
  - Circuit breakers
  - PLCs (e.g., S7-1500)
- Multi-vendor compatibility

> Fits well into existing industrial architectures.

### 8. Safety & reliability monitoring

- Monitoring of breaker status and protection settings
- Overload and fault detection
- Capacity tracking

> Helps prevent failures and improve safety.

### 9. Custom dashboards & UI

- Custom graphics (single-line diagrams, plant layouts)
- Role-based access control
- Web access (no full client installation required)

> Suitable for both operators and management.

### 10. Scalability & architecture

- Supports small to enterprise-level systems
- Distributed or standalone deployment
- Expandable across multiple sites

> Scales with system growth.

## Engineering insight: build vs buy

Given a setup with an S7-1500 PLC and connected power meters, PME typically provides:

- Data acquisition
- Visualization
- Analytics
- Reporting

Decision point:

- **PME**: fast deployment, robust features
- **Custom app**: flexible, tailored UI and workflows (at the cost of engineering time)

### Practical comparison (high level)

| Function       | PME rating |
|----------------|------------|
| Monitoring     | ⭐⭐⭐⭐⭐     |
| Power quality  | ⭐⭐⭐⭐⭐     |
| Reporting      | ⭐⭐⭐⭐      |
| Custom UI      | ⭐⭐⭐       |
| Cost           | $$$        |
| Flexibility    | Medium     |

### Next steps

- Compare PME vs a custom-built system for your requirements
- Draft architecture (e.g. **S7-1500 → PME → Web/Mobile**)
- Consider a hybrid approach (PME backend + custom frontend)
