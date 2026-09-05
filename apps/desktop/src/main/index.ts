import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc';
import { restoreSession } from './cloud';
import { installCrashHandlers } from './reporting';

/**
 * Electron main process.
 *
 * Windows and macOS run the same shell (spec §14: one shared domain model and
 * product logic, not a fork per platform); only window chrome and lifecycle
 * conventions differ.
 */

let mainWindow: BrowserWindow | null = null;

const isDevelopment = !app.isPackaged;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b0b0d',
    // macOS gets the inset traffic lights; Windows keeps its standard frame.
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The renderer is untrusted: no Node, no remote module, isolated context.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // External links open in the browser, never inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDevelopment && devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
};

// Installed before anything else runs, so a failure during startup is still
// reported. It sends nothing unless the writer has opted in (spec §14).
installCrashHandlers();

app.whenReady().then(() => {
  registerIpcHandlers(() => mainWindow);
  createWindow();

  // A stored session is restored in the background: signing in should last
  // between launches, and failing to restore it must not delay the window.
  void restoreSession().catch(() => undefined);

  app.on('activate', () => {
    // macOS convention: clicking the dock icon reopens a window.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Windows and Linux quit with the last window; macOS keeps the app running.
  if (process.platform !== 'darwin') app.quit();
});
