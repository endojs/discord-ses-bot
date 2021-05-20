import { inspect } from 'util'
import { promises as fs } from 'fs'

// LMDB bindings need to be imported before lockdown.
import 'node-lmdb'

// Now do lockdown.
import './swingset/install-optional-global-metering'
import './install-ses'

import { createMachine } from './machine.js'

const { appKey, appToken } = require('./config.json')
const { Client } = require('discord.js')

const REPLY_LIMIT = 2000
// This int isn't sensitive, it just describes the permissions we're requesting:
const PERMISSIONS_INT = 2147503168
const link = `https://discord.com/oauth2/authorize?client_id=${appKey}&scope=bot`

process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error.stack)
})

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
  const machine = await createMachine()

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

    // // check if its a no-commit query command
    // let isQuery = false
    // if (simulatePrefix === message[0]) {
    //   isQuery = true
    // }

    // This is a command for us!
    const command = message.substr(messagePrefix.length) // Cut off the prefix

    // machine.queue({ loggable, msg })
    let response
    try {
      response = await machine.handleMessage(authorId, command)
    } catch (err) {
      // encoutered fatal error (not a normal error with the evaled code)
      msg.reply(`Fatal Error: ${err.message}`)
      return
    }
    // message did not explode, commit to log
    await fs.appendFile('log.txt', `${JSON.stringify({ id: authorId, command })}\n`, 'utf8')
    const { error, result } = response
    let stringReply = serializeReply({ error, result })
    if (stringReply.length > REPLY_LIMIT) {
      const replyTruncactionMessage = `\n(reply truncated... length: ${stringReply.length})`
      stringReply = stringReply.slice(0, REPLY_LIMIT - replyTruncactionMessage.length) + replyTruncactionMessage
    }

    msg.reply(stringReply)
  })
}

function serializeReply ({ result, error }) {
  const opts = { depth: 1 }
  if (error) {
    return `Error Thrown: ${inspect(error, opts)}`
  } else {
    return inspect(result, opts)
  }

}
