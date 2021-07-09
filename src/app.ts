import got from 'got'
import { ITowerListResult } from './types/AcuparseTypes'
import { FanMode, FanState, IThermostat, ThermostatMode, ThermostatState } from './types/RadioThermTypes'

const _ = require('lodash')

const acuparseURL = 'http://192.168.1.126'
const officeTower = '00015652'
const diningTower = '00002056'
const radiothermostatURL = 'http://192.168.1.235'

/**
 * Max temperature differential between the two specified locations. If the temperature differential is above this
 * we will turn on the whole house fan.
 */
const MAX_TEMPERATURE_DIFF = 6

/**
 * Returns the current temperature being reported to acuparse by the specified 'tower'.
 *
 * @param towerID The Acurite Tower ID
 */
async function getAcuparseTemperature (towerID: string): Promise<number> {
  const response = await got(`${acuparseURL}/api/v1/json/tower/?id=${towerID}`)

  const towerList:ITowerListResult = JSON.parse(response.body)

  return towerList.towers[towerID].tempF
}

/**
 * Returns the office temperature as it is being reported by acuparse.
 *
 */
async function getOfficeTemperature (): Promise<number> {
  return getAcuparseTemperature(officeTower)
}

/**
 *
 */
async function getDiningRoomThermostat (): Promise<IThermostat> {
  const response = await got(`${radiothermostatURL}/tstat`)

  return JSON.parse(response.body)
}

async function setHouseFanMode (inFanMode: FanMode) {
  console.log(`Changing fan mode to ${FanMode[inFanMode]}`)

  const param = {
    fmode: inFanMode
  }

  await got.post(`${radiothermostatURL}/tstat`, { json: param })
}

async function test () {
  const officeTemperature = await getOfficeTemperature()
  console.log(`Office temperature:\t${officeTemperature}`)

  const diningTemperature = await getAcuparseTemperature(diningTower)
  console.log(`Dining temperature:\t${diningTemperature}`)

  const tstat = await getDiningRoomThermostat()
  console.log(`Current thermostat mode: ${ThermostatMode[tstat.tmode]}`)
  console.log(`Current thermostat state: ${ThermostatState[tstat.tstate]}`)
  console.log(`Current cool setpoint:\t${tstat.t_cool}`)
  console.log(`Current temperature:\t${tstat.temp}`)
  console.log(`Fan mode ${FanMode[tstat.fmode]}`)
  console.log(`Fan state ${FanState[tstat.fstate]}`)

  if (tstat.tmode === ThermostatMode.Cool) {
    const tempDiff = _.round(officeTemperature - tstat.t_cool, 2)
    console.log(`Currently office is ${tempDiff} warmer than the setpoint`)

    if (tempDiff >= MAX_TEMPERATURE_DIFF && tstat.fmode !== FanMode.On) {
      await setHouseFanMode(FanMode.On)
    } else if (tstat.fmode !== FanMode.Circulate) {
      await setHouseFanMode(FanMode.Circulate)
    } else {
      console.log('No changes needed to fan state.')
    }
  }
}

test()
