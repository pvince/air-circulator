import { FanMode } from './radiothermostat/types'
import { PlugState } from './tplink/api'
import fs from 'fs-extra'

export interface IDeviationData {
  expectedData: any,
  deviationDate: Date | null
}

export interface IDataStore {
  [index: string]: IDeviationData | null
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

abstract class DataStoreAccessor {
  abstract dataName(): string

  _getDeviationDifference (devData: IDeviationData | null): number {
    const deviationTime = devData?.deviationDate?.getTime()

    return deviationTime ? ((new Date()).getTime() - deviationTime) / 1000 / 60 : 0
  }

  async checkForDeviation<Type> (inCondition: Type): Promise<boolean> {
    const savedData = await loadData()

    let result = false

    if (savedData !== null) {
      const previousData = savedData[this.dataName()]
      if (previousData !== null) {
        if (previousData.expectedData !== inCondition) {
          // Current conditions do not match previously saved data.
          if (previousData.deviationDate === null) {
            result = true
            previousData.deviationDate = new Date()
          } else if (this._getDeviationDifference(previousData) <= 120) {
            result = true
          } else if (previousData.deviationDate) {
            previousData.deviationDate = null
          }
        }
      }
    }

    return result
  }

  async storeData
}
