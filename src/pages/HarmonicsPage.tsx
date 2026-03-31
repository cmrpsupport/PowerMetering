import { useMemo, useState } from 'react'
import { useMeters, useHarmonics } from '../hooks/queries'
import { MeterSelector } from '../components/ui/MeterSelector'
import { Badge } from '../components/ui/Badge'
import HarmonicBarChart from '../components/charts/HarmonicBarChart'
import GaugeChart from '../components/charts/GaugeChart'

export function HarmonicsPage() {
  const metersQ = useMeters()
  const meters = metersQ.data ?? []
  const [meterId, setMeterId] = useState('')
  const activeMeterId = meterId || meters[0]?.id || ''

  const harmonicsQ = useHarmonics(activeMeterId)
  const snapshot = harmonicsQ.data

  const harmonics = useMemo(
    () =>
      (snapshot?.harmonics ?? [])
        .filter((h) => h.order >= 1 && h.order <= 25)
        .sort((a, b) => a.order - b.order),
    [snapshot],
  )

  const thdPercent = snapshot?.thdPercent ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Harmonics Analysis
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Harmonic distortion spectrum and IEEE 519 compliance.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <MeterSelector value={activeMeterId} onChange={setMeterId} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Harmonic bar chart (spans 2 cols) */}
        <div className="card p-4 lg:col-span-2">
          <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
            Harmonic Spectrum (Orders 1\u201325)
          </div>
          {harmonics.length > 0 ? (
            <HarmonicBarChart harmonics={harmonics} />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              {harmonicsQ.isLoading ? 'Loading\u2026' : 'No harmonic data'}
            </div>
          )}
        </div>

        {/* THD Gauge */}
        <div className="card flex flex-col items-center justify-center p-4">
          <div className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-50">
            Total Harmonic Distortion
          </div>
          <GaugeChart
            value={thdPercent}
            max={15}
            label="THD"
            unit="%"
            thresholds={{ warning: 5, critical: 8 }}
          />
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            IEEE 519 limit: 5% (warning) / 8% (critical)
          </div>
        </div>
      </div>

      {/* IEEE 519 compliance table */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            IEEE 519 Compliance
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Magnitude (%)</th>
                <th className="px-4 py-2">Limit (%)</th>
                <th className="px-4 py-2">Margin</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {harmonics.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                    No data
                  </td>
                </tr>
              )}
              {harmonics.map((h) => {
                const pass = h.magnitudePercent <= h.limitPercent
                const margin = h.limitPercent - h.magnitudePercent
                return (
                  <tr
                    key={h.order}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/50"
                  >
                    <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                      H{h.order}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      {h.magnitudePercent.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                      {h.limitPercent.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">
                      {margin >= 0 ? `+${margin.toFixed(2)}` : margin.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge color={pass ? 'green' : 'red'}>
                        {pass ? 'Pass' : 'Fail'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
