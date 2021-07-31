import _ from 'lodash'
import * as acuparse from './acuparse/api'
import * as radiotherm from './radiothermostat/api'
import { logError, msgLogger, statLogger } from './settings'
import { FanMode, FanState, ThermostatMode, ThermostatState } from './radiothermostat/types'
import columnify from 'columnify'
import { SmartPlug, PlugState } from './tplink/api'
import { ThermoStatFanData } from './radiothermostat/dataAccessors'

// Setup the API hosts for the acuparse & radio thermostat
acuparse.Settings.apiHost = 'http://192.168.1.126'
radiotherm.Settings.apiHost = 'http://192.168.1.235'
const officePlug = new SmartPlug('192.168.1.100')

/**
 * Max temperature differential between the two specified locations. If the temperature differential is above this
 * we will turn on the whole house fan.
 */
const MAX_TEMPERATURE_DIFF = 6

/**
 * Temperature at which the small office fan will be toggled on // off
 */
const OFFICE_TEMPERATURE_THRESHOLD = 77

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
  statLogger.info(`Changing fan mode to ${FanMode[inFanMode]}`)
  await radiotherm.setFanMode(inFanMode)
}

/**
 * Changes the office fan state, re-uses the RadioThermostat constants for fan state.
 *
 * @param inFanState Fan state to set on the office fan.
 */
async function setOfficeFanState (inFanState: PlugState) {
  statLogger.info(`Changing office fan mode to ${PlugState[inFanState]}`)
  await officePlug.setPlugState(inFanState)
}

/**
 * Determines the current operating fan state of the office fan.
 */
async function getOfficeFanState (): Promise<PlugState> {
  return await officePlug.getState()
}

/**
 * Runs code that prints out the current thermostat state, and determines if the fan state should be changed.
 * @param officeTemperature Current office temperature
 */
async function checkAndSetThermostat (officeTemperature: number) {
  // Lookup the thermostat state.
  const tstat = await radiotherm.getThermostatState()
  msgLogger.info(`Current thermostat mode: ${ThermostatMode[tstat.tmode]}`)
  msgLogger.info(`Current thermostat state: ${ThermostatState[tstat.tstate]}`)
  msgLogger.info(`Current cool setpoint:\t${tstat.t_cool}`)
  msgLogger.info(`Current temperature:\t${tstat.temp}`)
  msgLogger.info(`Fan mode ${FanMode[tstat.fmode]}`)
  msgLogger.info(`Fan state ${FanState[tstat.fstate]}`)

  if (!(await ThermoStatFanData.checkForDeviation())) {
    if (tstat.tmode === ThermostatMode.Cool) {
      const tempDiff = _.round(officeTemperature - tstat.t_cool, 2)
      msgLogger.info(`Currently office is ${tempDiff} warmer than the setpoint`)

      // Check & set the whole house fan
      if (tempDiff >= MAX_TEMPERATURE_DIFF) {
        if (tstat.fmode !== FanMode.On) {
          await setHouseFanMode(FanMode.On)
        } else {
          msgLogger.info(`No changes needed to fan state. Leaving fan set to ${FanMode[tstat.fmode]}`)
        }
      } else if (tstat.fmode !== FanMode.Circulate) {
        await setHouseFanMode(FanMode.Circulate)
      } else {
        msgLogger.info(`No changes needed to house fan state. Leaving fan set to ${FanMode[tstat.fmode]}`)
      }
    }
  } else {
    msgLogger.info(`Fan mode is currently overridden to ${FanMode[tstat.fmode]} for the next ${await ThermoStatFanData.getRemainingDeviationMinutes()} minutes.`)
  }
}

/**
 * Checks the current fan state in the office and determines if it should be turned on or off.
 * @param officeTemperature Current office temperature.
 */
async function checkAndSetOfficeFan (officeTemperature: number) {
  if (!(await officePlug.checkForDeviation())) {
    const officeFanState = await getOfficeFanState()
    if (officeTemperature >= OFFICE_TEMPERATURE_THRESHOLD) {
      if (officeFanState === PlugState.Off) {
        await setOfficeFanState(PlugState.On)
      } else {
        msgLogger.info(`No changes needed to office fan state. Leaving fan set to ${PlugState[officeFanState]}`)
      }
    } else if (officeFanState === PlugState.On) {
      await setOfficeFanState(PlugState.Off)
    } else {
      msgLogger.info(`No changes needed to office fan state. Leaving fan set to ${PlugState[officeFanState]}`)
    }
  } else {
    msgLogger.info(`Office fan is currently overridden to ${PlugState[await officePlug.getState()]} for the next ${await officePlug.getRemainingDeviationMinutes()} minutes`)
  }
}

/**
 * Runs the process of checking temperatures, and seeing if we should change the fan state.
 */
async function runScript () {
  // Print out some general temperature data from around the house
  const office = await acuparse.getTower(officeTower)
  const dining = await acuparse.getTower(diningTower)
  const bedroom = await acuparse.getTower(bedroomTower)

  const outputData = [office, dining, bedroom]
  msgLogger.info('\n' + columnify(outputData, {
    columns: ['name', 'tempF', 'lastUpdated'],
    config: {
      lastUpdated: {
        dataTransform: (data: string) => (new Date(data)).toLocaleString()
      }
    }
  }))

  const officeTemperature = office.tempF

  // Check to see what we should do with regards to the above info.
  try {
    await checkAndSetThermostat(officeTemperature)
  } catch (err) {
    logError('Failed to check or set thermostat state.', err)
  }

  try {
    await checkAndSetOfficeFan(officeTemperature)
  } catch (err) {
    logError('Failed to check or set office fan state.', err)
  }
  // Check & set the office fan.
}

// Kicks off the process & handles any errors.
runScript()
  .catch((err) => {
    msgLogger.error(err)
  })
