// src/main/logger.ts

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { format } from 'util'
import { activeCategories } from '../utils/log-config'

const logDirectory = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory)
}
const logFilePath = path.join(logDirectory, 'main.log')

class Logger {
  private logToFile(level: string, category: string, ...args: unknown[]): void {
    const timestamp = new Date().toISOString()
    const message = format(...args)
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}\n`

    fs.appendFile(logFilePath, logMessage, (err) => {
      if (err) {
        console.error('Failed to write to log file:', err)
      }
    })
  }

  public log(category: string, ...args: unknown[]): void {
    if (activeCategories.includes(category)) {
      const message = `[${category}]`
      console.log(message, ...args)
      this.logToFile('info', category, ...args)
    }
  }

  public warn(category: string, ...args: unknown[]): void {
    if (activeCategories.includes(category)) {
      const message = `[${category}]`
      console.warn(message, ...args)
      this.logToFile('warn', category, ...args)
    }
  }

  public error(category: string, ...args: unknown[]): void {
    if (activeCategories.includes(category)) {
      const message = `[${category}]`
      console.error(message, ...args)
      this.logToFile('error', category, ...args)
    }
  }
}

export const logger = new Logger()
