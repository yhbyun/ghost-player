import { ElectronAPI } from '@electron-toolkit/preload'
import { Service } from '../config/services'
import { PlayParams } from '../types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      dragWindow: (deltaX: number, deltaY: number) => void
      getInitialService: () => Promise<Service | undefined>
      onChangeService: (callback: (service: Service) => void) => () => void
      onOpenLocation: (callback: (url: string) => void) => () => void
      onOpenFile: (callback: (playParams: PlayParams) => void) => () => void
      notifyMouseEvent: (event: 'enter' | 'leave') => void
      setSetting: (key: string, value: unknown) => void
      getSetting: (key: string, defaultValue: unknown) => Promise<unknown>
    }
  }
}
