import { create } from 'zustand'
import type { UserRole } from '../types'

type ToastType = 'success' | 'error' | 'info'
type Toast = { id: string; type: ToastType; message: string }

type CollapsedGroups = Record<string, boolean>

export type ThemeMode = 'system' | 'light' | 'dark'

type UiState = {
  // Theme
  themeMode: ThemeMode
  setThemeMode: (m: ThemeMode) => void
  toggleTheme: () => void

  // Sidebar collapse
  sidebarCollapsed: CollapsedGroups
  toggleSidebarGroup: (group: string) => void

  // Toasts
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void

  // Slide-over
  slideOverOpen: boolean
  slideOverContent: { type: string; id: string } | null
  openSlideOver: (type: string, id: string) => void
  closeSlideOver: () => void

  // Role
  role: UserRole
  setRole: (role: UserRole) => void
}

function readThemeMode(): ThemeMode {
  const stored = localStorage.getItem('pm_themeMode')
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function readCollapsedGroups(): CollapsedGroups {
  try {
    const stored = localStorage.getItem('pm_sidebarCollapsed')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function readRole(): UserRole {
  const stored = localStorage.getItem('pm_role')
  if (stored === 'operator' || stored === 'engineer' || stored === 'manager' || stored === 'admin') return stored
  return 'engineer'
}

let toastId = 0

export const useUiStore = create<UiState>((set, get) => ({
  themeMode: typeof window === 'undefined' ? 'system' : readThemeMode(),
  setThemeMode: (m) => {
    localStorage.setItem('pm_themeMode', m)
    set({ themeMode: m })
  },
  toggleTheme: () => {
    const current = get().themeMode
    // If user was on system, pick the opposite of current system preference.
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
    const resolved = current === 'system' ? (prefersDark ? 'dark' : 'light') : current
    const next: ThemeMode = resolved === 'dark' ? 'light' : 'dark'
    localStorage.setItem('pm_themeMode', next)
    set({ themeMode: next })
  },

  sidebarCollapsed: typeof window === 'undefined' ? {} : readCollapsedGroups(),
  toggleSidebarGroup: (group) => {
    const current = get().sidebarCollapsed
    const next = { ...current, [group]: !current[group] }
    localStorage.setItem('pm_sidebarCollapsed', JSON.stringify(next))
    set({ sidebarCollapsed: next })
  },

  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++toastId}`
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  slideOverOpen: false,
  slideOverContent: null,
  openSlideOver: (type, id) => set({ slideOverOpen: true, slideOverContent: { type, id } }),
  closeSlideOver: () => set({ slideOverOpen: false, slideOverContent: null }),

  role: typeof window === 'undefined' ? 'engineer' : readRole(),
  setRole: (role) => {
    localStorage.setItem('pm_role', role)
    set({ role })
  },
}))
