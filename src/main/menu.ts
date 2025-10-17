import { Menu, BrowserWindow, MenuItemConstructorOptions, dialog } from 'electron'
import prompt from 'electron-prompt'
import { services } from '../config/services'
import { logger } from './logger'
import { store } from './store'
import { playVideo } from './video/video-playback'

export function setupMenu(getMainWindow: () => BrowserWindow | null): Menu {
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
              id: 'transparency-enabled',
              label: 'Enabled',
              type: 'checkbox',
              checked: store.get('isTransparent'),
              click: (menuItem): void => {
                store.set('isTransparent', menuItem.checked)
              }
            },
            {
              label: 'Opacity',
              submenu: [10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => {
                const o = p / 100
                return {
                  id: `transparency-opacity-${p}`,
                  label: `${p}%`,
                  type: 'radio',
                  checked: store.get('opacity') === o,
                  click: (): void => {
                    store.set('opacity', o)
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
                  id: `transparency-mode-${modeValue}`,
                  label: mode,
                  type: 'radio',
                  checked: store.get('transparencyMode') === modeValue,
                  click: (): void => {
                    store.set('transparencyMode', modeValue)
                  }
                }
              }
            )
          ]
        },
        {
          label: 'Always on Top',
          submenu: [
            {
              id: 'always-on-top-enabled',
              label: 'Enabled',
              type: 'checkbox',
              checked: store.get('isAlwaysOnTop', false),
              click: (menuItem): void => {
                store.set('isAlwaysOnTop', menuItem.checked)
              }
            },
            {
              label: 'Level',
              submenu: (
                [
                  'floating',
                  'torn-off-menu',
                  'modal-panel',
                  'main-menu',
                  'status',
                  'pop-up-menu',
                  'screen-saver'
                ] as const
              ).map((level) => ({
                id: `always-on-top-level-${level}`,
                label: level,
                type: 'radio',
                checked: store.get('alwaysOnTopLevel') === level,
                click: (): void => {
                  store.set('alwaysOnTopLevel', level)
                }
              }))
            }
          ]
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
                store.set('isSideDockEnabled', menuItem.checked)
              }
            },
            { type: 'separator' },
            {
              label: 'Visible Width',
              submenu: [20, 50, 100, 150, 200].map((w) => ({
                id: `side-dock-visible-width-${w}`,
                label: `${w}px`,
                type: 'radio',
                checked: store.get('sideDockVisibleWidth') === w,
                click: (): void => {
                  store.set('sideDockVisibleWidth', w)
                }
              }))
            }
          ]
        },
        {
          id: 'disable-mouse',
          label: 'Disable Mouse',
          type: 'checkbox',
          checked: store.get('disableMouse', false),
          click: (menuItem): void => {
            store.set('disableMouse', menuItem.checked)
          }
        },
        { type: 'separator' },
        {
          id: 'open-devtools-on-start',
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
