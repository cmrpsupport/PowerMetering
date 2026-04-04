import type { ProductionEntry } from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').toString()

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url = API_BASE_URL ? `${API_BASE_URL}${path}` : path
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const j = (await res.json()) as { error?: string }
      if (j?.error) detail = j.error
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed: ${res.status}`)
  }
  return (await res.json()) as T
}

export type ProductionEntriesResponse = { ok: boolean; entries: ProductionEntry[] }
export type ProductionMutationResponse = { ok: boolean; entry?: ProductionEntry; error?: string }

export async function getProductionEntries(hours = 168): Promise<ProductionEntry[]> {
  const raw = await http<ProductionEntriesResponse>(
    `/api/production/entries?hours=${encodeURIComponent(String(hours))}`,
  ).catch(() => ({ ok: false, entries: [] as ProductionEntry[] }))
  return raw.entries ?? []
}

export async function getLastProductionEntry(lineId?: string): Promise<ProductionEntry | null> {
  const p = new URLSearchParams({ last: '1' })
  if (lineId) p.set('lineId', lineId)
  const raw = await http<ProductionEntriesResponse>(`/api/production/entries?${p.toString()}`).catch(() => ({
    ok: false,
    entries: [] as ProductionEntry[],
  }))
  const e = raw.entries?.[0]
  return e ?? null
}

async function mutateProduction(
  method: 'POST' | 'PUT',
  body: Record<string, unknown>,
): Promise<ProductionMutationResponse> {
  const url = API_BASE_URL ? `${API_BASE_URL}/api/production/entries` : '/api/production/entries'
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as ProductionMutationResponse
  if (!res.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` }
  }
  return data
}

export async function createProductionEntry(body: {
  lineId: string
  quantity: number
  ts?: string
  shift?: string | null
}): Promise<ProductionMutationResponse> {
  return mutateProduction('POST', body as Record<string, unknown>)
}

export async function updateProductionEntry(body: {
  id: number
  lineId?: string
  quantity?: number
  ts?: string
  shift?: string | null
}): Promise<ProductionMutationResponse> {
  return mutateProduction('PUT', body as Record<string, unknown>)
}

export async function deleteProductionEntry(id: number): Promise<ProductionMutationResponse> {
  const url = API_BASE_URL
    ? `${API_BASE_URL}/api/production/entries?id=${encodeURIComponent(String(id))}`
    : `/api/production/entries?id=${encodeURIComponent(String(id))}`
  const res = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } })
  const data = (await res.json().catch(() => ({}))) as ProductionMutationResponse
  if (!res.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` }
  return data
}
