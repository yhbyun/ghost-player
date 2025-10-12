import { globalShortcut } from 'electron'
import { SideDock } from './SideDock'

export class ShortcutManager {
  private sideDock: SideDock
  private onSideDockToggle: (enabled: boolean) => void
  private toggleSideDockShortcut: string
  private disableSideDockShortcut: string

  constructor(
    sideDock: SideDock,
    onSideDockToggle: (enabled: boolean) => void,
    toggleSideDockShortcut: string,
    disableSideDockShortcut: string
  ) {
    this.sideDock = sideDock
    this.onSideDockToggle = onSideDockToggle
    this.toggleSideDockShortcut = toggleSideDockShortcut
    this.disableSideDockShortcut = disableSideDockShortcut
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
      console.error('Failed to register shortcut:', this.toggleSideDockShortcut)
    } else {
      console.log('Successfully registered shortcut:', this.toggleSideDockShortcut)
    }

    ret = globalShortcut.register(this.disableSideDockShortcut, () => {
      this.onSideDockToggle(false)
    })

    if (!ret) {
      console.error('Failed to register shortcut:', this.disableSideDockShortcut)
    } else {
      console.log('Successfully registered shortcut:', this.disableSideDockShortcut)
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
