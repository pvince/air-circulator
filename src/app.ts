import * as acuparse from './acuparse/api';
import * as radiotherm from './radiothermostat/api';
import { getSettings, ISettings, logError, msgLogger, saveSettings } from './services/settings';
import { ThermostatMode } from './radiothermostat/types';
import columnify from 'columnify';
import { checkAndSetFanState } from './automations/tempControlFan';
import { checkAndSetThermostat } from './automations/thermostatFan';

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

  let bIsThermostatActive = true;
  try {
    const tstat = await radiotherm.getThermostatState();
    bIsThermostatActive = tstat.tmode !== ThermostatMode.Off;
  } catch (err: unknown) {
    logError('Failed to lookup thermostat state.', err);
  }

  try {
    await checkAndSetFanState(settings.tplink.officeFan);
  } catch (err) {
    logError('Failed to check or set office fan state.', err);
  }

  if (!bIsThermostatActive) {
    try {
      await checkAndSetFanState(settings.tplink.houseFan);
      await checkAndSetFanState(settings.tplink.boxFan);
    } catch (err: unknown) {
      logError('Failed to check or set house fan state.', err);
    }
  } else {
    msgLogger.info('Thermostat is controlling temperature. Skipping setting house & box fan.');
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
