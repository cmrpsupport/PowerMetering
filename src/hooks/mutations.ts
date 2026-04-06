import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acknowledgeAlert, resolveAlert, addAlertNote, triggerDatabaseBackup } from '../api/powerApi'
import { useUiStore } from '../store/uiStore'

export function useAcknowledgeAlert() {
  const qc = useQueryClient()
  const addToast = useUiStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ alertId, by }: { alertId: string; by: string }) => acknowledgeAlert(alertId, by),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enhancedAlerts'] })
      addToast('success', 'Alert acknowledged')
    },
    onError: () => addToast('error', 'Failed to acknowledge alert'),
  })
}

export function useResolveAlert() {
  const qc = useQueryClient()
  const addToast = useUiStore((s) => s.addToast)
  return useMutation({
    mutationFn: (alertId: string) => resolveAlert(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enhancedAlerts'] })
      addToast('success', 'Alert resolved')
    },
    onError: () => addToast('error', 'Failed to resolve alert'),
  })
}

export function useAddAlertNote() {
  const qc = useQueryClient()
  const addToast = useUiStore((s) => s.addToast)
  return useMutation({
    mutationFn: ({ alertId, note }: { alertId: string; note: string }) => addAlertNote(alertId, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enhancedAlerts'] })
      addToast('success', 'Note added')
    },
    onError: () => addToast('error', 'Failed to add note'),
  })
}

export function useDatabaseBackup() {
  const addToast = useUiStore((s) => s.addToast)
  return useMutation({
    mutationFn: () => triggerDatabaseBackup(),
    onSuccess: (r) => {
      if (r?.ok) addToast('success', `Backup complete${r.path ? `: ${r.path}` : ''}`)
      else addToast('error', r?.error ? `Backup failed: ${r.error}` : 'Backup failed')
    },
    onError: () => addToast('error', 'Backup failed'),
  })
}
