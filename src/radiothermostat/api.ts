import { FanMode, IThermostat } from './types'
import { URLSearchParams } from 'url'
import got from 'got'

export interface ISettings {
    /**
     * API Host address
     */
    apiHost: string,
}

export const Settings = <ISettings>{}

async function _runGetRequest (apiMethod: string, queryParams?: string | Record<string, string | number | boolean | null | undefined> | URLSearchParams): Promise<any> {
  return got(`${Settings.apiHost}/${apiMethod}`, { searchParams: queryParams }).json()
}

async function _runPostRequest (apiMethod: string, bodyParams: object, queryParams?: string | Record<string, string | number | boolean | null | undefined> | URLSearchParams): Promise<any> {
  return got.post(`${Settings.apiHost}/${apiMethod}`, { json: bodyParams, searchParams: queryParams }).json()
}

export async function getThermostatState (): Promise<IThermostat> {
  return _runGetRequest('tstat')
}

export async function setFanMode (inFanMode: FanMode) {
  await _runPostRequest('tstat', { fmode: inFanMode })
}
