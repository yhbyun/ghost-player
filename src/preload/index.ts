import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Service } from '../config/services'
import { PlayParams, Content } from '../types'

// Custom APIs for renderer
const api = {
  dragWindow: (deltaX: number, deltaY: number): void => {
    ipcRenderer.send('drag-window', { deltaX, deltaY })
  },
  getInitialContent: (): Promise<Content | undefined> => {
    return ipcRenderer.invoke('get-initial-content')
  },
  setLastContent: (content: Content): void => {
    ipcRenderer.send('set-last-content', content)
  },
  onChangeService: (callback: (service: Service) => void): (() => void) => {
    const handler = (_event, service: Service): void => callback(service)
    ipcRenderer.on('change-service', handler)
    return () => {
      ipcRenderer.removeListener('change-service', handler)
    }
  },
  onOpenLocation: (callback: (url: string) => void): (() => void) => {
    const handler = (_event, url: string): void => callback(url)
    ipcRenderer.on('open-location', handler)
    return () => {
      ipcRenderer.removeListener('open-location', handler)
    }
  },
  onOpenUrl: (callback: (url: string) => void): (() => void) => {
    const handler = (_event, url: string): void => callback(url)
    ipcRenderer.on('open-url', handler)
    return () => {
      ipcRenderer.removeListener('open-url', handler)
    }
  },
  onOpenFile: (callback: (playParams: PlayParams) => void): (() => void) => {
    const handler = (_event, playParams: PlayParams): void => callback(playParams)
    ipcRenderer.on('open-file', handler)
    return () => {
      ipcRenderer.removeListener('open-file', handler)
    }
  },
  notifyMouseEvent: (event: 'enter' | 'leave'): void => {
    ipcRenderer.send('mouse-event', event)
  },
  setSetting: (key: string, value: unknown): void => {
    ipcRenderer.send('set-setting', { key, value })
  },
  getSetting: (key: string, defaultValue: unknown): Promise<unknown> => {
    return ipcRenderer.invoke('get-setting', { key, defaultValue })
  },
  onSettingChanged: (callback: (args: { key: string; value: unknown }) => void): (() => void) => {
    const handler = (_event, args): void => callback(args)
    ipcRenderer.on('setting-changed', handler)
    return () => {
      ipcRenderer.removeListener('setting-changed', handler)
    }
  },
  transcribeAudio: (audioData: Uint8Array, apiKey: string): Promise<string> => {
    return ipcRenderer.invoke('transcribe-audio', { audioData, apiKey })
  },
  openFile: (): Promise<void> => {
    return ipcRenderer.invoke('open-file-dialog')
  },
  sendPlaybackState: (isPlaying: boolean): void => {
    ipcRenderer.send('playback-state', isPlaying)
  },
  onPlaybackControl: (callback: (action: 'play' | 'stop') => void): (() => void) => {
    const handler = (_event, action): void => callback(action)
    ipcRenderer.on('playback-control', handler)
    return () => {
      ipcRenderer.removeListener('playback-control', handler)
    }
  },
  onAlwaysOnTopStatusChanged: (callback: (status: boolean) => void): (() => void) => {
    const handler = (_event, status: boolean): void => callback(status)
    ipcRenderer.on('always-on-top-status-changed', handler)
    return () => {
      ipcRenderer.removeListener('always-on-top-status-changed', handler)
    }
  },
  dropFiles: (filePaths: string[]): void => {
    ipcRenderer.send('drop-files', filePaths)
  },
  getNetflixPreloadPath: (): Promise<string> => ipcRenderer.invoke('get-netflix-preload-path')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
