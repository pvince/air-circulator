/**
 * Acuparse API settings
 */
import { IMain, IMainResult, ITower, ITowerListResult, MAIN_TOWER_ID } from './types'
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
  let towerResult:ITower

  if (towerID === MAIN_TOWER_ID) {
    // We are working with the 'main' tower, lets get it using its special API.
    towerResult = await getMain()
  } else {
    // We are working with any other tower, lets get it using the standard API.
    const towerList:ITowerListResult = await _runGetRequest('tower', { id: towerID })
    towerResult = towerList.towers[towerID]
  }

  return towerResult
}

export async function getMain (): Promise<IMain> {
  const mainResult:IMainResult = await _runGetRequest('dashboard', 'main')

  mainResult.main.name = 'Outside'

  return mainResult.main
}
