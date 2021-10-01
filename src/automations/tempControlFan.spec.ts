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
 * Builds a fake plug with a fake initial state.
 *
 * @param plugSettings - Address & name for a plug
 * @param initialState - Initial plug state
 * @returns - Returns plug state
 */
export function getFakeSmartPlug (plugSettings: ITPLinkPlugSetting, initialState: PlugState = PlugState.Off): FakeSmartPlug {
  const fakePlug = new FakeSmartPlug(plugSettings.address, plugSettings.name);
  fakePlug.setPlugState(initialState);
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
   * Sets up fake handlers for common methods.
   *
   * @param fanSettings - Settings for the fan
   * @param fakeTowers - Fake tower information
   * @param initialState - Initial fan switch state
   * @param expectedState - Expected final switch state
   * @param deviation - (Default: false) what checkForDeviation returns
   */
  async function _setupAndRun (fanSettings: ITPLinkFanSetting, fakeTowers: IFakeTowers, initialState: PlugState, expectedState: PlugState, deviation = false) {
    const fakePlug = getFakeSmartPlug(fanSettings, initialState);

    sinon.replace(apiMethods, 'createSmartPlug', sinon.fake.resolves(fakePlug));
    sinon.replace(acuparse, 'getTower', sinon.stub().callsFake(fakeTowerHandler(fakeTowers)));

    // Fake out functions on the smart plug
    sinon.replace(fakePlug, 'checkForDeviation', sinon.fake.resolves(deviation));
    sinon.replace(fakePlug, 'getRemainingDeviationMinutes', sinon.fake.resolves(15));

    await checkAndSetFanState(fanSettings);

    expect(fakePlug.plugState).to.eql(expectedState);
  }

  it('should turn on fan', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 65
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 60
      }
    };

    const initialState = PlugState.Off;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan (Outside higher)', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 61
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 65
      }
    };

    const initialState = PlugState.On;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan (Inside below threshold)', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 59
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 65
      }
    };

    const initialState = PlugState.On;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan on (inside above threshold, outside lower)', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 61
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 50
      }
    };

    const initialState = PlugState.On;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan off (inside below threshold, outside lower)', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 59
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 50
      }
    };

    const initialState = PlugState.Off;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan off (inside above threshold, outside higher)', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 61
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 62
      }
    };

    const initialState = PlugState.Off;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('Deviated to On, would turn off', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: 'main',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 59
      },
      outside: {
        towerID: fanSettings.outsideSourceID,
        temperature: 65
      }
    };

    const initialState = PlugState.On;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState, true);
  });

  it('should turn on fan, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: '',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 61
      }
    };

    const initialState = PlugState.Off;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should turn off fan, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: '',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 59
      }
    };

    const initialState = PlugState.On;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan on, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: '',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 61
      }
    };

    const initialState = PlugState.On;
    const finalState = PlugState.On;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });

  it('should leave fan off, no outside tower', async function () {
    const fanSettings: ITPLinkFanSetting = {
      address: '192.168.1.70',
      name: 'House Fan',
      insideSourceID: '00010242',
      outsideSourceID: '',
      tempThreshold: 60
    };

    const fakeTowers: IFakeTowers = {
      inside: {
        towerID: fanSettings.insideSourceID,
        temperature: 59
      }
    };

    const initialState = PlugState.Off;
    const finalState = PlugState.Off;

    await _setupAndRun(fanSettings, fakeTowers, initialState, finalState);
  });
});
