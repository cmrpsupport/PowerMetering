import { useCallback, useEffect, useRef, useState } from 'react'

/** Reload after 8 hours regardless (nightly reset for kiosk displays). */
const MAX_AGE_MS = 8 * 60 * 60 * 1000

/** Reload when Chrome reports JS heap > 350 MB. */
const HEAP_LIMIT_BYTES = 350 * 1024 * 1024

/** How long before reload to show the warning banner. */
const WARN_BEFORE_MS = 60_000

/** How often to check memory / age. */
const CHECK_INTERVAL_MS = 60_000

type ChromePerf = Performance & {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number }
}

function getHeapBytes(): number | null {
  const mem = (performance as ChromePerf).memory
  return mem ? mem.usedJSHeapSize : null
}

export interface MemoryGuardInfo {
  /** Seconds until auto-reload, or null if no reload is pending. */
  reloadIn: number | null
  /** Human-readable reason for the upcoming reload. */
  reason: string
  /** Cancel the pending reload (keeps the tab alive until next trigger). */
  cancel: () => void
}

/**
 * Monitors JS heap size and page age. When either threshold is exceeded the
 * hook gives the user a 60-second warning then reloads the page.
 *
 * Mount once in App.tsx.
 */
export function useMemoryGuard(): MemoryGuardInfo {
  const [reloadIn, setReloadIn] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  // Use refs so the interval callback always sees current values.
  const reloadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelledRef = useRef(false)
  const startedAtRef = useRef(Date.now())

  const cancel = useCallback(() => {
    cancelledRef.current = true
    setReloadIn(null)
    if (reloadTimerRef.current) {
      clearInterval(reloadTimerRef.current)
      reloadTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    function scheduleReload(why: string) {
      // Already counting down.
      if (reloadTimerRef.current !== null) return

      cancelledRef.current = false
      setReason(why)

      const totalSecs = Math.round(WARN_BEFORE_MS / 1000)
      setReloadIn(totalSecs)

      let remaining = totalSecs
      reloadTimerRef.current = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          clearInterval(reloadTimerRef.current!)
          reloadTimerRef.current = null
          if (!cancelledRef.current) {
            window.location.reload()
          }
          setReloadIn(null)
        } else {
          setReloadIn(remaining)
        }
      }, 1_000)
    }

    const checker = setInterval(() => {
      // Don't schedule another reload if one is already pending.
      if (reloadTimerRef.current !== null) return

      const ageMs = Date.now() - startedAtRef.current
      if (ageMs >= MAX_AGE_MS) {
        scheduleReload('8-hour scheduled refresh')
        return
      }

      const heap = getHeapBytes()
      if (heap !== null && heap > HEAP_LIMIT_BYTES) {
        const mb = Math.round(heap / (1024 * 1024))
        scheduleReload(`high memory usage (${mb} MB)`)
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      clearInterval(checker)
      if (reloadTimerRef.current) clearInterval(reloadTimerRef.current)
    }
  }, [])

  return { reloadIn, reason, cancel }
}
