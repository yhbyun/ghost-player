import __Store from 'electron-store'

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
  lastService: string
  isAlwaysOnTop: boolean
  transparencyMode: 'always' | 'mouseover' | 'mouseout'
  isSideDockEnabled: boolean
  sideDockVisibleWidth: number
  openDevToolsOnStart: boolean
  shortcuts: {
    toggleSideDock: string
  }
  disableMouse: boolean
}

export const store = new Store<StoreType>({
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
    lastService: {
      type: 'string',
      default: 'YouTube'
    },
    isAlwaysOnTop: {
      type: 'boolean',
      default: false
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
        }
      },
      default: {
        toggleSideDock: 'F5'
      }
    },
    disableMouse: {
      type: 'boolean',
      default: false
    }
  }
})
