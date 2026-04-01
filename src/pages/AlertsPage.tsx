import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle,
  MessageSquarePlus,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { useEnhancedAlerts } from '../hooks/queries'
import {
  useAcknowledgeAlert,
  useResolveAlert,
  useAddAlertNote,
} from '../hooks/mutations'
import { Badge, type BadgeColor } from '../components/ui/Badge'
import { FilterBar } from '../components/ui/FilterBar'
import { SlideOver } from '../components/ui/SlideOver'
import type { EnhancedAlert } from '../types'
import { PLC_PRODUCTION_METERS } from '../constants/plcProductionMeters'
import { findPlcMeter } from '../constants/plcMeters'

function sevColor(sev: string): BadgeColor {
  if (sev === 'critical') return 'red'
  if (sev === 'warning') return 'yellow'
  return 'slate'
}

function priorityColor(p: string): BadgeColor {
  if (p === 'urgent') return 'red'
  if (p === 'high') return 'yellow'
  if (p === 'medium') return 'indigo'
  return 'slate'
}

function statusColor(s: string): BadgeColor {
  if (s === 'active') return 'red'
  if (s === 'acknowledged') return 'yellow'
  return 'green'
}

function fmtTime(ts: string | null) {
  if (!ts) return '--'
  return new Date(ts).toLocaleString()
}

function productionLineForMeterId(meterId: string): string | null {
  if (!meterId || meterId === 'plant') return null
  const hit = PLC_PRODUCTION_METERS.find((l) => Array.isArray(l.meterIds) && l.meterIds.includes(meterId))
  return hit?.name ?? null
}

export function AlertsPage() {
  const alertsQ = useEnhancedAlerts()
  const ackMut = useAcknowledgeAlert()
  const resolveMut = useResolveAlert()
  const noteMut = useAddAlertNote()

  const [severity, setSeverity] = useState('all')
  const [priority, setPriority] = useState('all')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')

  const [selected, setSelected] = useState<EnhancedAlert | null>(null)
  const [noteText, setNoteText] = useState('')

  const allAlerts = useMemo(() => alertsQ.data ?? [], [alertsQ.data])

  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (severity !== 'all' && a.severity !== severity) return false
      if (priority !== 'all' && a.priority !== priority) return false
      if (category !== 'all' && a.category !== category) return false
      if (status !== 'all' && a.status !== status) return false
      return true
    })
  }, [allAlerts, severity, priority, category, status])

  const activeCounts = useMemo(() => {
    const active = allAlerts.filter((a) => a.status === 'active')
    return {
      urgent: active.filter((a) => a.priority === 'urgent').length,
      high: active.filter((a) => a.priority === 'high').length,
      medium: active.filter((a) => a.priority === 'medium').length,
      low: active.filter((a) => a.priority === 'low').length,
    }
  }, [allAlerts])

  function handleFilterChange(key: string, value: string) {
    if (key === 'severity') setSeverity(value)
    if (key === 'priority') setPriority(value)
    if (key === 'category') setCategory(value)
    if (key === 'status') setStatus(value)
  }

  function handleAddNote() {
    if (!selected || !noteText.trim()) return
    noteMut.mutate(
      { alertId: selected.id, note: noteText.trim() },
      { onSuccess: () => setNoteText('') },
    )
  }

  // Keep selected alert in sync with latest data
  const selectedAlert = useMemo(() => {
    if (!selected) return null
    return allAlerts.find((a) => a.id === selected.id) ?? selected
  }, [allAlerts, selected])

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Alerts
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Enhanced alerts with priority, categories, and workflow actions.
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={[
          {
            key: 'severity',
            label: 'Severity',
            value: severity,
            options: [
              { value: 'all', label: 'All' },
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'critical', label: 'Critical' },
            ],
          },
          {
            key: 'priority',
            label: 'Priority',
            value: priority,
            options: [
              { value: 'all', label: 'All' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ],
          },
          {
            key: 'category',
            label: 'Category',
            value: category,
            options: [
              { value: 'all', label: 'All' },
              { value: 'power_quality', label: 'Power Quality' },
              { value: 'protection', label: 'Protection' },
              { value: 'communication', label: 'Communication' },
              { value: 'energy', label: 'Energy' },
              { value: 'system', label: 'System' },
            ],
          },
          {
            key: 'status',
            label: 'Status',
            value: status,
            options: [
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'acknowledged', label: 'Acknowledged' },
              { value: 'resolved', label: 'Resolved' },
            ],
          },
        ]}
        onChange={handleFilterChange}
      />

      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Active alerts:
        </span>
        <Badge color="red">Urgent {activeCounts.urgent}</Badge>
        <Badge color="yellow">High {activeCounts.high}</Badge>
        <Badge color="indigo">Medium {activeCounts.medium}</Badge>
        <Badge color="slate">Low {activeCounts.low}</Badge>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Meter</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]"
                  onClick={() => setSelected(a)}
                >
                  <td className="px-4 py-3">
                    <Badge color={priorityColor(a.priority)}>{a.priority}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={sevColor(a.severity)}>{a.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">
                      {a.meterName}
                    </div>
                    {(() => {
                      const line = productionLineForMeterId(a.meterId)
                      const loc = findPlcMeter(a.meterId)?.location ?? null
                      if (!line && !loc) return null
                      return (
                        <div className="mt-0.5 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {line ? (
                            <div className="truncate">
                              <span className="text-slate-400 dark:text-slate-500">Line:</span> {line}
                            </div>
                          ) : null}
                          {loc ? (
                            <div className="truncate">
                              <span className="text-slate-400 dark:text-slate-500">Location:</span> {loc}
                            </div>
                          ) : null}
                        </div>
                      )
                    })()}
                    <Link
                      className="text-xs text-indigo-600 hover:underline dark:text-indigo-300"
                      to={`/meters/${encodeURIComponent(a.meterId)}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.meterId}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-700 dark:text-slate-200">
                    {a.message}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {a.category.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor(a.status)}>{a.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700 dark:text-slate-200">
                    {fmtTime(a.ts)}
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.status === 'active' && (
                        <button
                          type="button"
                          title="Acknowledge"
                          onClick={() =>
                            ackMut.mutate({ alertId: a.id, by: 'operator' })
                          }
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                        >
                          <ShieldCheck size={16} />
                        </button>
                      )}
                      {(a.status === 'active' || a.status === 'acknowledged') && (
                        <button
                          type="button"
                          title="Resolve"
                          onClick={() => resolveMut.mutate(a.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-green-600 dark:hover:bg-slate-800 dark:hover:text-green-300"
                        >
                          <CheckCircle size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        title="Add Note"
                        onClick={() => {
                          setSelected(a)
                          setNoteText('')
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800 dark:hover:text-amber-300"
                      >
                        <MessageSquarePlus size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500 dark:text-slate-400"
                  >
                    No alerts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SlideOver detail panel */}
      <SlideOver
        open={!!selectedAlert}
        onClose={() => setSelected(null)}
        title="Alert Detail"
      >
        {selectedAlert && (
          <div className="space-y-5">
            {/* Header badges */}
            <div className="flex flex-wrap gap-2">
              <Badge color={priorityColor(selectedAlert.priority)}>
                {selectedAlert.priority}
              </Badge>
              <Badge color={sevColor(selectedAlert.severity)}>
                {selectedAlert.severity}
              </Badge>
              <Badge color={statusColor(selectedAlert.status)}>
                {selectedAlert.status}
              </Badge>
            </div>

            {/* Message */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {selectedAlert.message}
              </h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {selectedAlert.detail}
              </p>
            </div>

            {/* Info */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Meter</span>
                <span className="text-slate-900 dark:text-slate-50">
                  {selectedAlert.meterName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Category
                </span>
                <span className="text-slate-900 dark:text-slate-50">
                  {selectedAlert.category.replace('_', ' ')}
                </span>
              </div>
              {selectedAlert.incidentId && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Incident
                  </span>
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-300">
                    {selectedAlert.incidentId}
                  </span>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Timeline
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-slate-700 dark:text-slate-200">
                    Created {fmtTime(selectedAlert.ts)}
                  </span>
                </div>
                {selectedAlert.acknowledgedAt && (
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-yellow-500" />
                    <span className="text-slate-700 dark:text-slate-200">
                      Acknowledged {fmtTime(selectedAlert.acknowledgedAt)}
                      {selectedAlert.acknowledgedBy
                        ? ` by ${selectedAlert.acknowledgedBy}`
                        : ''}
                    </span>
                  </div>
                )}
                {selectedAlert.resolvedAt && (
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-500" />
                    <span className="text-slate-700 dark:text-slate-200">
                      Resolved {fmtTime(selectedAlert.resolvedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {selectedAlert.status !== 'resolved' && (
              <div className="flex gap-2">
                {selectedAlert.status === 'active' && (
                  <button
                    type="button"
                    onClick={() =>
                      ackMut.mutate({
                        alertId: selectedAlert.id,
                        by: 'operator',
                      })
                    }
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => resolveMut.mutate(selectedAlert.id)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Resolve
                </button>
              </div>
            )}

            {/* Notes */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Notes ({selectedAlert.notes.length})
              </h4>
              {selectedAlert.notes.length > 0 ? (
                <ul className="space-y-2">
                  {selectedAlert.notes.map((n, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {n}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No notes yet.
                </p>
              )}

              {/* Add note form */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNote()
                  }}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || noteMut.isPending}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  )
}
