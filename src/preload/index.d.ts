import { ElectronAPI } from '@electron-toolkit/preload'
import { Service } from '../config/services'
import { Content, PlayParams } from '../types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      dragWindow: (deltaX: number, deltaY: number) => void
      getInitialContent: () => Promise<Content | undefined>
      setLastContent: (content: Content) => void
      onChangeService: (callback: (service: Service) => void) => () => void
      onOpenLocation: (callback: (url: string) => void) => () => void
      onOpenFile: (callback: (playParams: PlayParams) => void) => () => void
      notifyMouseEvent: (event: 'enter' | 'leave') => void
      setSetting: (key: string, value: unknown) => void
      getSetting: (key: string, defaultValue: unknown) => Promise<unknown>
      onSettingChanged: (callback: (args: { key: string; value: unknown }) => void) => () => void
      transcribeAudio: (audioData: Uint8Array, apiKey: string) => Promise<string>
      openFile: () => Promise<void>
      sendPlaybackState: (isPlaying: boolean) => void
      onPlaybackControl: (callback: (action: 'play' | 'stop') => void) => () => void
      onAlwaysOnTopStatusChanged: (callback: (status: boolean) => void) => () => void
    }
  }
}
