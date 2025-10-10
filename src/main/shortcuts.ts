import { globalShortcut } from 'electron'
import { SideDock } from './SideDock'

export class ShortcutManager {
  private sideDock: SideDock
  private onSideDockToggle: (enabled: boolean) => void

  constructor(sideDock: SideDock, onSideDockToggle: (enabled: boolean) => void) {
    this.sideDock = sideDock
    this.onSideDockToggle = onSideDockToggle
  }

  registerShortcuts(): void {
    globalShortcut.register('F5', () => {
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
