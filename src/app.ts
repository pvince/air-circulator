import got from 'got'
import { ITowerListResult } from './types/AcuparseTypes'
import { FanMode, FanState, IThermstat, ThermoStatMode, ThermostatState } from './types/RadioThermTypes'

const acuparseURL = 'http://192.168.1.126'
const officeTower = '00015652'
const diningTower = '00002056'
const radiothermostatURL = 'http://192.168.1.235'

async function GetAcuparseTemperature (towerID: string): Promise<number> {
  const response = await got(`${acuparseURL}/api/v1/json/tower/?id=${towerID}`)

  const towerList:ITowerListResult = JSON.parse(response.body)

  return towerList.towers[towerID].tempF
}

async function GetOfficeTemperature (): Promise<number> {
  return GetAcuparseTemperature(officeTower)
}

async function GetDiningRoomThermostat (): Promise<IThermstat> {
  const response = await got(`${radiothermostatURL}/tstat`)

  const tstat:IThermstat = JSON.parse(response.body)

  return tstat
}

async function SetHouseFanMode (fanMode: FanMode) {
  const param = {
    fmode: fanMode
  }

  await got.post(`${radiothermostatURL}/tstat`, { json: param })
}

async function Test () {
  const officeTemperature = await GetOfficeTemperature()
  console.log(officeTemperature)

  const diningTemperature = await GetAcuparseTemperature(diningTower)
  console.log(diningTemperature)

  let tstat = await GetDiningRoomThermostat()
  console.log(`Current thermostat mode: ${ThermoStatMode[tstat.tmode]}`)
  console.log(`Current thermostat state: ${ThermostatState[tstat.tstate]}`)
  console.log(`Current cool setpoint: ${tstat.t_cool}`)
  console.log(`Current temperature: ${tstat.temp}`)
  console.log(`Fan mode ${FanMode[tstat.fmode]}`)
  console.log(`Fan state ${FanState[tstat.fstate]}`)

  console.log('Changing fan mode to On?')
  await SetHouseFanMode(FanMode.On)
  tstat = await GetDiningRoomThermostat()
  console.log(`Fan mode ${FanMode[tstat.fmode]}`)

  console.log('Changing fan mode to Circulate?')
  await SetHouseFanMode(FanMode.Circulate)
  tstat = await GetDiningRoomThermostat()
  console.log(`Fan mode ${FanMode[tstat.fmode]}`)
}

Test()
