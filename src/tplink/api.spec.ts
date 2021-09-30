/* eslint-disable no-unused-expressions */
/**
 * @file Unit tests for TP Link API
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */
import { describe, afterEach, it } from 'mocha';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { Plug, Client } from 'tplink-smarthome-api';
import * as tpLinkAPI from './api';
import { SmartPlug } from './api';

chai.use(sinonChai);

describe('SmartPlug', function () {
  describe('searchByName', function () {
    interface fakePlugParams {
      name?: string;
      ipAddress?: string;
    }

    /**
     * Generates a fake plug for unit testing.
     *
     * @param plugParams - Unit test plug info
     * @returns - Returns a fake plug
     */
    function _getFakePlug (plugParams?: fakePlugParams): Plug {
      return new Plug({
        client: new Client(),
        host: plugParams?.ipAddress ?? '10.15.123.41',
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

    afterEach(() => {
      sinon.restore();
    });

    it('should find the device.', async function () {
      const settingsDeviceInfo = {
        name: 'House fan',
        ipAddress: '192.168.1.145'
      };

      // Ensure that we can find a 'device' with this information
      // sinon.replace(tpLinkAPI.apiMethods, 'findDevices', sinon.fake.returns(Promise.resolve([_getFakePlug(deviceInfo)])));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.ipAddress, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.returns(Promise.resolve(_getFakePlug(settingsDeviceInfo))));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.eql(settingsDeviceInfo.ipAddress);
      expect(smartPlug.name).to.eql(settingsDeviceInfo.name);
    });

    it('should find the device with a new IP address', async function () {
      const settingsDeviceInfo = {
        name: 'House fan',
        ipAddress: '192.168.1.145'
      };

      const actualDeviceInfo = {
        name: settingsDeviceInfo.name,
        ipAddress: '192.168.1.123'
      };

      // Ensure that we can find a 'device' with this information
      sinon.replace(tpLinkAPI.apiMethods, 'findDevices', sinon.fake.returns(Promise.resolve([_getFakePlug(actualDeviceInfo)])));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.ipAddress, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.throws(new Error('Failed to find device.')));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.eql(actualDeviceInfo.ipAddress);
      expect(smartPlug.name).to.eql(actualDeviceInfo.name);
    });

    it('shouldn\'t find the device.', async function () {
      const settingsDeviceInfo = {
        name: 'House fan',
        ipAddress: '192.168.1.145'
      };

      // Ensure that we can find a 'device' with this information
      sinon.replace(tpLinkAPI.apiMethods, 'findDevices', sinon.fake.returns(Promise.resolve([])));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.ipAddress, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.throws(new Error('Failed to find device.')));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.be.null;
    });

    it('should find a device with the wrong name', async function () {
      const settingsDeviceInfo = {
        name: 'House fan',
        ipAddress: '192.168.1.145'
      };

      const actualDeviceInfo = {
        name: settingsDeviceInfo.name,
        ipAddress: '192.168.1.123'
      };

      const wrongDeviceInfo = {
        name: 'Other device',
        ipAddress: settingsDeviceInfo.ipAddress
      };

      // Ensure that we can find a 'device' with this information
      sinon.replace(tpLinkAPI.apiMethods, 'findDevices',
        sinon.fake.returns(Promise.resolve([_getFakePlug(wrongDeviceInfo), _getFakePlug(actualDeviceInfo)])));

      // Create the SmartPlug
      const smartPlug = new SmartPlug(settingsDeviceInfo.ipAddress, settingsDeviceInfo.name);
      sinon.replace(smartPlug, 'getDevice', sinon.fake.returns(Promise.resolve(_getFakePlug(wrongDeviceInfo))));

      // Now, make sure that we can find the device by name.
      const foundAtAddress = await smartPlug.searchByName();

      expect(foundAtAddress).to.eql(actualDeviceInfo.ipAddress);
      expect(smartPlug.name).to.eql(actualDeviceInfo.name);
    });
  });
});
