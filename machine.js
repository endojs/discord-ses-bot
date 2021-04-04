import { promises as fs } from 'fs'
import path from 'path'
import { inspect } from 'util'
import { createRunner } from './runner'

const REPLY_LIMIT = 2000
const defaultLogPath = path.join(__dirname, 'log.txt')

export function createMachine ({
  logPath = defaultLogPath,
  logging = true,
} = {}) {

  let runner = createRunner()
  let commandBuffer = [];
  let isRunning = false;

  return {
    runner,
    appendLoggable,
    executeLoggable,
    replayPast,
    replayPastFromDisk,
    getLogFromDisk,
    flushCommands,
    commandBuffer,
  }

  async function appendLoggable (loggable, msg) {
    await fs.appendFile(logPath, '\n' + JSON.stringify(loggable))
  }

  async function executeLoggable (loggable, msg) {
    const { id, command } = loggable
    const { result, error } = await runner.runCommand(id, command)
    return { result, error }
  }

  async function restart () {
    runner.close()
    runner = createRunner()
    replayPastFromDisk()
    commandBuffer = []
  }

  async function getLogFromDisk () {
    let logFile
    try {
      logFile = await fs.readFile(logPath, 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.log('No logfile found, starting new one.')
        await fs.writeFile(logPath, '{"id":"0","command":"0"}')
      } else {
        console.error(err)
        throw err
      }
    }
    const loggableCommands = logFile.split('\n').map(JSON.parse)
    return loggableCommands;
  }

  async function replayPastFromDisk () {
    const loggableCommands = await getLogFromDisk();
    await replayPast(loggableCommands)
  }

  async function replayPast (loggableCommands) {
    const results = []
    for (const command of loggableCommands) {
      const result = await executeLoggable(command)
      console.log(`${command}:`)
      console.log(result);
      results.push(result)
    }
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
      await appendLoggable(loggable, msg)
    }

    let stringReply
    const { result, error } = await executeLoggable(loggable)
    stringReply = serializeReply({ error, result })

    if (error && error.terminal) {
      console.log('we have caught an executeLoggable error')
      console.error(error);

      // If we can't execute that command, we need to purge it from the logs
      // So that replays don't also throw crashing errors.
      console.log('removing command from logs')
      await strikeLastLog(loggable)
      console.log('removed from logs they say, restarting')

      await restart()
      console.log('restarted')
      stringReply = `Terminal Error, state reverted.`
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

  async function strikeLastLog () {
    if (!logging) {
      return;
    }

    return new Promise((res, rej) => {
      console.log('getting fs stat, which is inexplicably hanging: ' + logPath);
      fs.stat(logPath, (err, stat) => {
        console.log('stats', stat);
        if (err) throw err;
        console.log('truncating')
        fs.truncate(logPath, stat.size - 1, (err) => {
          console.log('truncated')
          if (err) return rej(err)
          res()
        })
      })
    })
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
