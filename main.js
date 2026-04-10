import { app, BrowserWindow, ipcMain, screen } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const preloadPath = path.join(__dirname, 'preload.js');
let ipcHandlerRegistered = false;
let mainWin = null;

// Fix GPU crash issue
app.disableHardwareAcceleration();

function loadURLWithRetry(win, url, { retries = 30, intervalMs = 500 } = {}) {
  const attemptOnce = () =>
    new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        win.webContents.off('did-finish-load', onFinish);
        win.webContents.off('did-fail-load', onFail);
      };

      const onFinish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onFail = (_event, errorCode, errorDesc) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`${errorDesc || 'Failed to load'} (code: ${errorCode})`));
      };

      win.webContents.once('did-finish-load', onFinish);
      win.webContents.once('did-fail-load', onFail);
      win.loadURL(url);
    });

  return (async () => {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        await attemptOnce();
        return;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
    throw lastErr;
  })();
}

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    visualEffectState: 'active',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  });

  // On macOS, make the window visible on all workspaces and set it to a high level
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, 'floating', 1);
  }

  // Open dev tools to see if React is crashing
  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Start in click-through mode; renderer will disable it on hover.
  win.setIgnoreMouseEvents(true, { forward: true });
  mainWin = win;

  // Pipe renderer console logs to the terminal for easier debugging.
  // (So "pure white window" issues show useful JS errors.)
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = `[renderer:${level}]`;
    if (sourceId) {
      console.log(`${prefix} ${message} (${sourceId}:${line})`);
    } else {
      console.log(`${prefix} ${message}`);
    }
  });

  // Prevent popup windows for safety.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Renderer calls this to toggle Electron-level click-through.
  if (!ipcHandlerRegistered) {
    ipcMain.on('set-ignore-mouse-events', (event, payload) => {
      const { ignore, options } = payload || {};
      if (typeof ignore !== 'boolean') return;
      if (!mainWin) return;

      console.log(`[main] set-ignore-mouse-events: ignore=${ignore}`);

      if (!ignore) {
        mainWin.setIgnoreMouseEvents(false);
        // On macOS, focus and making it focusable is sometimes necessary
        if (process.platform === 'darwin') {
          mainWin.setFocusable(true);
          mainWin.showInactive(); // Ensure it's shown
          mainWin.focus();
          // Force a small delay then focus again to be sure
          setTimeout(() => {
            if (mainWin) mainWin.focus();
          }, 50);
        }
        return;
      }

      // default forward keeps React mouse-enter/leave working
      const safeOptions = options || { forward: true };
      mainWin.setIgnoreMouseEvents(true, safeOptions);
    });
    ipcHandlerRegistered = true;
  }

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    loadURLWithRetry(win, devUrl).catch((err) => {
      console.error('Failed to load dev server:', err);
    });
    return;
  }

  const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
  if (!fs.existsSync(indexPath)) {
    // Keep the app responsive even if build is missing.
    console.error('Missing production entry:', indexPath);
    win.loadURL(`file://${path.join(__dirname, 'index.html')}`);
    return;
  }

  win.loadFile(indexPath);
}

ipcMain.on('quit-app', () => {
  app.quit();
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

