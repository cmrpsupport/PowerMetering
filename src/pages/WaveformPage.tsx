import { useState } from 'react'
import { Radio } from 'lucide-react'
import { useWaveforms, useWaveform } from '../hooks/queries'
import { MeterSelector } from '../components/ui/MeterSelector'
import { Badge } from '../components/ui/Badge'
import WaveformChart from '../components/charts/WaveformChart'

export function WaveformPage() {
  const [meterId, setMeterId] = useState('')

  const waveformsQ = useWaveforms(meterId || undefined)
  const captures = waveformsQ.data ?? []

  const [selectedId, setSelectedId] = useState('')
  const waveformQ = useWaveform(selectedId)
  const waveform = waveformQ.data

  // Phase visibility toggles
  const [showA, setShowA] = useState(true)
  const [showB, setShowB] = useState(true)
  const [showC, setShowC] = useState(true)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Waveform Captures
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Captured waveforms triggered by power quality events.
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <MeterSelector value={meterId} onChange={setMeterId} includeAll />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Capture list */}
        <div className="card overflow-hidden lg:col-span-1">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Captures ({captures.length})
            </div>
          </div>
          <div className="max-h-[32rem] overflow-y-auto">
            {captures.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                {waveformsQ.isLoading ? 'Loading\u2026' : 'No waveform captures'}
              </div>
            )}
            {captures.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 dark:border-slate-800/50 ${
                  selectedId === c.id
                    ? 'bg-indigo-50 dark:bg-indigo-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-50">
                    {c.triggerEvent}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {new Date(c.ts).toLocaleString()}
                </div>
                <div className="mt-1 flex gap-2">
                  <Badge color="slate">{c.cycles} cycles</Badge>
                  <Badge color="slate">{c.samplesPerCycle} samp/cyc</Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Waveform viewer */}
        <div className="card p-4 lg:col-span-2">
          {waveform ? (
            <>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {waveform.triggerEvent}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(waveform.ts).toLocaleString()} &middot; {waveform.cycles} cycles &middot; {waveform.samplesPerCycle} samples/cycle
                  </div>
                </div>

                {/* Phase toggles */}
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showA}
                      onChange={(e) => setShowA(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-rose-500 focus:ring-rose-500"
                    />
                    Phase A
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showB}
                      onChange={(e) => setShowB(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    Phase B
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={showC}
                      onChange={(e) => setShowC(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                    />
                    Phase C
                  </label>
                </div>
              </div>

              <WaveformChart
                phaseA={waveform.phaseA}
                phaseB={waveform.phaseB}
                phaseC={waveform.phaseC}
                samplesPerCycle={waveform.samplesPerCycle}
                cycles={waveform.cycles}
                showPhases={{ a: showA, b: showB, c: showC }}
              />
            </>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              {selectedId && waveformQ.isLoading
                ? 'Loading waveform\u2026'
                : 'Select a capture to view its waveform'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
