/**
 * Global Error Handler for Main Process
 *
 * Handles uncaught exceptions and unhandled promise rejections
 * to prevent app crashes and provide better error reporting.
 */

import { app, dialog } from 'electron'
import { logger } from './logger'
import * as fs from 'fs'
import * as path from 'path'

interface CrashReport {
  timestamp: string
  error: {
    name: string
    message: string
    stack?: string
  }
  platform: string
  appVersion: string
  nodeVersion: string
  electronVersion: string
}

class ErrorHandler {
  private crashReportPath: string
  private isShuttingDown = false

  constructor() {
    const userDataPath = app.getPath('userData')
    const crashDir = path.join(userDataPath, 'crashes')

    // Create crash directory if it doesn't exist
    if (!fs.existsSync(crashDir)) {
      fs.mkdirSync(crashDir, { recursive: true })
    }

    this.crashReportPath = crashDir
  }

  /**
   * Initialize error handlers
   */
  public initialize(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.handleUncaughtException(error)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: unknown) => {
      this.handleUnhandledRejection(reason)
    })

    // Handle warnings
    process.on('warning', (warning: Error) => {
      logger.warn('process', 'Process warning:', warning.name, warning.message)
    })

    logger.log('error-handler', 'Global error handler initialized')
  }

  /**
   * Handle uncaught exceptions
   */
  private handleUncaughtException(error: Error): void {
    logger.error('error-handler', 'Uncaught Exception:', error)

    // Create crash report
    const crashReport = this.createCrashReport(error)
    this.saveCrashReport(crashReport)

    // Show error dialog to user
    if (!this.isShuttingDown) {
      this.showCrashDialog(error, 'Uncaught Exception')
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  private handleUnhandledRejection(reason: unknown): void {
    const error = reason instanceof Error ? reason : new Error(String(reason))

    logger.error('error-handler', 'Unhandled Promise Rejection:', error)

    // Create crash report
    const crashReport = this.createCrashReport(error)
    this.saveCrashReport(crashReport)

    // For unhandled rejections, we log but don't necessarily crash the app
    // unless it's critical
    if (this.isCriticalError(error)) {
      this.showCrashDialog(error, 'Critical Error')
    }
  }

  /**
   * Create a crash report
   */
  private createCrashReport(error: Error): CrashReport {
    return {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      platform: process.platform,
      appVersion: app.getVersion(),
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron || 'unknown'
    }
  }

  /**
   * Save crash report to file
   */
  private saveCrashReport(report: CrashReport): void {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `crash-${timestamp}.json`
      const filepath = path.join(this.crashReportPath, filename)

      fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf-8')
      logger.log('error-handler', `Crash report saved: ${filepath}`)
    } catch (err) {
      // If we can't save the crash report, at least log it
      console.error('Failed to save crash report:', err)
      console.error('Original crash report:', report)
    }
  }

  /**
   * Show crash dialog to user
   */
  private showCrashDialog(error: Error, title: string): void {
    const isDevelopment = process.env.NODE_ENV === 'development'

    const message = isDevelopment
      ? `${error.message}\n\nStack trace:\n${error.stack}`
      : `The application encountered an error and needs to restart.\n\nError: ${error.message}`

    dialog.showErrorBox(title, message)

    // In production, we might want to restart the app
    // In development, let the developer see the error
    if (!isDevelopment) {
      this.gracefulShutdown()
    }
  }

  /**
   * Determine if an error is critical enough to crash the app
   */
  private isCriticalError(error: Error): boolean {
    // Check for critical error patterns
    const criticalPatterns = [
      /ENOSPC/i, // No space left on device
      /ENOMEM/i, // Out of memory
      /Maximum call stack/i // Stack overflow
    ]

    return criticalPatterns.some(
      (pattern) => pattern.test(error.message) || (error.stack && pattern.test(error.stack))
    )
  }

  /**
   * Perform graceful shutdown
   */
  private gracefulShutdown(): void {
    if (this.isShuttingDown) return

    this.isShuttingDown = true
    logger.log('error-handler', 'Performing graceful shutdown...')

    // Give some time for cleanup
    setTimeout(() => {
      app.quit()
    }, 1000)
  }

  /**
   * Get crash reports directory
   */
  public getCrashReportsPath(): string {
    return this.crashReportPath
  }

  /**
   * Clean old crash reports (keep last 10)
   */
  public cleanOldCrashReports(): void {
    try {
      const files = fs
        .readdirSync(this.crashReportPath)
        .filter((f) => f.startsWith('crash-') && f.endsWith('.json'))
        .map((f) => ({
          name: f,
          path: path.join(this.crashReportPath, f),
          time: fs.statSync(path.join(this.crashReportPath, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)

      // Keep only the 10 most recent reports
      if (files.length > 10) {
        files.slice(10).forEach((file) => {
          fs.unlinkSync(file.path)
          logger.log('error-handler', `Deleted old crash report: ${file.name}`)
        })
      }
    } catch (err) {
      logger.error('error-handler', 'Failed to clean old crash reports:', err)
    }
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler()
