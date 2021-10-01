/**
 * @file Automated tests for automating fan state changes
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */

import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { apiMethods, PlugState, SmartPlug } from '../tplink/api';
import { ITPLinkFanSetting, ITPLinkPlugSetting } from '../services/settings';
import { acuparse } from '../acuparse/api';
import { ITower } from '../acuparse/types';
import { checkAndSetFanState } from './tempControlFan';
import { IDeviationResult } from '../services/datastore';
import _ from 'lodash';

chai.use(sinonChai);

interface IFakeTowerData {
  towerID: string;
  temperature: number;
}

interface IFakeTowers {
  inside: IFakeTowerData;
  outside?: IFakeTowerData;
}

/**
 * Returns fake tower data for inside & outside. Used by sinon to fake out responses.
 *
 * @param fakeTowers - Fake tower data
 * @returns - Returns a function that replaces the getTower function on acuparse.
 */
function fakeTowerHandler (fakeTowers: IFakeTowers) {
  return (towerID: string): Promise<ITower|undefined> => {
    let result: ITower | undefined;
    if (towerID === fakeTowers.inside.towerID) {
      result = {
        name: 'UnitTest inside tower',
        tempF: fakeTowers.inside.temperature,
        lastUpdated: '',
        relH: ''
      };
    } else if (towerID === fakeTowers.outside?.towerID) {
      result = {
        name: 'UnitTest outside tower',
        tempF: fakeTowers.outside.temperature,
        lastUpdated: '',
        relH: ''
      };
    } else {
      result = undefined;
    }
    return Promise.resolve(result);
  };
}

/**
 * Builds a fake 'fan setting'.
 *
 * @param settings - Optional settings object to override default generated settings.
 * @returns - Returns fake fan settings.
 */
function getFakeFanSetting (settings?: Partial<ITPLinkFanSetting>): ITPLinkFanSetting {
  const defaultSettings: ITPLinkFanSetting = {
    address: '192.168.1.70',
    name: 'House Fan',
    insideSourceID: '00010242',
    outsideSourceID: 'main',
    tempThreshold: 60
  };

  return _.defaults(settings, defaultSettings);
}

/**
 * Builds the boilerplate 'Fake Tower' settings. Allows overriding the actual key data values.
 *
 * @param fanSettings - Used to populate TowerID settings
 * @param insideTemp - Inside temperature value
 * @param outsideTemp - (Optional) Outside temperature value. Omitting this would represent the scenario where a setting
 *                      says that it has an 'outside' tower, but that tower doesn't actually exist.
 * @returns = Returns the 'Fake Tower' settings.
 */
function getFakeTowerSettings (fanSettings: ITPLinkFanSetting, insideTemp: number, outsideTemp?: number): IFakeTowers {
  const result: IFakeTowers = {
    inside: {
      towerID: fanSettings.insideSourceID,
      temperature: insideTemp
    }
  };

  if (!_.isEmpty(fanSettings.outsideSourceID) && _.isNumber(outsideTemp)) {
    result.outside = {
      towerID: fanSettings.outsideSourceID,
      temperature: outsideTemp
    };
  }

  return result;
}

/**
 * Builds a fake plug with a fake initial state.
 *
 * @param plugSettings - Address & name for a plug
 * @param initialState - Initial plug state
 * @returns - Returns plug state
 */
export async function getFakeSmartPlug (plugSettings: ITPLinkPlugSetting, initialState: PlugState = PlugState.Off): Promise<FakeSmartPlug> {
  const fakePlug = new FakeSmartPlug(plugSettings.address, plugSettings.name);
  await fakePlug.setPlugState(initialState);
  return fakePlug;
}

/**
 * Fake plug that remembers state locally.
 */
class FakeSmartPlug extends SmartPlug {
  public plugState: PlugState = PlugState.Off;

  /**
   * Returns the plugs 'state' (Is it on, or is it off)
   */
  public async getState (): Promise<PlugState> {
    return Promise.resolve(this.plugState);
  }

  /**
   * Sets the plugs 'state' (turns it off or on)
   *
   * @param inPlugState - Plug state to set.
   */
  public async setPlugState (inPlugState: PlugState) {
    this.plugState = inPlugState;
    return Promise.resolve();
  }
}

describe('checkAndSetFanState', function () {
  /**
   * Modifies API methods called by the function to ensure they return the data we want them to return.
   *
   * @param fanSettings - Settings that the program would have read from the settings.json
   * @param fakeTowers - Fake tower data that we need to return
   * @param initialState - The starting state of the plug
   * @param deviation - Has the plug 'deviated' from the setting we think it should have?
   */
  async function _setup (fanSettings: ITPLinkFanSetting, fakeTowers: IFakeTowers, initialState: PlugState, deviation = false): Promise<FakeSmartPlug> {
    const fakePlug = await getFakeSmartPlug(fanSettings, initialState);

    // The checkAndSet function will try to create a plug. We want to make sure it gets our plug
    sinon.replace(apiMethods, 'createSmartPlug', sinon.fake.resolves(fakePlug));

    // The acuparse API will not be accessible to unit tests, so make sure it returns an appropriate tower.
    sinon.replace(acuparse, 'getTower', sinon.stub().callsFake(fakeTowerHandler(fakeTowers)));

    // Fake plug needs to return special data foro 'checkForDeviation'.
    sinon.stub(fakePlug, 'checkForDeviation').callsFake(async (): Promise<IDeviationResult<PlugState>> => {
      const result: IDeviationResult<PlugState> = {
        isDeviated: deviation,
        currentState: fakePlug.plugState,
        expectedState: null
      };
      return Promise.resolve(result);
    });

    // In case of deviation, this function needs to return something sane.
    sinon.replace(fakePlug, 'getRemainingDeviationMinutes', sinon.fake.resolves(15));

    return fakePlug;
  }

  /**
   * Runs the code to control the fan state, and then checks to make sure it actually had the expected state result.
   *
   * @param fakePlug - Fake plug that is being controlled
   * @param fanSettings - Settings used to control the function
   * @param expectedState - Expected plug state after running the function.
   */
  async function _runAndCheck (fakePlug: FakeSmartPlug, fanSettings: ITPLinkFanSetting, expectedState: PlugState) {
    await checkAndSetFanState(fanSettings);

    expect(fakePlug.plugState).to.eql(expectedState);
  }

  /**
   * Sets up fake handlers for common methods.
   *
   * @param fanSettings - Settings for the fan
   * @param fakeTowers - Fake tower information
   * @param initialState - Initial fan switch state
   * @param expectedState - Expected final switch state
   * @param deviation - (Default: false) what checkForDeviation returns
   */
  async function _setupAndRun (fanSettings: ITPLinkFanSetting, fakeTowers: IFakeTowers, initialState: PlugState, expectedState: PlugState, deviation = false): Promise<FakeSmartPlug> {
    const fakePlug = await _setup(fanSettings, fakeTowers, initialState, deviation);
    await _runAndCheck(fakePlug, fanSettings, expectedState);

    return fakePlug;
  }

  it('should turn on fan', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 65, 60);

    const initialState = PlugState.Off;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan (Outside higher)', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 61, 65);

    const initialState = PlugState.On;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan (Inside below threshold)', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 59, 65);

    const initialState = PlugState.On;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan on (inside above threshold, outside lower)', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 61, 50);

    const initialState = PlugState.On;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan off (inside below threshold, outside lower)', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 59, 50);

    const initialState = PlugState.Off;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan off (inside above threshold, outside higher)', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 61, 62);

    const initialState = PlugState.Off;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('Deviated to On, would turn off', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60 });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 59, 65);

    const initialState = PlugState.On;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState, true);
  });

  it('should turn on fan, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60, outsideSourceID: '' });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 61);

    const initialState = PlugState.Off;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60, outsideSourceID: '' });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 59);

    const initialState = PlugState.On;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan on, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60, outsideSourceID: '' });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 61);

    const initialState = PlugState.On;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan and leave it off until temperature raises by 1 degree.', async function () {
    const fanSettings: ITPLinkFanSetting = getFakeFanSetting({ tempThreshold: 60, outsideSourceID: '' });
    const fakeTowers: IFakeTowers = getFakeTowerSettings(fanSettings, 59.6);

    const initialState = PlugState.On;

    // Should still be on at 59.6
    const fakePlug = await _setupAndRun(fanSettings, fakeTowers, initialState, PlugState.On);

    // Should turn off at 59.5
    fakeTowers.inside.temperature = 59.5;
    await _runAndCheck(fakePlug, fanSettings, PlugState.Off);

    // Should stay off even if we raise back to 60.4
    fakeTowers.inside.temperature = 60.4;
    await _runAndCheck(fakePlug, fanSettings, PlugState.Off);

    // Should turn on at 60.5
    fakeTowers.inside.temperature = 60.5;
    await _runAndCheck(fakePlug, fanSettings, PlugState.On);
  });
});
