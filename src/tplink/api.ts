import { Client } from 'tplink-smarthome-api';
import { DataStoreAccessor } from '../services/datastore';
import { AnyDevice } from 'tplink-smarthome-api/lib/client';
import { ITPLinkPlugSetting, logError, msgLogger, statLogger } from '../services/settings';

/**
 * Declares an enum that can be used to toggle the plug state.
 */
export enum PlugState {
  // eslint-disable-next-line no-unused-vars
  Off,

  // eslint-disable-next-line no-unused-vars
  On
}

/**
 * Optional parameters for finding devices.
 */
export interface IFindDevicesOptions {
  /**
   * How long should we search (in seconds) for devices? (Default: 60 seconds)
   */
  discoveryPeriod?: number;

  /**
   * Callback that delivers progress updates. (Default: no-op)
   *
   * @param total Total time (milliseconds)
   * @param current Current elapsed time (milliseconds)
   * @param deviceCount How many devices have been found so far?
   */
  progress?: (total: number, current: number, deviceCount: number) => void;

  /**
   * Network mask passed forward to the TP-link API. (Default: 192.168.1.255
   */
  broadcast?: string;
}

/**
 * Searches the network for TP-link devices.
 *
 * @param options - Optional configuration
 */
async function findDevices (options?: IFindDevicesOptions): Promise<AnyDevice[]> {
  // noinspection JSUnusedLocalSymbols
  const status = options?.progress ?? function (total: number, current: number, deviceCount: number): void {};
  const discoveryPeriod = options?.discoveryPeriod ?? 60;
  const broadcast = options?.broadcast ?? '192.168.1.255';

  const client = new Client();

  const results: AnyDevice[] = [];

  const startTime = new Date();
  let currentTime = startTime;
  const endTime = (new Date(startTime.getTime() + discoveryPeriod * 1000));

  client.startDiscovery({ broadcast: broadcast, discoveryInterval: 2500 }).on('device-new', async (device) => {
    results.push(device);
  });

  while (currentTime < endTime) {
    status(discoveryPeriod * 1000, currentTime.getTime() - startTime.getTime(), results.length);

    await new Promise(resolve => setTimeout(resolve, 500));

    currentTime = new Date();
  }

  client.stopDiscovery();

  return results;
}

/**
 * Handles creating a smart plug and locating it on the network.
 *
 * @param plugSettings - Plug settings that can be used to locate the plug
 * @returns - Returns a new smart plug, or null if a plug could not be found with the provided settings.
 */
async function createSmartPlug (plugSettings: ITPLinkPlugSetting): Promise<SmartPlug|null> {
  let newPlug: SmartPlug | null = new SmartPlug(plugSettings.address, plugSettings.name);

  const plugAddress = await newPlug.searchByName();
  if (plugAddress === null) {
    // We couldn't find the plug. This means it is probably offline.
    msgLogger.error(`Failed to connect to ${plugSettings.name} at ${plugSettings.address}. Cannot check & set fan state.`);
    newPlug = null;
  } else if (plugAddress !== plugSettings.address) {
    // We found the plug, but its address changed.
    msgLogger.info(`Updating ${plugSettings.name} IP address to ${plugAddress}.`);
    plugSettings.address = plugAddress;
  }

  return newPlug;
}

/**
 * This exists so that we can fake out certain methods for unit tests. (ex: Finding devices)
 * SmartPlug should use this apiMethods object to call methods on this class.
 */
export const apiMethods = {
  findDevices,
  createSmartPlug
};

/**
 * A helper class that wraps up the 'Smart Plug' functionality.
 */
export class SmartPlug extends DataStoreAccessor<PlugState> {
  /**
   * IP Address for the plug
   */
  public address: string;

  /**
   * Device name. If we fail to find the device at the specified address, we can search for it with this name.
   */
  public name: string;

  /**
   * TP-Link API object
   */
  private plugClient: Client;

  /**
   * Constructor
   *
   * @param inAddress - IP Address for the plug to control
   * @param inName - Name for the plug to control
   */
  constructor (inAddress: string, inName: string) {
    super();
    this.address = inAddress;
    this.name = inName;
    this.plugClient = new Client();
  }

  /**
   * Retrieves a TP-Link device
   */
  public async getDevice (): Promise<AnyDevice> {
    return this.plugClient.getDevice({ host: this.address });
  }

  /**
   * Name used to store this data into cache
   *
   * @returns Returns the plugs name
   * @override
   */
  public dataName (): string {
    return this.name;
  }

  /**
   * Checks that the set IP address is valid, and if not attempts to find this plug based on its name. If the plug
   * is located via its name, the IP address for this plug is automatically updated.
   */
  public async searchByName (): Promise<string|null> {
    let ipAddress;
    try {
      // Do a basic device lookup.
      const device = await this.getDevice();

      if (device.alias !== this.name) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(`Device with IP address ${this.address} is named ${device.alias} instead of ${this.name}. Need to lookup ${this.name}`);
      }

      // If we didn't encounter an error, we found the device by its IP address.
      ipAddress = this.address;
    } catch (err) {
      // If we had an error, then the IP address is wrong, or the device is offline.
      logError(`Failed to find a ${this.name} with IP address ${this.address}. Attempting to lookup device by name.`, err);

      const devices = await apiMethods.findDevices({ discoveryPeriod: 1 });

      const thisDevice = devices.find((device) => device.alias === this.name);
      ipAddress = thisDevice?.host ?? null;

      if (ipAddress !== null) {
        statLogger.info(`Found ${this.name} at ${ipAddress}.`);
      } else {
        msgLogger.error(`Failed to locate ${this.name} by name. Maybe it is offline?`);
      }
    }

    // Ensure the IP address is up to date if we found the device
    this.address = ipAddress ?? this.address;

    // Return the IP address if we have a valid IP address, return null if we didn't find the device.
    return ipAddress;
  }

  /**
   * Returns the plugs 'state' (Is it on, or is it off)
   *
   * @returns - Returns the plugs state
   * @override
   */
  public async getState (): Promise<PlugState> {
    const plugDevice = await this.getDevice();

    return (await plugDevice.getPowerState()) ? PlugState.On : PlugState.Off;
  }

  /**
   * Sets the plugs 'state' (turns it off or on)
   *
   * @param inPlugState - Plug state to set.
   */
  public async setPlugState (inPlugState: PlugState) {
    const plugDevice = await this.getDevice();

    await plugDevice.setPowerState(inPlugState === PlugState.On);
    await this.storeState();
  }
}
