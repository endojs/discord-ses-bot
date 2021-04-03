const test = require('ava')
const {
  createMachine
} = require('../machine')

test('share', (t) => {
  const { replayPast, authorMap } = createMachine()
  const msgResults = replayPast([
    `1: my.likes = 0`,
    `1: my.like = () => my.likes++`,
    `1: my.like()`,
    `1: my.likes`,
    `1: share.like = my.like`,
    `2: others['1'].like()`,
  ])
  ensureNoErrors(t, msgResults)
  const author = authorMap.get('1')
  const { my } = author.compartment.globalThis
  t.deepEqual(my.likes, 2)
})

test('share number', (t) => {
  const { replayPast, authorMap } = createMachine()
  const msgResults = replayPast([
    `1: id`,
    `2: debugger; others['1'].xyz = true`,
  ])
  t.falsy(msgResults[0].error)
  t.truthy(msgResults[1].error)
})

test('send', (t) => {
  const { replayPast, authorMap } = createMachine()
  const msgResults = replayPast([
    `1: my.likes = 0`,
    `1: my.like = () => my.likes++`,
    `1: my.like()`,
    `2: id`,
    `1: send('2', 'like', my.like)`,
    `2: inbox['1'].like()`,
  ])
  ensureNoErrors(t, msgResults)
  const author = authorMap.get('1')
  const { my } = author.compartment.globalThis
  t.deepEqual(my.likes, 2)
})

function ensureNoErrors (t, msgResults) {
  msgResults.forEach(({ error, result }) => {
    if (error) throw error
  })
}