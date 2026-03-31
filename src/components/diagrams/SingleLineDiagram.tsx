import { useState, useMemo } from 'react'
import { ChevronDown } from 'lucide-react'
import { useSites, useFeeders, useBreakers, useMeters, useLatestReading } from '../../hooks/queries'
import type { Feeder, Breaker as BreakerType, PowerMeter } from '../../types'
import BusBar from './BusBar'
import BreakerSymbol from './BreakerSymbol'
import MeterSymbol from './MeterSymbol'
import FeedLine from './FeedLine'

// Layout constants
const BUS_WIDTH = 500
const BUS_X = 50
const MAIN_BUS_Y = 80
const CHILD_BUS_Y = 300
const FEEDER_SPACING = 120
const SVG_PADDING = 40

/** Helper to get a live reading for a meter via the hook */
function LiveMeter({
  meter,
  x,
  y,
}: {
  meter: PowerMeter
  x: number
  y: number
}) {
  const { data: reading } = useLatestReading(meter.id)
  return (
    <MeterSymbol
      x={x}
      y={y}
      label={meter.name}
      powerKw={reading?.powerKw}
      voltageV={reading?.voltageV}
      status={meter.status}
    />
  )
}

type Props = {
  siteId?: string
}

export default function SingleLineDiagram({ siteId: siteIdProp }: Props) {
  const { data: sites } = useSites()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')

  // Pick first site if none selected
  const siteId = siteIdProp || selectedSiteId || sites?.[0]?.id || ''

  const { data: feeders } = useFeeders(siteId || undefined)
  const { data: breakers } = useBreakers()
  const { data: meters } = useMeters()

  // Build lookup maps
  const breakerMap = useMemo(() => {
    const m = new Map<string, BreakerType>()
    breakers?.forEach((b) => m.set(b.id, b))
    return m
  }, [breakers])

  const meterMap = useMemo(() => {
    const m = new Map<string, PowerMeter>()
    meters?.forEach((mt) => m.set(mt.id, mt))
    return m
  }, [meters])

  // Separate root feeders (main incomers) from child feeders
  const rootFeeders = useMemo(
    () => feeders?.filter((f) => f.parentFeederId === null) ?? [],
    [feeders],
  )

  const childFeeders = useMemo(
    () => feeders?.filter((f) => f.parentFeederId !== null) ?? [],
    [feeders],
  )

  // Group child feeders by parent
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Feeder[]>()
    childFeeders.forEach((f) => {
      const arr = map.get(f.parentFeederId!) ?? []
      arr.push(f)
      map.set(f.parentFeederId!, arr)
    })
    return map
  }, [childFeeders])

  // Calculate SVG dimensions based on content
  const maxChildren = Math.max(
    ...rootFeeders.map((r) => (childrenByParent.get(r.id) ?? []).length),
    1,
  )
  const svgWidth = Math.max(
    BUS_X * 2 + BUS_WIDTH,
    rootFeeders.length * FEEDER_SPACING + SVG_PADDING * 2,
    maxChildren * FEEDER_SPACING + SVG_PADDING * 2,
  )
  const svgHeight = 420

  // Site selector dropdown open state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const currentSite = sites?.find((s) => s.id === siteId)

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      {/* Site selector (only when siteId not provided by parent) */}
      {!siteIdProp && (
        <div className="relative mb-4 inline-block">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {currentSite?.name ?? 'Select site'}
            <ChevronDown className="h-4 w-4" />
          </button>
          {dropdownOpen && sites && (
            <ul className="absolute left-0 top-full z-10 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
              {sites.map((site) => (
                <li key={site.id}>
                  <button
                    onClick={() => {
                      setSelectedSiteId(site.id)
                      setDropdownOpen(false)
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                      site.id === siteId
                        ? 'font-semibold text-blue-600 dark:text-blue-400'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {site.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Diagram */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ minWidth: 400 }}
          role="img"
          aria-label="Single-line diagram"
        >
          {/* Main incomer bus */}
          <BusBar
            x={BUS_X}
            y={MAIN_BUS_Y}
            width={BUS_WIDTH}
            label={currentSite?.name ? `${currentSite.name} Main Bus` : 'Main Bus'}
            voltageKv={rootFeeders[0]?.voltageKv ?? 11}
          />

          {rootFeeders.map((feeder, idx) => {
            const feederX = BUS_X + 60 + idx * FEEDER_SPACING
            const breakerY = MAIN_BUS_Y + 60
            const children = childrenByParent.get(feeder.id) ?? []

            const breaker = feeder.breakerId
              ? breakerMap.get(feeder.breakerId)
              : undefined
            const meter = feeder.meterId
              ? meterMap.get(feeder.meterId)
              : undefined

            return (
              <g key={feeder.id}>
                {/* Vertical line from main bus down to breaker */}
                <FeedLine x={feederX} y1={MAIN_BUS_Y + 4} y2={breakerY - 14} />

                {/* Breaker */}
                {breaker && (
                  <BreakerSymbol
                    x={feederX}
                    y={breakerY}
                    state={breaker.state}
                    label={breaker.name}
                  />
                )}

                {/* Line from breaker down */}
                <FeedLine
                  x={feederX}
                  y1={breakerY + 14}
                  y2={meter ? breakerY + 55 : CHILD_BUS_Y - 14}
                />

                {/* Meter if present */}
                {meter && (
                  <>
                    <LiveMeter
                      meter={meter}
                      x={feederX}
                      y={breakerY + 75}
                    />
                    <FeedLine
                      x={feederX}
                      y1={breakerY + 95}
                      y2={CHILD_BUS_Y - 14}
                    />
                  </>
                )}

                {/* Feeder label */}
                <text
                  x={feederX}
                  y={CHILD_BUS_Y - 24}
                  textAnchor="middle"
                  className="fill-slate-600 dark:fill-slate-300"
                  fontSize={10}
                >
                  {feeder.name}
                </text>

                {/* Child bus if there are child feeders */}
                {children.length > 0 && (
                  <>
                    <BusBar
                      x={feederX - (children.length * FEEDER_SPACING) / 2 + 20}
                      y={CHILD_BUS_Y}
                      width={Math.max(children.length * FEEDER_SPACING - 40, 60)}
                      label={`${feeder.name} Bus`}
                      voltageKv={children[0]?.voltageKv ?? feeder.voltageKv}
                      color="#475569"
                    />

                    {/* Child feeders */}
                    {children.map((child, ci) => {
                      const childX =
                        feederX -
                        ((children.length - 1) * FEEDER_SPACING) / 2 +
                        ci * FEEDER_SPACING
                      const childBreakerY = CHILD_BUS_Y + 50
                      const childBreaker = child.breakerId
                        ? breakerMap.get(child.breakerId)
                        : undefined
                      const childMeter = child.meterId
                        ? meterMap.get(child.meterId)
                        : undefined

                      return (
                        <g key={child.id}>
                          <FeedLine
                            x={childX}
                            y1={CHILD_BUS_Y + 4}
                            y2={childBreakerY - 14}
                          />
                          {childBreaker && (
                            <BreakerSymbol
                              x={childX}
                              y={childBreakerY}
                              state={childBreaker.state}
                              label={childBreaker.name}
                            />
                          )}
                          <FeedLine
                            x={childX}
                            y1={childBreakerY + 14}
                            y2={childBreakerY + 45}
                          />
                          {childMeter && (
                            <LiveMeter
                              meter={childMeter}
                              x={childX}
                              y={childBreakerY + 60}
                            />
                          )}
                          {!childMeter && (
                            <text
                              x={childX}
                              y={childBreakerY + 55}
                              textAnchor="middle"
                              className="fill-slate-500 dark:fill-slate-400"
                              fontSize={9}
                            >
                              {child.name}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </>
                )}
              </g>
            )
          })}

          {/* If no feeders loaded yet */}
          {rootFeeders.length === 0 && (
            <text
              x={svgWidth / 2}
              y={svgHeight / 2}
              textAnchor="middle"
              className="fill-slate-400 dark:fill-slate-500"
              fontSize={14}
            >
              {siteId ? 'Loading diagram...' : 'Select a site to view the diagram'}
            </text>
          )}
        </svg>
      </div>
    </div>
  )
}
