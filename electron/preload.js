const { contextBridge, ipcRenderer } = require('electron');

// The renderer talks to the local Express API over HTTP for all normal data
// access (http://localhost:4000/api). This bridge only covers the bits that
// need real OS integration and can't go through HTTP: native file dialogs.
contextBridge.exposeInMainWorld('tukuzaSIS', {
  version: process.env.npm_package_version || '0.1.0',
  chooseBackupFolder: () => ipcRenderer.invoke('choose-backup-folder'),
});
