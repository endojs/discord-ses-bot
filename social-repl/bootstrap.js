/* global harden */
import { E } from '@agoric/eventual-send'

const log = console.log

log('bootstrap: loading')
export function buildRootObject (vatPowers) {
  log('bootstrap: setup called')
  const { D /* testLog */ } = vatPowers
  return harden({

    async bootstrap (vats, devices) {
      log('bootstrap: bootstrap() called')
      const vatMaker = E(vats.vatAdmin).createVatAdminService(devices.vatAdmin)
      log('bootstrap: vatMaker created')

      // make social-repl vat
      const roomVat = await E(vatMaker).createVatByName('room', {
        metered: true,
        vatParameters: {}
      })
      log('bootstrap: roomVat created')

      const inboundHandler = harden({
        async inbound (msgId, authorId, command) {
          log(`bootstrap: command - "${authorId}" runs "${command}"`)
          const response = await E(roomVat.root).handleCommand({ authorId, command })
          D(devices.bridge).callOutbound(msgId, response)
        }
      })
      D(devices.bridge).registerInboundHandler(inboundHandler)
      log('bootstrap: registered bridge inbound handler')
    }

  })
}
