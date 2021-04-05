/* global harden, Compartment */
import { E } from '@agoric/eventual-send'
// import { makeLocalAmountMath } from '@agoric/ertp'
// import { assert, details as X } from '@agoric/assert'
import { makePrintLog, serialize } from './printLog'
// import { showPurseBalance, setupIssuers } from './helpers';

const build = async (wallet) => {
  const compartment = new Compartment({
    E,
    wallet,
    waitForUpdate
  })

  // await wallet.makeEmptyPurse('moola', 'fun money');
  // const moolaPurse = wallet.getPurse('fun money');

  // const moolaPayment = moolaBundle.mint.mintPayment(
  //   moolaBundle.amountMath.make(100n),
  // );
  // await waitForUpdate(E(moolaPurse).getCurrentAmountNotifier(), () =>
  //   wallet.deposit('fun money', moolaPayment),
  // );
  // t.deepEqual(
  //   await moolaPurse.getCurrentAmount(),

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
    return serialize(value)
  } catch (err) {
    return '{ "error": "<failed to serialize result>" }'
  }
}

// export const showPurseBalance = async (purseP, name, log) => {
//   try {
//     const amount = await E(purseP).getCurrentAmount()
//     log(name, ': balance ', amount)
//   } catch (err) {
//     console.error(err)
//   }
// }

// export const setupIssuers = async (zoe, issuers) => {
//   const purses = issuers.map(issuer => E(issuer).makeEmptyPurse())
//   const inviteIssuer = await E(zoe).getInvitationIssuer()
//   const [moolaIssuer, simoleanIssuer, bucksIssuer] = issuers

//   const moolaAmountMath = await makeLocalAmountMath(moolaIssuer)
//   const simoleanAmountMath = await makeLocalAmountMath(simoleanIssuer)
//   const bucksAmountMath = await makeLocalAmountMath(bucksIssuer)

//   const moola = moolaAmountMath.make
//   const simoleans = simoleanAmountMath.make
//   const bucks = bucksAmountMath.make

//   return harden({
//     issuers: harden([moolaIssuer, simoleanIssuer]),
//     inviteIssuer,
//     moolaIssuer,
//     simoleanIssuer,
//     bucksIssuer,
//     moolaAmountMath,
//     simoleanAmountMath,
//     bucksAmountMath,
//     moola,
//     simoleans,
//     bucks,
//     purses
//   })
// }

const waitForUpdate = async (notifier, thunk) => {
  const { updateCount } = await E(notifier).getUpdateSince()
  await thunk()
  return E(notifier).getUpdateSince(updateCount)
}
