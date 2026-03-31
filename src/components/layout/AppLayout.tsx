import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useUiStore } from '../../store/uiStore'
import { ToastContainer } from '../ui/Toast'
import { SlideOver } from '../ui/SlideOver'

export function AppLayout() {
  const themeMode = useUiStore((s) => s.themeMode)
  const slideOverOpen = useUiStore((s) => s.slideOverOpen)
  const slideOverContent = useUiStore((s) => s.slideOverContent)
  const closeSlideOver = useUiStore((s) => s.closeSlideOver)

  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    const resolved =
      themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode
    root.dataset.theme = resolved
  }, [themeMode])

  return (
    <div className="min-h-screen w-full bg-[var(--bg)]">
      <div className="flex min-h-screen w-full flex-col">
        <Topbar />

        <div className="flex min-h-0 w-full flex-1">
          <Sidebar />
          <main className="min-w-0 flex-1 px-3 py-3 md:px-4 md:py-4">
            <div className="w-full min-w-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer />

      {/* Slide-over panel */}
      <SlideOver
        open={slideOverOpen}
        onClose={closeSlideOver}
        title={slideOverContent?.type ?? 'Details'}
      >
        {slideOverContent ? (
          <div className="text-sm text-slate-200">
            <p>
              Viewing <span className="font-medium">{slideOverContent.type}</span>:{' '}
              <span className="font-mono text-xs">{slideOverContent.id}</span>
            </p>
          </div>
        ) : null}
      </SlideOver>
    </div>
  )
}
