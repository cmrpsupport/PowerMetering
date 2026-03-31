import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useReportTemplate } from '../hooks/queries'
import { Badge } from '../components/ui/Badge'
import { DateRangePicker } from '../components/ui/DateRangePicker'
import { MeterSelector } from '../components/ui/MeterSelector'
import { useSites } from '../hooks/queries'
import { generateReport } from '../api/powerApi'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function thirtyDaysAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function downloadBase64(filename: string, mimeType: string, contentBase64: string) {
  const a = document.createElement('a')
  a.href = `data:${mimeType};base64,${contentBase64}`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function ReportBuilderPage() {
  const { templateId = '' } = useParams()
  const tplQ = useReportTemplate(templateId)
  const tpl = tplQ.data

  const sitesQ = useSites()
  const sites = sitesQ.data ?? []

  const [output, setOutput] = useState<'csv' | 'pdf'>('pdf')
  const [siteId, setSiteId] = useState('')
  const [meterId, setMeterId] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [dateRanges, setDateRanges] = useState<Record<string, { from: string; to: string }>>({
    dateRange: { from: thirtyDaysAgoIso(), to: todayIso() },
    period: { from: thirtyDaysAgoIso(), to: todayIso() },
  })
  const [month, setMonth] = useState(() => todayIso().slice(0, 7)) // YYYY-MM

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paramsList = tpl?.parameters ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Report Builder
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Configure parameters and generate a report from a template.
        </div>
      </div>

      <div className="card p-4">
        {tpl ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {tpl.name}
                </div>
                <div className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  {tpl.description}
                </div>
              </div>
              <Badge color="slate">{tpl.type.replace('_', ' ')}</Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Parameters */}
              <div className="lg:col-span-2">
                  <div className="panel p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Parameters
                  </div>
                  <div className="mt-3 space-y-3">
                    {paramsList.length === 0 ? (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        No parameters for this template.
                      </div>
                    ) : (
                      paramsList.map((p) => {
                        if (p.key === 'month') {
                          return (
                            <div key={p.key} className="space-y-1">
                              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {p.label}
                              </label>
                              <input
                                type="month"
                                value={month}
                                onChange={(e) => setMonth(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                              />
                            </div>
                          )
                        }

                        if (p.inputType === 'date' && (p.key === 'dateRange' || p.key === 'period')) {
                          const dr = dateRanges[p.key] ?? { from: thirtyDaysAgoIso(), to: todayIso() }
                          return (
                            <div key={p.key}>
                              <div className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                {p.label}
                              </div>
                              <DateRangePicker
                                from={dr.from}
                                to={dr.to}
                                onChange={(from, to) =>
                                  setDateRanges((prev) => ({ ...prev, [p.key]: { from, to } }))
                                }
                              />
                            </div>
                          )
                        }

                        if (p.inputType === 'select' && p.key === 'site') {
                          return (
                            <div key={p.key} className="flex flex-wrap items-center gap-2">
                              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {p.label}
                              </label>
                              <select
                                value={siteId}
                                onChange={(e) => setSiteId(e.target.value)}
                                disabled={sitesQ.isLoading}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                              >
                                <option value="">All sites</option>
                                {sites.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        }

                        if (p.inputType === 'select' && (p.key === 'meter' || p.key === 'meters')) {
                          return (
                            <div key={p.key} className="flex flex-wrap items-center gap-2">
                              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {p.label}
                              </label>
                              <MeterSelector value={meterId} onChange={setMeterId} includeAll />
                            </div>
                          )
                        }

                        // Generic text input (also used as a fallback for select until options are defined)
                        return (
                          <div key={p.key} className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {p.label}
                            </label>
                            <input
                              value={values[p.key] ?? ''}
                              onChange={(e) =>
                                setValues((prev) => ({ ...prev, [p.key]: e.target.value }))
                              }
                              placeholder={p.inputType === 'select' ? 'Enter value…' : undefined}
                              className="nr-input w-full"
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Output + generate */}
              <div className="lg:col-span-1">
                <div className="panel p-4">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Output
                  </div>
                  <div className="mt-3 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Format
                      </label>
                      <select
                        value={output}
                        onChange={(e) => setOutput(e.target.value as 'csv' | 'pdf')}
                        className="nr-input w-full"
                      >
                        <option value="csv">CSV</option>
                        <option value="pdf">PDF</option>
                      </select>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setError(null)

                        // Minimal validation for known date inputs
                        for (const p of paramsList) {
                          if (p.key === 'month' && !month) return setError('Please select a month.')
                          if (p.inputType === 'date' && (p.key === 'dateRange' || p.key === 'period')) {
                            const dr = dateRanges[p.key]
                            if (!dr?.from || !dr?.to) return setError(`Please select ${p.label}.`)
                          }
                        }

                        const params: Record<string, unknown> = { ...values }
                        if (paramsList.some((p) => p.key === 'month')) params.month = month
                        if (paramsList.some((p) => p.key === 'site')) params.siteId = siteId || null
                        if (paramsList.some((p) => p.key === 'meter' || p.key === 'meters')) {
                          params.meterId = meterId || null
                        }
                        if (paramsList.some((p) => p.key === 'dateRange')) params.dateRange = dateRanges.dateRange
                        if (paramsList.some((p) => p.key === 'period')) params.period = dateRanges.period

                        setBusy(true)
                        try {
                          const res = await generateReport({
                            templateId: tpl.id,
                            params,
                            output,
                          })
                          downloadBase64(res.filename, res.mimeType, res.contentBase64)
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Failed to generate report.')
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="nr-btn-primary w-full disabled:opacity-50"
                    >
                      {busy ? 'Generating…' : 'Generate'}
                    </button>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Mock mode downloads a CSV/PDF. Backend mode posts to <span className="font-mono">/api/reports/generate</span>.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {tplQ.isLoading ? 'Loading template...' : 'Template not found.'}
          </div>
        )}
      </div>
    </div>
  )
}

