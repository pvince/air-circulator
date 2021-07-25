import { DataStoreAccessor } from '../datastore'
import { getThermostatState } from './api'

class RadioThermoFanModeDataAccessor extends DataStoreAccessor {
  name: string

  constructor (inName: string) {
    super()
    this.name = inName
  }

  dataName (): string {
    return this.name
  }

  async getState (): Promise<any> {
    const tstat = await getThermostatState()

    return tstat.fmode
  }
}

export const ThermoStatFanData = new RadioThermoFanModeDataAccessor('houseFan')
