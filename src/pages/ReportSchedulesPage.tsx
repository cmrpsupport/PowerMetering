import { useReportSchedules } from '../hooks/queries'
import { useToggleSchedule } from '../hooks/mutations'
import { Badge } from '../components/ui/Badge'

export function ReportSchedulesPage() {
  const schedulesQ = useReportSchedules()
  const toggle = useToggleSchedule()

  const schedules = schedulesQ.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Report Schedules
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Automated report generation schedules.
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Frequency</th>
                <th className="px-4 py-3">Next run</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {s.templateName}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {s.frequency}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {s.nextRun ? new Date(s.nextRun).toLocaleString() : '--'}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {(s.recipients ?? []).join(', ') || '--'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={s.enabled ? 'green' : 'slate'}>
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(s.id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {s.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}

              {schedules.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    {schedulesQ.isLoading ? 'Loading schedules...' : 'No schedules configured.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

