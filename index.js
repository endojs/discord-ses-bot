import { inspect } from 'util'
import { promises as pfs } from 'fs'
import fs from 'fs'
import path from 'path'
const defaultLogPath = path.join(__dirname, 'log.txt')
// LMDB bindings need to be imported before lockdown.
import 'node-lmdb'

// Now do lockdown.
import './swingset/install-optional-global-metering'
import './install-ses'

import { createSwingsetRunner } from './swingset-main.js'

const { appKey, appToken } = require('./config.json')
const { Client } = require('discord.js')

const REPLY_LIMIT = 2000
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
  // const machine = createMachine()
  const swingsetRunner = await createSwingsetRunner()

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
    // const loggable = { id: authorId, command }

    // // For simulated calls, invoke a new machine to try it.
    // if (simulatePrefix === message[0]) {
    //   const commands = await machine.getLogFromDisk()
    //   const counterfactual = createMachine({
    //     // We don't need to remember this state
    //     logging: false
    //   })
    //   await counterfactual.replayPast(commands)
    //   counterfactual.queue({ loggable, msg })
    //   return
    // }

    // machine.queue({ loggable, msg })
    const { result, error } = await swingsetRunner.handleMessage(authorId, command)
    // console.log(`${authorId}: "${command}": ${result}`)
    let stringReply = serializeReply({ error, result })
    if (stringReply.length > REPLY_LIMIT) {
      const replyTruncactionMessage = `\n(reply truncated... length: ${stringReply.length})`
      stringReply = stringReply.slice(0, REPLY_LIMIT - replyTruncactionMessage.length) + replyTruncactionMessage
    }

    msg.reply(stringReply)
  })

  await replayPastFromDisk(swingsetRunner)
}

async function replayPastFromDisk (swingsetRunner, filePath = defaultLogPath) {
  await ensureLogfileExists()

  const stream = fs.createReadStream(defaultLogPath)
  for await (let chunk of stream) {
    if (chunk) {
      const stringChunk = chunk.toString('utf8')
      const entries = stringChunk.split('\n')
      for (let entry of entries) {
        console.log(entry)
        const { authorId, command } = JSON.parse(entry)
        await swingsetRunner.handleMessage(authorId, command)
      }
    }
  }
}

async function ensureLogfileExists () {
  let logFile
  try {
    logFile = await pfs.stat(defaultLogPath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('No logfile found, starting new one.')
      await pfs.writeFile(defaultLogPath, '{"id":"0","command":"0"}')
    } else {
      console.error(err)
      throw err
    }
  }
}

function serializeReply ({ result, error }) {
  const opts = { depth: 1 }
  if (error) {
    return `Error Thrown: ${inspect(error, opts)}`
  } else {
    return inspect(result, opts)
  }
}
