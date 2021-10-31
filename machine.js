import { promises as fs } from 'fs'
import path from 'path'
import { nextTick } from 'process'
import { inspect } from 'util'
import { createRunner } from './runner'

const REPLY_LIMIT = 2000
const defaultLogPath = path.join(__dirname, 'log.txt')

export function createMachine ({
  logPath = defaultLogPath,
  logging = true
} = {}) {
  let runner = createRunner()
  let commandBuffer = []
  let isRunning = false

  return {
    getSystemState: () => runner.getSystemState(),
    appendLoggable,
    executeLoggable,
    replayPast,
    replayPastFromDisk,
    getLogFromDisk,
    flushCommands,
    queue
  }

  function queue (opts) {
    commandBuffer.push(opts)
    nextTick(flushCommands)
  }

  async function appendLoggable (loggable, msg) {
    await fs.appendFile(logPath, createLogLine(loggable))
  }

  function createLogLine (loggable) {
    return '\n' + JSON.stringify(loggable)
  }

  async function executeLoggable (loggable, msg) {
    const { id, command } = loggable
    console.log(command)
    const { result, error } = await runner.runCommand(id, command)
    return { result, error }
  }

  async function restart () {
    await runner.close()
    console.log('runner closed')
    runner = createRunner()
    console.log('new runner created', runner)
    await replayPastFromDisk()
    console.log('replayed past from disk')
    commandBuffer = []
    isRunning = false
  }

  async function getLogFromDisk () {
    let logFile
    try {
      logFile = await fs.readFile(logPath, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No logfile found, starting new one.')
        logFile = '{"id":"0","command":"0"}'
        await fs.writeFile(logPath, logFile)
      } else {
        console.error(err)
        throw err
      }
    }
    const loggableCommands = logFile.split('\n').map((entry) => {
      console.log(entry)
      return JSON.parse(entry)
    })
    return loggableCommands
  }

  async function replayPastFromDisk () {
    const loggableCommands = await getLogFromDisk()
    await replayPast(loggableCommands)
  }

  async function replayPast (loggableCommands) {
    isRunning = true
    const results = []
    for (const command of loggableCommands) {
      const result = await executeLoggable(command)
      console.log(`${command}:`)
      console.log(result)
      results.push(result)
    }
    isRunning = false
    nextTick(flushCommands)
    return results
  }

  async function flushCommands () {
    // if we're already running, do nothing
    if (isRunning) {
      return
    }
    if (commandBuffer.length === 0) return
    // handle next command
    isRunning = true
    const { loggable, msg } = commandBuffer.shift()

    // Commit to running message
    if (logging) {
      console.log('append loggable: ', loggable)
      await appendLoggable(loggable, msg)
    }

    let stringReply
    const { result, error } = await executeLoggable(loggable)
    stringReply = serializeReply({ error, result })

    if (error && error.fatal) {
      console.log('we have caught a fatal error')
      console.error(error)

      // If we can't execute that command, we need to purge it from the logs
      // So that replays don't also throw crashing errors.
      await strikeLastLog(loggable)

      console.log('restarting')
      await restart()
      console.log('restarted')
      stringReply = 'Fatal Error, state reverted.'
    }

    if (stringReply.length > REPLY_LIMIT) {
      const replyTruncactionMessage = `\n(reply truncated... length: ${stringReply.length})`
      stringReply = stringReply.slice(0, REPLY_LIMIT - replyTruncactionMessage.length) + replyTruncactionMessage
    }

    console.log(`> ${stringReply}`)
    if (!msg || !msg.reply) return
    msg.reply(stringReply)

    isRunning = false
    // continue flushing on next tick
    setTimeout(flushCommands)
  }

  async function strikeLastLog (loggable) {
    if (!logging) {
      return
    }
    const stringMessage = createLogLine(loggable)

    const stat = await fs.stat(logPath)
    await fs.truncate(logPath, stat.size - stringMessage.length)
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
