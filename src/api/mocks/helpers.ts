export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function round(n: number, digits = 2) {
  const p = 10 ** digits
  return Math.round(n * p) / p
}

export function nowIso() {
  return new Date().toISOString()
}

export function seededNoise(seed: number) {
  const x = Math.sin(seed) * 10000
  return (x - Math.floor(x)) * 2 - 1
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

export function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString()
}
