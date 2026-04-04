/**
 * Normalize PLC / historian display names so UI matches plant naming (URC).
 * Backend or legacy strings may still use old spellings.
 */
export function normalizeProductionLineName(name: string): string {
  const n = String(name ?? '').trim()
  if (/^chocoy\s+choco\s+line$/i.test(n)) return 'Chooey Choco Line'
  if (/^choco\s+choco\s+line$/i.test(n)) return 'Chooey Choco Line'
  return n
}
