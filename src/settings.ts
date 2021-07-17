import { TransformableInfo } from 'logform'

const { createLogger, format, transports } = require('winston')

const devFormat = format.combine(
  format.colorize(),
  format.timestamp(),
  format.splat(),
  format.errors(),
  format.printf(({ timestamp, level, message, ...rest }: TransformableInfo) => {
    let restString = JSON.stringify(rest, undefined, 2)
    restString = restString === '{}' ? '' : restString

    return `[${(new Date(timestamp)).toLocaleString()}] ${level} - ${message} ${restString}`
  })
)

export const logger = createLogger({
  format: format.combine(
    format.errors({ stack: true }), // Handle errors (was automagic in winston@2)
    format.splat(), // Handle splat (was automagic in winston@2)
    format.timestamp()
  ),
  transports: [
    new transports.Console({ format: devFormat }),
    new transports.File({
      filename: 'air-circulator.log',
      level: 'error'
    })
  ]
})
