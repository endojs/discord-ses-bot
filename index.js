const { appKey, appToken } = require('./config.json')
const {
  createMachine
} = require('./machine')

// This int isn't sensitive, it just describes the permissions we're requesting:
const PERMISSIONS_INT = 2147503168

const link = `https://discord.com/oauth2/authorize?client_id=${appKey}&scope=bot`
console.log(`Starting SES-bot! Add to your discord server with this link: \n${link}`)

const { Client } = require('discord.js')
const client = new Client({
  client_id: appKey,
  scope: 'bot',
  permissions: PERMISSIONS_INT
})

client.login(appToken)

const machine = createMachine()
const {
  appendLoggable,
  replayPastFromLog
} = machine

replayPastFromLog()

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`)
})

client.on('message', msg => {
  const authorId = msg.author.id
  const message = msg.content

  if (message.indexOf('/eval') === 0) {
    // This is a command for us!

    const command = message.substr(6) // Cut off the 'eval' prefix
    const loggable = `${authorId}: ${command}`
    appendLoggable(loggable, msg)
  }
})
