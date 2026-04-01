import type { PlcFullSnapshot, PlcMeterData } from '../types'
import { findPlcMeter } from '../constants/plcMeters'
import {
  PLC_MAIN_LINE_ID,
  PLC_MAIN_LINE_POWER_METER_FEED_LINE_IDS,
  PLC_MAIN_LINE_POWER_METER_ID,
  PLC_PRODUCTION_METERS,
  PLC_TOPOLOGY_INCOMER_LINE_ID,
} from '../constants/plcProductionMeters'

export type TopologyNodeKind = 'root' | 'line'

/** Root or production line summary card. */
export type TopologyDisplayNode = {
  id: string
  kind: TopologyNodeKind
  name: string
  kw: number
  amps: number
  /** Line-to-line average voltage (V), from PLC `Voltage_Lave`. */
  voltageV: number
  /** Cumulative real energy (kWh), from PLC `Real_energy`. */
  energyKwh: number
  online: boolean
}

/** One physical power meter under a production line. */
export type TopologyMeterNode = {
  meterId: string
  name: string
  kw: number
  amps: number
  voltageV: number
  energyKwh: number
  online: boolean
}

export type TopologyLineBranch = {
  id: string
  name: string
  kw: number
  amps: number
  voltageV: number
  energyKwh: number
  online: boolean
  meters: TopologyMeterNode[]
}

export type ElectricalTopologyModel = {
  root: TopologyDisplayNode
  lines: TopologyLineBranch[]
}

export type TopologyGraphNodeType = 'grid' | 'incomer' | 'main_line' | 'production_line' | 'meter'

/** Explicit node for hierarchy-driven layout and edge generation. */
export type TopologyGraphNode = {
  id: string
  type: TopologyGraphNodeType
  parentId: string | null
  name: string
  kw: number
  amps: number
  voltageV: number
  energyKwh: number
  online: boolean
  /** Physical meter id for routes (meters only). */
  meterId?: string
  /** Owning PLC line id (meters only). */
  lineId?: string
}

export type TopologyGraphEdge = {
  id: string
  parentId: string
  childId: string
}

export type ElectricalTopologyGraph = {
  rootId: string
  nodes: Map<string, TopologyGraphNode>
  edges: TopologyGraphEdge[]
}

export function meterNodeId(lineId: string, meterId: string): string {
  return `meter:${lineId}:${meterId}`
}

function resolveLineParentId(
  line: TopologyLineBranch,
  model: ElectricalTopologyModel,
  rootId: string,
): string {
  const incomerId = PLC_TOPOLOGY_INCOMER_LINE_ID
  const hasIncomer = Boolean(incomerId && model.lines.some((l) => l.id === incomerId))
  const mainExists = model.lines.some((l) => l.id === PLC_MAIN_LINE_ID)

  if (line.id === PLC_MAIN_LINE_ID) {
    if (hasIncomer) return incomerId!
    return rootId
  }
  if (incomerId && line.id === incomerId) {
    return rootId
  }
  if (/Line/i.test(line.name) && line.id !== PLC_MAIN_LINE_ID) {
    if (mainExists) return PLC_MAIN_LINE_ID
    if (hasIncomer) return incomerId!
    return rootId
  }
  return rootId
}

function resolveLineNodeType(line: TopologyLineBranch): TopologyGraphNodeType {
  if (line.id === PLC_MAIN_LINE_ID) return 'main_line'
  if (PLC_TOPOLOGY_INCOMER_LINE_ID && line.id === PLC_TOPOLOGY_INCOMER_LINE_ID) return 'incomer'
  return 'production_line'
}

/**
 * Builds parent-child edges from hierarchy rules:
 * Grid → (optional Incomer) → Main Line; names containing "Line" (except Main) under Main Line when present;
 * other feeders attach directly to Grid or Incomer when no Main Line; meters attach to their line.
 */
export function buildTopologyGraph(model: ElectricalTopologyModel): ElectricalTopologyGraph {
  const rootId = 'utility-grid'
  const nodes = new Map<string, TopologyGraphNode>()
  const edges: TopologyGraphEdge[] = []

  const addEdge = (parentId: string, childId: string) => {
    edges.push({ id: `${parentId}->${childId}`, parentId, childId })
  }

  nodes.set(rootId, {
    id: rootId,
    type: 'grid',
    parentId: null,
    name: model.root.name,
    kw: model.root.kw,
    amps: model.root.amps,
    voltageV: model.root.voltageV,
    energyKwh: model.root.energyKwh,
    online: model.root.online,
  })

  for (const line of model.lines) {
    const parentId = resolveLineParentId(line, model, rootId)
    const type = resolveLineNodeType(line)
    nodes.set(line.id, {
      id: line.id,
      type,
      parentId: parentId,
      name: line.name,
      kw: line.kw,
      amps: line.amps,
      voltageV: line.voltageV,
      energyKwh: line.energyKwh,
      online: line.online,
    })
  }

  for (const line of model.lines) {
    for (const m of line.meters) {
      const mid = meterNodeId(line.id, m.meterId)
      nodes.set(mid, {
        id: mid,
        type: 'meter',
        parentId: line.id,
        name: m.name,
        kw: m.kw,
        amps: m.amps,
        voltageV: m.voltageV,
        energyKwh: m.energyKwh,
        online: m.online,
        meterId: m.meterId,
        lineId: line.id,
      })
      addEdge(line.id, mid)
    }
  }

  for (const line of model.lines) {
    const parentId = resolveLineParentId(line, model, rootId)
    addEdge(parentId, line.id)
  }

  return { rootId, nodes, edges }
}

export function buildChildrenMap(edges: TopologyGraphEdge[]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const e of edges) {
    if (!m.has(e.parentId)) m.set(e.parentId, [])
    m.get(e.parentId)!.push(e.childId)
  }
  return m
}

export function sortTopologyChildren(
  parentId: string,
  childIds: string[],
  nodes: Map<string, TopologyGraphNode>,
  rootId: string,
  mainLineId: string,
): string[] {
  const copy = [...childIds]
  copy.sort((a, b) => {
    const na = nodes.get(a)
    const nb = nodes.get(b)
    if (!na || !nb) return 0

    if (parentId === rootId) {
      if (PLC_TOPOLOGY_INCOMER_LINE_ID) {
        if (a === PLC_TOPOLOGY_INCOMER_LINE_ID) return -1
        if (b === PLC_TOPOLOGY_INCOMER_LINE_ID) return 1
      }
      if (a === mainLineId) return -1
      if (b === mainLineId) return 1
    }

    if (parentId === mainLineId) {
      const pwr = meterNodeId(PLC_MAIN_LINE_ID, PLC_MAIN_LINE_POWER_METER_ID)
      if (a === pwr) return -1
      if (b === pwr) return 1
      const ma = na.type === 'meter'
      const mb = nb.type === 'meter'
      if (ma !== mb) return ma ? -1 : 1
    }

    return na.name.localeCompare(nb.name, undefined, { sensitivity: 'base' })
  })
  return copy
}

function meterHasData(d: PlcMeterData | undefined): boolean {
  if (!d) return false
  return d.Real_power !== 0 || d.Voltage_Lave !== 0 || d.Current_Ave !== 0
}

/**
 * Utility → production lines → power meters (from `PLC_PRODUCTION_METERS.meterIds`).
 * No incomer / auxiliary buckets — only defined lines and their meters.
 */
export function buildElectricalTopology(snap: PlcFullSnapshot | undefined, plcLinkUp: boolean): ElectricalTopologyModel {
  const emptyRoot = (): TopologyDisplayNode => ({
    id: 'utility-grid',
    kind: 'root',
    name: 'Utility Grid',
    kw: NaN,
    amps: NaN,
    voltageV: NaN,
    energyKwh: NaN,
    online: false,
  })

  const buildMeterNodes = (meterIds: string[] | undefined): TopologyMeterNode[] => {
    const ids = meterIds ?? []
    if (!snap?.meters || ids.length === 0) {
      return ids.map((meterId) => ({
        meterId,
        name: findPlcMeter(meterId)?.name ?? meterId,
        kw: 0,
        amps: 0,
        voltageV: NaN,
        energyKwh: NaN,
        online: false,
      }))
    }
    return ids.map((meterId) => {
      const d = snap.meters[meterId]
      const kw = d ? d.Real_power : 0
      const amps = d ? d.Current_Ave : 0
      const voltageV = d && Number.isFinite(d.Voltage_Lave) ? d.Voltage_Lave : NaN
      const energyKwh = d && Number.isFinite(d.Real_energy) ? d.Real_energy : NaN
      return {
        meterId,
        name: findPlcMeter(meterId)?.name ?? meterId,
        kw,
        amps,
        voltageV,
        energyKwh,
        online: plcLinkUp && meterHasData(d),
      }
    })
  }

  const lines: TopologyLineBranch[] = [...PLC_PRODUCTION_METERS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((line) => {
      const meters = buildMeterNodes(line.meterIds)
      let kw = 0
      let amps = 0
      let anyOnline = false
      const voltages: number[] = []
      let energySum = 0
      let energyAny = false
      for (const m of meters) {
        if (Number.isFinite(m.kw)) kw += m.kw
        if (Number.isFinite(m.amps)) amps += m.amps
        if (m.online) anyOnline = true
        if (Number.isFinite(m.voltageV)) voltages.push(m.voltageV)
        if (Number.isFinite(m.energyKwh)) {
          energySum += m.energyKwh
          energyAny = true
        }
      }
      const voltageV = voltages.length ? voltages.reduce((a, b) => a + b, 0) / voltages.length : NaN
      const energyKwh = energyAny ? energySum : NaN
      return {
        id: line.id,
        name: line.name,
        kw: meters.length ? kw : 0,
        amps: meters.length ? amps : 0,
        voltageV,
        energyKwh,
        online: meters.length > 0 && plcLinkUp && anyOnline,
        meters,
      }
    })

  if (!snap?.meters) {
    return { root: emptyRoot(), lines }
  }

  const allMeters = Object.values(snap.meters)
  const plantKw = allMeters.reduce((s, d) => s + d.Real_power, 0)
  const plantAmps = allMeters.reduce((s, d) => s + d.Current_Ave, 0)
  const plantOnline = allMeters.some((d) => meterHasData(d))
  const plantVoltages = allMeters.filter((d) => Number.isFinite(d.Voltage_Lave)).map((d) => d.Voltage_Lave)
  const plantVoltageV = plantVoltages.length
    ? plantVoltages.reduce((a, b) => a + b, 0) / plantVoltages.length
    : NaN
  let plantEnergySum = 0
  let plantEnergyAny = false
  for (const d of allMeters) {
    if (Number.isFinite(d.Real_energy)) {
      plantEnergySum += d.Real_energy
      plantEnergyAny = true
    }
  }
  const plantEnergyKwh = plantEnergyAny ? plantEnergySum : NaN

  return {
    root: {
      id: 'utility-grid',
      kind: 'root',
      name: 'Utility Grid',
      kw: plantKw,
      amps: plantAmps,
      voltageV: plantVoltageV,
      energyKwh: plantEnergyKwh,
      online: plcLinkUp && plantOnline,
    },
    lines,
  }
}
