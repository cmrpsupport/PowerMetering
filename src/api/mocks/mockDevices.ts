import type { Device } from '../../types'
import { minutesAgo, sleep } from './helpers'

const devices: Device[] = [
  {
    id: 'dev-101',
    name: 'PM5350 MAIN LINE',
    manufacturer: 'Schneider Electric',
    model: 'PowerLogic PM5350',
    protocol: 'modbus-tcp',
    address: '192.168.10.101:502',
    status: 'connected',
    lastPollAt: minutesAgo(0.1),
    meterId: 'mtr-101',
    firmwareVersion: 'v2.0.8',
  },
  {
    id: 'dev-102',
    name: 'PM5340 MDP3EM6400A',
    manufacturer: 'Schneider Electric',
    model: 'PowerLogic PM5340',
    protocol: 'modbus-tcp',
    address: '192.168.10.102:502',
    status: 'connected',
    lastPollAt: minutesAgo(0.1),
    meterId: 'mtr-102',
    firmwareVersion: 'v2.0.8',
  },
  {
    id: 'dev-103',
    name: 'ABB M4M PPBSF',
    manufacturer: 'ABB',
    model: 'M4M 30',
    protocol: 'modbus-rtu',
    address: 'COM4:1',
    status: 'connected',
    lastPollAt: minutesAgo(0.2),
    meterId: 'mtr-104',
    firmwareVersion: 'v1.4.2',
  },
  {
    id: 'dev-104',
    name: 'Siemens PAC3200 PPASF',
    manufacturer: 'Siemens',
    model: 'SENTRON PAC3200',
    protocol: 'modbus-tcp',
    address: '192.168.10.105:502',
    status: 'connected',
    lastPollAt: minutesAgo(0.15),
    meterId: 'mtr-105',
    firmwareVersion: 'v3.1.0',
  },
  {
    id: 'dev-105',
    name: 'Schneider PM8000 SLITTER',
    manufacturer: 'Schneider Electric',
    model: 'PowerLogic PM8000',
    protocol: 'modbus-tcp',
    address: '192.168.10.118:502',
    status: 'connected',
    lastPollAt: minutesAgo(0.4),
    meterId: 'mtr-118',
    firmwareVersion: 'v3.0.2',
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
