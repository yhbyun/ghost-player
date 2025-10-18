import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Service } from '../config/services'
import { PlayParams } from '../types'

// Custom APIs for renderer
const api = {
  dragWindow: (deltaX: number, deltaY: number): void => {
    ipcRenderer.send('drag-window', { deltaX, deltaY })
  },
  getInitialService: (): Promise<Service | undefined> => {
    return ipcRenderer.invoke('get-initial-service')
  },
  onChangeService: (callback: (service: Service) => void): (() => void) => {
    const handler = (_event, service): void => callback(service)
    ipcRenderer.on('change-service', handler)
    return () => {
      ipcRenderer.removeListener('change-service', handler)
    }
  },
  onOpenLocation: (callback: (url: string) => void): (() => void) => {
    const handler = (_event, url): void => callback(url)
    ipcRenderer.on('open-location', handler)
    return () => {
      ipcRenderer.removeListener('open-location', handler)
    }
  },
  onOpenFile: (callback: (playParams: PlayParams) => void): (() => void) => {
    const handler = (_event, playParams): void => callback(playParams)
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
  onSettingChanged: (callback: (args: { key: string; value: any }) => void): (() => void) => {
    const handler = (_event, args): void => callback(args)
    ipcRenderer.on('setting-changed', handler)
    return () => {
      ipcRenderer.removeListener('setting-changed', handler)
    }
  },
  transcribeAudio: (audioData: Uint8Array, apiKey: string): Promise<any> => {
    return ipcRenderer.invoke('transcribe-audio', { audioData, apiKey })
  }
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
