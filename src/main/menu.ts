import { Menu, BrowserWindow } from 'electron'
import { services } from '../config/services'
import { logger } from './logger'
import { store } from './store'

export function setupMenu(
  getMainWindow: () => BrowserWindow | null,
  getIsTransparent: () => boolean,
  setIsTransparent: (value: boolean) => void,
  getOpacity: () => number,
  setOpacity: (value: number) => void
): void {
  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'Services',
      submenu: services.map((service) => ({
        label: service.name,
        click: (): void => {
          const mainWindow = getMainWindow()
          logger.log('menu', 'change-service', service.name)
          store.set('lastService', service.name)
          mainWindow?.webContents.send('change-service', service)
        }
      }))
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
                      mainWindow?.setOpacity(o)
                    }
                  }
                }
              })
            }
          ]
        }
      ]
    }
  ])
  Menu.setApplicationMenu(menu)
}
