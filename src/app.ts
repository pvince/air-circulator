import got from 'got'
import { ITowerListResult } from './types/AcuparseTypes'

const acuparseURL = 'http://weather.pvince.me'

async function Test () {
  const response = await got(`${acuparseURL}/api/v1/json/tower/?id=00015652`)

  const towerList:ITowerListResult = JSON.parse(response.body)

  console.log(towerList.towers['00015652'].tempF)
}

Test()
