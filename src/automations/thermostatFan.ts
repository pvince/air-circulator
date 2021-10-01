/**
 * @file Automations related to checking & setting the thermostat fan mode.
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */

import { FanMode, FanState, ThermostatMode, ThermostatState } from '../radiothermostat/types';
import { ISettings, msgLogger, statLogger } from '../services/settings';
import * as radiotherm from '../radiothermostat/api';
import { ThermoStatFanData } from '../radiothermostat/dataAccessors';
import _ from 'lodash';

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
 * Runs code that prints out the current thermostat state, and determines if the fan state should be changed.
 *
 * @param settings Script settings
 * @param officeTemperature Current office temperature
 */
export async function checkAndSetThermostat (settings: ISettings, officeTemperature: number) {
  // Lookup the thermostat state.
  const tstat = await radiotherm.getThermostatState();
  msgLogger.info(`Current thermostat mode: ${ThermostatMode[tstat.tmode]}`);
  msgLogger.info(`Current thermostat state: ${ThermostatState[tstat.tstate]}`);
  msgLogger.info(`Current cool setpoint:\t${tstat.t_cool ?? '<disabled>'}`);
  msgLogger.info(`Current temperature:\t${tstat.temp}`);
  msgLogger.info(`Fan mode ${FanMode[tstat.fmode]}`);
  msgLogger.info(`Fan state ${FanState[tstat.fstate]}`);

  const deviationData = await ThermoStatFanData.checkForDeviation();

  if (!(deviationData.isDeviated)) {
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
