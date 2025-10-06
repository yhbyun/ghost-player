import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      dragWindow: (deltaX: number, deltaY: number) => void
    }
  }
}
