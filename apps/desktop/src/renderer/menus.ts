/**
 * The menu bar (addendum 02 §13).
 *
 * One description of the menus, used twice: the bar drawn in the window —
 * which is what the browser preview has, and what Windows shows — and the
 * native application menu the main process builds from the same list, so a
 * Mac gets its menus where a Mac keeps them and every accelerator works
 * whether or not the window has focus on a text box.
 *
 * A menu item is a **command name and a label**, nothing else. What a command
 * does lives in the workspace, which is the only place that knows what is
 * open; this file knows what the menus contain and what they are called, and
 * that is all it should ever know.
 */

import type { ProjectFormat } from '@vcwriter/domain';

export type CommandId =
  // File
  | 'file.new'
  | 'file.new.episode'
  | 'file.open'
  | 'file.import'
  | 'file.save'
  | 'file.saveAs'
  | 'file.titlePage'
  | 'file.pageSetup'
  | 'file.print'
  | 'file.exportPdf'
  | 'file.preferences'
  | 'file.close'
  // Editor
  | 'editor.find'
  | 'editor.replace'
  | 'editor.findNext'
  | 'editor.daily'
  | 'editor.final'
  | 'editor.readBack'
  | 'editor.reformat'
  // Reports
  | 'reports.writing'
  | 'reports.story'
  // Window
  | 'window.script'
  | 'window.viewer'
  | 'window.lanes'
  | 'window.inspector'
  | 'window.research'
  | 'window.episodes'
  | 'window.beat'
  | 'window.focus'
  | 'window.bringAllBack'
  | 'window.preferences'
  // Help
  | 'help.spec'
  | 'help.about';

export interface MenuItem {
  command: CommandId;
  label: string;
  /** Electron accelerator syntax; also what the bar prints beside the label. */
  accelerator?: string;
  /** A tick beside the item, for the things that are on or off. */
  checkable?: boolean;
}

export interface Menu {
  id: string;
  label: string;
  /** A `null` is a separator. */
  items: (MenuItem | null)[];
}

/**
 * The menus, for the project that is open (addendum 02 §13).
 *
 * **New project** is one item, not six. Which kind of thing this is going to
 * be is the first decision of the work, and it belongs on the screen where
 * the title and the author are set, beside a description of what each format
 * does — not buried in a menu as a list of nouns.
 *
 * **New episode** is the exception, and appears only in a series. It is not
 * a kind of project; it is a thing you do inside one, and a menu that offers
 * it in a novel is a menu that lies.
 */
export const menusFor = (format: ProjectFormat | null): readonly Menu[] => [
  {
    id: 'file',
    label: 'File',
    items: [
      { command: 'file.new', label: 'New project…', accelerator: 'CmdOrCtrl+N' },
      ...(format === 'series' ? [{ command: 'file.new.episode' as CommandId, label: 'New episode…' }] : []),
      null,
      { command: 'file.open', label: 'Open…', accelerator: 'CmdOrCtrl+O' },
      { command: 'file.import', label: 'Import a script…' },
      null,
      { command: 'file.save', label: 'Save', accelerator: 'CmdOrCtrl+S' },
      { command: 'file.saveAs', label: 'Save a copy…', accelerator: 'CmdOrCtrl+Shift+S' },
      null,
      { command: 'file.titlePage', label: 'Title page…' },
      { command: 'file.pageSetup', label: 'Page setup…' },
      { command: 'file.print', label: 'Print…', accelerator: 'CmdOrCtrl+P' },
      { command: 'file.exportPdf', label: 'Export PDF…', accelerator: 'CmdOrCtrl+Shift+P' },
      null,
      { command: 'file.preferences', label: 'Preferences…', accelerator: 'CmdOrCtrl+,' },
      { command: 'file.close', label: 'Close project' },
    ],
  },
  {
    id: 'editor',
    label: 'Editor',
    items: [
      { command: 'editor.find', label: 'Find…', accelerator: 'CmdOrCtrl+F' },
      { command: 'editor.findNext', label: 'Find next', accelerator: 'CmdOrCtrl+G' },
      { command: 'editor.replace', label: 'Find and replace…', accelerator: 'CmdOrCtrl+Alt+F' },
      null,
      { command: 'editor.reformat', label: 'Reformat pasted text' },
      null,
      // The two editors of spec §8: the daily pass, and the one that reads
      // the whole thing. "More advanced" is where the rest will go.
      { command: 'editor.daily', label: 'Daily editor' },
      { command: 'editor.final', label: 'Final editor' },
      { command: 'editor.readBack', label: 'Read back' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      { command: 'reports.writing', label: 'Writing log…' },
      { command: 'reports.story', label: 'Story statistics…' },
    ],
  },
  {
    id: 'window',
    label: 'Window',
    items: [
      // Each of these is a section: ticked when it is in a window of its own,
      // and choosing it docks it back (addendum 02 §8).
      { command: 'window.script', label: 'Script in its own window', checkable: true },
      { command: 'window.viewer', label: 'Timeline & Viewer in its own window', checkable: true },
      { command: 'window.lanes', label: 'Plot lanes in its own window', checkable: true },
      { command: 'window.inspector', label: 'Inspector in its own window', checkable: true },
      { command: 'window.research', label: 'Research in its own window', checkable: true },
      { command: 'window.episodes', label: 'Episodes', checkable: true },
      { command: 'window.beat', label: 'This beat in its own window' },
      null,
      { command: 'window.bringAllBack', label: 'Bring everything back' },
      null,
      { command: 'window.focus', label: 'Focus mode', accelerator: 'CmdOrCtrl+Shift+F', checkable: true },
      { command: 'window.preferences', label: 'Window preferences…' },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    items: [
      { command: 'help.spec', label: 'What this build does' },
      { command: 'help.about', label: 'About VC Writer' },
    ],
  },
];

/** The menus with nothing open: everything a project does not decide. */
export const MENUS: readonly Menu[] = menusFor(null);

/** The accelerator as a reader of the menu should see it, per platform. */
export const prettyAccelerator = (accelerator: string, mac: boolean): string =>
  accelerator
    .replace('CmdOrCtrl', mac ? '⌘' : 'Ctrl')
    .replace('Shift', mac ? '⇧' : 'Shift')
    .replace('Alt', mac ? '⌥' : 'Alt')
    .replace(/\+/g, mac ? '' : '+');

/**
 * Whether a keystroke is this accelerator. Used by the in-app bar, which has
 * to do its own matching because there is no native menu in a browser.
 */
export const matchesAccelerator = (event: KeyboardEvent, accelerator: string): boolean => {
  const parts = accelerator.split('+');
  const key = (parts[parts.length - 1] as string).toLowerCase();
  const wantsMod = parts.includes('CmdOrCtrl');
  const wantsShift = parts.includes('Shift');
  const wantsAlt = parts.includes('Alt');
  const hasMod = event.metaKey || event.ctrlKey;
  return (
    event.key.toLowerCase() === key &&
    wantsMod === hasMod &&
    wantsShift === event.shiftKey &&
    wantsAlt === event.altKey
  );
};
