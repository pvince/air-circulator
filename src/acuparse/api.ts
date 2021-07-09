/**
 * Acuparse API settings
 */
import { ITower, ITowerListResult } from './types'
import got from 'got'
import { URLSearchParams } from 'url'

export interface ISettings {
    /**
     * API Host address
     */
    apiHost: string,
}

const API_SUB_PATH = '/api/v1/json'

export const Settings = <ISettings>{}

async function _runGetRequest (apiMethod: string, queryParams?: string | Record<string, string | number | boolean | null | undefined> | URLSearchParams): Promise<any> {
  return got(`${Settings.apiHost}/${API_SUB_PATH}/${apiMethod}`, { searchParams: queryParams }).json()
}

export async function getTower (towerID: string): Promise<ITower> {
  const towerList:ITowerListResult = await _runGetRequest('tower', { id: towerID })

  return towerList.towers[towerID]
}
