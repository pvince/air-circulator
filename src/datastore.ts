import { FanMode } from './radiothermostat/types'
import { PlugState } from './tplink/api'
import fs from 'fs-extra'

export interface IHouseFanData {
  expectedMode: FanMode,
  deviationDate: Date
}

export interface ISwitchStateData {
  expectedState: PlugState,
  deviationDate: Date
}

export interface IDataStore {
  houseFan: IHouseFanData | null,
  officeFan: ISwitchStateData | null
}

let dataStore = <IDataStore|null> null
const DATASTORE_FILENAME = 'air-circulator-data.json'

export async function saveData () {
  await fs.writeJson(DATASTORE_FILENAME, dataStore)
}

export async function loadData (): Promise<IDataStore|null> {
  if (dataStore === null) {
    if (fs.existsSync(DATASTORE_FILENAME)) {
      dataStore = await fs.readJson(DATASTORE_FILENAME)
    } else {
      dataStore = {
        houseFan: null,
        officeFan: null
      }
    }
  }
  return dataStore
}
