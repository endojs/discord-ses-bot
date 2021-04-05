/* global harden */
// import { E } from '@agoric/eventual-send'
// import { makeIssuerKit } from '@agoric/ertp'
// import buildManualTimer from '@agoric/zoe/tools/manualTimer'

/* eslint-disable import/no-unresolved, import/extensions */
import automaticRefundBundle from './bundle-automaticRefund'
// import coveredCallBundle from './bundle-coveredCall'
// import secondPriceAuctionBundle from './bundle-secondPriceAuction'
// import atomicSwapBundle from './bundle-atomicSwap'
// import simpleExchangeBundle from './bundle-simpleExchange'
import autoswapBundle from './bundle-autoswap'
// import sellItemsBundle from './bundle-sellItems'
// import mintAndSellNFTBundle from './bundle-mintAndSellNFT'
// import otcDeskBundle from './bundle-otcDesk'
/* eslint-enable import/no-unresolved, import/extensions */

// eslint-disable-next-line import/no-extraneous-dependencies
import { makeIssuerKit } from '@agoric/ertp'

// eslint-disable-next-line import/no-extraneous-dependencies
import { makeRegistrar } from '@agoric/registrar'

import { assert } from '@agoric/assert'
import { E } from '@agoric/eventual-send'
// eslint-disable-next-line import/no-extraneous-dependencies
import { makeBoard } from '@agoric/cosmic-swingset/lib/ag-solo/vats/lib-board'
import { makeWallet } from '@agoric/dapp-svelte-wallet/api/src/lib-wallet'

import { createKernel } from './kernel'
// import '../src/types';

// const ZOE_INVITE_PURSE_PETNAME = 'Default Zoe invite purse';

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
      // const installations = {
      //   automaticRefund: await E(zoe).install(automaticRefundBundle.bundle),
      //   coveredCall: await E(zoe).install(coveredCallBundle.bundle),
      //   secondPriceAuction: await E(zoe).install(
      //     secondPriceAuctionBundle.bundle
      //   ),
      //   atomicSwap: await E(zoe).install(atomicSwapBundle.bundle),
      //   simpleExchange: await E(zoe).install(simpleExchangeBundle.bundle),
      //   autoswap: await E(zoe).install(autoswapBundle.bundle),
      //   sellItems: await E(zoe).install(sellItemsBundle.bundle),
      //   mintAndSellNFT: await E(zoe).install(mintAndSellNFTBundle.bundle),
      //   otcDesk: await E(zoe).install(otcDeskBundle.bundle)
      // }

      const {
        moolaBundle,
        simoleanBundle,
        rpgBundle,
        // registry,
        board,
        // invite,
        // addLiquidityInvite,
        // installation,
        // instance,
        // autoswapInstanceHandle,
        // autoswapInstallationHandle,
        // pursesStateChangeLog,
        // inboxStateChangeLog,
        pursesStateChangeHandler,
        inboxStateChangeHandler
      } = await setupEconomy({ zoe })

      const kernel = createKernel()

      const authorMap = new Map()
      // const { timer, issuers, makePayments } = createZoeThings()

      const inboundHandler = harden({
        async inbound (msgId, authorId, command) {
          log(`bootstrap: command - "${authorId}" runs "${command}"`)
          let response
          let author
          try {
            author = await prepareAuthor(authorId)
            // this is a noop if already exists
            // this is how we expose the wallet
            kernel.createAuthor(authorId, { ...author })
          } catch (err) {
            log('bootstrap: prepareAuthor failed', err)
            response = { error: err }
          }
          log('bootstrap: after prepare author')
          // if no error, handle the command
          if (!response) {
            try {
              response = kernel.handleCommand({ authorId, command })
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
          const author = await createAuthor({
            vatMaker,
            zoe,
            moolaBundle,
            simoleanBundle,
            rpgBundle,
            board,
            pursesStateChangeHandler,
            inboxStateChangeHandler
          })
          // const author = await createAuthor({ vatMaker, zoe, issuers, makePayments, installations, timer })
          authorMap.set(authorId, author)
          return author
        }
      }
    }

  })
}

// async function createAuthor ({ vatMaker, zoe, issuers, makePayments, installations, timer }) {
async function createAuthor ({
  vatMaker,
  zoe,
  board,
  pursesStateChangeHandler,
  inboxStateChangeHandler,
  moolaBundle,
  simoleanBundle,
  rpgBundle
}) {
  // const values = [100, 100, 100]
  // const vat = await E(vatMaker).createVatByName('author', {
  //   // metered: true,
  //   vatParameters: {}
  // })

  const { wallet } = await setupWallet({
    zoe,
    board,
    moolaBundle,
    simoleanBundle,
    rpgBundle,
    pursesStateChangeHandler,
    inboxStateChangeHandler
  })
  // const actor = await E(vat.root).build(wallet)
  return { wallet }
}

async function setupEconomy ({ zoe }) {
  const pursesStateChangeLog = []
  const inboxStateChangeLog = []
  const pursesStateChangeHandler = data => {
    pursesStateChangeLog.push(data)
  }
  const inboxStateChangeHandler = data => {
    inboxStateChangeLog.push(data)
  }

  const moolaBundle = makeIssuerKit('moola')
  const simoleanBundle = makeIssuerKit('simolean')
  const rpgBundle = makeIssuerKit('rpg', 'strSet')
  const registry = makeRegistrar()
  const board = makeBoard()

  // Create AutomaticRefund instance
  // const automaticRefundContractRoot = require.resolve(
  //   '@agoric/zoe/src/contracts/automaticRefund',
  // );
  // const automaticRefundBundle = await bundleSource(automaticRefundContractRoot);
  const installation = await E(zoe).install(automaticRefundBundle.bundle)
  const issuerKeywordRecord = harden({ Contribution: moolaBundle.issuer })
  const { creatorInvitation: invite, instance } = await E(zoe).startInstance(
    installation,
    issuerKeywordRecord
  )
  assert(invite)

  // Create Autoswap instance
  // const autoswapContractRoot = require.resolve(
  //   '@agoric/zoe/src/contracts/autoswap',
  // );
  // const autoswapBundle = await bundleSource(autoswapContractRoot);
  const autoswapInstallationHandle = await E(zoe).install(autoswapBundle.bundle)
  const autoswapIssuerKeywordRecord = harden({
    Central: moolaBundle.issuer,
    Secondary: simoleanBundle.issuer
  })
  const {
    publicFacet: autoswapPublicFacet,
    instance: autoswapInstanceHandle
  } = await E(zoe).startInstance(
    autoswapInstallationHandle,
    autoswapIssuerKeywordRecord
  )

  const addLiquidityInvite = await E(autoswapPublicFacet).makeAddLiquidityInvitation()

  return {
    moolaBundle,
    simoleanBundle,
    rpgBundle,
    registry,
    board,
    invite,
    addLiquidityInvite,
    installation,
    instance,
    autoswapInstanceHandle,
    autoswapInstallationHandle,
    pursesStateChangeLog,
    inboxStateChangeLog,
    pursesStateChangeHandler,
    inboxStateChangeHandler
  }
}

async function setupWallet ({ zoe, board, moolaBundle, simoleanBundle, rpgBundle, pursesStateChangeHandler, inboxStateChangeHandler }) {
  const { admin: wallet, initialized } = makeWallet({
    zoe,
    board,
    pursesStateChangeHandler,
    inboxStateChangeHandler
  })
  await initialized

  await wallet.addIssuer('moola', moolaBundle.issuer)
  await wallet.addIssuer('simolean', simoleanBundle.issuer)
  await wallet.addIssuer('rpg', rpgBundle.issuer)

  return { wallet }
}
