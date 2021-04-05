import { promises as pfs } from 'fs'
import path from 'path'
import './install-ses'
import { createSwingsetRunner } from './swingset-main.js'
const defaultLogPath = path.join(__dirname, 'log.txt')

replayPastFromDisk();

export async function replayPastFromDisk (filePath = defaultLogPath) {
  const swingsetRunner = await createSwingsetRunner()
  await ensureLogfileExists()
  const file = await pfs.readFile(defaultLogPath, 'utf-8')
  const lines = file.split('\n')
  for await (let entry of lines) {
    const { id, command } = JSON.parse(entry)
    await swingsetRunner.handleMessage(id, command)
  }
}

async function ensureLogfileExists () {
  let logFile
  try {
    logFile = await pfs.stat(defaultLogPath, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      await pfs.writeFile(defaultLogPath, '{"id":"0","command":"0"}')
    } else {
      console.error(err)
      throw err
    }
  }
}