/* eslint-disable camelcase,no-unused-vars */
// noinspection JSUnusedGlobalSymbols

/**
 * Thermostat operating mode
 */
export enum ThermostatMode {
    Off = 0,
    Heat,
    Cool,
    Auto
}

/**
 * Absolute Target Temperature Mode
 */
export enum AbsoluteTempMode {
    Disable,
    Enable
}

/**
 * Fan operating mode
 */
export enum FanMode {
    Auto= 0,
    Circulate,
    On
}

/**
 * Target temperature temporary override
 */
export enum OverrideMode {
    Disabled,
    Enabled
}

/**
 * Target temperature hold status
 */
export enum HoldMode {
    Disabled,
    Enabled
}

/**
 * HVAC Operating State
 */
export enum ThermostatState {
    Off,
    Heat,
    Cool
}

/**
 * Fan Operating State
 */
export enum FanState {
    Off,
    On
}

/**
 * Current operating mode. If the thermostat is in Auto mode and operating towards
 * a cool target. This value will be 'Cool'
 */
export enum OperatingTargetMode {
    Off,
    Heat,
    Cool
}

/**
 * Radio Thermostat 'state' interface.
 */
export interface IThermostat {
    temp: number,
    tmode: ThermostatMode,
    fmode: FanMode,
    override: OverrideMode,
    hold: HoldMode,
    t_cool: number,
    t_heat: number,
    it_heat: number,
    it_cool: number,
    a_heat: number,
    a_cool: number,
    a_mode: AbsoluteTempMode,
    tstate: ThermostatState,
    fstate: FanState,
    time: string, // todo: This is currently not the correct 'time' format.
    ttarget: OperatingTargetMode
}
