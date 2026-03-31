import type { Feeder, Site } from '../../types'
import { sleep } from './helpers'

const sites: Site[] = [
  {
    id: 'site-004',
    name: 'URC Cavite',
    address: 'URC Cavite Plant',
    meterIds: [
      'mtr-101',
      'mtr-102',
      'mtr-103',
      'mtr-104',
      'mtr-105',
      'mtr-106',
      'mtr-107',
      'mtr-108',
      'mtr-109',
      'mtr-110',
      'mtr-111',
      'mtr-112',
      'mtr-113',
      'mtr-114',
      'mtr-115',
      'mtr-116',
      'mtr-117',
      'mtr-118',
    ],
    feederIds: ['fdr-101', 'fdr-102', 'fdr-103', 'fdr-104'],
  },
]

const feeders: Feeder[] = [
  { id: 'fdr-101', siteId: 'site-004', name: 'Main Line Feeder', parentFeederId: null, meterId: 'mtr-101', breakerId: 'brk-101', ratingA: 2000, voltageKv: 11 },
  { id: 'fdr-102', siteId: 'site-004', name: 'MDP3 Feeder A', parentFeederId: 'fdr-101', meterId: 'mtr-102', breakerId: 'brk-102', ratingA: 1000, voltageKv: 0.4 },
  { id: 'fdr-103', siteId: 'site-004', name: 'PPBSF Feeder', parentFeederId: 'fdr-101', meterId: 'mtr-104', breakerId: 'brk-103', ratingA: 800, voltageKv: 0.4 },
  { id: 'fdr-104', siteId: 'site-004', name: 'SLITTER Feeder', parentFeederId: 'fdr-101', meterId: 'mtr-118', breakerId: 'brk-104', ratingA: 800, voltageKv: 0.4 },
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
