/* global harden */
// import { E } from '@agoric/eventual-send'
import { createKernel } from './kernel'

const log = console.log

log('=> loading bootstrap.js')

export function buildRootObject (vatPowers) {
  log('=> setup called')
  const { D /* testLog */ } = vatPowers
  return harden({
    bootstrap (_vats, devices) {
      log('=> bootstrap() called')
      const kernel = createKernel()
      const inboundHandler = harden({
        inbound (msgId, authorId, command) {
          log(`command: ${authorId} runs "${command}"`)
          const { error, result } = kernel.handleCommand({ authorId, command })
          D(devices.bridge).callOutbound(msgId, { error, result })
        }
      })
      D(devices.bridge).registerInboundHandler(inboundHandler)
    }
  })
}
