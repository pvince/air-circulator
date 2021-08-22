import { TransformableInfo } from 'logform'
import fs from 'fs-extra'
import { createLogger, format, transports } from 'winston'
import _ from 'lodash'

const SETTINGS_FILE = 'settings.json'

/**
 * Pretty console error formatting for the winston logger
 */
const devFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.splat(),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, ...rest }: TransformableInfo) => {
    let restString = JSON.stringify(rest, undefined, 2)
    restString = restString === '{}' ? '' : restString

    return `[${(new Date(timestamp)).toLocaleString()}] ${level} - ${message} ${restString}`
  })
)

/**
 * General output & error logger. Writes pretty print messages to the console, writes error messages to a log file.
 */
export const msgLogger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json(),
    format.prettyPrint()
  ),
  transports: [
    new transports.Console({ format: devFormat }),
    new transports.File({
      filename: 'air-circulator-messages.log',
      level: 'error'
    })
  ]
})

/**
 * Event logger or 'Stats' logger. Logs when important events happen (eg: Turned the lights on, changed the fan mode)
 */
export const statLogger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json(),
    format.prettyPrint()
  ),
  transports: [
    new transports.Console({ format: devFormat }),
    new transports.File({
      filename: 'air-circulator-events.json',
      level: 'info'
    })
  ]
})

/**
 * Ensures consistent error logging.
 *
 * @param message Helpful message describing the error
 * @param err Error object
 */
export function logError (message: string, err: Error) {
  msgLogger.error({ message: `${message} ${err.message}`, err: err, stack: err.stack })
  // console.error(`${err}\n${err.stack}`)
}

/**
 * Acuparse specific settings
 */
export interface IAcuparseSettings {
  /**
   * Acuparse hostname
   */
  hostname: string,

  /**
   * Office Tower ID
   */
  officeTowerID: string,

  /**
   * Dining Tower ID
   */
  diningTowerID: string,

  /**
   * Bedroom Tower ID
   */
  bedroomTowerID: string
}

/**
 * TPLink API settings
 */
export interface ITPLinkSettings {
  /**
   * Office fan name
   */
  officeFanName: string,

  /**
   * Office fan address. Don't bother settings this. If this is
   * not valid, then we should use the office fan name.
   */
  officeFanAddress: string,

  /**
   * Office temperature threshold. At this point, turn the office device on.
   */
  officeTempThreshold: number
}

/**
 * Radio thermostat settings
 */
export interface IRadioThermSettings {
  /**
   * Device hostname
   */
  hostname: string,

  /**
   * Temperature differential. If the difference between the dining room thermostat
   * and the target acuparse tower is greater than this, turn on the thermostat house
   * fan
   */
  temperatureDiff: number,
}

/**
 * Settings interface
 */
export interface ISettings {
  tplink: ITPLinkSettings,
  acuparse: IAcuparseSettings
  radioTherm: IRadioThermSettings
}

/**
 * Lazy initialized cache of the settings.
 */
let settings = <ISettings|null> null

/**
 * Loads the settings from a file. If the settings file fails to load, this writes
 * a default settings file & re-throws the error.
 */
async function _loadSettings (): Promise<ISettings> {
  return fs.readJson(SETTINGS_FILE)
    .catch((err) => {
      logError('Failed to load settings. Saving defaults', err)
      settings = {
        tplink: {
          officeFanAddress: '',
          officeFanName: '',
          officeTempThreshold: 77
        },
        acuparse: {
          hostname: '',
          officeTowerID: '',
          diningTowerID: '',
          bedroomTowerID: ''
        },
        radioTherm: {
          hostname: '',
          temperatureDiff: 6
        }
      }
      return saveSettings()
        .then(() => Promise.reject(err))
    })
}

/**
 * Saves the current set 'settings'
 */
export async function saveSettings () {
  return fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 })
    .catch((err) => logError('Failed to save settings.', err))
}

/**
 * Ensures settings are loaded & returns reference to the settings.
 *
 * If the settings fails to load, this will throw an exception.
 */
export async function getSettings (): Promise<ISettings> {
  if (_.isEmpty(settings)) {
    settings = await _loadSettings()
    await saveSettings()
  }
  return settings ?? <ISettings>{}
}
