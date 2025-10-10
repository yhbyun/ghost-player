import { globalShortcut } from 'electron'
import { SideDock } from './SideDock'

export class ShortcutManager {
  private sideDock: SideDock
  private onSideDockToggle: (enabled: boolean) => void
  private toggleSideDockShortcut: string

  constructor(
    sideDock: SideDock,
    onSideDockToggle: (enabled: boolean) => void,
    toggleSideDockShortcut: string
  ) {
    this.sideDock = sideDock
    this.onSideDockToggle = onSideDockToggle
    this.toggleSideDockShortcut = toggleSideDockShortcut
  }

  registerShortcuts(): void {
    const ret = globalShortcut.register(this.toggleSideDockShortcut, () => {
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
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
