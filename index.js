import {
  createMachine
} from './machine.js'
import { Client as DiscordClient } from 'discord.js'

// workaround for importing json
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { appKey, appToken } = require('./config.json')

// This int isn't sensitive, it just describes the permissions we're requesting:
const PERMISSIONS_INT = 2147503168
const link = `https://discord.com/oauth2/authorize?client_id=${appKey}&scope=bot`

main()

async function main () {
  console.log(`Starting SES-bot!`)

  /**
   * DISCORD CONFIG SECTION
   */
  console.log(`Add to your discord server with this link: \n${link}`)
  const discord = new DiscordClient({
    client_id: appKey,
    scope: 'bot',
    permissions: PERMISSIONS_INT
  })
  discord.login(appToken)
  discord.on('message', (discordMsg) => {
    handleMessage({
      authorId: discordMsg.author.id,
      content: discordMsg.content,
      reply: (text) => discordMsg.reply(text),
    })
  })

  /**
   * MESSAGE HANDLING
   */
  const machine = createMachine()

  await machine.replayPastFromDisk()

  async function handleMessage (msg) {
    const authorId = msg.authorId
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
  }

}
