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

  const commandBuffer = []
  let isRunning = true

  client.on('message', async msg => {
    const authorId = msg.author.id
    const message = msg.content

    const messagePrefix = '$'
    if (message.indexOf(messagePrefix) !== 0) {
      return
    }

    // This is a command for us!
    const command = message.substr(messagePrefix.length) // Cut off the 'eval' prefix
    const loggable = `${authorId}: ${command}`
    commandBuffer.push({ loggable, msg })
    flushCommands()
  })

  await machine.replayPastFromLog()
  isRunning = false
  await flushCommands()

  async function flushCommands () {
    // if we're already running, do nothing
    if (isRunning) {
      return
    }
    if (commandBuffer.length === 0) return
    // handle next command
    isRunning = true
    const { loggable, msg } = commandBuffer.shift()
    await machine.appendLoggable(loggable, msg)
    isRunning = false
    // continue flushing on next tick
    setTimeout(flushCommands)
  }
}
