/**
 * @file Automates a fan on a TP-Link plug based on the temperature retrieved from Acuparse.
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */
import { ITPLinkFanSetting, msgLogger, statLogger } from '../services/settings';
import { PlugState, SmartPlug } from '../tplink/api';
import * as acuparse from '../acuparse/api';
import { ITower } from '../acuparse/types';

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
 * Checks the conditions that are relevant to the fans state, and toggles the state accordingly
 *
 * @param fanSetting - Settings that tell us about the fan
 */
export async function checkAndSetFanState (fanSetting: ITPLinkFanSetting) {
  const fanPlug = new SmartPlug(fanSetting.address, fanSetting.name);

  const plugAddress = await fanPlug.searchByName();

  // Ensure we were able to find the plug...
  if (plugAddress === null) {
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
