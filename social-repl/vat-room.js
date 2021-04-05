/* global harden */
import { createKernel } from './kernel'

const log = console.log

log('room: loading')
export function buildRootObject () {
  log('room: buildRootObject called')
  const kernel = createKernel()
  return harden({

    handleCommand ({ authorId, command }) {
      const response = kernel.handleCommand({ authorId, command })
      return response
    }

  })
}
