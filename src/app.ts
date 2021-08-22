import _ from 'lodash'
import * as acuparse from './acuparse/api'
import * as radiotherm from './radiothermostat/api'
import { logError, msgLogger, statLogger, getSettings, ISettings } from './settings'
import { FanMode, FanState, ThermostatMode, ThermostatState } from './radiothermostat/types'
import columnify from 'columnify'
import { SmartPlug, PlugState } from './tplink/api'
import { ThermoStatFanData } from './radiothermostat/dataAccessors'

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
 * @param officePlug Office plug object
 * @param inFanState Fan state to set on the office fan.
 */
async function setOfficeFanState (officePlug: SmartPlug, inFanState: PlugState) {
  statLogger.info(`Changing office fan mode to ${PlugState[inFanState]}`)
  await officePlug.setPlugState(inFanState)
}

/**
 * Determines the current operating fan state of the office fan.
 *
 * @param officePlug Office plug object
 */
async function getOfficeFanState (officePlug: SmartPlug): Promise<PlugState> {
  return await officePlug.getState()
}

/**
 * Runs code that prints out the current thermostat state, and determines if the fan state should be changed.
 *
 * @param settings Script settings
 * @param officeTemperature Current office temperature
 */
async function checkAndSetThermostat (settings: ISettings, officeTemperature: number) {
  // Lookup the thermostat state.
  const tstat = await radiotherm.getThermostatState()
  msgLogger.info(`Current thermostat mode: ${ThermostatMode[tstat.tmode]}`)
  msgLogger.info(`Current thermostat state: ${ThermostatState[tstat.tstate]}`)
  msgLogger.info(`Current cool setpoint:\t${tstat.t_cool ?? '<disabled>'}`)
  msgLogger.info(`Current temperature:\t${tstat.temp}`)
  msgLogger.info(`Fan mode ${FanMode[tstat.fmode]}`)
  msgLogger.info(`Fan state ${FanState[tstat.fstate]}`)

  if (!(await ThermoStatFanData.checkForDeviation())) {
    if (tstat.tmode === ThermostatMode.Cool) {
      const tempDiff = _.round(officeTemperature - (tstat.t_cool ?? officeTemperature), 2)
      msgLogger.info(`Currently office is ${tempDiff} warmer than the setpoint`)

      // Check & set the whole house fan
      if (tempDiff >= settings.radioTherm.temperatureDiff) {
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
 *
 * @param settings Script settings
 * @param officeTemperature Current office temperature.
 */
async function checkAndSetOfficeFan (settings: ISettings, officeTemperature: number) {
  const officePlug = new SmartPlug(settings.tplink.officeFanAddress)

  if (!(await officePlug.checkForDeviation())) {
    const officeFanState = await getOfficeFanState(officePlug)
    if (officeTemperature >= settings.tplink.officeTempThreshold) {
      if (officeFanState === PlugState.Off) {
        await setOfficeFanState(officePlug, PlugState.On)
      } else {
        msgLogger.info(`No changes needed to office fan state. Leaving fan set to ${PlugState[officeFanState]}`)
      }
    } else if (officeFanState === PlugState.On) {
      await setOfficeFanState(officePlug, PlugState.Off)
    } else {
      msgLogger.info(`No changes needed to office fan state. Leaving fan set to ${PlugState[officeFanState]}`)
    }
  } else {
    msgLogger.info(`Office fan is currently overridden to ${PlugState[await officePlug.getState()]} for the next ${await officePlug.getRemainingDeviationMinutes()} minutes`)
  }
}

/**
 * Runs the process of checking temperatures, and seeing if we should change the fan state.
 *
 * @param settings Script settings
 */
async function runScript (settings: ISettings) {
  acuparse.Settings.apiHost = settings.acuparse.hostname
  radiotherm.Settings.apiHost = settings.radioTherm.hostname

  // Print out some general temperature data from around the house
  const office = await acuparse.getTower(settings.acuparse.officeTowerID)
  const dining = await acuparse.getTower(settings.acuparse.diningTowerID)
  const bedroom = await acuparse.getTower(settings.acuparse.bedroomTowerID)

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
    await checkAndSetThermostat(settings, officeTemperature)
  } catch (err) {
    logError('Failed to check or set thermostat state.', err)
  }

  try {
    await checkAndSetOfficeFan(settings, officeTemperature)
  } catch (err) {
    logError('Failed to check or set office fan state.', err)
  }
  // Check & set the office fan.
}

// Kicks off the process & handles any errors.
getSettings()
  .then((settings) => runScript(settings))
  .catch((err) => {
    msgLogger.error(err)
  })
