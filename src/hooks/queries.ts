import { useQuery } from '@tanstack/react-query'
import type { ConsumptionGranularity } from '../types'
import { CONSUMPTION_REPORT_HOURS } from '../lib/consumptionReport'
import {
  getPlcFullSnapshot,
  getNodeRedHealth,
  listEnhancedAlerts,
  getEnergyIntervals,
  getPlantLoadProfile,
  getPowerTrend,
  getVoltageEvents,
  getMeterHistory,
  getDemandStatus,
  type DemandTrendRange,
} from '../api/powerApi'
import { PLC_SITE_NAME } from '../constants/plcProductionMeters'
import { PLC_METERS } from '../constants/plcMeters'

type PowerMeterStatus = 'online' | 'offline' | 'warning'

export type PowerMeter = {
  id: string
  name: string
  site: string
  status: PowerMeterStatus
  lastSeenAt: string
}

export type MeterReading = {
  meterId: string
  ts: string
  powerKw: number
  energyKwh: number
  voltageV: number
  currentA: number
  pf: number
}

/** Full DB16 snapshot — all 25 meters, 20 params each. Polls every 3s. */
export function usePlcFullSnapshot() {
  return useQuery({
    queryKey: ['plcFullSnapshot'],
    queryFn: getPlcFullSnapshot,
    refetchInterval: 3_000,
  })
}

export function useNodeRedHealth() {
  return useQuery({
    queryKey: ['nodeRedHealth'],
    queryFn: getNodeRedHealth,
    refetchInterval: 5_000,
  })
}

export function useEnhancedAlerts() {
  return useQuery({
    queryKey: ['enhancedAlerts'],
    queryFn: listEnhancedAlerts,
    refetchInterval: 5_000,
  })
}

export function useEnergyIntervals(hours = 24) {
  return useQuery({
    queryKey: ['energyIntervals', hours],
    queryFn: () => getEnergyIntervals(hours),
    refetchInterval: 60_000,
  })
}

export function usePlantLoadProfile(
  hours = 24,
  opts?: { bucket?: '1m' | '5m' | '15m' | '1h'; bucketSec?: number },
) {
  return useQuery({
    queryKey: ['plantLoadProfile', hours, opts?.bucket ?? null, opts?.bucketSec ?? null],
    queryFn: () => getPlantLoadProfile(hours, opts),
    refetchInterval: 60_000,
  })
}

export function useConsumptionReportIntervals(granularity: ConsumptionGranularity) {
  const hours = CONSUMPTION_REPORT_HOURS[granularity]
  return useQuery({
    queryKey: ['energyIntervals', 'consumption', granularity, hours],
    queryFn: () => getEnergyIntervals(hours),
    staleTime: 60_000,
  })
}

export function usePowerTrend(
  minutes = 24 * 60,
  opts?: { bucket?: '1m' | '5m' | '15m' | '1h' | '1d'; bucketSec?: number },
) {
  return useQuery({
    queryKey: ['powerTrend', minutes, opts?.bucket ?? null, opts?.bucketSec ?? null],
    queryFn: () => getPowerTrend(minutes, opts),
    refetchInterval: 60_000,
  })
}

/** Real-time 15-min rolling demand + stored trend (SQLite). Polls every 5s. */
export function useDemandStatus(range: DemandTrendRange = 'all') {
  return useQuery({
    queryKey: ['demandStatus', range],
    queryFn: () => getDemandStatus(range),
    refetchInterval: 5_000,
  })
}

/** Per-meter, per-phase historical data. Optionally filter by meterId. */
export function useMeterHistory(minutes = 24 * 60, meterId?: string) {
  return useQuery({
    queryKey: ['meterHistory', minutes, meterId],
    queryFn: () => getMeterHistory(minutes, meterId),
    refetchInterval: 60_000,
  })
}

// ── UI helper hooks (safe defaults; backend can replace later) ──

/** List meters for selectors and browse pages. */
export function useMeters() {
  return useQuery({
    queryKey: ['meters'],
    queryFn: async (): Promise<PowerMeter[]> => {
      const now = new Date().toISOString()
      return PLC_METERS.map((m) => ({
        id: m.id,
        name: m.name,
        site: PLC_SITE_NAME,
        status: 'online' as const,
        lastSeenAt: now,
      }))
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

export function useMeter(meterId: string) {
  return useQuery({
    queryKey: ['meter', meterId],
    queryFn: async () => {
      if (!meterId) return null
      const m = PLC_METERS.find((x) => x.id === meterId)
      if (!m) return null
      return {
        id: m.id,
        name: m.name,
        site: PLC_SITE_NAME,
        status: 'online' as const,
        lastSeenAt: new Date().toISOString(),
      } satisfies PowerMeter
    },
    enabled: Boolean(meterId),
    staleTime: 30_000,
  })
}

export function useLatestReading(meterId: string) {
  return useQuery({
    queryKey: ['latestReading', meterId],
    queryFn: async () => null,
    enabled: Boolean(meterId),
    refetchInterval: 5_000,
  })
}

export function useReadings(meterId: string, minutes = 60) {
  return useQuery({
    queryKey: ['readings', meterId, minutes],
    queryFn: async () => [],
    enabled: Boolean(meterId),
    refetchInterval: 30_000,
  })
}

export function useVoltageEvents(meterId?: string) {
  return useQuery({
    queryKey: ['voltageEvents', meterId ?? 'all'],
    queryFn: () => getVoltageEvents(meterId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useHarmonics(meterId: string) {
  return useQuery({
    queryKey: ['harmonics', meterId],
    queryFn: async () => null,
    enabled: Boolean(meterId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useWaveforms(meterId?: string) {
  return useQuery({
    queryKey: ['waveforms', meterId ?? 'all'],
    queryFn: async () => [],
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

export function useWaveform(waveformId: string) {
  return useQuery({
    queryKey: ['waveform', waveformId],
    queryFn: async () => null,
    enabled: Boolean(waveformId),
    staleTime: 30_000,
  })
}

export function useSites() {
  return useQuery({
    queryKey: ['sites'],
    queryFn: async () => [],
    staleTime: 60_000,
  })
}

export function useFeeders(siteId?: string) {
  return useQuery({
    queryKey: ['feeders', siteId ?? 'all'],
    queryFn: async () => [],
    staleTime: 60_000,
  })
}

export function useBreakers() {
  return useQuery({
    queryKey: ['breakers'],
    queryFn: async () => [],
    staleTime: 60_000,
  })
}
