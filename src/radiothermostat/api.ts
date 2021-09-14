import { FanMode, IThermostat } from './types';
import { URLSearchParams } from 'url';
import got from 'got';
import { ThermoStatFanData } from './dataAccessors';

export interface ISettings {
    /**
     * API Host address
     */
    apiHost: string;
}

export const Settings:ISettings = {
  apiHost: ''
};

/**
 * Runs a get request against the API.
 *
 * @param apiMethod - API Method that will be run (Example: 'tstat')
 * @param queryParams - Query level parameters to include
 */
async function _runGetRequest (apiMethod: string, queryParams?: string | Record<string, string | number | boolean | null | undefined> | URLSearchParams): Promise<any> {
  return got(`${Settings.apiHost}/${apiMethod}`, { searchParams: queryParams }).json();
}

/**
 * Runs a POST request against the API.
 *
 * @param apiMethod - API method to run
 * @param bodyParams - Body parameters to send
 * @param queryParams - Query parameters to include.
 */
async function _runPostRequest (apiMethod: string, bodyParams: object, queryParams?: string | Record<string, string | number | boolean | null | undefined> | URLSearchParams): Promise<any> {
  return got.post(`${Settings.apiHost}/${apiMethod}`, { json: bodyParams, searchParams: queryParams }).json();
}

/**
 * Find the current thermostat's state.
 *
 * @returns - Returns thermostat state information
 */
export async function getThermostatState (): Promise<IThermostat> {
  return _runGetRequest('tstat');
}

/**
 * Sets the fan mode.
 *
 * @param inFanMode - Should the fan be on or off?
 */
export async function setFanMode (inFanMode: FanMode) {
  await _runPostRequest('tstat', { fmode: inFanMode });
  await ThermoStatFanData.storeState();
}
