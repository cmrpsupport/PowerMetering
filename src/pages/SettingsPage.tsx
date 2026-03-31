import { useUiStore } from '../store/uiStore'

export function SettingsPage() {
  const themeMode = useUiStore((s) => s.themeMode)
  const setThemeMode = useUiStore((s) => s.setThemeMode)

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-[var(--text)]">Settings</div>
        <div className="text-sm text-[var(--muted)]">
          Configure the frontend (API + UI preferences).
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-[var(--text)]">Theme</div>
            <div className="text-xs text-[var(--muted)]">Saved locally in this browser.</div>
          </div>
          <select
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value as 'system' | 'light' | 'dark')}
            className="nr-input px-2.5 py-1.5"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="card p-4">
        <div className="text-sm font-medium text-[var(--text)]">API configuration</div>
        <div className="mt-2 text-sm text-[var(--text)]">
          This build uses mock data by default.
        </div>
        <div className="mt-2 text-xs text-[var(--muted)]">
          Set <span className="kbd">VITE_USE_MOCK=false</span> and <span className="kbd">VITE_API_BASE_URL</span> in a <span className="kbd">.env</span> file to connect to your backend.
        </div>
      </div>
    </div>
  )
}

