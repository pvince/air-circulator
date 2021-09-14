export interface ITemperatureData {
    tempF: number;
    relH: string;
    lastUpdated: string;
}

export interface ITower extends ITemperatureData{
    name: string;
}

export interface ITowerList {
    [key: string]: ITower;
}

export interface ITowerListResult {
    towers: ITowerList;
}

export interface IMain extends ITower {
    rainIn: number;
    // eslint-disable-next-line camelcase
    rainTotalIN_today: number;
    windSpeedMPH: number;
    windDEG: number;
    windDIR: string;
}

export interface IMainResult {
    main: IMain;
}

export const MAIN_TOWER_ID = 'main';
