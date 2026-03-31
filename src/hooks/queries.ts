import { useQuery } from '@tanstack/react-query'
import type { ConsumptionGranularity } from '../types'
import { CONSUMPTION_REPORT_HOURS } from '../lib/consumptionReport'
import {
  getPlcFullSnapshot,
  getNodeRedHealth,
  listEnhancedAlerts,
  getEnergyIntervals,
  getPowerTrend,
  getMeterHistory,
  getDemandStatus,
} from '../api/powerApi'

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

export function useConsumptionReportIntervals(granularity: ConsumptionGranularity) {
  const hours = CONSUMPTION_REPORT_HOURS[granularity]
  return useQuery({
    queryKey: ['energyIntervals', 'consumption', granularity, hours],
    queryFn: () => getEnergyIntervals(hours),
    staleTime: 60_000,
  })
}

export function usePowerTrend(minutes = 24 * 60) {
  return useQuery({
    queryKey: ['powerTrend', minutes],
    queryFn: () => getPowerTrend(minutes),
    refetchInterval: 60_000,
  })
}

/** Real-time 15-min rolling demand tracking. Polls every 5s for responsiveness. */
export function useDemandStatus() {
  return useQuery({
    queryKey: ['demandStatus'],
    queryFn: getDemandStatus,
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
