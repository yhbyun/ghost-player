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
    globalShortcut.register(this.toggleSideDockShortcut, () => {
      if (!this.sideDock.getIsEnabled()) {
        this.onSideDockToggle(true)
      } else {
        this.sideDock.toggleDocking()
      }
    })
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }
}
