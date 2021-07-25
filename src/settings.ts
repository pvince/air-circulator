import { TransformableInfo } from 'logform'

const { createLogger, format, transports } = require('winston')

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
  // msgLogger.error({ message: `${message} ${err.message}`, err: err, stack: err.stack })
  console.error(`${err}\n${err.stack}`)
}
