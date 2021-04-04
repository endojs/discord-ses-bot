/* global globalThis __dirname assert */
import path from 'path'
import fs from 'fs'
import process from 'process'

import { makeStatLogger } from '@agoric/stat-logger'
import {
  loadSwingsetConfigFile,
  loadBasedir,
  initializeSwingset,
  makeSwingsetController
} from '@agoric/swingset-vat'
import {
  initSwingStore as initSimpleSwingStore,
  openSwingStore as openSimpleSwingStore
} from '@agoric/swing-store-simple'
import {
  initSwingStore as initLMDBSwingStore,
  openSwingStore as openLMDBSwingStore
} from '@agoric/swing-store-lmdb'

import { dumpStore } from './swingset/dumpstore'
import { auditRefCounts } from './swingset/auditstore'

import { prepareDevices } from './swingset-devices'

const log = console.log

function readClock () {
  return process.hrtime.bigint()
}

function fail (message) {
  log(message)
  process.exit(1)
}

function generateIndirectConfig (baseConfig) {
  const config = {
    bootstrap: 'launcher',
    bundles: {},
    vats: {
      launcher: {
        sourceSpec: path.resolve(__dirname, 'vat-launcher.js'),
        parameters: {
          config: {
            bootstrap: baseConfig.bootstrap,
            vats: {}
          }
        }
      }
    }
  }
  if (baseConfig.vats) {
    for (const vatName of Object.keys(baseConfig.vats)) {
      const baseVat = { ...baseConfig.vats[vatName] }
      let newBundleName = `bundle-${vatName}`
      if (baseVat.sourceSpec) {
        config.bundles[newBundleName] = { sourceSpec: baseVat.sourceSpec }
        delete baseVat.sourceSpec
      } else if (baseVat.bundleSpec) {
        config.bundles[newBundleName] = { bundleSpec: baseVat.bundleSpec }
        delete baseVat.bundleSpec
      } else if (baseVat.bundle) {
        config.bundles[newBundleName] = { bundle: baseVat.bundle }
        delete baseVat.bundle
      } else if (baseVat.bundleName) {
        newBundleName = baseVat.bundleName
        config.bundles[newBundleName] = baseConfig.bundles[baseVat.bundleName]
      } else {
        fail('this can\'t happen')
      }
      baseVat.bundleName = newBundleName
      config.vats.launcher.parameters.config.vats[vatName] = baseVat
    }
  }
  if (baseConfig.bundles) {
    for (const bundleName of Object.keys(baseConfig.bundles)) {
      config.bundles[bundleName] = baseConfig.bundles[bundleName]
    }
  }
  return config
}

/* eslint-disable no-use-before-define */

/**
 * Command line utility to run a swingset for development and testing purposes.
 */
export async function createSwingsetRunner () {
  let forceReset = false
  const dbMode = '--lmdb'
  const blockSize = 200
  // let batchSize = 200
  const blockMode = false
  const logTimes = false
  const logMem = false
  const logDisk = false
  const logStats = false
  const logTag = 'runner'
  const slogFile = null
  const forceGC = false
  const verbose = false
  const doDumps = false
  const doAudits = false
  const dumpDir = '.'
  const dumpTag = 't'
  const rawMode = false
  // const shouldPrintStats = false
  // let globalMeteringActive = false
  const meterVats = false
  const launchIndirectly = false
  // const benchmarkRounds = 0
  const configPath = null
  // const statsFile = null
  let dbDir = null
  const initOnly = false

  // case '--init':
  forceReset = true

  let basedir = 'social-repl'
  const bootstrapArgv = []

  let config
  if (configPath) {
    config = loadSwingsetConfigFile(configPath)
    if (config === null) {
      fail(`config file ${configPath} not found`)
    }
    basedir = path.dirname(configPath)
  } else {
    config = loadBasedir(basedir)
  }
  if (launchIndirectly) {
    config = generateIndirectConfig(config)
  }
  if (!dbDir) {
    dbDir = basedir
  }

  let endowments = {}

  const messageResponsePromises = {}
  function doOutboundBridge (msgId, value) {
    if (!messageResponsePromises[msgId]) {
      console.warn('outbound missing msg id', msgId)
      return
    }
    messageResponsePromises[msgId].resolve(value)
  }

  // add devices
  const { deviceConfig, deviceEndowments, devices } = prepareDevices({ doOutboundBridge })
  // append deviceConfig
  config.devices = {
    ...deviceConfig,
    ...(config.devices || {})
  }
  endowments = { ...endowments, ...deviceEndowments }

  let store
  const kernelStateDBDir = path.join(dbDir, 'swingset-kernel-state')
  switch (dbMode) {
    case '--filedb':
      if (forceReset) {
        store = initSimpleSwingStore(kernelStateDBDir)
      } else {
        store = openSimpleSwingStore(kernelStateDBDir)
      }
      break
    case '--memdb':
      store = initSimpleSwingStore()
      break
    case '--lmdb':
      if (forceReset) {
        store = initLMDBSwingStore(kernelStateDBDir)
      } else {
        store = openLMDBSwingStore(kernelStateDBDir)
      }
      break
    default:
      fail(`invalid database mode ${dbMode}`)
  }
  if (config.bootstrap) {
    config.vats[config.bootstrap].parameters.metered = meterVats
  }
  const runtimeOptions = {}
  if (verbose) {
    runtimeOptions.verbose = true
  }
  if (slogFile) {
    runtimeOptions.slogFile = slogFile
    if (forceReset) {
      try {
        fs.unlinkSync(slogFile)
      } catch (e) {
        if (e.code !== 'ENOENT') {
          fail(`${e}`)
        }
      }
    }
  }
  let bootstrapResult
  if (forceReset) {
    bootstrapResult = await initializeSwingset(
      config,
      bootstrapArgv,
      store.storage,
      runtimeOptions
    )
    if (initOnly) {
      store.commit()
      store.close()
      return
    }
  }
  const controller = await makeSwingsetController(
    store.storage,
    endowments,
    runtimeOptions
  )

  let blockNumber = 0
  let statLogger = null
  if (logTimes || logMem || logDisk) {
    let headers = ['block', 'steps']
    if (logTimes) {
      headers.push('btime', 'ctime')
    }
    if (logMem) {
      headers = headers.concat(['rss', 'heapTotal', 'heapUsed', 'external'])
    }
    if (logDisk) {
      headers.push('disk')
    }
    if (logStats) {
      const statNames = Object.keys(controller.getStats())
      headers = headers.concat(statNames)
    }
    statLogger = makeStatLogger(logTag, headers)
  }

  let crankNumber = 0

  // skip the command switch

  // initialize
  await runBatch(0, blockMode)

  // return a swingsetRunner api
  let messageCount = 0
  return {
    bootstrapResult,
    getCrankNumber,
    async handleMessage (...args) {
      const messageId = messageCount
      messageCount++
      const deferred = defer()
      messageResponsePromises[messageId] = deferred
      // deliver the message
      await devices.bridge.deliverInbound(messageId, ...args)
      // run the message
      await runBatch(0, blockMode)
      return deferred.promise
    }
  }

  // if (statLogger) {
  //   statLogger.close()
  // }

  function getCrankNumber () {
    return Number(store.storage.get('crankNumber'))
  }

  function kernelStateDump () {
    const dumpPath = `${dumpDir}/${dumpTag}${crankNumber}`
    dumpStore(store.storage, dumpPath, rawMode)
  }

  async function runBlock (requestedSteps, doCommit) {
    const blockStartTime = readClock()
    let actualSteps = 0
    if (verbose) {
      log('==> running block')
    }
    while (requestedSteps > 0) {
      requestedSteps -= 1
      // eslint-disable-next-line no-await-in-loop
      const stepped = await controller.step()
      if (stepped < 1) {
        break
      }
      crankNumber += stepped
      actualSteps += stepped
      if (doDumps) {
        kernelStateDump()
      }
      if (doAudits) {
        auditRefCounts(store.storage)
      }
      if (verbose) {
        log(`===> end of crank ${crankNumber}`)
      }
    }
    const commitStartTime = readClock()
    if (doCommit) {
      store.commit()
    }
    const blockEndTime = readClock()
    if (forceGC) {
      globalThis.gc()
    }
    if (statLogger) {
      blockNumber += 1
      let data = [blockNumber, actualSteps]
      if (logTimes) {
        data.push(blockEndTime - blockStartTime)
        data.push(blockEndTime - commitStartTime)
      }
      if (logMem) {
        const mem = process.memoryUsage()
        data = data.concat([
          mem.rss,
          mem.heapTotal,
          mem.heapUsed,
          mem.external
        ])
      }
      if (logDisk) {
        const diskUsage = dbMode === '--lmdb' ? store.diskUsage() : 0
        data.push(diskUsage)
      }
      if (logStats) {
        data = data.concat(Object.values(controller.getStats()))
      }
      statLogger.log(data)
    }
    return actualSteps
  }

  async function runBatch (stepLimit, doCommit) {
    const startTime = readClock()
    let totalSteps = 0
    let steps
    const runAll = stepLimit === 0
    do {
      // eslint-disable-next-line no-await-in-loop
      steps = await runBlock(blockSize, doCommit)
      totalSteps += steps
      stepLimit -= steps
    /* eslint-disable-next-line no-unmodified-loop-condition */
    } while ((runAll || stepLimit > 0) && steps >= blockSize)
    return [totalSteps, readClock() - startTime]
  }
}

function defer () {
  let resolve
  let reject
  /* eslint-disable-next-line promise/param-names */
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  assert(resolve !== undefined)
  assert(reject !== undefined)
  return { promise, resolve, reject }
}
