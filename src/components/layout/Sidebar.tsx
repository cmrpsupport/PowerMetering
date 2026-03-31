import { NavLink } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  Cable,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Database,
  FileBarChart,
  FileText,
  Gauge,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MapPin,
  Monitor,
  Network,
  Settings,
  Target,
  TrendingUp,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean }

type NavGroup = {
  key: string
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    key: 'monitoring',
    label: 'Monitoring',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/single-line', label: 'Single-Line', icon: Network },
      { to: '/meters', label: 'Meters', icon: Gauge },
    ],
  },
  {
    key: 'power-quality',
    label: 'Power Quality',
    items: [
      { to: '/power-quality', label: 'PQ Analysis', icon: Activity, end: true },
      { to: '/power-quality/harmonics', label: 'Harmonics', icon: BarChart3 },
      { to: '/power-quality/waveforms', label: 'Waveforms', icon: LineChart },
      { to: '/power-quality/events', label: 'Events', icon: Zap },
    ],
  },
  {
    key: 'alarms',
    label: 'Alarms',
    items: [
      { to: '/alerts', label: 'Active Alarms', icon: BellRing },
      { to: '/alarms/incidents', label: 'Incidents', icon: AlertTriangle },
      { to: '/alarms/soe', label: 'SOE Log', icon: Clock },
    ],
  },
  {
    key: 'energy',
    label: 'Energy',
    items: [
      { to: '/energy', label: 'Energy Dashboard', icon: Zap, end: true },
      { to: '/energy/plc-totals', label: 'PLC Total Energy', icon: Cpu },
      { to: '/energy/load-profiles', label: 'Load Profiles', icon: TrendingUp },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Templates', icon: FileText, end: true },
      { to: '/reports/schedules', label: 'Schedules', icon: ListChecks },
      { to: '/reports/kpis', label: 'KPIs', icon: Target },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    items: [
      { to: '/analytics/data-browser', label: 'Data Browser', icon: Database },
      { to: '/analytics/trends', label: 'Trends', icon: FileBarChart },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      { to: '/system/devices', label: 'Devices', icon: Cpu },
      { to: '/system/sites', label: 'Sites', icon: MapPin },
      { to: '/system/capacity', label: 'Capacity', icon: Cable },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleGroup = useUiStore((s) => s.toggleSidebarGroup)

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-[var(--border)] bg-[var(--bg)] md:flex">
      {/* Brand header */}
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--card)] text-[var(--text)] shadow">
            <Monitor size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text)]">
              Power Monitoring System
            </div>
            <div className="truncate text-[11px] text-[var(--muted)]">
              Monitoring Dashboard
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {navGroups.map((group) => {
            const isCollapsed = collapsed[group.key] ?? false

            return (
              <div key={group.key}>
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="flex w-full items-center justify-between rounded-[10px] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--text)]"
                >
                  <span>{group.label}</span>
                  {isCollapsed ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </button>

                {/* Group items */}
                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.end}
                          className={({ isActive }) =>
                            [
                              'flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm transition',
                              isActive
                                ? 'bg-[var(--card)] text-[var(--text)] ring-1 ring-inset ring-[var(--border)]'
                                : 'text-[var(--muted)] hover:bg-[var(--card)] hover:text-[var(--text)]',
                            ].join(' ')
                          }
                        >
                          <Icon size={16} />
                          <span className="truncate">{item.label}</span>
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Footer tip */}
      <div className="mt-auto border-t border-[var(--border)] p-3">
        <div className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text)] shadow">
          Tip: open a meter and watch <span className="font-semibold">live</span> readings update.
        </div>
      </div>
    </aside>
  )
}
