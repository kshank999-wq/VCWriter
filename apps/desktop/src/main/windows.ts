import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';

/**
 * Windows beyond the workspace (addendum 02 §8).
 *
 * Any section of the workspace can be taken out of it and given a window of
 * its own, which the writer can then put on a second monitor: the Script on
 * the left screen, the beat they are writing on the right, research open
 * behind both. Each one runs the same renderer bundle with `?pane=` naming
 * what it is; the document they all edit is shared over the link, which this
 * module relays and does not read.
 *
 * The registry is keyed by pane, so asking twice for the same section raises
 * the window that already exists rather than making a second one. Beats key
 * on their own id — a writer can have two beats open side by side — and
 * everything else is a singleton.
 */

export type PaneKey = string;

interface Registry {
  /** Open the pane in its own window, or raise it if it is already open. */
  open(pane: PaneKey): void;
  close(pane: PaneKey): void;
  /** Which panes are currently out of the workspace. */
  list(): PaneKey[];
  /** Pass a link message to every window except the one it came from. */
  relay(fromWebContentsId: number, message: unknown): void;
  /** The workspace has gone: nothing else has a document to edit. */
  closeAll(): void;
}

/** How big a section wants to be when it is on its own. */
const SHAPES: Record<string, { width: number; height: number }> = {
  // A beat is a page: tall rather than wide, and wide enough for the page
  // plus its margins at a comfortable size.
  beat: { width: 900, height: 1040 },
  script: { width: 860, height: 1040 },
  research: { width: 1280, height: 860 },
  viewer: { width: 1240, height: 560 },
  lanes: { width: 1240, height: 620 },
};

const shapeFor = (pane: PaneKey) => SHAPES[pane.split(':')[0] ?? ''] ?? { width: 1000, height: 800 };

export const createWindowRegistry = (options: {
  getWorkspace(): BrowserWindow | null;
  /** Told whenever the set of open panes changes, so the workspace can follow. */
  onChanged(panes: PaneKey[]): void;
  isDevelopment: boolean;
}): Registry => {
  const windows = new Map<PaneKey, BrowserWindow>();

  const announce = () => options.onChanged([...windows.keys()]);

  const open = (pane: PaneKey) => {
    const existing = windows.get(pane);
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
      return;
    }

    const shape = shapeFor(pane);
    const window = new BrowserWindow({
      ...shape,
      minWidth: 420,
      minHeight: 320,
      show: false,
      backgroundColor: '#0b0b0d',
      ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        // The same terms as the workspace window: no Node, isolated context,
        // sandboxed. A second window is not a second trust level.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    windows.set(pane, window);
    window.on('ready-to-show', () => window.show());
    window.on('closed', () => {
      windows.delete(pane);
      announce();
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
    if (options.isDevelopment && devServerUrl) {
      void window.loadURL(`${devServerUrl}?pane=${encodeURIComponent(pane)}`);
    } else {
      void window.loadFile(join(__dirname, '../renderer/index.html'), { query: { pane } });
    }

    announce();
  };

  const close = (pane: PaneKey) => {
    const window = windows.get(pane);
    if (window && !window.isDestroyed()) window.close();
    windows.delete(pane);
    announce();
  };

  return {
    open,
    close,
    list: () => [...windows.keys()],
    relay(fromWebContentsId, message) {
      const workspace = options.getWorkspace();
      const targets = [...windows.values(), ...(workspace ? [workspace] : [])];
      for (const window of targets) {
        if (window.isDestroyed() || window.webContents.id === fromWebContentsId) continue;
        window.webContents.send('link:message', message);
      }
    },
    closeAll() {
      for (const window of windows.values()) {
        if (!window.isDestroyed()) window.destroy();
      }
      windows.clear();
      announce();
    },
  };
};
