export type CellHighlight = 'none' | 'warn' | 'critical' | 'zero' | 'top'

export type CellAnomaly = {
  icon: 'spike' | 'flat' | 'zero' | 'none'
  highlight: CellHighlight
  tooltip: string
}

function maxHighlight(a: CellHighlight, b: CellHighlight): CellHighlight {
  const o = { none: 0, top: 1, warn: 2, zero: 2, critical: 3 }
  return o[a] >= o[b] ? a : b
}

export function classifyEnergyCell(input: {
  value: number
  prevPeriodValue: number | null
  consumptionRank: number
  activeLines: number
}): CellAnomaly {
  const { value, prevPeriodValue, consumptionRank, activeLines } = input

  if (!Number.isFinite(value)) {
    return { icon: 'none', highlight: 'none', tooltip: '' }
  }

  let highlight: CellHighlight = 'none'
  let icon: CellAnomaly['icon'] = 'none'
  let tooltip = ''

  if (Math.abs(value) < 1e-6) {
    return {
      icon: 'zero',
      highlight: 'zero',
      tooltip: 'Zero consumption — downtime, idle line, or telemetry gap.',
    }
  }

  const spike =
    prevPeriodValue !== null && prevPeriodValue > 1e-6 ? ((value - prevPeriodValue) / prevPeriodValue) * 100 : null

  if (spike !== null && spike >= 50) {
    highlight = 'critical'
    icon = 'spike'
    tooltip = `≥50% vs previous period (+${spike.toFixed(0)}%).`
  } else if (spike !== null && spike >= 20) {
    highlight = maxHighlight(highlight, 'warn')
    icon = 'spike'
    tooltip = `≥20% vs previous period (+${spike.toFixed(0)}%).`
  }

  if (
    prevPeriodValue !== null &&
    prevPeriodValue > 10 &&
    value < prevPeriodValue * 0.2 &&
    highlight !== 'critical'
  ) {
    highlight = maxHighlight(highlight, 'warn')
    icon = 'flat'
    tooltip = tooltip || 'Sharp drop vs prior period — check downtime or metering.'
  }

  if (consumptionRank <= 3 && activeLines >= 3 && highlight === 'none') {
    highlight = 'top'
    tooltip = tooltip || 'Among the top three consumers this period.'
  }

  return { icon, highlight, tooltip }
}
