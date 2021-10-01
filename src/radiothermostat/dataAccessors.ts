import { DataStoreAccessor } from '../services/datastore';
import { getThermostatState } from './api';
import { FanMode } from './types';

class RadioThermoFanModeDataAccessor extends DataStoreAccessor<FanMode> {
  name: string;

  constructor (inName: string) {
    super();
    this.name = inName;
  }

  dataName (): string {
    return this.name;
  }

  async getState (): Promise<FanMode> {
    const tstat = await getThermostatState();

    return tstat.fmode;
  }
}

export const ThermoStatFanData = new RadioThermoFanModeDataAccessor('houseFan');
