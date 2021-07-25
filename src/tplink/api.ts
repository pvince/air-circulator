import { Client } from 'tplink-smarthome-api'
import { DataStoreAccessor } from '../datastore'

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
