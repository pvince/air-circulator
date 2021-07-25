import fs from 'fs-extra'
import _ from 'lodash'
/**
 * Data used to detect deviation from a set value.
 */
export interface IDeviationData {
  expectedData: any,
  deviationDate: Date | null
}

/**
 * Data storage object definition
 */
export interface IDataStore {
  [index: string]: IDeviationData | null
}

/**
 * Data storage object
 */
let dataStore = <IDataStore|null> null

/**
 * Data storage filename
 */
const DATASTORE_FILENAME = 'air-circulator-data.json'

/**
 * Stores the cached data storage object into a file
 */
export async function saveData () {
  await fs.writeJson(DATASTORE_FILENAME, dataStore)
}

/**
 * Loads data from the storage file into cache.
 */
export async function loadData (): Promise<IDataStore> {
  if (dataStore === null) {
    if (fs.existsSync(DATASTORE_FILENAME)) {
      dataStore = await fs.readJson(DATASTORE_FILENAME)
    }
  }
  dataStore = dataStore ?? {}

  return dataStore
}

/**
 * Stores a specific value into the data cache.
 * @param inKey Data access key
 * @param inData Data to store
 */
export async function setData<Type> (inKey: string, inData: Type) {
  const savedData = await loadData()
  const previousReading = savedData[inKey] ?? null
  if (previousReading === null) {
    savedData[inKey] = {
      expectedData: inData,
      deviationDate: null
    }
  } else {
    previousReading.expectedData = inData
  }
}

/**
 * Abstract class that can be implemented by specific data providers to store data into the cached file
 */
export abstract class DataStoreAccessor {
  /**
   * Name used to store this data into cache
   */
  abstract dataName(): string

  /**
   * Gets the current state of the item we are tracking.
   */
  abstract getState(): Promise<any>

  /**
   * If there is a deviation time stored, this determines how long ago it happened in minutes.
   * @param devData Deviation data to check
   * @private
   */
  _getDeviationDifference (devData: IDeviationData | null): number {
    if (_.isString(devData?.deviationDate)) {
      // @ts-ignore
      devData.deviationDate = new Date(devData.deviationDate)
    }
    const deviationTime = devData?.deviationDate?.getTime()

    return deviationTime ? ((new Date()).getTime() - deviationTime) / 1000 / 60 : 0
  }

  /**
   * Checks to see if the provided data represents a 'deviation'.
   *
   * @returns Returns true if we are in an active 'deviation' state, false otherwise.
   */
  async checkForDeviation (): Promise<boolean> {
    const savedData = await loadData()
    const currentState = await this.getState()

    let result = false

    const previousData = savedData[this.dataName()] ?? null
    if (previousData !== null) {
      if (previousData.expectedData !== currentState) {
        // Current conditions do not match previously saved data.
        if (previousData.deviationDate === null) {
          // Previous data does not have a 'deviation time', this is the first time
          // the deviation has been detected.
          result = true
          previousData.deviationDate = new Date()
          await saveData()
        } else if (this._getDeviationDifference(previousData) <= 60) {
          // We have previously detected the deviation, but it occurred in the last 60 minutes
          // so continue to report that we are in a deviation state.
          result = true
        } else if (previousData.deviationDate) {
          // There is currently a deviation state, we had previously detected the state, however
          // it has been more than 60 minutes since this state was detected. Clear our deviation data
          // and say we are ready to allow state changes again.
          previousData.deviationDate = null
        }
      }
    } else {
      // Looks like we didn't have a stored state, store one now.
      await this.storeState()
    }

    return result
  }

  /**
   * Ensures our current state data gets written to the saved data
   */
  async storeState () {
    const currentState = await this.getState()
    await setData(this.dataName(), currentState)
    await saveData()
  }
}
