import { findDevices } from './tplink/api'
import { msgLogger } from './settings'
import columnify from 'columnify'
import cliProgress from 'cli-progress'

interface IDeviceSummary {
  ipaddress: string,
  alias: string,
  model: string
}

let initializedProgress = false
let progressBar = <cliProgress.SingleBar|null> null

/**
 * Displays & updates a progress bar.
 *
 * @param total Total time for the progress bar
 * @param current Current elapsed time for the progress bar
 * @param deviceCount Total number of devices that have been found.
 */
function progress (total: number, current: number, deviceCount: number) {
  if (!initializedProgress) {
    progressBar = new cliProgress.SingleBar({
      clearOnComplete: true,
      format: '[{bar}] {percentage}% | ETA: {eta}s | Devices: {devices}'
    }, cliProgress.Presets.legacy)
    progressBar.start(total, current, {
      devices: deviceCount
    })
    initializedProgress = true
  } else {
    progressBar?.update(current, {
      devices: deviceCount
    })
  }
}

/**
 * Runs the 'Identify' script actions.
 */
async function runScript () {
  msgLogger.info('Starting discovery...')

  const devices = await findDevices({ progress, discoveryPeriod: 30 })
  progressBar?.stop()

  msgLogger.info(`Found ${devices.length} devices.`)

  const sysInfoArray = <IDeviceSummary[]>[]

  for (const device of devices) {
    const sysInfo = await device.getSysInfo()

    sysInfoArray.push({
      ipaddress: device.host,
      alias: sysInfo.alias,
      model: sysInfo.model
    })
  }

  msgLogger.info('\n' + columnify(sysInfoArray, {
    columns: ['alias', 'ipaddress', 'model']
  }))
}

runScript()
  .catch((err) => {
    msgLogger.error(err)
  })
