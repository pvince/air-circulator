/**
 * Acuparse API settings
 */
import { IMain, IMainResult, ITower, ITowerListResult, MAIN_TOWER_ID } from './types';
import got from 'got';
import { URLSearchParams } from 'url';

export interface ISettings {
    /**
     * API Host address
     */
    apiHost: string;
}

const API_SUB_PATH = '/api/v1/json';

export const acuparseSettings:ISettings = {
  apiHost: ''
};

/**
 * Runs a get request against the acuparse API
 *
 * @param apiMethod - API method to run
 * @param queryParams - Query level parameters
 */
async function _runGetRequest (apiMethod: string, queryParams?: string | Record<string, string | number | boolean | null | undefined> | URLSearchParams): Promise<any> {
  return got(`${acuparseSettings.apiHost}/${API_SUB_PATH}/${apiMethod}`, { searchParams: queryParams }).json();
}

/**
 * Returns Tower data.
 *
 * @param towerID - TowerID string
 * @returns - Returns tower data
 */
async function getTower (towerID: string): Promise<ITower> {
  let towerResult:ITower;

  if (towerID === MAIN_TOWER_ID) {
    // We are working with the 'main' tower, lets get it using its special API.
    towerResult = await getMain();
  } else {
    // We are working with any other tower, lets get it using the standard API.
    const towerList:ITowerListResult = await _runGetRequest('tower', { id: towerID });
    towerResult = towerList.towers[towerID];
  }

  return towerResult;
}

/**
 * Looks up information about the 'Main' tower. The 'Main' tower is typically a 5-in-1 device.
 *
 * @returns - Returns 'Main' tower information
 */
async function getMain (): Promise<IMain> {
  const mainResult:IMainResult = await _runGetRequest('dashboard', 'main');

  mainResult.main.name = 'Outside';

  return mainResult.main;
}

/**
 * Ma
 */
export const acuparse = {
  getTower,
  getMain
};
