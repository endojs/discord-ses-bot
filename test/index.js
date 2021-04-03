import test from 'ava';
import { createMachine } from '../machine';

test('share', async (t) => {
  const { replayPast, runner: { getSystemState } } = createMachine()
  const msgResults = await replayPast([
    `1: my.likes = 0`,
    `1: my.like = () => my.likes++`,
    `1: my.like()`,
    `1: my.likes`,
    `1: share.like = my.like`,
    `2: others['1'].like()`,
  ])
  ensureNoErrors(t, msgResults)
  const { authorsState } = await getSystemState()
  const author = authorsState['1']
  const { my } = author
  t.deepEqual(my.likes, 2)
})

test('share number', async (t) => {
  const { replayPast, runner: { getSystemState } } = createMachine()
  const msgResults = await replayPast([
    `1: id`,
    `2: debugger; others['1'].xyz = true`,
  ])
  t.falsy(msgResults[0].error)
  t.truthy(msgResults[1].error)
})

test('send', async (t) => {
  const { replayPast, runner: { getSystemState } } = createMachine()
  const msgResults = await replayPast([
    `1: my.likes = 0`,
    `1: my.like = () => my.likes++`,
    `1: my.like()`,
    `2: id`,
    `1: send('2', 'like', my.like)`,
    `2: inbox['1'].like()`,
  ])
  ensureNoErrors(t, msgResults)
  const { authorsState } = await getSystemState()
  const author = authorsState['1']
  const { my } = author
  t.deepEqual(my.likes, 2)
})

function ensureNoErrors (t, msgResults) {
  msgResults.forEach(({ error, result }) => {
    if (error) throw error
  })
}