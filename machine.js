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
      }
    },
    devices: {
      ...deviceConfig
    },
    bundles: {
      room: {
        sourceSpec: path.resolve(__dirname, 'social-repl', 'vat-room.js')
      }
    }
  }

  const swingetRunner = await createSwingsetRunner({
    basedir: 'social-repl',
    config,
    endowments: deviceEndowments
    // devices,
    // below are options triggered by --meter flag
    // meterVats: true,
    // globalMeteringActive: true,
    // launchIndirectly: true
  })

  // return a swingsetRunner api
  return {
    async handleMessage (...args) {
      const msg = createMessage()
      // deliver the message
      await devices.bridge.deliverInbound(msg.id, ...args)
      // run the message
      await swingetRunner.run()
      // resolved when handleMessageResponse is called with the matching id
      return msg.promise
    }
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
    delete messageResponsePromises[msgId]
  }

  function createMessage () {
    const messageId = messageCount
    messageCount++
    const deferred = defer()
    messageResponsePromises[messageId] = deferred
    return { id: messageId, promise: deferred.promise }
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
