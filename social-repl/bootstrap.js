/* global harden */
import { E } from '@agoric/eventual-send'

/* eslint-disable import/no-unresolved, import/extensions */
import automaticRefundBundle from './bundle-automaticRefund';
import coveredCallBundle from './bundle-coveredCall';
import secondPriceAuctionBundle from './bundle-secondPriceAuction';
import atomicSwapBundle from './bundle-atomicSwap';
import simpleExchangeBundle from './bundle-simpleExchange';
import autoswapBundle from './bundle-autoswap';
import sellItemsBundle from './bundle-sellItems';
import mintAndSellNFTBundle from './bundle-mintAndSellNFT';
import otcDeskBundle from './bundle-otcDesk';
/* eslint-enable import/no-unresolved, import/extensions */

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

      const zoe = await E(vats.zoe).buildZoe(vatMaker);
      const installations = {
        automaticRefund: await E(zoe).install(automaticRefundBundle.bundle),
        coveredCall: await E(zoe).install(coveredCallBundle.bundle),
        secondPriceAuction: await E(zoe).install(
          secondPriceAuctionBundle.bundle,
        ),
        atomicSwap: await E(zoe).install(atomicSwapBundle.bundle),
        simpleExchange: await E(zoe).install(simpleExchangeBundle.bundle),
        autoswap: await E(zoe).install(autoswapBundle.bundle),
        sellItems: await E(zoe).install(sellItemsBundle.bundle),
        mintAndSellNFT: await E(zoe).install(mintAndSellNFTBundle.bundle),
        otcDesk: await E(zoe).install(otcDeskBundle.bundle),
      };

      // // make social-repl vat
      // const roomVat = await E(vatMaker).createVatByName('room', {
      //   metered: true,
      //   vatParameters: {}
      // })
      // log('bootstrap: roomVat created')

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
