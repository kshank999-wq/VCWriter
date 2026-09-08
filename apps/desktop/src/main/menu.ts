import { app, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

/**
 * The native application menu (addendum 02 §13).
 *
 * The menus themselves are described once, in the renderer, and the shape of
 * that description is mirrored here: this process builds the real menu from
 * it and sends the command name back to the window that was focused when the
 * item was chosen. Nothing about what a command *does* is known here.
 *
 * macOS needs this for a second reason. An Electron application with no menu
 * loses ⌘C, ⌘V and ⌘A entirely, because on a Mac those live on the menu and
 * nowhere else — so the standard editing roles are added whether or not the
 * renderer asks for them.
 */

export interface MenuSpec {
  id: string;
  label: string;
  items: ({ command: string; label: string; accelerator?: string; checkable?: boolean } | null)[];
}

const isMac = process.platform === 'darwin';

export const applyApplicationMenu = (
  spec: readonly MenuSpec[],
  checked: readonly string[],
  send: (command: string) => void,
): void => {
  const ticked = new Set(checked);

  const fromSpec: MenuItemConstructorOptions[] = spec.map((menu) => ({
    label: menu.label,
    submenu: menu.items.map((item) =>
      item === null
        ? { type: 'separator' as const }
        : {
            label: item.label,
            ...(item.accelerator ? { accelerator: item.accelerator } : {}),
            ...(item.checkable ? { type: 'checkbox' as const, checked: ticked.has(item.command) } : {}),
            click: () => send(item.command),
          },
    ),
  }));

  /**
   * The clipboard and undo, as roles rather than commands. These are the
   * window manager's to handle — the renderer has no idea what is selected
   * in which text box — and on a Mac they do not work at all without being
   * on the menu.
   */
  const editing: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      ...(isMac ? [{ role: 'pasteAndMatchStyle' as const }] : []),
      { role: 'delete' },
      { role: 'selectAll' },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { label: 'Preferences…', accelerator: 'Cmd+,', click: () => send('file.preferences') },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),
    // File first, then the platform's editing roles, then the rest of ours.
    ...fromSpec.filter((menu) => menu.label === 'File'),
    editing,
    ...fromSpec.filter((menu) => menu.label !== 'File' && menu.label !== 'Help'),
    {
      role: 'help',
      submenu: [
        ...(fromSpec.find((menu) => menu.label === 'Help')?.submenu as MenuItemConstructorOptions[]) ?? [],
        { type: 'separator' },
        { label: 'vc-writer.com', click: () => void shell.openExternal('https://vc-writer.com') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

/** Sends a command to a window, if there still is one. */
export const commandSender =
  (getWindow: () => BrowserWindow | null) =>
  (command: string): void => {
    const window = getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('menu:command', command);
  };
