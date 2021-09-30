import fs from 'fs-extra';
import _ from 'lodash';
/**
 * Data used to detect deviation from a set value.
 */
export interface IDeviationData {
  expectedData: any;
  deviationDate: Date | null;
}

/**
 * Data storage object definition
 */
export interface IDataStore {
  [index: string]: IDeviationData | null;
}

/**
 * Data storage object
 */
let dataStore: IDataStore | null = null;

/**
 * Data storage filename
 */
const DATASTORE_FILENAME = 'air-circulator-data.json';

/**
 * Stores the cached data storage object into a file
 */
export async function saveData () {
  await fs.writeJson(DATASTORE_FILENAME, dataStore, { spaces: 2 });
}

/**
 * Loads data from the storage file into cache.
 */
export async function loadData (): Promise<IDataStore> {
  if (dataStore === null) {
    if (fs.existsSync(DATASTORE_FILENAME)) {
      dataStore = await fs.readJson(DATASTORE_FILENAME);
    }
  }
  dataStore = dataStore ?? {};

  return dataStore;
}

/**
 * Returns either the current stored data for a specific key, or null if no data exists.
 * @param inKey Key to retrieve data for.
 */
export async function getDeviationData (inKey: string): Promise<IDeviationData|null> {
  const storedData = await loadData();
  return storedData[inKey] ?? null;
}

/**
 * Stores the provided deviation into the data store.
 *
 * @param inKey Key to the data to save
 * @param inData Deviation data object to save.
 */
export async function setDeviationData (inKey: string, inData: IDeviationData) {
  const savedData = await loadData();
  savedData[inKey] = inData;
  await saveData();
}

/**
 * Stores a specific value into the data cache.
 * @param inKey Data access key
 * @param inData Data to store
 */
export async function setData<Type> (inKey: string, inData: Type) {
  const previousReading = await getDeviationData(inKey);
  if (previousReading === null) {
    await setDeviationData(inKey, {
      expectedData: inData,
      deviationDate: null
    });
  } else {
    previousReading.expectedData = inData;
  }
}

/**
 * Max time that we should a allow a setting to deviate.
 */
const DEVIATION_LIMIT = 60;

/**
 * Abstract class that can be implemented by specific data providers to store data into the cached file
 */
export abstract class DataStoreAccessor {
  /**
   * Name used to store this data into cache
   */
  abstract dataName(): string;

  /**
   * Gets the current state of the item we are tracking.
   */
  abstract getState(): Promise<any>;

  /**
   * If there is a deviation time stored, this determines how long ago it happened in minutes.
   *
   * @param devData Deviation data to check
   * @returns - Returns how long ago in minutes the deviation was noticed.
   * @private
   */
  _getDeviationDifference (devData: IDeviationData | null): number {
    if (_.isString(devData?.deviationDate)) {
      // @ts-ignore
      devData.deviationDate = new Date(devData.deviationDate);
    }
    const deviationTime = devData?.deviationDate?.getTime();

    return deviationTime ? Math.ceil(((new Date()).getTime() - deviationTime) / 1000 / 60) : 0;
  }

  /**
   * If there is an active deviation data with a deviation date, find out how much longer it is active, in minutes.
   */
  async getRemainingDeviationMinutes (): Promise<number> {
    const deviationData = await getDeviationData(this.dataName());
    return DEVIATION_LIMIT - this._getDeviationDifference(deviationData);
  }

  /**
   * Checks to see if the provided data represents a 'deviation'.
   *
   * @returns Returns true if we are in an active 'deviation' state, false otherwise.
   */
  async checkForDeviation (): Promise<boolean> {
    const currentState = await this.getState();

    let result = false;

    const previousData = await getDeviationData(this.dataName());
    if (previousData !== null) {
      if (previousData.expectedData !== currentState) {
        // Current conditions do not match previously saved data.
        if (previousData.deviationDate === null) {
          // Previous data does not have a 'deviation time', this is the first time
          // the deviation has been detected.
          result = true;
          previousData.deviationDate = new Date();
          await saveData();
        } else if (this._getDeviationDifference(previousData) <= DEVIATION_LIMIT) {
          // We have previously detected the deviation, but it occurred in the last 60 minutes
          // so continue to report that we are in a deviation state.
          result = true;
        } else if (previousData.deviationDate) {
          // There is currently a deviation state, we had previously detected the state, however
          // it has been more than 60 minutes since this state was detected. Clear our deviation data
          // and say we are ready to allow state changes again.
          previousData.deviationDate = null;
          await this.storeState();
        }
      }
    } else {
      // Looks like we didn't have a stored state, store one now.
      await this.storeState();
    }

    return result;
  }

  /**
   * Ensures our current state data gets written to the saved data
   */
  async storeState () {
    const currentState = await this.getState();
    await setData(this.dataName(), currentState);
    await saveData();
  }
}
