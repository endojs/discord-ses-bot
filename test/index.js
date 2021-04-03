const test = require('ava')
const {
  createMachine
} = require('../machine')

test('basic replay', (t) => {
  const { replayPast, authorMap } = createMachine()
  const msgResults = replayPast([
    `1: my.likes = 0`,
    `1: my.like = () => my.likes++`,
    `1: my.like()`,
    `1: my.likes`,
    `1: share.like = my.like`,
    `2: others['1'].like()`,
  ])
  const author = authorMap.get('1')
  const { my } = author.compartment.globalThis
  t.deepEqual(my.likes, 2)
  const hasError = msgResults.some(({ error }) => error)
  t.is(hasError, false)
})