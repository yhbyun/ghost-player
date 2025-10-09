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
}

export const store = new Store<StoreType>({
  schema: {
    windowBounds: {
      type: 'object',
      properties: {
        width: { type: 'number' },
        height: { type: 'number' },
        x: { type: 'number' },
        y: { type: 'number' }
      },
      default: {
        width: 900,
        height: 670
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
      default: 'Netflix'
    },
    isAlwaysOnTop: {
      type: 'boolean',
      default: false
    },
    transparencyMode: {
      type: 'string',
      enum: ['always', 'mouseover', 'mouseout'],
      default: 'always'
    }
  }
})
