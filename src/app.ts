import _ from 'lodash'
import * as acuparse from './acuparse/api'
import * as radiotherm from './radiothermostat/api'
import { FanMode, FanState, ThermostatMode, ThermostatState } from './radiothermostat/types'

// Setup the API hosts for the acuparse & radio thermostat
acuparse.Settings.apiHost = 'http://192.168.1.126'
radiotherm.Settings.apiHost = 'http://192.168.1.235'

/**
 * Acurite tower ID for the office temperature sensor
 */
const officeTower = '00015652'

/**
 * Acurite tower ID for the dining room temperature sensor.
 */
const diningTower = '00002056'

/**
 * Max temperature differential between the two specified locations. If the temperature differential is above this
 * we will turn on the whole house fan.
 */
const MAX_TEMPERATURE_DIFF = 6

async function setHouseFanMode (inFanMode: FanMode) {
  console.log(`Changing fan mode to ${FanMode[inFanMode]}`)
  await radiotherm.setFanMode(inFanMode)
}

async function runScript () {
  // Print out the current date
  console.log(`Currently: ${new Date()}`)

  // Print out some general temperature data from around the housue
  const officeTemperature = (await acuparse.getTower(officeTower)).tempF
  console.log(`Office temperature:\t${officeTemperature}`)

  const diningTemperature = (await acuparse.getTower(diningTower)).tempF
  console.log(`Dining temperature:\t${diningTemperature}`)

  // Lookup the thermostat state.
  const tstat = await radiotherm.getThermostatState()
  console.log(`Current thermostat mode: ${ThermostatMode[tstat.tmode]}`)
  console.log(`Current thermostat state: ${ThermostatState[tstat.tstate]}`)
  console.log(`Current cool setpoint:\t${tstat.t_cool}`)
  console.log(`Current temperature:\t${tstat.temp}`)
  console.log(`Fan mode ${FanMode[tstat.fmode]}`)
  console.log(`Fan state ${FanState[tstat.fstate]}`)

  // Check to see what we should do with regards to the above info.
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

runScript()
  .catch((err) => {
    console.error(`Error: ${err}`)
  })
