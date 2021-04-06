/* global assert */
import path from 'path'
import { prepareDevices } from './swingset-devices'
import { createSwingsetRunner } from './swingset-main'

export async function createMachine () {
  const { createMessage, handleMessageResponse } = createMessageManager()

  // create devices
  const { devices, deviceConfig, deviceEndowments } = prepareDevices({ doOutboundBridge: handleMessageResponse })

  const config = {
    bootstrap: 'bootstrap',
    vats: {
      bootstrap: {
        sourceSpec: path.resolve(__dirname, 'social-repl', 'bootstrap.js'),
        parameters: {}
      },
      zoe: {
        sourceSpec: path.resolve(__dirname, 'social-repl', 'vat-zoe.js'),
        parameters: {
          zcfBundleName: 'zcf'
        }
      }
    },
    devices: {
      ...deviceConfig
    },
    bundles: {
      author: {
        sourceSpec: path.resolve(__dirname, 'social-repl', 'vat-author.js')
      },
      zcf: {
        sourceSpec: require.resolve('@agoric/zoe/contractFacet')
      }
    }
  }

  const swingsetRunner = await createSwingsetRunner({
    basedir: 'social-repl',
    config,
    endowments: deviceEndowments,
    // below are options triggered by --meter flag
    meterVats: true,
    globalMeteringActive: true
    // launchIndirectly: true
  })

  let aborting = false

  // return a swingsetRunner api
  return {
    handleMessage
  }

  async function handleMessage (...args) {
    if (aborting) {
      throw new Error('restarting, please wait...')
    }
    try {
      const stringResponse = await runMessage(...args)
      const response = deserializeResponse(stringResponse)
      // no failure - commit message and continue
      swingsetRunner.commit()
      return response
    } catch (err) {
      aborting = true
      // allow time to respond, then exit (and restart)
      setTimeout(() => process.exit(1), 200)
      throw err
    }
  }

  // we cant seem to detect "Compute meter exceeded" (eg inf loop)
  // with `swingsetRunner.run`. Additionally, the kernel
  // seems to hang in response to a inf-loop, so we
  // error here if the `swingsetRunner.run` completed
  // without responding via the bridge device.
  // then handleMessage can close the process
  // which hopefully will be restarted
  async function runMessage (...args) {
    const msg = createMessage()
    // deliver the message
    await devices.bridge.deliverInbound(msg.id, ...args)
    // run the message
    try {
      // "Compute meter exceeded" does not throw here
      await swingsetRunner.run()
    } catch (err) {
      // not aware of any errors that make it here
      console.log('errored', err)
      // msg.reject(err)
      msg.resolve({ error: err })
    } finally {
      msg.destroy('machine failed to respond to message, reverting...')
    }
    // resolved when handleMessageResponse is called with the matching id
    return msg.promise
  }
}

function createMessageManager () {
  let messageCount = 0
  const messageResponsePromises = {}
  return { createMessage, handleMessageResponse }

  function handleMessageResponse (msgId, value) {
    if (!messageResponsePromises[msgId]) {
      console.warn('outbound missing msg id', msgId)
      return
    }
    messageResponsePromises[msgId].resolve(value)
  }

  function createMessage () {
    const msgId = messageCount
    messageCount++
    const deferred = defer()
    messageResponsePromises[msgId] = deferred
    return { id: msgId, destroy, ...deferred }

    function destroy (errMsg = 'message destroyed before resolution') {
      // this rejection is ignored if it already resolved
      messageResponsePromises[msgId].reject(new Error(errMsg))
      delete messageResponsePromises[msgId]
    }
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

function deserializeResponse (stringResponse) {
  try {
    console.log(stringResponse)
    return JSON.parse(stringResponse)
  } catch (err) {
    return { error: err }
  }
}
