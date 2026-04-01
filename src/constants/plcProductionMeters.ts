/**
 * Production lines exposed on DB16 via Node-RED S7 (Cracker Line 1 → Utilities Lighting).
 * Aligns mock data, meter lists, energy intervals, and PLC snapshot mapping.
 */
export const PLC_SITE_NAME = 'PLC (DB16)'

export type PlcProductionMeterDef = {
  id: string
  name: string
  /** S7 / Node-RED variable name for cumulative energy (REAL). */
  totalKey: string
  /** Underlying powermeter IDs that roll up into this line (optional). */
  meterIds?: string[]
  /** Synthetic demand scale for mock intervals (kW). */
  baseKw: number
}

export const PLC_PRODUCTION_METERS: PlcProductionMeterDef[] = [
  {
    id: 'plc-line-01',
    name: 'Cracker Line 1',
    totalKey: 'Total_CrackerLine1_kWh',
    meterIds: ['RIO2CM1_EMU4_1', 'RIO2CM1_EMU4_3', 'RIO2CM1_EMU4_4'],
    baseKw: 520,
  },
  {
    id: 'plc-line-02',
    name: 'Cracker Line 2',
    totalKey: 'Total_CrackerLine2_kWh',
    meterIds: ['RIO2CM1_EMU4_2', 'RIO2CM1_EMU4_5'],
    baseKw: 480,
  },
  {
    id: 'plc-line-03',
    name: 'Pretzel Line',
    totalKey: 'Total_PretzelLine_kWh',
    meterIds: ['RIO2CM1_EMU4_8'],
    baseKw: 310,
  },
  {
    id: 'plc-line-04',
    name: 'Wafer Line 1',
    totalKey: 'Total_WaferLine1_kWh',
    meterIds: ['RIO2CM1_EMU4_7', 'RIO2CM1_EMU4_9'],
    baseKw: 290,
  },
  {
    id: 'plc-line-05',
    name: 'Wafer Line 2',
    totalKey: 'Total_WaferLine2_kWh',
    meterIds: ['RIO2CM1_EMU4_12'],
    baseKw: 275,
  },
  {
    id: 'plc-line-06',
    name: 'Choco Choco Line',
    totalKey: 'Total_ChocoyChocoLine_kWh',
    meterIds: ['RIO2CM1_EMU4_6', 'RIO2CM1_EMU4_11'],
    baseKw: 340,
  },
  {
    id: 'plc-line-07',
    name: 'Dynamite Line',
    totalKey: 'Total_DynamiteLine_kWh',
    meterIds: ['RIO1CM1_EMU4_2'],
    baseKw: 380,
  },
  {
    id: 'plc-line-08',
    name: 'XO Line',
    totalKey: 'Total_XOLine_kWh',
    meterIds: ['RIO1CM1_EMU4_1'],
    baseKw: 265,
  },
  { id: 'plc-line-09', name: 'Maxx Line', totalKey: 'Total_MaxxLine_kWh', baseKw: 410 },
  {
    id: 'plc-line-10',
    name: 'Main Line',
    totalKey: 'Total_MainLine_kWh',
    meterIds: ['RIO2_UMG508_52', 'RIO2CM2_EM6400_2', 'RIO2CM2_EM6400_3'],
    baseKw: 580,
  },
  {
    id: 'plc-line-11',
    name: 'Utilities Jaguar',
    totalKey: 'Total_UtilitiesJaguar_kWh',
    meterIds: ['RIO2_PAC3200_51', 'RIO2_PAC3200_53'],
    baseKw: 195,
  },
  {
    id: 'plc-line-12',
    name: 'Utilities Lighting',
    totalKey: 'Total_UtilitiesLighting_kWh',
    meterIds: ['RIO1CM2_EM6400_10'],
    baseKw: 120,
  },
]

/** Production line id for “Main Line” — used by electrical topology hierarchy. */
export const PLC_MAIN_LINE_ID = 'plc-line-10'

/** Main Line power analyzer / incomer meter (UMG508) — branch lines tap here in the diagram. */
export const PLC_MAIN_LINE_POWER_METER_ID = 'RIO2_UMG508_52'

/**
 * Production lines fed from the Main Line power meter (not the Main Line summary card).
 * Must match `PLC_PRODUCTION_METERS` ids.
 */
export const PLC_MAIN_LINE_POWER_METER_FEED_LINE_IDS: readonly string[] = [
  'plc-line-04', // Wafer Line 1
  'plc-line-05', // Wafer Line 2
  'plc-line-08', // XO Line
]

/**
 * Optional incomer line id: when set and present in PLC lines, topology is
 * Utility Grid → Incomer → Main Line; production lines named with "Line" stay under Main Line.
 */
export const PLC_TOPOLOGY_INCOMER_LINE_ID: string | null = null

/** Legacy aggregate meter id (full plant snapshot: Power_kW, Energy_kWh, …). */
export const PLC_AGGREGATE_METER_ID = 'plc-1'

export const PLC_TOTAL_ENERGY_LINES = PLC_PRODUCTION_METERS.map((m) => ({
  key: m.totalKey,
  name: m.name,
}))

export function findPlcProductionMeter(meterId: string): PlcProductionMeterDef | undefined {
  return PLC_PRODUCTION_METERS.find((m) => m.id === meterId)
}
