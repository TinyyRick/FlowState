const { contextBridge, ipcRenderer } = require('electron');

// Expose a small bridge for click-through control.
// Renderer code expects: window.electron.setIgnoreMouseEvents(ignore, options?)
contextBridge.exposeInMainWorld('electron', {
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', { ignore, options });
  },
  quitApp: () => {
    ipcRenderer.send('quit-app');
  },
});

