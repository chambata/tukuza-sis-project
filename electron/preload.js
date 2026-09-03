const { contextBridge } = require('electron');

// Reserved for future native integrations (printing, file dialogs, etc.).
// The renderer talks to the local Express API over HTTP (http://localhost:4000/api),
// so no IPC bridge is required for normal app functionality yet.
contextBridge.exposeInMainWorld('tukuzaSIS', {
  version: process.env.npm_package_version || '0.1.0',
});
