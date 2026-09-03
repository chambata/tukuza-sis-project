const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// Point the server at a per-user writable data directory in production so the
// SQLite database survives app updates and isn't inside the (read-only) install dir.
if (!isDev) {
  process.env.SIMS_DATA_DIR = path.join(app.getPath('userData'), 'data');
}

let serverStarted = false;
function startServer() {
  if (serverStarted) return;
  // Requiring the server module starts the Express API on PORT (default 4000).
  require('../server/index.js');
  serverStarted = true;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'Tukuza SIS — Fountain of Peace University College',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
