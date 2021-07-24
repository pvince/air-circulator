import { Client } from 'tplink-smarthome-api'

export enum PlugState {
  Off,
  On
}

export class KazaPlug {
  address: string
  plugClient: Client

  constructor (inAddress: string) {
    this.address = inAddress
    this.plugClient = new Client()
  }

  async getState (): Promise<PlugState> {
    const plugDevice = await this.plugClient.getDevice({ host: this.address })

    return (await plugDevice.getPowerState()) ? PlugState.On : PlugState.Off
  }

  async setPlugState (inPlugState: PlugState) {
    const plugDevice = await this.plugClient.getDevice({ host: this.address })

    await plugDevice.setPowerState(inPlugState === PlugState.On)
  }
}
