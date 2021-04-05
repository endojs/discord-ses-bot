/* global harden, Compartment */
import { E } from '@agoric/eventual-send'
import { makeLocalAmountMath } from '@agoric/ertp'
import { assert, details as X } from '@agoric/assert'
import { makePrintLog } from './printLog'
// import { showPurseBalance, setupIssuers } from './helpers';

const build = async (log, zoe, wrappedIssuers, wrappedPayments, installations, timer) => {
  const issuers = Object.values(wrappedIssuers)
  const payments = Object.values(wrappedPayments)
  const { moola, simoleans, bucks, purses } = await setupIssuers(zoe, issuers)
  const [moolaPurseP, simoleanPurseP] = purses
  const [moolaPayment, simoleanPayment, bucksPayment] = payments
  const [moolaIssuer, simoleanIssuer, bucksIssuer] = issuers

  const doAutomaticRefund = async bobP => {
    log('=> author.doCreateAutomaticRefund called')
    const installId = installations.automaticRefund
    const issuerKeywordRecord = harden({
      Contribution1: moolaIssuer,
      Contribution2: simoleanIssuer
    })
    const { publicFacet, creatorInvitation: refundInvitation } = await E(
      zoe
    ).startInstance(installId, issuerKeywordRecord)

    const proposal = harden({
      give: { Contribution1: moola(3) },
      want: { Contribution2: simoleans(7) },
      exit: { onDemand: null }
    })

    const paymentKeywordRecord = { Contribution1: moolaPayment }
    const refundSeatP = await E(zoe).offer(
      refundInvitation,
      proposal,
      paymentKeywordRecord
    )
    log(await E(refundSeatP).getOfferResult())

    const bobInvitation = E(publicFacet).makeInvitation()
    await E(bobP).doAutomaticRefund(bobInvitation)
    const moolaPayout = await E(refundSeatP).getPayout('Contribution1')
    const simoleanPayout = await E(refundSeatP).getPayout('Contribution2')

    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  const doCoveredCall = async bobP => {
    log('=> author.doCreateCoveredCall called')
    const installation = installations.coveredCall
    const issuerKeywordRecord = harden({
      UnderlyingAsset: moolaIssuer,
      StrikePrice: simoleanIssuer
    })
    const { creatorInvitation: writeCallInvitation } = await E(
      zoe
    ).startInstance(installation, issuerKeywordRecord)

    const proposal = harden({
      give: { UnderlyingAsset: moola(3) },
      want: { StrikePrice: simoleans(7) },
      exit: { afterDeadline: { deadline: 1, timer } }
    })

    const paymentKeywordRecord = { UnderlyingAsset: moolaPayment }
    const seatP = await E(zoe).offer(
      writeCallInvitation,
      proposal,
      paymentKeywordRecord
    )

    const optionP = E(seatP).getOfferResult()
    await E(bobP).doCoveredCall(optionP)
    const moolaPayout = await E(seatP).getPayout('UnderlyingAsset')
    const simoleanPayout = await E(seatP).getPayout('StrikePrice')
    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  const doSwapForOption = async (bobP, _carolP, daveP) => {
    log('=> author.doSwapForOption called')
    const issuerKeywordRecord = harden({
      UnderlyingAsset: moolaIssuer,
      StrikePrice: simoleanIssuer
    })
    const { creatorInvitation: writeCallInvitation } = await E(
      zoe
    ).startInstance(installations.coveredCall, issuerKeywordRecord)

    const proposal = harden({
      give: { UnderlyingAsset: moola(3) },
      want: { StrikePrice: simoleans(7) },
      exit: {
        afterDeadline: {
          deadline: 100,
          timer
        }
      }
    })

    const paymentKeywordRecord = harden({ UnderlyingAsset: moolaPayment })
    const seatP = await E(zoe).offer(
      writeCallInvitation,
      proposal,
      paymentKeywordRecord
    )

    log('call option made')
    const invitationForBob = E(seatP).getOfferResult()
    await E(bobP).doSwapForOption(invitationForBob, daveP)
    const moolaPayout = await E(seatP).getPayout('UnderlyingAsset')
    const simoleanPayout = await E(seatP).getPayout('StrikePrice')

    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  const doSecondPriceAuction = async (bobP, carolP, daveP) => {
    const issuerKeywordRecord = harden({
      Asset: moolaIssuer,
      Ask: simoleanIssuer
    })
    const now = await E(timer).getCurrentTimestamp()
    const terms = harden({ timeAuthority: timer, closesAfter: now + 1 })
    const { creatorInvitation: sellAssetsInvitation } = await E(
      zoe
    ).startInstance(
      installations.secondPriceAuction,
      issuerKeywordRecord,
      terms
    )

    const proposal = harden({
      give: { Asset: moola(1) },
      want: { Ask: simoleans(3) },
      exit: { waived: null }
    })
    const paymentKeywordRecord = { Asset: moolaPayment }
    const authorSeatP = await E(zoe).offer(
      sellAssetsInvitation,
      proposal,
      paymentKeywordRecord
    )

    const makeBidInvitationObj = await E(authorSeatP).getOfferResult()
    const bobInvitation = E(makeBidInvitationObj).makeBidInvitation()
    const carolInvitation = E(makeBidInvitationObj).makeBidInvitation()
    const daveInvitation = E(makeBidInvitationObj).makeBidInvitation()

    const bobBidDoneP = E(bobP).doSecondPriceAuctionBid(bobInvitation)
    const carolBidDoneP = E(carolP).doSecondPriceAuctionBid(carolInvitation)
    const daveBidDoneP = E(daveP).doSecondPriceAuctionBid(daveInvitation)

    await Promise.all([bobBidDoneP, carolBidDoneP, daveBidDoneP])
    await E(timer).tick()

    const bobCollectDoneP = E(bobP).doSecondPriceAuctionGetPayout()
    const carolCollectDoneP = E(carolP).doSecondPriceAuctionGetPayout()
    const daveCollectDoneP = E(daveP).doSecondPriceAuctionGetPayout()
    await Promise.all([bobCollectDoneP, carolCollectDoneP, daveCollectDoneP])

    const moolaPayout = await E(authorSeatP).getPayout('Asset')
    const simoleanPayout = await E(authorSeatP).getPayout('Ask')

    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  const doAtomicSwap = async bobP => {
    const issuerKeywordRecord = harden({
      Asset: moolaIssuer,
      Price: simoleanIssuer
    })
    const { creatorInvitation: firstOfferInvitation } = await E(
      zoe
    ).startInstance(installations.atomicSwap, issuerKeywordRecord)

    const proposal = harden({
      give: { Asset: moola(3) },
      want: { Price: simoleans(7) },
      exit: { onDemand: null }
    })
    const paymentKeywordRecord = { Asset: moolaPayment }
    const seatP = await E(zoe).offer(
      firstOfferInvitation,
      proposal,
      paymentKeywordRecord
    )

    E(bobP).doAtomicSwap(E(seatP).getOfferResult())

    const moolaPayout = await E(seatP).getPayout('Asset')
    const simoleanPayout = await E(seatP).getPayout('Price')

    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  const doSimpleExchange = async bobP => {
    const issuerKeywordRecord = harden({
      Price: simoleanIssuer,
      Asset: moolaIssuer
    })
    const { simpleExchange } = installations
    const { publicFacet } = await E(zoe).startInstance(
      simpleExchange,
      issuerKeywordRecord
    )

    const addOrderInvitation = await E(publicFacet).makeInvitation()
    const authorSellOrderProposal = harden({
      give: { Asset: moola(3) },
      want: { Price: simoleans(4) },
      exit: { onDemand: null }
    })
    const paymentKeywordRecord = { Asset: moolaPayment }
    const addOrderSeatP = await E(zoe).offer(
      addOrderInvitation,
      authorSellOrderProposal,
      paymentKeywordRecord
    )

    log(await E(addOrderSeatP).getOfferResult())

    const bobInvitationP = E(publicFacet).makeInvitation()
    await E(bobP).doSimpleExchange(bobInvitationP)
    const moolaPayout = await E(addOrderSeatP).getPayout('Asset')
    const simoleanPayout = await E(addOrderSeatP).getPayout('Price')

    await E(moolaPurseP).deposit(await moolaPayout)
    await E(simoleanPurseP).deposit(await simoleanPayout)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  function logStateOnChanges (notifier, lastCount = undefined) {
    const updateRecordP = E(notifier).getUpdateSince(lastCount)
    updateRecordP.then(updateRec => {
      log(updateRec.value)
      logStateOnChanges(notifier, updateRec.updateCount)
    })
  }

  const doSimpleExchangeWithNotification = async bobP => {
    const issuerKeywordRecord = harden({
      Price: simoleanIssuer,
      Asset: moolaIssuer
    })
    const { simpleExchange } = installations
    const { publicFacet } = await E(zoe).startInstance(
      simpleExchange,
      issuerKeywordRecord
    )

    logStateOnChanges(await E(publicFacet).getNotifier())

    const authorSellOrderProposal = harden({
      give: { Asset: moola(3) },
      want: { Price: simoleans(4) },
      exit: { onDemand: null }
    })
    const paymentKeywordRecord = { Asset: moolaPayment }
    const addOrderInvitation = await E(publicFacet).makeInvitation()
    const addOrderSeatP = await E(zoe).offer(
      addOrderInvitation,
      authorSellOrderProposal,
      paymentKeywordRecord
    )

    log(await E(addOrderSeatP).getOfferResult())

    const bobInvitation1P = E(publicFacet).makeInvitation()
    await E(bobP).doSimpleExchangeUpdates(bobInvitation1P, 3, 7)
    const bobInvitation2P = E(publicFacet).makeInvitation()
    await E(bobP).doSimpleExchangeUpdates(bobInvitation2P, 8, 2)

    const moolaPayout = await E(addOrderSeatP).getPayout('Asset')
    const simoleanPayout = await E(addOrderSeatP).getPayout('Price')

    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)
    const bobInvitation3P = E(publicFacet).makeInvitation()
    await E(bobP).doSimpleExchangeUpdates(bobInvitation3P, 20, 13)
    const bobInvitation4P = E(publicFacet).makeInvitation()
    await E(bobP).doSimpleExchangeUpdates(bobInvitation4P, 5, 2)
    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
  }

  const doAutoswap = async bobP => {
    const issuerKeywordRecord = harden({
      Central: moolaIssuer,
      Secondary: simoleanIssuer
    })
    const { publicFacet, instance } = await E(zoe).startInstance(
      installations.autoswap,
      issuerKeywordRecord
    )
    const liquidityIssuer = await E(publicFacet).getLiquidityIssuer()
    const liquidityAmountMath = await makeLocalAmountMath(liquidityIssuer)
    const liquidity = liquidityAmountMath.make

    // Alice adds liquidity
    // 10 moola = 5 simoleans at the time of the liquidity adding
    // aka 2 moola = 1 simolean
    const addLiquidityProposal = harden({
      give: { Central: moola(10), Secondary: simoleans(5) },
      want: { Liquidity: liquidity(10) }
    })
    const paymentKeywordRecord = harden({
      Central: moolaPayment,
      Secondary: simoleanPayment
    })
    const addLiquidityInvitation = E(publicFacet).makeAddLiquidityInvitation()
    const addLiqSeatP = await E(zoe).offer(
      addLiquidityInvitation,
      addLiquidityProposal,
      paymentKeywordRecord
    )

    log(await E(addLiqSeatP).getOfferResult())

    const liquidityPayout = await E(addLiqSeatP).getPayout('Liquidity')

    const liquidityTokenPurseP = E(liquidityIssuer).makeEmptyPurse()
    await E(liquidityTokenPurseP).deposit(liquidityPayout)

    await E(bobP).doAutoswap(instance)

    // remove the liquidity
    const authorRemoveLiquidityProposal = harden({
      give: { Liquidity: liquidity(10) },
      want: { Central: moola(0), Secondary: simoleans(0) }
    })

    const liquidityTokenPayment = await E(liquidityTokenPurseP).withdraw(
      liquidity(10)
    )
    const removeLiquidityInvitation = E(
      publicFacet
    ).makeRemoveLiquidityInvitation()

    const removeLiquiditySeatP = await E(zoe).offer(
      removeLiquidityInvitation,
      authorRemoveLiquidityProposal,
      harden({ Liquidity: liquidityTokenPayment })
    )

    log(await E(removeLiquiditySeatP).getOfferResult())

    const moolaPayout = await E(removeLiquiditySeatP).getPayout('Central')
    const simoleanPayout = await E(removeLiquiditySeatP).getPayout('Secondary')

    await E(moolaPurseP).deposit(moolaPayout)
    await E(simoleanPurseP).deposit(simoleanPayout)

    const poolAmounts = await E(publicFacet).getPoolAllocation()

    log('poolAmounts', poolAmounts)

    await showPurseBalance(moolaPurseP, 'authorMoolaPurse', log)
    await showPurseBalance(simoleanPurseP, 'authorSimoleanPurse', log)
    await showPurseBalance(
      liquidityTokenPurseP,
      'authorLiquidityTokenPurse',
      log
    )
  }

  const doSellTickets = async bobP => {
    const { mintAndSellNFT } = installations
    const { creatorFacet } = await E(zoe).startInstance(mintAndSellNFT)

    // completeObj exists because of a current limitation in @agoric/marshal : https://github.com/Agoric/agoric-sdk/issues/818
    const {
      sellItemsInstance: ticketSalesInstance,
      sellItemsCreatorSeat,
      sellItemsPublicFacet,
      sellItemsCreatorFacet
    } = await E(creatorFacet).sellTokens({
      customValueProperties: {
        show: 'Steven Universe, the Opera',
        start: 'Wed, March 25th 2020 at 8pm'
      },
      count: 3,
      moneyIssuer: moolaIssuer,
      sellItemsInstallation: installations.sellItems,
      pricePerItem: moola(22)
    })
    const buyerInvitation = E(sellItemsCreatorFacet).makeBuyerInvitation()
    await E(bobP).doBuyTickets(ticketSalesInstance, buyerInvitation)

    const availableTickets = await E(sellItemsPublicFacet).getAvailableItems()

    log('after ticket1 purchased: ', availableTickets)

    await E(sellItemsCreatorSeat).tryExit()

    const moneyPayment = await E(sellItemsCreatorSeat).getPayout('Money')
    await E(moolaPurseP).deposit(moneyPayment)
    const currentPurseBalance = await E(moolaPurseP).getCurrentAmount()

    log('author earned: ', currentPurseBalance)
  }

  const doOTCDesk = async bobP => {
    const { creatorFacet } = await E(zoe).startInstance(
      installations.otcDesk,
      undefined,
      { coveredCallInstallation: installations.coveredCall }
    )

    // Add inventory
    const addInventoryInvitation = await E(
      creatorFacet
    ).makeAddInventoryInvitation({
      Moola: moolaIssuer,
      Simolean: simoleanIssuer,
      Buck: bucksIssuer
    })
    const addInventoryProposal = harden({
      give: {
        Moola: moola(10000),
        Simolean: simoleans(10000),
        Buck: bucks(10000)
      }
    })
    const addInventoryPayments = {
      Moola: moolaPayment,
      Simolean: simoleanPayment,
      Buck: bucksPayment
    }

    const addInventorySeat = await E(zoe).offer(
      addInventoryInvitation,
      addInventoryProposal,
      addInventoryPayments
    )
    const addInventoryOfferResult = await E(addInventorySeat).getOfferResult()
    log(addInventoryOfferResult)
    const bobInvitation = await E(creatorFacet).makeQuote(
      { Simolean: simoleans(4) },
      { Moola: moola(3) },
      timer,
      1n
    )

    await E(bobP).doOTCDesk(bobInvitation)

    // Remove Inventory
    const removeInventoryInvitation = await E(
      creatorFacet
    ).makeRemoveInventoryInvitation()
    // Intentionally do not remove it all
    const removeInventoryProposal = harden({
      want: { Simolean: simoleans(2) }
    })
    const removeInventorySeat = await E(zoe).offer(
      removeInventoryInvitation,
      removeInventoryProposal
    )
    const removeInventoryOfferResult = await E(
      removeInventorySeat
    ).getOfferResult()
    log(removeInventoryOfferResult)
    const simoleanPayout = await E(removeInventorySeat).getPayout('Simolean')

    log(await E(simoleanIssuer).getAmountOf(simoleanPayout))
  }

  const compartment = new Compartment({
    log,
    zoe,
    issuers,
    payments,
    installations,
    timer,
    moola,
    simoleans,
    bucks,
    purses,
    moolaPurseP,
    simoleanPurseP,
    moolaPayment,
    simoleanPayment,
    bucksPayment,
    moolaIssuer,
    simoleanIssuer,
    bucksIssuer,
    doAutomaticRefund,
    doCoveredCall,
    doSwapForOption,
    doSecondPriceAuction,
    doAtomicSwap,
    doSimpleExchange,
    doSimpleExchangeWithNotification,
    doAutoswap,
    doSellTickets,
    doOTCDesk
  })

  return harden({
    handleCommand: (command) => {
      let result, error
      try {
        result = compartment.evaluate(command)
      } catch (err) {
        error = {
          message: err.message
          // this causes is non determinism
          // stack: err.stack
        }
      }
      return serializeOutput({ error, result })
    },
    startTest: async (testName, bobP, carolP, daveP) => {
      switch (testName) {
        case 'automaticRefundOk': {
          return doAutomaticRefund(bobP, carolP, daveP)
        }
        case 'coveredCallOk': {
          return doCoveredCall(bobP, carolP, daveP)
        }
        case 'swapForOptionOk': {
          return doSwapForOption(bobP, carolP, daveP)
        }
        case 'secondPriceAuctionOk': {
          return doSecondPriceAuction(bobP, carolP, daveP)
        }
        case 'atomicSwapOk': {
          return doAtomicSwap(bobP, carolP, daveP)
        }
        case 'simpleExchangeOk': {
          return doSimpleExchange(bobP, carolP, daveP)
        }
        case 'simpleExchangeNotifier': {
          return doSimpleExchangeWithNotification(bobP, carolP, daveP)
        }
        case 'autoswapOk': {
          return doAutoswap(bobP, carolP, daveP)
        }
        case 'sellTicketsOk': {
          return doSellTickets(bobP, carolP, daveP)
        }
        case 'otcDeskOk': {
          return doOTCDesk(bobP)
        }
        default: {
          assert.fail(X`testName ${testName} not recognized`)
        }
      }
    }
  })
}

export function buildRootObject (_vatPowers) {
  return harden({
    build: (...args) => build(makePrintLog(), ...args)
  })
}

function serializeOutput (value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch (err) {
    return '{ "error": "<failed to serialize result>" }'
  }
}

export const showPurseBalance = async (purseP, name, log) => {
  try {
    const amount = await E(purseP).getCurrentAmount()
    log(name, ': balance ', amount)
  } catch (err) {
    console.error(err)
  }
}

export const setupIssuers = async (zoe, issuers) => {
  const purses = issuers.map(issuer => E(issuer).makeEmptyPurse())
  const inviteIssuer = await E(zoe).getInvitationIssuer()
  const [moolaIssuer, simoleanIssuer, bucksIssuer] = issuers

  const moolaAmountMath = await makeLocalAmountMath(moolaIssuer)
  const simoleanAmountMath = await makeLocalAmountMath(simoleanIssuer)
  const bucksAmountMath = await makeLocalAmountMath(bucksIssuer)

  const moola = moolaAmountMath.make
  const simoleans = simoleanAmountMath.make
  const bucks = bucksAmountMath.make

  return harden({
    issuers: harden([moolaIssuer, simoleanIssuer]),
    inviteIssuer,
    moolaIssuer,
    simoleanIssuer,
    bucksIssuer,
    moolaAmountMath,
    simoleanAmountMath,
    bucksAmountMath,
    moola,
    simoleans,
    bucks,
    purses
  })
}
