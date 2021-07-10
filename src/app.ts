import _ from 'lodash'
import * as acuparse from './acuparse/api'
import * as radiotherm from './radiothermostat/api'
import { FanMode, FanState, ThermostatMode, ThermostatState } from './radiothermostat/types'
const columnify = require('columnify')

// Setup the API hosts for the acuparse & radio thermostat
acuparse.Settings.apiHost = 'http://192.168.1.126'
radiotherm.Settings.apiHost = 'http://192.168.1.235'

/**
 * Max temperature differential between the two specified locations. If the temperature differential is above this
 * we will turn on the whole house fan.
 */
const MAX_TEMPERATURE_DIFF = 6

/**
 * Acurite tower ID for the office temperature sensor
 */
const officeTower = '00015652'

/**
 * Acurite tower ID for the dining room temperature sensor.
 */
const diningTower = '00002056'

/**
 * Acurite tower ID for the bedroom temperature sensor.
 */
const bedroomTower = '00010242'

/**
 * Sets the house fan mode.
 *
 * @param inFanMode New fan mode
 */
async function setHouseFanMode (inFanMode: FanMode) {
  console.log(`Changing fan mode to ${FanMode[inFanMode]}`)
  await radiotherm.setFanMode(inFanMode)
}

/**
 * Runs the process of checking temperatures, and seeing if we should change the fan state.
 */
async function runScript () {
  // Print out the current date
  console.log(`Currently: ${new Date()}`)

  // Print out some general temperature data from around the house
  const office = await acuparse.getTower(officeTower)
  const dining = await acuparse.getTower(diningTower)
  const bedroom = await acuparse.getTower(bedroomTower)

  const outputData = [office, dining, bedroom]
  console.log(columnify(outputData, {
    columns: ['name', 'tempF', 'lastUpdated'],
    config: {
      lastUpdated: {
        dataTransform: (data: string) => (new Date(data)).toLocaleString()
      }
    }
  }))

  const officeTemperature = office.tempF

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

// Kicks off the process & handles any errors.
runScript()
  .catch((err) => {
    console.error(`Error: ${err}`)
  })
