/**
 * @file Automates a fan on a TP-Link plug based on the temperature retrieved from Acuparse.
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */
import { ITPLinkFanSetting, msgLogger, statLogger } from '../services/settings';
import { apiMethods, PlugState, SmartPlug } from '../tplink/api';
import { acuparse } from '../acuparse/api';
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
 * @param fanSetting - acuparseSettings that tell us about the fan
 */
export async function checkAndSetFanState (fanSetting: ITPLinkFanSetting) {
  const fanPlug = await apiMethods.createSmartPlug(fanSetting);

  // Ensure we were able to find the plug...
  if (fanPlug !== null) {
    // Check to see if the plug state has deviated from the last time we set it.
    const deviationInfo = await fanPlug.checkForDeviation();

    if (deviationInfo.isDeviated) {
      msgLogger.info(`${fanSetting.name} is currently overridden to ${PlugState[await fanPlug.getState()]} for the next ${await fanPlug.getRemainingDeviationMinutes()} minutes`);
    } else {
      // Plug is still in the same state we expected it to be in...
      const stateCurrent = deviationInfo.currentState;
      let stateTarget;

      // We need to find the temperatures we are working with.
      const insideTower = await acuparse.getTower(fanSetting.insideSourceID);
      const insideTempF = insideTower.tempF;

      // Outside temperature is optional, so this requires a couple extra hoops.
      let outsideTower: ITower | null = null;
      if (fanSetting.outsideSourceID.length > 0) {
        outsideTower = await acuparse.getTower(fanSetting.outsideSourceID);
      }
      const outsideTempF = outsideTower?.tempF ?? 0;

      // Determine the target state.
      const fanOffThreshold = fanSetting.tempThreshold - 0.5;
      const fanOnThreshold = fanSetting.tempThreshold + 0.5;

      if (insideTempF >= fanOnThreshold && insideTempF > outsideTempF) {
        stateTarget = PlugState.On;
      } else if (insideTempF <= fanOffThreshold || insideTempF <= outsideTempF) {
        stateTarget = PlugState.Off;
      } else {
        // This is probably the region between fanOffThreshold <--> fanOnThreshold, so we are not going to do anything.
        stateTarget = stateCurrent; // Don't change anything
      }

      // Check if we are going to change the fan state.
      if (stateCurrent !== stateTarget) {
        await setPlugState(fanPlug, stateTarget);
      } else {
        msgLogger.info(`No changes needed to ${fanSetting.name} state. Leaving fan set to ${PlugState[stateCurrent]}`);
      }
    }
  }
}
