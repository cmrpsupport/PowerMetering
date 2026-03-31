import { useQuery } from '@tanstack/react-query'
import {
  getLatestReading,
  getMeter,
  getReadings,
  listAlerts,
  listMeters,
  listSites,
  getSite,
  listFeeders,
  listVoltageEvents,
  getHarmonics,
  listWaveforms,
  getWaveform,
  listEnhancedAlerts,
  getEnhancedAlert,
  listIncidents,
  listSOE,
  getEnergyIntervals,
  getCostRates,
  getLoadProfile,
  getAllLoadProfiles,
  listReportTemplates,
  getReportTemplate,
  listReportSchedules,
  listKpis,
  listDevices,
  getDevice,
  listBreakers,
  getCapacityThresholds,
  getPlcEnergyTotals,
  getPlcEnergyConsumptionSnapshot,
} from '../api/powerApi'

// ── Meters ──

export function useMeters() {
  return useQuery({
    queryKey: ['meters'],
    queryFn: listMeters,
    refetchInterval: 10_000,
  })
}

export function useMeter(meterId: string) {
  return useQuery({
    queryKey: ['meter', meterId],
    queryFn: () => getMeter(meterId),
    enabled: !!meterId,
    refetchInterval: 20_000,
  })
}

export function useLatestReading(meterId: string) {
  return useQuery({
    queryKey: ['latestReading', meterId],
    queryFn: () => getLatestReading(meterId),
    enabled: !!meterId,
    refetchInterval: 2_000,
  })
}

export function useReadings(meterId: string, minutes: number) {
  return useQuery({
    queryKey: ['readings', meterId, minutes],
    queryFn: () => getReadings(meterId, minutes),
    enabled: !!meterId,
    refetchInterval: 10_000,
  })
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: listAlerts,
    refetchInterval: 10_000,
  })
}

// ── Sites & Feeders ──

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: listSites,
    refetchInterval: 30_000,
  })
}

export function useSite(siteId: string) {
  return useQuery({
    queryKey: ['site', siteId],
    queryFn: () => getSite(siteId),
    enabled: !!siteId,
  })
}

export function useFeeders(siteId?: string) {
  return useQuery({
    queryKey: ['feeders', siteId ?? 'all'],
    queryFn: () => listFeeders(siteId),
    refetchInterval: 15_000,
  })
}

// ── Power Quality ──

export function useVoltageEvents(meterId?: string) {
  return useQuery({
    queryKey: ['voltageEvents', meterId ?? 'all'],
    queryFn: () => listVoltageEvents(meterId),
    refetchInterval: 30_000,
  })
}

export function useHarmonics(meterId: string) {
  return useQuery({
    queryKey: ['harmonics', meterId],
    queryFn: () => getHarmonics(meterId),
    enabled: !!meterId,
    refetchInterval: 10_000,
  })
}

export function useWaveforms(meterId?: string) {
  return useQuery({
    queryKey: ['waveforms', meterId ?? 'all'],
    queryFn: () => listWaveforms(meterId),
    refetchInterval: 30_000,
  })
}

export function useWaveform(waveformId: string) {
  return useQuery({
    queryKey: ['waveform', waveformId],
    queryFn: () => getWaveform(waveformId),
    enabled: !!waveformId,
  })
}

// ── Enhanced Alarms ──

export function useEnhancedAlerts() {
  return useQuery({
    queryKey: ['enhancedAlerts'],
    queryFn: listEnhancedAlerts,
    refetchInterval: 5_000,
  })
}

export function useEnhancedAlert(alertId: string) {
  return useQuery({
    queryKey: ['enhancedAlert', alertId],
    queryFn: () => getEnhancedAlert(alertId),
    enabled: !!alertId,
  })
}

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: listIncidents,
    refetchInterval: 10_000,
  })
}

export function useSOE() {
  return useQuery({
    queryKey: ['soe'],
    queryFn: listSOE,
    refetchInterval: 5_000,
  })
}

// ── Energy ──

export function useEnergyIntervals(hours = 24) {
  return useQuery({
    queryKey: ['energyIntervals', hours],
    queryFn: () => getEnergyIntervals(hours),
    refetchInterval: 60_000,
  })
}

export function usePlcEnergyTotals() {
  return useQuery({
    queryKey: ['plcEnergyTotals'],
    queryFn: getPlcEnergyTotals,
    refetchInterval: 10_000,
  })
}

export function usePlcEnergyConsumptionSnapshot() {
  return useQuery({
    queryKey: ['plcEnergyConsumptionSnapshot'],
    queryFn: getPlcEnergyConsumptionSnapshot,
    refetchInterval: 5_000,
  })
}

export function useCostRates() {
  return useQuery({
    queryKey: ['costRates'],
    queryFn: getCostRates,
  })
}

export function useLoadProfile(meterId: string) {
  return useQuery({
    queryKey: ['loadProfile', meterId],
    queryFn: () => getLoadProfile(meterId),
    enabled: !!meterId,
    refetchInterval: 60_000,
  })
}

export function useAllLoadProfiles() {
  return useQuery({
    queryKey: ['allLoadProfiles'],
    queryFn: getAllLoadProfiles,
    refetchInterval: 60_000,
  })
}

// ── Reports ──

export function useReportTemplates() {
  return useQuery({
    queryKey: ['reportTemplates'],
    queryFn: listReportTemplates,
  })
}

export function useReportTemplate(templateId: string) {
  return useQuery({
    queryKey: ['reportTemplate', templateId],
    queryFn: () => getReportTemplate(templateId),
    enabled: !!templateId,
  })
}

export function useReportSchedules() {
  return useQuery({
    queryKey: ['reportSchedules'],
    queryFn: listReportSchedules,
    refetchInterval: 30_000,
  })
}

export function useKpis() {
  return useQuery({
    queryKey: ['kpis'],
    queryFn: listKpis,
    refetchInterval: 30_000,
  })
}

// ── Devices ──

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: listDevices,
    refetchInterval: 10_000,
  })
}

export function useDevice(deviceId: string) {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => getDevice(deviceId),
    enabled: !!deviceId,
  })
}

// ── Safety ──

export function useBreakers() {
  return useQuery({
    queryKey: ['breakers'],
    queryFn: listBreakers,
    refetchInterval: 5_000,
  })
}

export function useCapacityThresholds() {
  return useQuery({
    queryKey: ['capacityThresholds'],
    queryFn: getCapacityThresholds,
    refetchInterval: 10_000,
  })
}
