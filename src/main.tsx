import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Disable refetch-on-focus globally: kiosk screen-wake events would otherwise
// trigger mass simultaneous re-fetches of every stale query on the page.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
})

// Apply theme before first render to avoid flash.
const stored = localStorage.getItem('pm_themeMode')
const themeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
const resolved = themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode
document.documentElement.dataset.theme = resolved

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
