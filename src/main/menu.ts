import { Menu, BrowserWindow, MenuItemConstructorOptions, dialog } from 'electron'
import prompt from 'electron-prompt'
import { services } from '../config/services'
import { logger } from './logger'
import { store } from './store'
import { playVideo } from './video/video-playback'

export function setupMenu(
  getMainWindow: () => BrowserWindow | null,
  getIsTransparent: () => boolean,
  setIsTransparent: (value: boolean) => void,
  getOpacity: () => number,
  setOpacity: (value: number) => void,
  onSideDockToggle: (enabled: boolean) => void,
  onVisibleWidthChange: (width: number) => void
): Menu {
  const menuTemplate: (MenuItemConstructorOptions | Electron.MenuItem)[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File...',
          accelerator: 'CommandOrControl+O',
          click: () => {
            const mainWindow = getMainWindow()
            if (!mainWindow) return

            dialog
              .showOpenDialog(mainWindow, {
                properties: ['openFile']
              })
              .then((result) => {
                if (!result.canceled && result.filePaths.length > 0) {
                  playVideo(mainWindow, result.filePaths[0])
                }
              })
              .catch((err) => {
                logger.error('Error opening file dialog', err)
              })
          }
        },
        { type: 'separator' },
        {
          label: 'Open Location...',
          accelerator: 'CommandOrControl+L',
          click: () => {
            const mainWindow = getMainWindow()
            if (!mainWindow) return

            prompt({
              title: 'Open Location',
              label: 'Enter URL:',
              inputAttrs: {
                type: 'url',
                placeholder: 'https://example.com/video.mp4'
              },
              type: 'input'
            })
              .then((value: string | null) => {
                if (value) {
                  mainWindow.webContents.send('open-location', value)
                }
              })
              .catch(console.error)
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Services',
      submenu: services.map((service) => ({
        label: service.name,
        type: 'radio',
        checked: store.get('lastService') === service.name,
        click: (): void => {
          const mainWindow = getMainWindow()
          logger.log('menu', 'change-service', service.name)
          store.set('lastService', service.name)
          mainWindow?.webContents.send('change-service', service)
        }
      }))
    },
    {
      role: 'editMenu'
    },
    {
      role: 'viewMenu'
    },
    {
      role: 'windowMenu'
    },
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Transparency',
          submenu: [
            {
              label: 'Enabled',
              type: 'checkbox',
              checked: getIsTransparent(),
              click: (menuItem): void => {
                const mainWindow = getMainWindow()
                const newIsTransparent = menuItem.checked
                setIsTransparent(newIsTransparent)
                store.set('isTransparent', newIsTransparent)
                if (newIsTransparent) {
                  mainWindow?.setOpacity(getOpacity())
                } else {
                  mainWindow?.setOpacity(1.0)
                }
              }
            },
            {
              label: 'Opacity',
              submenu: [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => {
                const o = p / 100
                return {
                  label: `${p}%`,
                  type: 'radio',
                  checked: getOpacity() === o,
                  click: (): void => {
                    const mainWindow = getMainWindow()
                    setOpacity(o)
                    store.set('opacity', o)
                    if (getIsTransparent()) {
                      const mode = store.get('transparencyMode')
                      if (mode === 'always' || mode === 'mouseout') {
                        mainWindow?.setOpacity(o)
                      }
                    }
                  }
                }
              })
            },
            { type: 'separator' },
            ...(['Always', 'Mouse Over', 'Mouse Out'] as const).map(
              (mode): MenuItemConstructorOptions => {
                const modeValue = mode.toLowerCase().replace(' ', '') as
                  | 'always'
                  | 'mouseover'
                  | 'mouseout'
                return {
                  label: mode,
                  type: 'radio',
                  checked: store.get('transparencyMode') === modeValue,
                  click: (): void => {
                    store.set('transparencyMode', modeValue)
                    const mainWindow = getMainWindow()
                    if (mainWindow && getIsTransparent()) {
                      if (modeValue === 'mouseover') {
                        mainWindow.setOpacity(1.0)
                      } else {
                        mainWindow.setOpacity(getOpacity())
                      }
                    }
                  }
                }
              }
            )
          ]
        },
        {
          label: 'Always on Top',
          type: 'checkbox',
          checked: store.get('isAlwaysOnTop', false),
          click: (menuItem): void => {
            const mainWindow = getMainWindow()
            const isAlwaysOnTop = menuItem.checked
            store.set('isAlwaysOnTop', isAlwaysOnTop)
            mainWindow?.setAlwaysOnTop(isAlwaysOnTop)
          }
        },
        {
          label: 'Side Dock',
          submenu: [
            {
              id: 'side-dock-enabled',
              label: 'Enabled',
              type: 'checkbox',
              checked: store.get('isSideDockEnabled', false),
              click: (menuItem): void => {
                onSideDockToggle(menuItem.checked)
              }
            },
            { type: 'separator' },
            {
              label: 'Visible Width',
              submenu: [20, 50, 100, 150].map((w) => ({
                label: `${w}px`,
                type: 'radio',
                checked: store.get('sideDockVisibleWidth') === w,
                click: (): void => {
                  store.set('sideDockVisibleWidth', w)
                  onVisibleWidthChange(w)
                }
              }))
            }
          ]
        },
        {
          label: 'Disable Mouse',
          type: 'checkbox',
          checked: store.get('disableMouse', false),
          click: (menuItem): void => {
            const mainWindow = getMainWindow()
            store.set('disableMouse', menuItem.checked)
            mainWindow?.setIgnoreMouseEvents(menuItem.checked)
          }
        },
        { type: 'separator' },
        {
          label: 'Open DevTools on Start',
          type: 'checkbox',
          checked: store.get('openDevToolsOnStart', false),
          click: (menuItem): void => {
            store.set('openDevToolsOnStart', menuItem.checked)
          }
        }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
  return menu
}
