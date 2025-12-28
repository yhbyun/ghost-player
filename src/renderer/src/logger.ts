// src/renderer/logger.ts

import { activeCategories } from '../../utils/log-config'

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
}

class Logger {
  private config: LoggerConfig

  constructor() {
    // Default configuration
    this.config = {
      minLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true
    }
  }

  /**
   * Set logger configuration
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
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
    if (!this.config.enableConsole) return

    console.debug(`[${category}]`, ...args)
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
    if (!this.config.enableConsole) return

    console.log(`[${category}]`, ...args)
  }

  /**
   * Warning level logging
   */
  public warn(category: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return
    if (!activeCategories.includes(category)) return
    if (!this.config.enableConsole) return

    console.warn(`[${category}]`, ...args)
  }

  /**
   * Error level logging
   */
  public error(category: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.ERROR)) return
    if (!activeCategories.includes(category)) return
    if (!this.config.enableConsole) return

    console.error(`[${category}]`, ...args)
  }
}

export const logger = new Logger()
