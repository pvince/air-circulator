import { Client } from 'tplink-smarthome-api'
import { DataStoreAccessor } from '../datastore'
import { AnyDevice } from 'tplink-smarthome-api/lib/client'

/**
 * Declares an enum that can be used to toggle the plug state.
 */
export enum PlugState {
  // eslint-disable-next-line no-unused-vars
  Off,

  // eslint-disable-next-line no-unused-vars
  On
}

/**
 * A helper class that wraps up the 'Smart Plug' functionality.
 */
export class SmartPlug extends DataStoreAccessor {
  /**
   * IP Address for the plug
   */
  address: string

  /**
   * TP-Link API object
   */
  plugClient: Client

  /**
   * Constructor
   *
   * @param inAddress - IP Address for the plug to control
   */
  constructor (inAddress: string) {
    super()
    this.address = inAddress
    this.plugClient = new Client()
  }

  dataName (): string {
    return this.address
  }

  /**
   * Returns the plugs 'state' (Is it on, or is it off)
   */
  async getState (): Promise<PlugState> {
    const plugDevice = await this.plugClient.getDevice({ host: this.address })

    return (await plugDevice.getPowerState()) ? PlugState.On : PlugState.Off
  }

  /**
   * Sets the plugs 'state' (turns it off or on)
   * @param inPlugState
   */
  async setPlugState (inPlugState: PlugState) {
    const plugDevice = await this.plugClient.getDevice({ host: this.address })

    await plugDevice.setPowerState(inPlugState === PlugState.On)
    await this.storeState()
  }
}

/**
 * Optional parameters for finding devices.
 */
export interface IFindDevicesOptions {
  /**
   * How long should we search (in seconds) for devices? (Default: 60 seconds)
   */
  discoveryPeriod?: number,
  /**
   * Callback that delivers progress updates. (Default: no-op)
   *
   * @param total Total time (milliseconds)
   * @param current Current elapsed time (milliseconds)
   * @param deviceCount How many devices have been found so far?
   */
  progress?: (total: number, current: number, deviceCount: number) => void,
  /**
   * Network mask passed forward to the TP-link API. (Default: 192.168.1.255
   */
  broadcast?: string
}

/**
 * Searches the network for TP-link devices.
 *
 * @param options - Optional configuration
 */
export async function findDevices (options?: IFindDevicesOptions): Promise<AnyDevice[]> {
  // noinspection JSUnusedLocalSymbols
  const status = options?.progress ?? function (total: number, current: number, deviceCount: number): void {}
  const discoveryPeriod = options?.discoveryPeriod ?? 60
  const broadcast = options?.broadcast ?? '192.168.1.255'

  const client = new Client()

  const results = <AnyDevice[]>[]

  const startTime = new Date()
  let currentTime = startTime
  const endTime = (new Date(startTime.getTime() + discoveryPeriod * 1000))

  client.startDiscovery({ broadcast: broadcast }).on('device-new', async (device) => {
    results.push(device)
  })

  while (currentTime < endTime) {
    status(discoveryPeriod * 1000, currentTime.getTime() - startTime.getTime(), results.length)

    await new Promise(resolve => setTimeout(resolve, 500))

    currentTime = new Date()
  }

  client.stopDiscovery()

  return results
}
