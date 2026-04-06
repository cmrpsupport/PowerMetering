import { RefreshCw, X } from 'lucide-react'
import type { MemoryGuardInfo } from '../../hooks/useMemoryGuard'

interface Props {
  guard: MemoryGuardInfo
}

export function MemoryReloadBanner({ guard }: Props) {
  if (guard.reloadIn === null) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[200] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 shadow-lg dark:border-amber-500/40 dark:bg-amber-500/15">
      <RefreshCw size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="text-sm text-amber-800 dark:text-amber-200">
        Auto-refresh in <strong>{guard.reloadIn}s</strong>
        <span className="ml-1 opacity-70">— {guard.reason}</span>
      </span>
      <button
        type="button"
        onClick={guard.cancel}
        title="Cancel auto-refresh"
        className="ml-1 shrink-0 rounded p-0.5 text-amber-700 opacity-60 hover:opacity-100 dark:text-amber-300"
      >
        <X size={14} />
      </button>
    </div>
  )
}
