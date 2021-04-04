/* global harden */
import { E } from '@agoric/eventual-send'

const log = console.log

log('=> loading bootstrap.js')

const inboundHandler = harden({
  inbound (...args) {
    log(`bootstrap vat saw: ${args}`)
    // no return value
  }
})

export function buildRootObject (vatPowers) {
  log('=> setup called')
  const { D /* testLog */ } = vatPowers
  return harden({
    bootstrap (vats, devices) {
      log('=> bootstrap() called')
      D(devices.bridge).registerInboundHandler(inboundHandler)
      E(vats.alice)
        .sayHelloTo(vats.bob)
        .then(
          r => log(`=> alice.hello(bob) resolved to '${r}'`),
          e => log(`=> alice.hello(bob) rejected as '${e}'`)
        )
    }
  })
}
