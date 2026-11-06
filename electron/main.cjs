const { app, BrowserWindow, nativeImage, shell } = require('electron')
const path = require('node:path')

let mainWindow

function iconPath() {
  return path.join(app.getAppPath(), 'build', 'icon.svg')
}

function createWindow() {
  const icon = nativeImage.createFromPath(iconPath())
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#131418',
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // The packaged renderer is a local file, not a localhost web server.
  void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
