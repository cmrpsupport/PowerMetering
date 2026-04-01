import { useMemo } from 'react'
import { usePlcFullSnapshot, useNodeRedHealth } from '../hooks/queries'
import { buildElectricalTopology } from '../lib/electricalTopology'
import { ElectricalTopologyDiagram } from '../components/topology/ElectricalTopologyDiagram'

export function TopologyPage() {
  const snapQ = usePlcFullSnapshot()
  const healthQ = useNodeRedHealth()
  const plcUp = healthQ.data?.plcLink?.up === true

  const model = useMemo(
    () => buildElectricalTopology(snapQ.data, plcUp),
    [snapQ.data, plcUp],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Electrical Network Topology</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Hierarchical view of metered nodes and communication status.
        </p>
      </div>

      <div className="card card-hover overflow-hidden p-0">
        <div
          className={[
            'min-h-[70vh] p-4 sm:p-6 md:p-8',
            'topology-grid-bg',
          ].join(' ')}
        >
          <ElectricalTopologyDiagram model={model} />
        </div>
      </div>
    </div>
  )
}
