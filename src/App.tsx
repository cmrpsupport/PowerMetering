import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { DashboardScadaPage } from './pages/DashboardScadaPage'
import { DashboardDetailsPage } from './pages/DashboardDetailsPage'
import { MeterDetailPage } from './pages/MeterDetailPage'
import { AlertsPage } from './pages/AlertsPage'
import { ConsumptionReportPage } from './pages/ConsumptionReportPage'
import { LineDashboardPage } from './pages/LineDashboardPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { TopologyPage } from './pages/TopologyPage'
import { PowerQualityPage } from './pages/PowerQualityPage'
import { PowerQualityTrendsPage } from './pages/PowerQualityTrendsPage'
import { RealTimeDataPage } from './pages/RealTimeDataPage'
import { PvcTrendsPage } from './pages/PvcTrendsPage'
import { ProductionEfficiencyPage } from './pages/ProductionEfficiencyPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ConsumptionReportPage />} />
        <Route path="dashboard" element={<DashboardScadaPage />} />
        <Route path="dashboard/pvc" element={<PvcTrendsPage />} />
        <Route path="dashboard/details" element={<DashboardDetailsPage />} />
        <Route path="dashboard/legacy" element={<DashboardPage />} />
        <Route path="lines/:lineId" element={<LineDashboardPage />} />
        <Route path="meters/:meterId" element={<MeterDetailPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="topology" element={<TopologyPage />} />
        <Route path="power-quality" element={<PowerQualityTrendsPage />} />
        <Route path="power-quality/trends" element={<PowerQualityTrendsPage />} />
        <Route path="power-quality/events" element={<PowerQualityPage />} />
        <Route path="real-time-data" element={<RealTimeDataPage />} />
        <Route
          path="production-efficiency"
          element={
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <ProductionEfficiencyPage />
            </div>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
