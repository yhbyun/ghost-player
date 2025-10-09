import { ElectronAPI } from '@electron-toolkit/preload'
import { Service } from '../config/services'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      dragWindow: (deltaX: number, deltaY: number) => void
      getInitialService: () => Promise<Service | undefined>
      onChangeService: (callback: (service: Service) => void) => () => void
      notifyMouseEvent: (event: 'enter' | 'leave') => void
    }
  }
}
