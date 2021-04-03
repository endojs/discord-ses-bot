/* global lockdown, Compartment */

const fs = require('fs')
const path = require('path')
const { inspect } = require('util')
require('ses')
const {
  createReadOnlyMapProxy,
  createReadOnlyProxy
} = require('./readOnly')

lockdown()

const defaultLogPath = path.join(__dirname, 'log.txt')
const REPLY_LIMIT = 2000

module.exports = {
  createMachine
}

function createMachine ({
  logPath = defaultLogPath
} = {}) {
  const authorMap = new Map()
  const shareBoxes = new Map()
  const inboxes = new Map()

  return {
    authorMap,
    shareBoxes,
    inboxes,

    appendLoggable,
    executeLoggable,
    getAuthor,
    createUser,
    replayPast,
    replayPastFromLog,
    help
  }

  function appendLoggable (loggable, msg) {
    fs.appendFile(logPath, loggable + '\n', (err) => {
      if (err) {
        console.error('Problem appending to file', err)
        return
      }
      console.log(loggable)

      const { result, error } = executeLoggable(loggable, msg)
      let stringReply = serializeReply({ error, result })
      if (stringReply.length > REPLY_LIMIT) {
        const replyTruncactionMessage = `\n(reply truncated... length: ${stringReply.length})`
        stringReply = stringReply.slice(0, REPLY_LIMIT - replyTruncactionMessage.length) + replyTruncactionMessage
      }

      console.log(`> ${stringReply}`)
      if (!msg || !msg.reply) return
      msg.reply(stringReply)
    })
  }

  function executeLoggable (loggable, msg) {
    const components = loggable.split(':')
    const authorId = components.shift()
    const command = components.join(':')
    const author = getAuthor(authorId)

    let result, error
    try {
      result = author.compartment.evaluate(command)
    } catch (err) {
      error = err
    }

    return { result, error }
  }

  function getAuthor (id) {
    let author = authorMap.get(id)
    if (!author) {
      author = createUser(id)
      authorMap.set(id, author)
    }
    return author
  }

  function createUser (id) {
    // for sharing publicly, multicast
    // set via "share"
    const shareBox = {}
    shareBoxes.set(id, shareBox)
    // for sharing privately, unicast
    // receives from "send"
    const inbox = {}
    inboxes.set(id, inbox)
    const compartment = new Compartment({
      id: id,
      my: {},
      share: shareBox,
      inbox,
      print: console.log,
      help,
      send: (to, label, value) => {
        sendValueBetweenAuthors(id, to, label, value)
      },
      // expose the shareBoxes map as an object that returns read only interfaces
      others: createReadOnlyMapProxy(shareBoxes, (otherShareBox) => createReadOnlyProxy(otherShareBox))
    })
    return {
      compartment
    }
  }

  function sendValueBetweenAuthors (from, to, label, value) {
    if (!inboxes.has(to)) {
      throw new Error(`no inbox for user "${to}"`)
    }
    let recipientBox = inboxes.get(to)

    let myBox = recipientBox[from]
    if (!myBox) {
      myBox = {}
      recipientBox[from] = myBox
    }

    myBox[label] = value
  }

  function replayPastFromLog () {
    let logFile
    try {
      logFile = fs.readFileSync(logPath).toString()
      console.log('replaying logFile')
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No logfile found, starting new one.')
        fs.writeFileSync(logPath, '0:0\n')
      } else {
        console.error(err)
        throw err
      }
    }
    const loggableCommands = logFile.split('\n')
    replayPast(loggableCommands)
  }

  function replayPast (loggableCommands) {
    return loggableCommands.map(executeLoggable)
  }

  function help () {
    return `Welcome to SES-bot!
    
    You can run JavaScript commands with the "/eval" prefix, and they are run in your own personal SES container!
    You can't assign variables in these commands, but you have a "my" object you can hang variables on.
    You can also add objects to your "share" object, to make them available to everyone.
    You can find the objects others have shared in your "others" object, by their ID.
    You can send an object to a specific user by calling "send(otherId, label, object)".
    They can access objects sent from you at their "inbox[yourId][yourLabel]".
    A member can have SES-bot print their ID by calling "/eval id".
    You can read my source code here: https://github.com/danfinlay/discord-ses-bot
    `
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