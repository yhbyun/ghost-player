import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { logger } from './logger'
import { services } from '../config/services'

let mainWindow: BrowserWindow | null
let isTransparent = false // Transparency is disabled by default
let opacity = 0.8 // Default opacity setting is 80%

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('get-initial-service', () => {
    return services.find((s) => s.name === 'Netflix')
  })

  ipcMain.on('drag-window', (_, { deltaX, deltaY }) => {
    logger.log('dragging', 'drag-window', { deltaX, deltaY })
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition()
      mainWindow.setPosition(x + deltaX, y + deltaY)
    }
  })

  const menu = Menu.buildFromTemplate([
    { role: 'appMenu' },
    {
      label: 'Services',
      submenu: services.map((service) => ({
        label: service.name,
        click: (): void => {
          logger.log('menu', 'change-service', service.name)
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
              checked: isTransparent,
              click: (menuItem): void => {
                isTransparent = menuItem.checked
                if (isTransparent) {
                  // Apply the stored opacity value
                  mainWindow?.setOpacity(opacity)
                } else {
                  // Make it fully opaque
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
                  checked: opacity === o,
                  click: (): void => {
                    // Only update the setting
                    opacity = o
                    // If transparency is currently active, apply the new opacity immediately
                    if (isTransparent) {
                      mainWindow?.setOpacity(opacity)
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

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
