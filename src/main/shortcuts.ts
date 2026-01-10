import { globalShortcut, BrowserWindow } from 'electron'
import { SideDock } from './SideDock'

export type ShortcutAction =
  | 'toggleSideDock'
  | 'disableSideDock'
  | 'focusWindow'
  | 'toggleAlwaysOnTop'

export class ShortcutManager {
  private mainWindow: BrowserWindow
  private sideDock: SideDock
  private onSideDockToggle: (enabled: boolean) => void
  private onToggleAlwaysOnTop: () => void

  private shortcuts: Map<ShortcutAction, string> = new Map()
  private handlers: Map<ShortcutAction, () => void> = new Map()
  private isSuspended: boolean = false

  constructor(
    mainWindow: BrowserWindow,
    sideDock: SideDock,
    onSideDockToggle: (enabled: boolean) => void,
    onToggleAlwaysOnTop: () => void
  ) {
    this.mainWindow = mainWindow
    this.sideDock = sideDock
    this.onSideDockToggle = onSideDockToggle
    this.onToggleAlwaysOnTop = onToggleAlwaysOnTop

    this.initializeHandlers()
  }

  private initializeHandlers(): void {
    this.handlers.set('toggleSideDock', () => {
      if (!this.sideDock.getIsEnabled()) {
        this.onSideDockToggle(true)
      } else {
        this.sideDock.toggleDocking()
      }
    })

    this.handlers.set('disableSideDock', () => {
      this.onSideDockToggle(false)
    })

    this.handlers.set('focusWindow', () => {
      this.mainWindow.focus()
    })

    this.handlers.set('toggleAlwaysOnTop', () => {
      this.onToggleAlwaysOnTop()
    })
  }

  public setShortcut(action: ShortcutAction, accelerator: string): void {
    const oldAccelerator = this.shortcuts.get(action)

    if (oldAccelerator === accelerator) return

    if (oldAccelerator) {
      globalShortcut.unregister(oldAccelerator)
    }

    this.shortcuts.set(action, accelerator)

    if (this.isSuspended) return

    if (!accelerator) {
      this.shortcuts.delete(action)
      return
    }

    const handler = this.handlers.get(action)
    if (handler) {
      const success = globalShortcut.register(accelerator, handler)
      if (success) {
        console.log(`Successfully registered shortcut for ${action}: ${accelerator}`)
      } else {
        console.error(`Failed to register shortcut for ${action}: ${accelerator}`)
      }
    }
  }

  public registerAll(shortcuts: Record<ShortcutAction, string>): void {
    Object.entries(shortcuts).forEach(([action, accelerator]) => {
      this.setShortcut(action as ShortcutAction, accelerator)
    })
  }

  public suspendShortcuts(): void {
    this.isSuspended = true
    globalShortcut.unregisterAll()
    console.log('Global shortcuts suspended')
  }

  public resumeShortcuts(): void {
    this.isSuspended = false
    this.shortcuts.forEach((accelerator, action) => {
      if (!accelerator) return
      const handler = this.handlers.get(action)
      if (handler) {
        globalShortcut.register(accelerator, handler)
      }
    })
    console.log('Global shortcuts resumed')
  }

  public unregisterAll(): void {
    globalShortcut.unregisterAll()
    this.shortcuts.clear()
  }
}
