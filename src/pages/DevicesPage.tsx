import { useDevices } from '../hooks/queries'
import { Badge } from '../components/ui/Badge'

export function DevicesPage() {
  const devicesQ = useDevices()
  const devices = devicesQ.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          Devices
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Connected meters, breakers, PLCs, and gateways.
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Protocol</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Poll</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">
                      {d.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {d.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {d.manufacturer} {d.model}
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      FW {d.firmwareVersion}
                      {d.meterId ? ` · meter ${d.meterId}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {d.protocol}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {d.address}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      color={
                        d.status === 'connected'
                          ? 'green'
                          : d.status === 'error'
                            ? 'red'
                            : 'slate'
                      }
                    >
                      {d.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                    {d.lastPollAt ? new Date(d.lastPollAt).toLocaleString() : '--'}
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    {devicesQ.isLoading ? 'Loading devices...' : 'No devices found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

