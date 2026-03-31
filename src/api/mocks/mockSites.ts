import type { Feeder, Site } from '../../types'
import { PLC_PRODUCTION_METERS, PLC_SITE_NAME } from '../../constants/plcProductionMeters'
import { sleep } from './helpers'

const meterIds = PLC_PRODUCTION_METERS.map((m) => m.id)

const sites: Site[] = [
  {
    id: 'site-004',
    name: PLC_SITE_NAME,
    address: 'Production facility — S7 DB16 / Node-RED',
    meterIds,
    feederIds: ['fdr-101', 'fdr-102', 'fdr-103', 'fdr-104'],
  },
]

const feeders: Feeder[] = [
  {
    id: 'fdr-101',
    siteId: 'site-004',
    name: 'Cracker & pretzel group',
    parentFeederId: null,
    meterId: 'plc-line-01',
    breakerId: 'brk-101',
    ratingA: 2000,
    voltageKv: 0.4,
  },
  {
    id: 'fdr-102',
    siteId: 'site-004',
    name: 'Wafer & chocolate group',
    parentFeederId: 'fdr-101',
    meterId: 'plc-line-04',
    breakerId: 'brk-102',
    ratingA: 1200,
    voltageKv: 0.4,
  },
  {
    id: 'fdr-103',
    siteId: 'site-004',
    name: 'Lines & main bus',
    parentFeederId: 'fdr-101',
    meterId: 'plc-line-10',
    breakerId: 'brk-103',
    ratingA: 2500,
    voltageKv: 11,
  },
  {
    id: 'fdr-104',
    siteId: 'site-004',
    name: 'Utilities',
    parentFeederId: 'fdr-103',
    meterId: 'plc-line-12',
    breakerId: 'brk-104',
    ratingA: 400,
    voltageKv: 0.4,
  },
]

export async function mockListSites(): Promise<Site[]> {
  await sleep(150)
  return sites.map((s) => ({ ...s }))
}

export async function mockGetSite(siteId: string): Promise<Site | null> {
  await sleep(100)
  const s = sites.find((x) => x.id === siteId)
  return s ? { ...s } : null
}

export async function mockListFeeders(siteId?: string): Promise<Feeder[]> {
  await sleep(120)
  const list = siteId ? feeders.filter((f) => f.siteId === siteId) : feeders
  return list.map((f) => ({ ...f }))
}
