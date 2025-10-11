import { app, shell, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { logger } from './logger'
import { services, Service } from '../config/services'
import { store } from './store'
import { setupMenu } from './menu'
import { SideDock } from './SideDock'
import { ShortcutManager } from './shortcuts'
import { registerLocalVideoProtocol } from './video/video-playback'

let mainWindow: BrowserWindow | null
let isTransparent = false // Transparency is disabled by default
let opacity = 0.8 // Default opacity setting is 80%
let isSideDockEnabled = false

if (is.dev) {
  console.log('store path:' + store.path)
}

function createWindow(onReadyToShow: () => void): void {
  const { width, height, x, y } = store.get('windowBounds')
  const transparencyMode = store.get('transparencyMode')

  let initialOpacity = 1.0
  if (isTransparent) {
    if (transparencyMode === 'mouseover') {
      initialOpacity = 1.0
    } else {
      initialOpacity = opacity
    }
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    frame: false,
    opacity: initialOpacity,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webviewTag: true
    }
  })

  mainWindow.setAlwaysOnTop(store.get('isAlwaysOnTop', false))

  if (store.get('disableMouse')) {
    mainWindow.setIgnoreMouseEvents(true)
  }

  mainWindow.on('resize', () => {
    const { width, height } = mainWindow!.getBounds()
    store.set('windowBounds', { ...store.get('windowBounds'), width, height })
  })

  mainWindow.on('move', () => {
    if (isSideDockEnabled) return
    const { x, y } = mainWindow!.getBounds()
    store.set('windowBounds', { ...store.get('windowBounds'), x, y })
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    onReadyToShow()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (store.get('openDevToolsOnStart')) {
    mainWindow.webContents.openDevTools()
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
])

app.whenReady().then(() => {
  registerLocalVideoProtocol()

  if (is.dev && process.platform === 'darwin') {
    app.dock.setIcon(icon)
  }

  isTransparent = store.get('isTransparent')
  opacity = store.get('opacity')
  isSideDockEnabled = store.get('isSideDockEnabled')

  let sideDock: SideDock | null = null

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-initial-service', (): Service | undefined => {
    const lastServiceName = store.get('lastService')
    return services.find((s) => s.name === lastServiceName)
  })

  ipcMain.on('mouse-event', (_, event: 'enter' | 'leave') => {
    logger.log('mouse-event', event)
    // Transparency handler
    if (isTransparent) {
      const mode = store.get('transparencyMode')
      if (mode === 'mouseover') {
        mainWindow?.setOpacity(event === 'enter' ? opacity : 1.0)
      } else if (mode === 'mouseout') {
        mainWindow?.setOpacity(event === 'enter' ? 1.0 : opacity)
      }
    }

    // SideDock handler
    if (event === 'enter') {
      sideDock?.handleMouseEnter()
    } else {
      sideDock?.handleMouseLeave()
    }
  })

  ipcMain.on('drag-window', (_, { deltaX, deltaY }) => {
    logger.log('dragging', 'drag-window', { deltaX, deltaY })
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition()
      mainWindow.setPosition(x + deltaX, y + deltaY)
    }
  })

  let shortcutManager: ShortcutManager | null = null

  const onSideDockToggle = (enabled: boolean): void => {
    isSideDockEnabled = enabled
    store.set('isSideDockEnabled', enabled)
    if (sideDockEnabledMenuItem) {
      sideDockEnabledMenuItem.checked = enabled
    }
    if (enabled) {
      sideDock?.enable()
    } else {
      sideDock?.disable()
    }
  }

  createWindow(() => {
    sideDock = new SideDock(mainWindow!, store.get('sideDockVisibleWidth'))
    if (isSideDockEnabled) {
      sideDock.enable()
    }

    shortcutManager = new ShortcutManager(
      sideDock!,
      onSideDockToggle,
      store.get('shortcuts.toggleSideDock')
    )
    shortcutManager.registerShortcuts()

    app.on('will-quit', () => {
      shortcutManager?.unregisterAll()
    })
  })

  const menu = setupMenu(
    () => mainWindow,
    () => isTransparent,
    (value) => (isTransparent = value),
    () => opacity,
    (value) => (opacity = value),
    onSideDockToggle,
    (width) => {
      sideDock?.setVisibleWidth(width)
    }
  )
  const sideDockEnabledMenuItem = menu.getMenuItemById('side-dock-enabled')

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow(() => {
        sideDock = new SideDock(mainWindow!, store.get('sideDockVisibleWidth'))
        if (isSideDockEnabled) {
          sideDock.enable()
        }
      })
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
