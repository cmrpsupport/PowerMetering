/**
 * Real power meter definitions from DB16 variable table (S7-1500 via Node-RED).
 * 25 meters across Remote I/O modules, each with 20 REAL parameters (80 bytes).
 * Sourced from the Excel variable table imported into node-red-contrib-s7.
 */

export type PlcMeterDef = {
  /** URL-safe identifier (matches the S7 variable name prefix). */
  id: string
  /** Human-readable meter name. */
  name: string
  /** Meter model / type. */
  model: 'EMU4' | 'EM6400' | 'PAC3200' | 'UMG508'
  /** Remote I/O module and communication module path. */
  location: string
}

/** The 20 S7 variable suffixes for each meter, in DB16 byte order. */
export const METER_PARAM_SUFFIXES = [
  'Real_power',
  'Reactive_power',
  'Apparent_power',
  'Real_energy',
  'Reactive_energy',
  'Apparent_energy',
  'Voltage_ab',
  'Voltage_bc',
  'Voltage_ca',
  'Voltage_Lave',
  'Voltage_an',
  'Voltage_bn',
  'Voltage_cn',
  'Voltage_Nave',
  'Current_a',
  'Current_b',
  'Current_c',
  'Current_Ave',
  'Power_factor',
  'Frequency',
] as const

export type MeterParamKey = (typeof METER_PARAM_SUFFIXES)[number]

export const PLC_METERS: PlcMeterDef[] = [
  // RIO 1, CM 1 — Siemens EMU4
  { id: 'RIO1CM1_EMU4_1', name: 'RIO1 CM1 EMU4 #1', model: 'EMU4', location: 'RIO1 / CM1' },
  { id: 'RIO1CM1_EMU4_2', name: 'RIO1 CM1 EMU4 #2', model: 'EMU4', location: 'RIO1 / CM1' },

  // RIO 1, CM 2 — Siemens EM6400
  { id: 'RIO1CM2_EM6400_10', name: 'RIO1 CM2 EM6400 #10', model: 'EM6400', location: 'RIO1 / CM2' },
  { id: 'RIO1CM2_EM6400_11', name: 'RIO1 CM2 EM6400 #11', model: 'EM6400', location: 'RIO1 / CM2' },

  // RIO 2, CM 1 — Siemens EMU4 (12 meters)
  { id: 'RIO2CM1_EMU4_1', name: 'RIO2 CM1 EMU4 #1', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_2', name: 'RIO2 CM1 EMU4 #2', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_3', name: 'RIO2 CM1 EMU4 #3', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_4', name: 'RIO2 CM1 EMU4 #4', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_5', name: 'RIO2 CM1 EMU4 #5', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_6', name: 'RIO2 CM1 EMU4 #6', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_7', name: 'RIO2 CM1 EMU4 #7', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_8', name: 'RIO2 CM1 EMU4 #8', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_9', name: 'RIO2 CM1 EMU4 #9', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_10', name: 'RIO2 CM1 EMU4 #10', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_11', name: 'RIO2 CM1 EMU4 #11', model: 'EMU4', location: 'RIO2 / CM1' },
  { id: 'RIO2CM1_EMU4_12', name: 'RIO2 CM1 EMU4 #12', model: 'EMU4', location: 'RIO2 / CM1' },

  // RIO 2, CM 2 — Siemens EM6400 (6 meters)
  { id: 'RIO2CM2_EM6400_1', name: 'RIO2 CM2 EM6400 #1', model: 'EM6400', location: 'RIO2 / CM2' },
  { id: 'RIO2CM2_EM6400_2', name: 'RIO2 CM2 EM6400 #2', model: 'EM6400', location: 'RIO2 / CM2' },
  { id: 'RIO2CM2_EM6400_3', name: 'RIO2 CM2 EM6400 #3', model: 'EM6400', location: 'RIO2 / CM2' },
  { id: 'RIO2CM2_EM6400_4', name: 'RIO2 CM2 EM6400 #4', model: 'EM6400', location: 'RIO2 / CM2' },
  { id: 'RIO2CM2_EM6400_5', name: 'RIO2 CM2 EM6400 #5', model: 'EM6400', location: 'RIO2 / CM2' },
  { id: 'RIO2CM2_EM6400_6', name: 'RIO2 CM2 EM6400 #6', model: 'EM6400', location: 'RIO2 / CM2' },

  // RIO 2 — Mixed meters
  { id: 'RIO2_PAC3200_51', name: 'RIO2 PAC3200 #51', model: 'PAC3200', location: 'RIO2' },
  { id: 'RIO2_PAC3200_53', name: 'RIO2 PAC3200 #53', model: 'PAC3200', location: 'RIO2' },
  { id: 'RIO2_UMG508_52', name: 'RIO2 UMG508 #52', model: 'UMG508', location: 'RIO2' },
]

/** Total energy counters for production lines (at the end of DB16). */
export const PLC_TOTAL_ENERGY_KEYS = [
  { key: 'Total_EnergyCon_kwh_Cracker_Line_1', name: 'Cracker Line 1' },
  { key: 'Total_EnergyCon_kwh_Cracker_Line_2', name: 'Cracker Line 2' },
  { key: 'Total_EnergyCon_kwh_Pretzel_Line', name: 'Pretzel Line' },
  { key: 'Total_EnergyCon_kwh_Wafer_Line_1', name: 'Wafer Line 1' },
  { key: 'Total_EnergyCon_kwh_Wafer_Line_2', name: 'Wafer Line 2' },
  { key: 'Total_EnergyCon_kwh_Chooey_Choco_Line', name: 'Chooey Choco Line' },
  { key: 'Total_EnergyCon_kwh_Dynamite_Line', name: 'Dynamite Line' },
  { key: 'Total_EnergyCon_kwh_XO_Line', name: 'XO Line' },
  { key: 'Total_EnergyCon_kwh_Maxx_Line', name: 'Maxx Line' },
  { key: 'Total_EnergyCon_kwh_Main_Line', name: 'Main Line' },
  { key: 'Total_EnergyCon_kwh_Utilities_Jaguar', name: 'Utilities Jaguar' },
  { key: 'Total_EnergyCon_kwh_Utilities_Lighting_Power_Panel', name: 'Utilities Lighting' },
] as const

export function findPlcMeter(meterId: string): PlcMeterDef | undefined {
  return PLC_METERS.find((m) => m.id === meterId)
}
