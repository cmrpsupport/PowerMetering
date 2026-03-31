// Re-exporting shim — all mock logic now lives in src/api/mocks/
export {
  mockListMeters,
  mockGetMeter,
  mockGetLatestReading,
  mockGetReadings,
} from './mocks/mockMeters'

export { mockListLegacyAlerts as mockListAlerts } from './mocks/mockAlarms'
