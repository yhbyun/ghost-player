
import { Tray, Menu, nativeImage, app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'

let tray: Tray | null = null

const createTray = (win: BrowserWindow) => {
  const playIcon = nativeImage.createFromPath(path.join(__dirname, '../../resources/play.png'))
  const stopIcon = nativeImage.createFromPath(path.join(__dirname, '../../resources/stop.png'))

  tray = new Tray(playIcon)

  const updateTray = (isPlaying: boolean) => {
    if (!tray) return

    const icon = isPlaying ? stopIcon : playIcon
    tray.setImage(icon)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isPlaying ? 'Stop' : 'Play',
        click: () => {
          win.webContents.send('playback-control', isPlaying ? 'stop' : 'play')
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)
  }

  updateTray(false) // Initial state

  ipcMain.on('playback-state', (_, isPlaying: boolean) => {
    updateTray(isPlaying)
  })

  tray.setToolTip('Ghost Player')
}

export { createTray }
