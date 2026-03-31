import { useState } from 'react'
import { useSites } from '../hooks/queries'
import SingleLineDiagram from '../components/diagrams/SingleLineDiagram'

export function SingleLinePage() {
  const sitesQ = useSites()
  const sites = sitesQ.data ?? []
  const [selectedSiteId, setSelectedSiteId] = useState('')

  // Default to first site once loaded
  const activeSiteId = selectedSiteId || sites[0]?.id || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Single-Line Diagram
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Electrical one-line overview of the selected site.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Site
          </label>
          <select
            value={activeSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            disabled={sitesQ.isLoading}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Diagram */}
      <div className="card p-4">
        {activeSiteId ? (
          <SingleLineDiagram siteId={activeSiteId} />
        ) : (
          <div className="flex h-64 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            {sitesQ.isLoading ? 'Loading sites\u2026' : 'No sites available'}
          </div>
        )}
      </div>
    </div>
  )
}
