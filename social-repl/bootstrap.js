/* global harden */
import { E } from '@agoric/eventual-send'
import { makeIssuerKit } from '@agoric/ertp'
import buildManualTimer from '@agoric/zoe/tools/manualTimer'

/* eslint-disable import/no-unresolved, import/extensions */
import automaticRefundBundle from './bundle-automaticRefund'
import coveredCallBundle from './bundle-coveredCall'
import secondPriceAuctionBundle from './bundle-secondPriceAuction'
import atomicSwapBundle from './bundle-atomicSwap'
import simpleExchangeBundle from './bundle-simpleExchange'
import autoswapBundle from './bundle-autoswap'
import sellItemsBundle from './bundle-sellItems'
import mintAndSellNFTBundle from './bundle-mintAndSellNFT'
import otcDeskBundle from './bundle-otcDesk'
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

      const zoe = await E(vats.zoe).buildZoe(vatMaker)
      const installations = {
        automaticRefund: await E(zoe).install(automaticRefundBundle.bundle),
        coveredCall: await E(zoe).install(coveredCallBundle.bundle),
        secondPriceAuction: await E(zoe).install(
          secondPriceAuctionBundle.bundle
        ),
        atomicSwap: await E(zoe).install(atomicSwapBundle.bundle),
        simpleExchange: await E(zoe).install(simpleExchangeBundle.bundle),
        autoswap: await E(zoe).install(autoswapBundle.bundle),
        sellItems: await E(zoe).install(sellItemsBundle.bundle),
        mintAndSellNFT: await E(zoe).install(mintAndSellNFTBundle.bundle),
        otcDesk: await E(zoe).install(otcDeskBundle.bundle)
      }

      const authorMap = new Map()
      const { timer, issuers, makePayments } = createZoeThings()

      const inboundHandler = harden({
        async inbound (msgId, authorId, command) {
          log(`bootstrap: command - "${authorId}" runs "${command}"`)
          let response
          let author
          try {
            author = await prepareAuthor(authorId)
          } catch (err) {
            log('bootstrap: prepareAuthor failed', err)
            response = { error: err }
          }
          log('bootstrap: after prepare author')
          // if no error, handle the command
          if (!response) {
            try {
              response = await E(author.wallet).handleCommand(command)
            } catch (err) {
              log('bootstrap: handleCommand failed')
              response = { error: err }
            }
            log('bootstrap: after handleCommand')
          }
          D(devices.bridge).callOutbound(msgId, response)
        }
      })
      D(devices.bridge).registerInboundHandler(inboundHandler)
      log('bootstrap: registered bridge inbound handler')

      async function prepareAuthor (authorId) {
        if (authorMap.has(authorId)) {
          return authorMap.get(authorId)
        } else {
          const author = await createAuthor({ vatMaker, zoe, issuers, makePayments, installations, timer })
          authorMap.set(authorId, author)
          return author
        }
      }
    }

  })
}

function setupBasicMints () {
  const all = [
    makeIssuerKit('moola'),
    makeIssuerKit('simoleans'),
    makeIssuerKit('bucks')
  ]
  const mints = all.map(objs => objs.mint)
  const issuers = all.map(objs => objs.issuer)
  const amountMaths = all.map(objs => objs.amountMath)

  return harden({
    mints,
    issuers,
    amountMaths
  })
};

function createZoeThings () {
  const timer = buildManualTimer(log)
  const { mints, issuers, amountMaths } = setupBasicMints()
  const makePayments = values =>
    mints.map((mint, i) => mint.mintPayment(amountMaths[i].make(values[i])))
  return { timer, issuers, makePayments }
}

async function createAuthor ({ vatMaker, zoe, issuers, makePayments, installations, timer }) {
  const values = [100, 100, 100]
  const vat = await E(vatMaker).createVatByName('author', {
    // metered: true,
    vatParameters: {}
  })
  // Setup Author
  const payments = makePayments(values)
  const wrappedPayments = {
    moola: payments[0],
    simoleans: payments[1],
    bucks: payments[2]
  }
  const wrappedIssuers = {
    moola: issuers[0],
    simoleans: issuers[1],
    bucks: issuers[2]
  }

  const wallet = await E(vat.root).build(
    zoe,
    wrappedIssuers,
    wrappedPayments,
    installations,
    timer
  )
  return { wallet, vat }
}
