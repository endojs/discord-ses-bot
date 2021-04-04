const { appKey, appToken } = require('./config.json')
const {
  createMachine
} = require('./machine')
const { Client } = require('discord.js')

// This int isn't sensitive, it just describes the permissions we're requesting:
const PERMISSIONS_INT = 2147503168
const link = `https://discord.com/oauth2/authorize?client_id=${appKey}&scope=bot`

main()

async function main () {
  console.log(`Starting SES-bot! Add to your discord server with this link: \n${link}`)

  /**
   * DISCORD CONFIG SECTION
   */
  const client = new Client({
    client_id: appKey,
    scope: 'bot',
    permissions: PERMISSIONS_INT
  })

  client.login(appToken)
  const machine = createMachine()

  /**
   * CHAT MESSAGE HANDLING
   */

  client.on('message', async msg => {
    const authorId = msg.author.id
    const message = msg.content

    const simulatePrefix = '?'
    const messagePrefix = '$'
    if (![simulatePrefix, messagePrefix].includes(message[0])) {
      return
    }

    // This is a command for us!
    const command = message.substr(messagePrefix.length) // Cut off the prefix
    const loggable = { id: authorId, command }

    // For simulated calls, invoke a new machine to try it.
    if (simulatePrefix === message[0]) {
      const commands = await machine.getLogFromDisk()
      const counterfactual = createMachine({
        // We don't need to remember this state
        logging: false
      })
      await counterfactual.replayPast(commands)
      counterfactual.queue({ loggable, msg })
      return
    }

    machine.queue({ loggable, msg })
  })

  await machine.replayPastFromDisk()
}
