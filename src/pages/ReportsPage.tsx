import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { useReportTemplates } from '../hooks/queries'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import type { ReportType } from '../types'

const typeBadgeColor: Record<ReportType, BadgeColor> = {
  energy: 'green',
  power_quality: 'indigo',
  compliance: 'yellow',
  custom: 'slate',
  demand: 'red',
  billing: 'slate',
}

function typeLabel(t: ReportType): string {
  return t.replace('_', ' ')
}

export function ReportsPage() {
  const { data: templates, isLoading } = useReportTemplates()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Reports
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Select a report template to generate a report.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/"
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 shadow-sm hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-100 dark:hover:bg-indigo-500/25"
          >
            Consumption
          </Link>
          <Link
            to="/reports/schedules"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Schedules
          </Link>
          <Link
            to="/reports/kpis"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            KPIs
          </Link>
        </div>
      </div>

      {/* Template grid */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
          Loading templates...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(templates ?? []).map((tpl) => (
            <div key={tpl.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15">
                  <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <Badge color={typeBadgeColor[tpl.type] ?? 'slate'}>
                  {typeLabel(tpl.type)}
                </Badge>
              </div>

              <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">
                {tpl.name}
              </div>
              <div className="mt-1 flex-1 text-xs text-slate-500 dark:text-slate-400">
                {tpl.description}
              </div>

              <Link
                to={`/reports/builder/${tpl.id}`}
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                Generate
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
