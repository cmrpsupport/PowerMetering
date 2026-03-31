import type { Device } from '../../types'
import { minutesAgo, sleep } from './helpers'

const devices: Device[] = [
  {
    id: 'dev-101',
    name: 'EMU Main Line',
    manufacturer: 'Siemens',
    model: 'SENTRON PAC / EMU',
    protocol: 'opc',
    address: 'PLC DB16',
    status: 'connected',
    lastPollAt: minutesAgo(0.1),
    meterId: 'plc-line-10',
    firmwareVersion: '—',
  },
  {
    id: 'dev-102',
    name: 'Cracker Line 2 EMU',
    manufacturer: 'Siemens',
    model: 'SENTRON PAC / EMU',
    protocol: 'opc',
    address: 'PLC DB16',
    status: 'connected',
    lastPollAt: minutesAgo(0.1),
    meterId: 'plc-line-02',
    firmwareVersion: '—',
  },
  {
    id: 'dev-103',
    name: 'Pretzel Line EMU',
    manufacturer: 'Siemens',
    model: 'SENTRON PAC / EMU',
    protocol: 'opc',
    address: 'PLC DB16',
    status: 'connected',
    lastPollAt: minutesAgo(0.2),
    meterId: 'plc-line-03',
    firmwareVersion: '—',
  },
  {
    id: 'dev-104',
    name: 'Wafer Line 1 EMU',
    manufacturer: 'Siemens',
    model: 'SENTRON PAC / EMU',
    protocol: 'opc',
    address: 'PLC DB16',
    status: 'connected',
    lastPollAt: minutesAgo(0.15),
    meterId: 'plc-line-04',
    firmwareVersion: '—',
  },
  {
    id: 'dev-105',
    name: 'Utilities Lighting EMU',
    manufacturer: 'Siemens',
    model: 'SENTRON PAC / EMU',
    protocol: 'opc',
    address: 'PLC DB16',
    status: 'connected',
    lastPollAt: minutesAgo(0.4),
    meterId: 'plc-line-12',
    firmwareVersion: '—',
  },
]

export async function mockListDevices(): Promise<Device[]> {
  await sleep(150)
  return devices.map((d) => ({ ...d }))
}

export async function mockGetDevice(deviceId: string): Promise<Device | null> {
  await sleep(100)
  const d = devices.find((x) => x.id === deviceId)
  return d ? { ...d } : null
}
