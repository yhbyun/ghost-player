import __Store from 'electron-store'
import { PlaylistItem } from '../types'

// @ts-ignore: electron-store a CommonJS module, so a type error related to default export occurs.
const Store = __Store.default || __Store

export interface StoreType {
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
  isTransparent: boolean
  opacity: number
  lastContent: {
    type: 'service' | 'video' | 'playlist'
    data: {
      // Service
      name?: string
      // Video
      videoSource?: string
      subtitleSource?: string
      currentTime?: number
      // Playlist
      items?: PlaylistItem[]
      currentIndex?: number
    }
  }
  playlist?: {
    items: PlaylistItem[]
    currentIndex: number
  }
  isAlwaysOnTop: boolean
  alwaysOnTopLevel:
    | 'floating'
    | 'torn-off-menu'
    | 'modal-panel'
    | 'main-menu'
    | 'status'
    | 'pop-up-menu'
    | 'screen-saver'
  transparencyMode: 'always' | 'mouseover' | 'mouseout'
  isSideDockEnabled: boolean
  sideDockVisibleWidth: number
  openDevToolsOnStart: boolean
  shortcuts: {
    toggleSideDock: string
    disableSideDock: string
    focusWindow: string
  }
  disableMouse: boolean
  transcriptionProvider: 'remote' | 'local'
}

export const store = new Store<StoreType>({
  watch: true,
  schema: {
    windowBounds: {
      type: 'object',
      properties: {
        width: { type: 'number', default: 800 },
        height: { type: 'number', default: 600 },
        x: { type: 'number' },
        y: { type: 'number' }
      },
      default: {
        width: 800,
        height: 600
      }
    },
    isTransparent: {
      type: 'boolean',
      default: false
    },
    opacity: {
      type: 'number',
      default: 0.8
    },
    lastContent: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['service', 'video', 'playlist'], default: 'service' },
        data: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            videoSource: { type: 'string' },
            subtitleSource: { type: 'string' },
            currentTime: { type: 'number' },
            items: { type: 'array' },
            currentIndex: { type: 'number' }
          }
        }
      },
      default: {
        type: 'service',
        data: {
          name: 'YouTube'
        }
      }
    },
    isAlwaysOnTop: {
      type: 'boolean',
      default: false
    },
    alwaysOnTopLevel: {
      type: 'string',
      enum: [
        'floating',
        'torn-off-menu',
        'modal-panel',
        'main-menu',
        'status',
        'pop-up-menu',
        'screen-saver'
      ],
      default: 'floating'
    },
    transparencyMode: {
      type: 'string',
      enum: ['always', 'mouseover', 'mouseout'],
      default: 'always'
    },
    isSideDockEnabled: {
      type: 'boolean',
      default: false
    },
    sideDockVisibleWidth: {
      type: 'number',
      default: 100
    },
    openDevToolsOnStart: {
      type: 'boolean',
      default: false
    },
    shortcuts: {
      type: 'object',
      properties: {
        toggleSideDock: {
          type: 'string',
          default: 'F5'
        },
        disableSideDock: {
          type: 'string',
          default: 'Option+F5'
        },
        focusWindow: {
          type: 'string',
          default: 'Shift+Cmd+0'
        },
        toggleAlwaysOnTop: {
          type: 'string',
          default: 'F4'
        }
      },
      default: {
        toggleSideDock: 'F5',
        disableSideDock: 'Option+F5',
        focusWindow: 'Shift+Cmd+0',
        toggleAlwaysOnTop: 'F4'
      }
    },
    disableMouse: {
      type: 'boolean',
      default: false
    },
    transcriptionProvider: {
      type: 'string',
      enum: ['remote', 'local'],
      default: 'remote'
    },
    playlist: {
      type: 'object',
      properties: {
        items: { type: 'array', default: [] },
        currentIndex: { type: 'number', default: -1 }
      },
      default: {
        items: [],
        currentIndex: -1
      }
    }
  }
})
