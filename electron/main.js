const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

  // Automatic backups: run once at startup (skipped if a backup already exists
  // from the last 24h), then re-check every 6 hours in case the app is left open.
  const { backupIfStale } = require('../server/lib/backup');
  backupIfStale().catch((err) => console.error('[backup] automatic backup failed', err));
  setInterval(() => {
    backupIfStale().catch((err) => console.error('[backup] automatic backup failed', err));
  }, 6 * 60 * 60 * 1000);
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

  // Native folder picker for the offsite/cloud backup mirror location (e.g. a
  // synced OneDrive/Google Drive/Dropbox folder). The renderer can't show OS
  // dialogs directly, so it asks the main process via this IPC channel and
  // then saves the chosen path itself through the normal API.
  ipcMain.handle('choose-backup-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose a folder to also copy backups to',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
