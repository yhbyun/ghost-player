import { app, shell, BrowserWindow, ipcMain, protocol, Menu, dialog, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { logger } from './logger'
import { store } from './store'
import { setupMenu } from './menu'
import { SideDock } from './SideDock'
import { ShortcutManager } from './shortcuts'
import { registerLocalFileProtocols } from './video/video-playback'
import fetch from 'node-fetch'
import FormData from 'form-data'
import { localTranscriber } from './local-transcriber'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { EventEmitter } from 'events'
import { createTray } from './tray'

EventEmitter.defaultMaxListeners = 30

let mainWindow: BrowserWindow | null

if (is.dev) {
  console.log('store path:' + store.path)
}

function createWindow(onReadyToShow: () => void): void {
  const { width, height, x, y } = store.get('windowBounds')
  const isTransparent = store.get('isTransparent')
  const transparencyMode = store.get('transparencyMode')
  const opacity = store.get('opacity')

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

  mainWindow.setAlwaysOnTop(store.get('isAlwaysOnTop', false), store.get('alwaysOnTopLevel'))

  if (store.get('disableMouse')) {
    mainWindow.setIgnoreMouseEvents(true)
  }

  mainWindow.on('resize', () => {
    const { width, height } = mainWindow!.getBounds()
    store.set('windowBounds', { ...store.get('windowBounds'), width, height })
  })

  mainWindow.on('move', () => {
    if (store.get('isSideDockEnabled')) return
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

app.whenReady().then(async () => {
  const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch)
  blocker.enableBlockingInSession(session.defaultSession)

  // blocker.on('request-blocked', (request: Request) => {
  //   logger.log('adblocker', 'blocked', request.tabId, request.url)
  // })

  // blocker.on('request-redirected', (request: Request) => {
  //   logger.log('adblocker', 'redirected', request.tabId, request.url)
  // })

  // blocker.on('request-whitelisted', (request: Request) => {
  //   logger.log('adblocker', 'whitelisted', request.tabId, request.url)
  // })

  // blocker.on('csp-injected', (request: Request, csps: string) => {
  //   logger.log('adblocker', 'csp', request.url, csps)
  // })

  // blocker.on('script-injected', (script: string, url: string) => {
  //   logger.log('adblocker', 'script', script.length, url)
  // })

  // blocker.on('style-injected', (style: string, url: string) => {
  //   logger.log('adblocker', 'style', style.length, url)
  // })

  // blocker.on('filter-matched', console.log.bind(console, 'filter-matched'));

  registerLocalFileProtocols()

  // Pre-load the local transcription model
  localTranscriber.transcribe(Buffer.from([]))

  if (is.dev && process.platform === 'darwin') {
    app.dock.setIcon(icon)
  }

  let sideDock: SideDock | null = null

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('get-initial-content', () => {
    return store.get('lastContent')
  })

  ipcMain.on('set-last-content', (_, content) => {
    store.set('lastContent', content)
  })

  ipcMain.on('mouse-event', (_, event: 'enter' | 'leave') => {
    logger.log('mouse-event', event)
    // Transparency handler
    if (store.get('isTransparent')) {
      const mode = store.get('transparencyMode')
      if (mode === 'mouseover') {
        mainWindow?.setOpacity(event === 'enter' ? store.get('opacity') : 1.0)
      } else if (mode === 'mouseout') {
        mainWindow?.setOpacity(event === 'enter' ? 1.0 : store.get('opacity'))
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

  ipcMain.handle('get-setting', (_, { key, defaultValue }) => {
    return store.get(key, defaultValue)
  })

  ipcMain.on('set-setting', (_, { key, value }) => {
    store.set(key, value)
  })

  ipcMain.handle('open-file-dialog', async () => {
    if (!mainWindow) return
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mkv', 'avi', 'mp4', 'mov', 'webm'] }]
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const videoSource = result.filePaths[0]
      mainWindow.webContents.send('open-file', {
        type: 'native',
        videoSource: `local-video:${videoSource}`
      })
    }
  })

  ipcMain.handle('transcribe-audio', async (_, { audioData, apiKey }) => {
    const provider = store.get('transcriptionProvider', 'remote')
    logger.log('captioning', `Using transcription provider: ${provider}`)

    if (provider === 'local') {
      return localTranscriber.transcribe(Buffer.from(audioData))
    }

    // Remote API logic
    const formData = new FormData()
    formData.append('file', Buffer.from(audioData), {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    })
    formData.append('response_format', 'text')

    try {
      const response = await fetch('https://api.lemonfox.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(
          'captioning',
          `API Error: ${response.status} ${response.statusText} - ${errorText}`
        )
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const transcription = await response.text()
      logger.log('captioning', 'Transcription successful.')
      return transcription
    } catch (error) {
      logger.error('captioning', 'Error transcribing audio:', error)
      throw error
    }
  })

  const applySetting = (key: string, value: unknown): void => {
    const menu = Menu.getApplicationMenu()
    if (!menu) return

    switch (key) {
      case 'isTransparent': {
        mainWindow?.setOpacity(value ? store.get('opacity') : 1.0)
        const menuItem = menu.getMenuItemById('transparency-enabled')
        if (menuItem) menuItem.checked = value as boolean
        break
      }
      case 'opacity': {
        if (store.get('isTransparent')) {
          mainWindow?.setOpacity(value as number)
        }
        const menuItem = menu.getMenuItemById(`transparency-opacity-${(value as number) * 100}`)
        if (menuItem) menuItem.checked = true
        break
      }
      case 'transparencyMode': {
        if (store.get('isTransparent')) {
          mainWindow?.setOpacity(value === 'mouseover' ? 1.0 : store.get('opacity'))
        }
        const menuItem = menu.getMenuItemById(`transparency-mode-${value}`)
        if (menuItem) menuItem.checked = true
        break
      }
      case 'isAlwaysOnTop': {
        mainWindow?.setAlwaysOnTop(value as boolean, store.get('alwaysOnTopLevel'))
        const menuItem = menu.getMenuItemById('always-on-top-enabled')
        if (menuItem) menuItem.checked = value as boolean
        break
      }
      case 'alwaysOnTopLevel': {
        mainWindow?.setAlwaysOnTop(
          store.get('isAlwaysOnTop'),
          value as
            | 'normal'
            | 'floating'
            | 'torn-off-menu'
            | 'modal-panel'
            | 'main-menu'
            | 'status'
            | 'pop-up-menu'
            | 'screen-saver'
        )
        const menuItem = menu.getMenuItemById(`always-on-top-level-${value}`)
        if (menuItem) menuItem.checked = true
        break
      }
      case 'isSideDockEnabled': {
        if (value) {
          sideDock?.enable()
        } else {
          sideDock?.disable()
        }
        const menuItem = menu.getMenuItemById('side-dock-enabled')
        if (menuItem) menuItem.checked = value as boolean
        break
      }
      case 'sideDockVisibleWidth': {
        sideDock?.setVisibleWidth(value as number)
        const menuItem = menu.getMenuItemById(`side-dock-visible-width-${value}`)
        if (menuItem) menuItem.checked = true
        break
      }
      case 'disableMouse': {
        mainWindow?.setIgnoreMouseEvents(value as boolean)
        const menuItem = menu.getMenuItemById('disable-mouse')
        if (menuItem) menuItem.checked = value as boolean
        break
      }
      case 'openDevToolsOnStart': {
        const menuItem = menu.getMenuItemById('open-devtools-on-start')
        if (menuItem) menuItem.checked = value as boolean
        break
      }
    }
  }

  store.onDidAnyChange((newState, oldState) => {
    if (!newState || !oldState) return
    const changedKeys = Object.keys(newState).filter((key) => newState[key] !== oldState[key])
    for (const key of changedKeys) {
      const newValue = newState[key]
      applySetting(key, newValue)
      mainWindow?.webContents.send('setting-changed', { key, value: newValue })
    }
  })

  let shortcutManager: ShortcutManager | null = null

  createWindow(() => {
    if (!mainWindow) return
    createTray(mainWindow)

    sideDock = new SideDock(mainWindow!, store.get('sideDockVisibleWidth'))
    if (store.get('isSideDockEnabled')) {
      sideDock.enable()
    }

    shortcutManager = new ShortcutManager(
      mainWindow!,
      sideDock!,
      () => store.set('isSideDockEnabled', true),
      store.get('shortcuts.toggleSideDock'),
      store.get('shortcuts.disableSideDock'),
      store.get('shortcuts.focusWindow')
    )
    shortcutManager.registerShortcuts()

    app.on('will-quit', () => {
      shortcutManager?.unregisterAll()
    })
  })

  setupMenu(() => mainWindow)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow(() => {
        sideDock = new SideDock(mainWindow!, store.get('sideDockVisibleWidth'))
        if (store.get('isSideDockEnabled')) {
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
