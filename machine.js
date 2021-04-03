import { promises as fs } from 'fs'
import path from 'path'
import { inspect } from 'util'
import { createRunner } from './runner'

const REPLY_LIMIT = 2000
const defaultLogPath = path.join(__dirname, 'log.txt')


export function createMachine ({
  logPath = defaultLogPath
} = {}) {
  const runner = createRunner()

  return {
    runner,
    appendLoggable,
    executeLoggable,
    replayPast,
    replayPastFromLog
  }

  async function appendLoggable (loggable, msg) {
    await fs.appendFile(logPath, loggable + '\n')
    console.log(loggable)
    const { result, error } = await executeLoggable(loggable)
    let stringReply = serializeReply({ error, result })
    if (stringReply.length > REPLY_LIMIT) {
      const replyTruncactionMessage = `\n(reply truncated... length: ${stringReply.length})`
      stringReply = stringReply.slice(0, REPLY_LIMIT - replyTruncactionMessage.length) + replyTruncactionMessage
    }
    console.log(`> ${stringReply}`)
    if (!msg || !msg.reply) return
    msg.reply(stringReply)
  }

  async function executeLoggable (loggable, msg) {
    const components = loggable.split(':')
    const authorId = components.shift()
    const command = components.join(':')
    const { result, error } = await runner.runCommand(authorId, command)
    return { result, error }
  }

  async function replayPastFromLog () {
    let logFile
    try {
      logFile = await fs.readFile(logPath, 'utf8')
      console.log('replaying logFile')
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No logfile found, starting new one.')
        await fs.writeFile(logPath, '0:0\n')
      } else {
        console.error(err)
        throw err
      }
    }
    const loggableCommands = logFile.split('\n')
    await replayPast(loggableCommands)
  }

  async function replayPast (loggableCommands) {
    const results = []
    for (const command of loggableCommands) {
      // console.log(command)
      const result = await executeLoggable(command)
      results.push(result)
    }
    return results
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
