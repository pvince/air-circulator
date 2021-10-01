/* eslint-disable no-unused-expressions */
/**
 * @file Unit tests for TP Link API
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */
import { describe, it } from 'mocha';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Plug, Client } from 'tplink-smarthome-api';
import * as tpLinkAPI from './api';
import { SmartPlug } from './api';
import { ITPLinkPlugSetting } from '../services/settings';

chai.use(sinonChai);

/**
 * Generates a fake plug for unit testing.
 *
 * @param plugParams - Unit test plug info
 * @returns - Returns a fake plug
 */
export function getFakePlug (plugParams?: Partial<ITPLinkPlugSetting>): Plug {
  return new Plug({
    client: new Client(),
    host: plugParams?.address ?? '10.15.123.41',
    sysInfo: {
      sw_ver: '1.0.3 Build 210414 Rel.193918',
      hw_ver: '4.0',
      model: 'HS105(US)',
      deviceId: '800624AD5F20C94A1267CA5AC731CAE71DFD4A31',
      alias: plugParams?.name ?? 'A unit test device',
      mic_type: 'IOT.SMARTPLUGSWITCH',
      feature: 'TIM',
      mac: '90:9A:4A:08:96:E4',
      led_off: 0,
      relay_state: 0,
      dev_name: 'Smart Wi-Fi Plug Mini'
    }
  });
}

describe('SmartPlug', function () {
  describe('searchByName', function () {
    it('should find the device.', async function () {
      const settingsDeviceInfo: ITPLinkPlugSetting = {
        name: 'House fan',
        address: '192.168.1.145'
      };

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.address, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.resolves(getFakePlug(settingsDeviceInfo)));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.eql(settingsDeviceInfo.address);
      expect(smartPlug.name).to.eql(settingsDeviceInfo.name);
    });

    it('should find the device with a new IP address', async function () {
      const settingsDeviceInfo: ITPLinkPlugSetting = {
        name: 'House fan',
        address: '192.168.1.145'
      };

      const actualDeviceInfo: ITPLinkPlugSetting = {
        name: settingsDeviceInfo.name,
        address: '192.168.1.123'
      };

      // Ensure that we can find a 'device' with this information
      sinon.replace(tpLinkAPI.apiMethods, 'findDevices', sinon.fake.resolves([getFakePlug(actualDeviceInfo)]));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.address, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.throws(new Error('Failed to find device.')));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.eql(actualDeviceInfo.address);
      expect(smartPlug.name).to.eql(actualDeviceInfo.name);
    });

    it('shouldn\'t find the device.', async function () {
      const settingsDeviceInfo: ITPLinkPlugSetting = {
        name: 'House fan',
        address: '192.168.1.145'
      };

      // Ensure that we can find a 'device' with this information
      sinon.replace(tpLinkAPI.apiMethods, 'findDevices', sinon.fake.resolves([]));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.address, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.throws(new Error('Failed to find device.')));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.be.null;
    });

    it('should find a device with the wrong name', async function () {
      const settingsDeviceInfo: ITPLinkPlugSetting = {
        name: 'House fan',
        address: '192.168.1.145'
      };

      const actualDeviceInfo: ITPLinkPlugSetting = {
        name: settingsDeviceInfo.name,
        address: '192.168.1.123'
      };

      const wrongDeviceInfo: ITPLinkPlugSetting = {
        name: 'Other device',
        address: settingsDeviceInfo.address
      };

      // Ensure that we can find a 'device' with this information
      sinon.replace(tpLinkAPI.apiMethods, 'findDevices',
        sinon.fake.returns(Promise.resolve([getFakePlug(wrongDeviceInfo), getFakePlug(actualDeviceInfo)])));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.address, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.resolves(getFakePlug(wrongDeviceInfo)));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.eql(actualDeviceInfo.address);
      expect(smartPlug.name).to.eql(actualDeviceInfo.name);
    });
  });
});
