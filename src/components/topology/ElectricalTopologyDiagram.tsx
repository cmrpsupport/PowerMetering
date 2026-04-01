import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import type {
  ElectricalTopologyGraph,
  ElectricalTopologyModel,
  TopologyDisplayNode,
  TopologyGraphEdge,
  TopologyGraphNode,
} from '../../lib/electricalTopology'
import {
  buildChildrenMap,
  buildTopologyGraph,
  meterNodeId,
  sortTopologyChildren,
} from '../../lib/electricalTopology'
import { orthogonalConnectorPath } from '../../lib/topologyOrtho'
import { PLC_MAIN_LINE_ID, PLC_MAIN_LINE_POWER_METER_ID } from '../../constants/plcProductionMeters'

const ROOT_ID = 'utility-grid'

function mainLinePowerMeterNodeId(): string {
  return meterNodeId(PLC_MAIN_LINE_ID, PLC_MAIN_LINE_POWER_METER_ID)
}

/** Thicker strokes on Main Line card and Main Line power-meter branches. */
function edgeStrokeWidths(e: TopologyGraphEdge): { base: number; hover: number } {
  const p = mainLinePowerMeterNodeId()
  const a = e.parentId
  const b = e.childId
  if (a === PLC_MAIN_LINE_ID || b === PLC_MAIN_LINE_ID) return { base: 2.5, hover: 3.25 }
  if (a === p || b === p) return { base: 2, hover: 2.75 }
  return { base: 1.25, hover: 2 }
}

function fmtKw(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(1)
}

function fmtA(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(0)
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      className={[
        'inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-[var(--card)]',
        online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.35)]',
      ].join(' ')}
      title={online ? 'Online / normal' : 'Offline or alarm'}
      aria-hidden
    />
  )
}

function graphNodeToDisplay(n: TopologyGraphNode): TopologyDisplayNode {
  return {
    id: n.meterId ?? n.id,
    kind: 'line',
    name: n.name,
    kw: n.kw,
    amps: n.amps,
    online: n.online,
  }
}

function NodeCard({
  node,
  size = 'md',
}: {
  node: TopologyDisplayNode
  size?: 'sm' | 'md'
}) {
  const pad = size === 'md' ? 'p-3' : 'p-2.5'
  const titleCls = size === 'md' ? 'text-sm' : 'text-xs'
  const valCls = size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <div
      className={[
        'relative w-full min-w-0 max-w-[200px] rounded-xl border transition-shadow duration-300',
        'border-[color-mix(in_srgb,var(--chart-2)_35%,var(--border))]',
        'bg-[color-mix(in_srgb,var(--muted)_8%,var(--card))]',
        'shadow-sm hover:shadow-md',
        pad,
      ].join(' ')}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className={['min-w-0 truncate font-semibold text-[var(--text)]', titleCls].join(' ')}>{node.name}</div>
        <StatusDot online={node.online} />
      </div>
      <div className={['space-y-1 tabular-nums text-[var(--text)]', valCls].join(' ')}>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">Pwr:</span>
          <span>
            {fmtKw(node.kw)} <span className="text-[var(--muted)]">kW</span>
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-[var(--muted)]">I avg:</span>
          <span>
            {fmtA(node.amps)} <span className="text-[var(--muted)]">A</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function useNodeRegistry() {
  const refs = useRef<Map<string, HTMLElement>>(new Map())
  const register = useCallback((id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }, [])
  return { register, refs }
}

function useOrthogonalEdgePaths(
  containerRef: RefObject<HTMLElement | null>,
  edges: TopologyGraphEdge[],
  refs: RefObject<Map<string, HTMLElement>>,
) {
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([])

  const measure = useCallback(() => {
    const root = containerRef.current
    if (!root) return
    const r0 = root.getBoundingClientRect()

    const byParent = new Map<string, TopologyGraphEdge[]>()
    for (const e of edges) {
      if (!byParent.has(e.parentId)) byParent.set(e.parentId, [])
      byParent.get(e.parentId)!.push(e)
    }

    const childCenterX = (edge: TopologyGraphEdge): number => {
      const cEl = refs.current?.get(edge.childId)
      if (!cEl) return 0
      const cr = cEl.getBoundingClientRect()
      return cr.left + cr.width / 2 - r0.left
    }

    const next: { id: string; d: string }[] = []
    for (const e of edges) {
      const pEl = refs.current?.get(e.parentId)
      const cEl = refs.current?.get(e.childId)
      if (!pEl || !cEl) continue
      const pr = pEl.getBoundingClientRect()
      const cr = cEl.getBoundingClientRect()
      const pxCenter = pr.left + pr.width / 2 - r0.left
      const ay = pr.bottom - r0.top
      const bx = cr.left + cr.width / 2 - r0.left
      const by = cr.top - r0.top

      const siblings = (byParent.get(e.parentId) ?? []).slice().sort((a, b) => childCenterX(a) - childCenterX(b))
      const n = siblings.length
      const idx = Math.max(0, siblings.findIndex((s) => s.id === e.id))
      /** Fan horizontal anchors along the parent bottom so shared parents do not triple-stroke one vertical. */
      let ax = pxCenter
      if (n > 1) {
        const maxSpread = Math.min(14, pr.width * 0.42)
        const step = n <= 1 ? 0 : maxSpread / Math.max(n - 1, 1)
        ax = pxCenter + (idx - (n - 1) / 2) * step
        ax = Math.min(Math.max(ax, pr.left - r0.left + 4), pr.right - r0.left - 4)
      }

      const d = orthogonalConnectorPath(ax, ay, bx, by, {
        siblingIndex: idx,
        siblingCount: n,
      })
      next.push({ id: e.id, d })
    }
    setPaths(next)
  }, [containerRef, edges, refs])

  useLayoutEffect(() => {
    measure()
    const root = containerRef.current
    if (!root) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(root)
    window.addEventListener('resize', measure)
    const id = window.requestAnimationFrame(measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
      window.cancelAnimationFrame(id)
    }
  }, [measure])

  return paths
}

function GridCard({
  node,
  register,
  onHover,
}: {
  node: TopologyGraphNode
  register: (id: string) => (el: HTMLElement | null) => void
  onHover: (id: string | null) => void
}) {
  return (
    <div
      ref={register(node.id)}
      className="flex flex-col items-center"
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex flex-col items-center rounded-2xl border border-amber-400/40 bg-[color-mix(in_srgb,#fbbf2418,var(--card))] p-4 shadow-md ring-1 ring-amber-500/20">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-400/20 text-amber-500 ring-2 ring-amber-400/50">
          <Zap className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <div className="mt-2 text-center">
          <div className="text-sm font-semibold text-[var(--text)]">{node.name}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <span>
              {fmtKw(node.kw)} kW · {fmtA(node.amps)} A
            </span>
            <StatusDot online={node.online} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LineCardLink({
  lineId,
  node,
  register,
  size = 'md',
  onHover,
}: {
  lineId: string
  node: TopologyGraphNode
  register: (id: string) => (el: HTMLElement | null) => void
  size?: 'sm' | 'md'
  onHover: (id: string | null) => void
}) {
  return (
    <div
      ref={register(lineId)}
      className="w-full max-w-[220px]"
      onMouseEnter={() => onHover(lineId)}
      onMouseLeave={() => onHover(null)}
    >
      <Link
        to={`/lines/${lineId}`}
        className="block rounded-xl transition hover:ring-2 hover:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
      >
        <NodeCard node={graphNodeToDisplay(node)} size={size} />
      </Link>
    </div>
  )
}

function MeterLeaf({
  node,
  register,
  onHover,
}: {
  node: TopologyGraphNode
  register: (id: string) => (el: HTMLElement | null) => void
  onHover: (id: string | null) => void
}) {
  if (!node.meterId) return null
  return (
    <div
      ref={register(node.id)}
      className="w-full max-w-[200px]"
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
    >
      <Link
        to={`/meters/${encodeURIComponent(node.meterId)}`}
        className="block rounded-xl transition hover:ring-2 hover:ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
      >
        <NodeCard node={graphNodeToDisplay(node)} size="sm" />
      </Link>
    </div>
  )
}

function LineSubtree({
  lineId,
  graph,
  childrenByParent,
  register,
  onHover,
}: {
  lineId: string
  graph: ElectricalTopologyGraph
  childrenByParent: Map<string, string[]>
  register: (id: string) => (el: HTMLElement | null) => void
  onHover: (id: string | null) => void
}) {
  const node = graph.nodes.get(lineId)
  if (!node) return null

  const rawKids = childrenByParent.get(lineId) ?? []
  const kids = sortTopologyChildren(lineId, rawKids, graph.nodes, ROOT_ID, PLC_MAIN_LINE_ID)
  const meterIds = kids.filter((id) => graph.nodes.get(id)?.type === 'meter')
  const lineChildIds = kids.filter((id) => graph.nodes.get(id)?.type !== 'meter')

  return (
    <div className="flex flex-col items-center gap-3">
      <LineCardLink lineId={lineId} node={node} register={register} onHover={onHover} />

      {meterIds.length > 0 ? (
        <div className="flex w-full max-w-[min(100vw,720px)] flex-row flex-wrap justify-center gap-2">
          {meterIds.map((mid) => {
            const m = graph.nodes.get(mid)
            if (!m) return null
            return (
              <MeterWithLineChildren
                key={mid}
                meterNode={m}
                graph={graph}
                childrenByParent={childrenByParent}
                register={register}
                onHover={onHover}
              />
            )
          })}
        </div>
      ) : null}

      {lineChildIds.length > 0 ? (
        <div className="flex w-full max-w-[min(100vw,1400px)] flex-row flex-wrap justify-center gap-x-4 gap-y-6">
          {lineChildIds.map((cid) => (
            <div key={cid} className="flex min-w-[180px] max-w-[220px] flex-col items-center">
              <LineSubtree
                lineId={cid}
                graph={graph}
                childrenByParent={childrenByParent}
                register={register}
                onHover={onHover}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Main Line power meter may have downstream line nodes (Wafer / XO). */
function MeterWithLineChildren({
  meterNode,
  graph,
  childrenByParent,
  register,
  onHover,
}: {
  meterNode: TopologyGraphNode
  graph: ElectricalTopologyGraph
  childrenByParent: Map<string, string[]>
  register: (id: string) => (el: HTMLElement | null) => void
  onHover: (id: string | null) => void
}) {
  const raw = childrenByParent.get(meterNode.id) ?? []
  const sorted = sortTopologyChildren(
    meterNode.id,
    raw,
    graph.nodes,
    ROOT_ID,
    PLC_MAIN_LINE_ID,
  )
  const lineDownstream = sorted.filter((id) => graph.nodes.get(id)?.type !== 'meter')

  if (lineDownstream.length === 0) {
    return <MeterLeaf node={meterNode} register={register} onHover={onHover} />
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <MeterLeaf node={meterNode} register={register} onHover={onHover} />
      <div className="flex w-full max-w-[min(100vw,1200px)] flex-row flex-wrap justify-center gap-x-4 gap-y-6">
        {lineDownstream.map((cid) => (
          <div key={cid} className="flex min-w-[180px] max-w-[220px] flex-col items-center">
            <LineSubtree
              lineId={cid}
              graph={graph}
              childrenByParent={childrenByParent}
              register={register}
              onHover={onHover}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ElectricalTopologyDiagram({ model }: { model: ElectricalTopologyModel }) {
  const graph = useMemo(() => buildTopologyGraph(model), [model])
  const childrenByParent = useMemo(() => buildChildrenMap(graph.edges), [graph.edges])
  const { register, refs } = useNodeRegistry()
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const edgeHighlight = useMemo(() => {
    if (!hoverId) return new Set<string>()
    const s = new Set<string>()
    for (const e of graph.edges) {
      if (e.parentId === hoverId || e.childId === hoverId) s.add(e.id)
    }
    return s
  }, [graph.edges, hoverId])

  const paths = useOrthogonalEdgePaths(containerRef, graph.edges, refs)
  const edgeById = useMemo(() => new Map(graph.edges.map((e) => [e.id, e])), [graph.edges])

  const gridKids = sortTopologyChildren(
    ROOT_ID,
    childrenByParent.get(ROOT_ID) ?? [],
    graph.nodes,
    ROOT_ID,
    PLC_MAIN_LINE_ID,
  )

  return (
    <div
      className="relative w-full pb-4 pt-2"
      role="region"
      aria-label="Electrical network topology diagram"
    >
      <div ref={containerRef} className="relative flex flex-col items-center gap-6">
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full min-h-full w-full overflow-visible"
          aria-hidden
        >
          {paths.map((p) => {
            const hi = edgeHighlight.has(p.id)
            const edge = edgeById.get(p.id)
            const sw = edge ? edgeStrokeWidths(edge) : { base: 1.25, hover: 2 }
            return (
              <path
                key={p.id}
                d={p.d}
                fill="none"
                stroke="currentColor"
                strokeWidth={hi ? sw.hover : sw.base}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={
                  hi
                    ? 'text-[color-mix(in_srgb,var(--primary)_55%,var(--border))]'
                    : 'text-[color-mix(in_srgb,var(--muted)_45%,var(--border))]'
                }
                opacity={hi ? 0.95 : 0.58}
              />
            )
          })}
        </svg>

        <div className="relative z-10 flex w-full flex-col items-center gap-6">
          <GridCard node={graph.nodes.get(ROOT_ID)!} register={register} onHover={setHoverId} />

          <div className="flex w-full max-w-[100vw] flex-row flex-wrap items-start justify-center gap-x-6 gap-y-8 overflow-x-auto px-1 pb-2">
            {gridKids.map((cid) => {
              const cn = graph.nodes.get(cid)
              if (!cn || cn.type === 'meter') return null
              return (
                <div key={cid} className="flex shrink-0 flex-col items-center">
                  <LineSubtree
                    lineId={cid}
                    graph={graph}
                    childrenByParent={childrenByParent}
                    register={register}
                    onHover={setHoverId}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
