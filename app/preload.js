const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getUsers: () => ipcRenderer.invoke('getUsers'),
  onUsers: (cb) => ipcRenderer.on('users', (_, u) => cb(u)),
  alert: (to) => ipcRenderer.send('alert', to),
  reply: (to, text) => ipcRenderer.send('reply', { to, text }),
  close: () => ipcRenderer.send('close'),
});
