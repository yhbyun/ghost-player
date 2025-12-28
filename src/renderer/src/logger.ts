// src/renderer/logger.ts

import { activeCategories } from '../../utils/log-config'

class Logger {
  public log(category: string, ...args: unknown[]): void {
    if (activeCategories.includes(category)) {
      console.log(`[${category}]`, ...args)
    }
  }

  public warn(category: string, ...args: unknown[]): void {
    if (activeCategories.includes(category)) {
      console.warn(`[${category}]`, ...args)
    }
  }

  public error(category: string, ...args: unknown[]): void {
    if (activeCategories.includes(category)) {
      console.error(`[${category}]`, ...args)
    }
  }
}

export const logger = new Logger()
