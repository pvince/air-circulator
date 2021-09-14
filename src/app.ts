import _ from 'lodash';
import * as acuparse from './acuparse/api';
import * as radiotherm from './radiothermostat/api';
import { logError, msgLogger, statLogger, getSettings, ISettings, saveSettings, ITPLinkFanSetting } from './settings';
import { FanMode, FanState, ThermostatMode, ThermostatState } from './radiothermostat/types';
import columnify from 'columnify';
import { SmartPlug, PlugState } from './tplink/api';
import { ThermoStatFanData } from './radiothermostat/dataAccessors';
import { ITower } from './acuparse/types';

/**
 * Sets the thermostat fan mode.
 *
 * @param inFanMode New fan mode
 */
async function setThermostatFanMode (inFanMode: FanMode) {
  statLogger.info(`Changing fan mode to ${FanMode[inFanMode]}`);
  await radiotherm.setFanMode(inFanMode);
}

/**
 * Changes the office fan state, re-uses the RadioThermostat constants for fan state.
 *
 * @param plug Office plug object
 * @param inFanState Fan state to set on the office fan.
 */
async function setPlugState (plug: SmartPlug, inFanState: PlugState) {
  statLogger.info(`Changing ${plug.name} mode to ${PlugState[inFanState]}`);
  await plug.setPlugState(inFanState);
}

/**
 * Runs code that prints out the current thermostat state, and determines if the fan state should be changed.
 *
 * @param settings Script settings
 * @param officeTemperature Current office temperature
 */
async function checkAndSetThermostat (settings: ISettings, officeTemperature: number) {
  // Lookup the thermostat state.
  const tstat = await radiotherm.getThermostatState();
  msgLogger.info(`Current thermostat mode: ${ThermostatMode[tstat.tmode]}`);
  msgLogger.info(`Current thermostat state: ${ThermostatState[tstat.tstate]}`);
  msgLogger.info(`Current cool setpoint:\t${tstat.t_cool ?? '<disabled>'}`);
  msgLogger.info(`Current temperature:\t${tstat.temp}`);
  msgLogger.info(`Fan mode ${FanMode[tstat.fmode]}`);
  msgLogger.info(`Fan state ${FanState[tstat.fstate]}`);

  if (!(await ThermoStatFanData.checkForDeviation())) {
    if (tstat.tmode === ThermostatMode.Cool) {
      const tempDiff = _.round(officeTemperature - (tstat.t_cool ?? officeTemperature), 2);
      msgLogger.info(`Currently office is ${tempDiff} warmer than the setpoint`);

      // Check & set the whole house fan
      if (tempDiff >= settings.radioTherm.temperatureDiff) {
        if (tstat.fmode !== FanMode.On) {
          await setThermostatFanMode(FanMode.On);
        } else {
          msgLogger.info(`No changes needed to fan state. Leaving fan set to ${FanMode[tstat.fmode]}`);
        }
      } else if (tstat.fmode !== FanMode.Circulate) {
        await setThermostatFanMode(FanMode.Circulate);
      } else {
        msgLogger.info(`No changes needed to house fan state. Leaving fan set to ${FanMode[tstat.fmode]}`);
      }
    }
  } else {
    msgLogger.info(`Fan mode is currently overridden to ${FanMode[tstat.fmode]} for the next ${await ThermoStatFanData.getRemainingDeviationMinutes()} minutes.`);
  }
}

/**
 * Checks the conditions that are relevant to the fans state, and toggles the state accordingly
 *
 * @param fanSetting - Settings that tell us about the fan
 */
async function checkAndSetFanState (fanSetting: ITPLinkFanSetting) {
  const fanPlug = new SmartPlug(fanSetting.address, fanSetting.name);

  const plugAlias = await fanPlug.searchByName();

  // Ensure we were able to find the plug...
  if (plugAlias === null) {
    msgLogger.error(`Failed to connect to ${fanSetting.name} at ${fanSetting.address}. Cannot check & set fan state.`);
  } else {
    // Check to see if the plug is at a different IP address than we have saved in the settings...
    if (fanPlug.address !== fanSetting.address) {
      msgLogger.info(`Updating ${fanSetting.name} IP address to ${fanPlug.address}.`);
      fanSetting.address = fanPlug.address;
    }

    // Continue with checking & setting the fan state.
    if (!(await fanPlug.checkForDeviation())) {
      const fanState = await fanPlug.getState();

      // We need to find the temperatures we are working with.
      const insideTower = await acuparse.getTower(fanSetting.insideSourceID);

      let outsideTower: ITower | null = null;
      if (fanSetting.outsideSourceID.length > 0) {
        outsideTower = await acuparse.getTower(fanSetting.outsideSourceID);
      }

      const outsideTempF = outsideTower?.tempF ?? 0;

      if (insideTower.tempF >= fanSetting.tempThreshold && insideTower.tempF > outsideTempF) {
        if (fanState === PlugState.Off) {
          await setPlugState(fanPlug, PlugState.On);
        } else {
          msgLogger.info(`No changes needed to ${fanSetting.name} state. Leaving fan set to ${PlugState[fanState]}`);
        }
      } else if (fanState === PlugState.On) {
        await setPlugState(fanPlug, PlugState.Off);
      } else {
        msgLogger.info(`No changes needed to ${fanSetting.name} state. Leaving fan set to ${PlugState[fanState]}`);
      }
    } else {
      msgLogger.info(`${fanSetting.name} fan is currently overridden to ${PlugState[await fanPlug.getState()]} for the next ${await fanPlug.getRemainingDeviationMinutes()} minutes`);
    }
  }
}

/**
 * Runs the process of checking temperatures, and seeing if we should change the fan state.
 *
 * @param settings Script settings
 */
async function runScript (settings: ISettings) {
  acuparse.Settings.apiHost = settings.acuparse.hostname;
  radiotherm.Settings.apiHost = settings.radioTherm.hostname;

  // Print out some general temperature data from around the house
  const office = await acuparse.getTower(settings.acuparse.officeTowerID);
  const dining = await acuparse.getTower(settings.acuparse.diningTowerID);
  const bedroom = await acuparse.getTower(settings.acuparse.bedroomTowerID);
  const outside = await acuparse.getTower(settings.tplink.houseFan.outsideSourceID);

  const outputData = [office, dining, bedroom, outside];
  msgLogger.info('\n' + columnify(outputData, {
    columns: ['name', 'tempF', 'lastUpdated'],
    config: {
      lastUpdated: {
        dataTransform: (data: string) => (new Date(data)).toLocaleString()
      }
    }
  }));

  const officeTemperature = office.tempF;

  // Check to see what we should do with regards to the above info.
  try {
    await checkAndSetThermostat(settings, officeTemperature);
  } catch (err) {
    logError('Failed to check or set thermostat state.', err);
  }

  try {
    await checkAndSetFanState(settings.tplink.officeFan);
  } catch (err) {
    logError('Failed to check or set office fan state.', err);
  }

  try {
    await checkAndSetFanState(settings.tplink.houseFan);
    await checkAndSetFanState(settings.tplink.boxFan);
  } catch (err) {
    logError('Failed to check or set house fan state.', err);
  }
  // Check & set the office fan.
}

// Kicks off the process & handles any errors.
getSettings()
  .then((settings) => runScript(settings))
  .then(() => saveSettings())
  .catch((err) => {
    msgLogger.error(err);
  });
