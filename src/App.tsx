import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { MeterDetailPage } from './pages/MeterDetailPage'
import { AlertsPage } from './pages/AlertsPage'
import { ConsumptionReportPage } from './pages/ConsumptionReportPage'
import { LineDashboardPage } from './pages/LineDashboardPage'
import { NotFoundPage } from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ConsumptionReportPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="lines/:lineId" element={<LineDashboardPage />} />
        <Route path="meters/:meterId" element={<MeterDetailPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
