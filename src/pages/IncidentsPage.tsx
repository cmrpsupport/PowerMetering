import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useIncidents, useEnhancedAlerts } from '../hooks/queries'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import type { IncidentGroup, EnhancedAlert } from '../types'

function incidentStatusColor(s: IncidentGroup['status']): BadgeColor {
  if (s === 'open') return 'red'
  if (s === 'investigating') return 'yellow'
  return 'green'
}

function sevColor(sev: string): BadgeColor {
  if (sev === 'critical') return 'red'
  if (sev === 'warning') return 'yellow'
  return 'slate'
}

function fmtTime(ts: string | null) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString()
}

export function IncidentsPage() {
  const incidentsQ = useIncidents()
  const alertsQ = useEnhancedAlerts()

  const incidents = useMemo(() => incidentsQ.data ?? [], [incidentsQ.data])
  const alertMap = useMemo(() => {
    const map = new Map<string, EnhancedAlert>()
    for (const a of alertsQ.data ?? []) {
      map.set(a.id, a)
    }
    return map
  }, [alertsQ.data])

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Incidents
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Correlated alert groups and root cause investigations.
        </div>
      </div>

      {incidents.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No incidents recorded.
        </div>
      )}

      <div className="space-y-3">
        {incidents.map((inc) => {
          const expanded = expandedIds.has(inc.id)
          const childAlerts = inc.alertIds
            .map((id) => alertMap.get(id))
            .filter(Boolean) as EnhancedAlert[]

          return (
            <div key={inc.id} className="card overflow-hidden">
              {/* Header */}
              <button
                type="button"
                onClick={() => toggleExpand(inc.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40"
              >
                {expanded ? (
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-slate-400"
                  />
                ) : (
                  <ChevronRight
                    size={16}
                    className="shrink-0 text-slate-400"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {inc.title}
                    </span>
                    <Badge color={incidentStatusColor(inc.status)}>
                      {inc.status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Created {fmtTime(inc.createdAt)}
                    {inc.resolvedAt ? ` \u2022 Resolved ${fmtTime(inc.resolvedAt)}` : ''}
                    {' \u2022 '}
                    {inc.alertIds.length} alert{inc.alertIds.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </button>

              {/* Expandable content */}
              {expanded && (
                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                  {/* Summary */}
                  <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">
                    {inc.summary}
                  </p>

                  {/* Child alerts */}
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Related Alerts
                  </h4>
                  {childAlerts.length > 0 ? (
                    <div className="space-y-2">
                      {childAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <Badge color={sevColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-50">
                              {alert.message}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {alert.meterName} &middot; {fmtTime(alert.ts)}
                            </div>
                          </div>
                          <Badge
                            color={
                              alert.status === 'active'
                                ? 'red'
                                : alert.status === 'acknowledged'
                                  ? 'yellow'
                                  : 'green'
                            }
                          >
                            {alert.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Alert details not available.
                    </p>
                  )}

                  {/* Event timeline */}
                  <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Event Timeline
                  </h4>
                  <div className="relative ml-2 space-y-2 border-l-2 border-slate-300 pl-4 dark:border-slate-600">
                    <div className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                      <div className="text-sm text-slate-700 dark:text-slate-200">
                        Incident created
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {fmtTime(inc.createdAt)}
                      </div>
                    </div>
                    {childAlerts.map((alert) => (
                      <div key={alert.id} className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <div className="text-sm text-slate-700 dark:text-slate-200">
                          Alert: {alert.message}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {fmtTime(alert.ts)}
                        </div>
                      </div>
                    ))}
                    {inc.resolvedAt && (
                      <div className="relative">
                        <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-green-500" />
                        <div className="text-sm text-slate-700 dark:text-slate-200">
                          Incident resolved
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {fmtTime(inc.resolvedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
