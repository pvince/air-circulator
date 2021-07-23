import { TransformableInfo } from 'logform'

const { createLogger, format, transports } = require('winston')

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

export function LogError (message: string, err: Error) {
  msgLogger.error({ message: `${message} ${err.message}`, err: err, stack: err.stack })
}
