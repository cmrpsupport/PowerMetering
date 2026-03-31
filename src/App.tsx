import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { AlertsPage } from './pages/AlertsPage'
import { DashboardPage } from './pages/DashboardPage'
import { SingleLinePage } from './pages/SingleLinePage'
import { MeterDetailPage } from './pages/MeterDetailPage'
import { MetersPage } from './pages/MetersPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'
import { PowerQualityPage } from './pages/PowerQualityPage'
import { HarmonicsPage } from './pages/HarmonicsPage'
import { WaveformPage } from './pages/WaveformPage'
import { EventsPage } from './pages/EventsPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { SOEPage } from './pages/SOEPage'
import { EnergyDashboardPage } from './pages/EnergyDashboardPage'
import { PlcTotalEnergyPage } from './pages/PlcTotalEnergyPage'
import { LoadProfilePage } from './pages/LoadProfilePage'
import { ReportsPage } from './pages/ReportsPage'
import { ReportSchedulesPage } from './pages/ReportSchedulesPage'
import { KpisPage } from './pages/KpisPage'
import { ReportBuilderPage } from './pages/ReportBuilderPage'
import { DevicesPage } from './pages/DevicesPage'
import { SitesPage } from './pages/SitesPage'
import { CapacityPage } from './pages/CapacityPage'
import { DataBrowserPage } from './pages/DataBrowserPage'
import { TrendsPage } from './pages/TrendsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="single-line" element={<SingleLinePage />} />

        <Route path="meters" element={<MetersPage />} />
        <Route path="meters/:meterId" element={<MeterDetailPage />} />

        <Route path="alerts" element={<AlertsPage />} />
        <Route path="alarms/incidents" element={<IncidentsPage />} />
        <Route path="alarms/soe" element={<SOEPage />} />

        <Route path="power-quality" element={<PowerQualityPage />} />
        <Route path="power-quality/harmonics" element={<HarmonicsPage />} />
        <Route path="power-quality/waveforms" element={<WaveformPage />} />
        <Route path="power-quality/events" element={<EventsPage />} />

        <Route path="energy" element={<EnergyDashboardPage />} />
        <Route path="energy/plc-totals" element={<PlcTotalEnergyPage />} />
        <Route path="energy/load-profiles" element={<LoadProfilePage />} />

        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/schedules" element={<ReportSchedulesPage />} />
        <Route path="reports/kpis" element={<KpisPage />} />
        <Route path="reports/builder/:templateId" element={<ReportBuilderPage />} />

        <Route path="analytics/data-browser" element={<DataBrowserPage />} />
        <Route path="analytics/trends" element={<TrendsPage />} />

        <Route path="system/devices" element={<DevicesPage />} />
        <Route path="system/sites" element={<SitesPage />} />
        <Route path="system/capacity" element={<CapacityPage />} />

        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
