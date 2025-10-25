import { ElectronAPI } from '@electron-toolkit/preload'
import { Service } from '../config/services'
import { PlayParams } from '../types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      dragWindow: (deltaX: number, deltaY: number) => void
      getInitialContent: () => Promise<any>
      setLastContent: (content: any) => void
      onChangeService: (callback: (service: Service) => void) => () => void
      onOpenLocation: (callback: (url: string) => void) => () => void
      onOpenFile: (callback: (playParams: PlayParams) => void) => () => void
      notifyMouseEvent: (event: 'enter' | 'leave') => void
      setSetting: (key: string, value: unknown) => void
      getSetting: (key: string, defaultValue: unknown) => Promise<unknown>
      onSettingChanged: (callback: (args: { key:string; value: any }) => void) => () => void
      transcribeAudio: (audioData: Uint8Array, apiKey: string) => Promise<any>
      openFile: () => Promise<void>
    }
  }
}
