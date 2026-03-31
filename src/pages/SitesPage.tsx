import { useSites } from '../hooks/queries'
export function SitesPage() {
  const sitesQ = useSites()
  const sites = sitesQ.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Sites
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Multi-site overview for scalable deployments.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sites.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {s.name}
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {s.id} · {s.meterIds.length} meter{s.meterIds.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <div className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              {s.address}
            </div>
          </div>
        ))}

        {sites.length === 0 && (
          <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-3">
            {sitesQ.isLoading ? 'Loading sites...' : 'No sites available.'}
          </div>
        )}
      </div>
    </div>
  )
}

