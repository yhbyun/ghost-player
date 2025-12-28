import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { format } from 'util'
import { activeCategories } from '../utils/log-config'

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel
  enableConsole: boolean
  enableFile: boolean
  maxFileSize: number // in bytes
  maxFiles: number
}

const logDirectory = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true })
}

class Logger {
  private logFilePath: string
  private config: LoggerConfig

  constructor() {
    this.logFilePath = path.join(logDirectory, 'main.log')

    // Default configuration
    this.config = {
      minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableFile: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    }

    // Check and rotate log file if needed
    this.rotateLogIfNeeded()
  }

  /**
   * Set logger configuration
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current log file path
   */
  public getLogFilePath(): string {
    return this.logFilePath
  }

  /**
   * Get logs directory
   */
  public getLogsDirectory(): string {
    return logDirectory
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private rotateLogIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return
      }

      const stats = fs.statSync(this.logFilePath)
      if (stats.size > this.config.maxFileSize) {
        this.rotateLogFile()
      }
    } catch (error) {
      console.error('Failed to check log file size:', error)
    }
  }

  /**
   * Rotate log files
   */
  private rotateLogFile(): void {
    try {
      // Remove oldest log if we have too many
      const oldestLog = path.join(logDirectory, `main.${this.config.maxFiles - 1}.log`)
      if (fs.existsSync(oldestLog)) {
        fs.unlinkSync(oldestLog)
      }

      // Shift existing logs
      for (let i = this.config.maxFiles - 2; i >= 0; i--) {
        const oldPath = i === 0 ? this.logFilePath : path.join(logDirectory, `main.${i}.log`)
        const newPath = path.join(logDirectory, `main.${i + 1}.log`)

        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath)
        }
      }

      console.log('Log file rotated successfully')
    } catch (error) {
      console.error('Failed to rotate log file:', error)
    }
  }

  /**
   * Write log to file
   */
  private logToFile(level: string, category: string, ...args: unknown[]): void {
    if (!this.config.enableFile) return

    try {
      const timestamp = new Date().toISOString()
      const message = format(...args)
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}\n`

      fs.appendFile(this.logFilePath, logMessage, (err) => {
        if (err) {
          console.error('Failed to write to log file:', err)
        }
      })

      // Check if rotation is needed after writing
      this.rotateLogIfNeeded()
    } catch (error) {
      console.error('Failed to log to file:', error)
    }
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.minLevel
  }

  /**
   * Debug level logging
   */
  public debug(category: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return
    if (!activeCategories.includes(category)) return

    if (this.config.enableConsole) {
      console.debug(`[${category}]`, ...args)
    }
    this.logToFile('debug', category, ...args)
  }

  /**
   * Info level logging (alias for log)
   */
  public info(category: string, ...args: unknown[]): void {
    this.log(category, ...args)
  }

  /**
   * Info level logging
   */
  public log(category: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return
    if (!activeCategories.includes(category)) return

    if (this.config.enableConsole) {
      console.log(`[${category}]`, ...args)
    }
    this.logToFile('info', category, ...args)
  }

  /**
   * Warning level logging
   */
  public warn(category: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return
    if (!activeCategories.includes(category)) return

    if (this.config.enableConsole) {
      console.warn(`[${category}]`, ...args)
    }
    this.logToFile('warn', category, ...args)
  }

  /**
   * Error level logging
   */
  public error(category: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.ERROR)) return
    if (!activeCategories.includes(category)) return

    if (this.config.enableConsole) {
      console.error(`[${category}]`, ...args)
    }
    this.logToFile('error', category, ...args)
  }

  /**
   * Clean old log files
   */
  public cleanOldLogs(): void {
    try {
      const files = fs
        .readdirSync(logDirectory)
        .filter((f) => f.startsWith('main.') && f.endsWith('.log'))
        .map((f) => ({
          name: f,
          path: path.join(logDirectory, f),
          time: fs.statSync(path.join(logDirectory, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      // Keep only maxFiles
      if (files.length > this.config.maxFiles) {
        files.slice(this.config.maxFiles).forEach((file) => {
          fs.unlinkSync(file.path)
          console.log(`Deleted old log file: ${file.name}`)
        })
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error)
    }
  }
}

export const logger = new Logger()

// Clean old logs on startup
logger.cleanOldLogs()
