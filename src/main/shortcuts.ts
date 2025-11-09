import { globalShortcut, BrowserWindow } from 'electron'
import { SideDock } from './SideDock'

export class ShortcutManager {
  private mainWindow: BrowserWindow
  private sideDock: SideDock
  private onSideDockToggle: (enabled: boolean) => void
  private onToggleAlwaysOnTop: () => void
  private toggleSideDockShortcut: string
  private disableSideDockShortcut: string
  private focusWindowShortcut: string
  private toggleAlwaysOnTopShortcut: string

  constructor(
    mainWindow: BrowserWindow,
    sideDock: SideDock,
    onSideDockToggle: (enabled: boolean) => void,
    onToggleAlwaysOnTop: () => void,
    toggleSideDockShortcut: string,
    disableSideDockShortcut: string,
    focusWindowShortcut: string,
    toggleAlwaysOnTopShortcut: string
  ) {
    this.mainWindow = mainWindow
    this.sideDock = sideDock
    this.onSideDockToggle = onSideDockToggle
    this.onToggleAlwaysOnTop = onToggleAlwaysOnTop
    this.toggleSideDockShortcut = toggleSideDockShortcut
    this.disableSideDockShortcut = disableSideDockShortcut
    this.focusWindowShortcut = focusWindowShortcut
    this.toggleAlwaysOnTopShortcut = toggleAlwaysOnTopShortcut
  }

  registerShortcuts(): void {
    let ret = globalShortcut.register(this.toggleSideDockShortcut, () => {
      if (!this.sideDock.getIsEnabled()) {
        this.onSideDockToggle(true)
      } else {
        this.sideDock.toggleDocking()
      }
    })

    if (!ret) {
      console.error('Failed to register Toggle Side Dock shortcut:', this.toggleSideDockShortcut)
    } else {
      console.log('Successfully registered Toggle Side Dock shortcut:', this.toggleSideDockShortcut)
    }

    ret = globalShortcut.register(this.disableSideDockShortcut, () => {
      this.onSideDockToggle(false)
    })

    if (!ret) {
      console.error('Failed to register Disable Side Dock shortcut:', this.disableSideDockShortcut)
    } else {
      console.log(
        'Successfully registered Disable Side Dock shortcut:',
        this.disableSideDockShortcut
      )
    }

    ret = globalShortcut.register(this.focusWindowShortcut, () => {
      this.mainWindow.focus()
    })

    if (!ret) {
      console.error('Failed to register Focus Window shortcut:', this.focusWindowShortcut)
    } else {
      console.log('Successfully registered Focus Window shortcut:', this.focusWindowShortcut)
    }

    ret = globalShortcut.register(this.toggleAlwaysOnTopShortcut, () => {
      this.onToggleAlwaysOnTop()
    })

    if (!ret) {
      console.error(
        'Failed to register Toggle Always On Top shortcut:',
        this.toggleAlwaysOnTopShortcut
      )
    } else {
      console.log(
        'Successfully registered Toggle Always On Top shortcut:',
        this.toggleAlwaysOnTopShortcut
      )
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
