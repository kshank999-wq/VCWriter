import { ipcMain, Menu, session, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

/**
 * The right-click menu over writing, as in any word processor (from Ken: *the
 * spell check catches mistakes but there should be a right-click menu like
 * standard in writing software with a suggestion and other standard menu
 * options*).
 *
 * Electron shows no menu of its own, so a right-click in a note, a title or
 * the word processor did nothing at all. This is the standard one: the
 * spelling suggestions for a misspelled word, Add to Dictionary, then Undo,
 * Redo, Cut, Copy, Paste and Select All. A screen that draws its own menu (the
 * beat editor's) prevents the browser's, and then this never opens; that menu
 * carries the same spelling and editing items itself, through `spelling:*`.
 */
export const attachEditMenu = (window: BrowserWindow): void => {
  window.webContents.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];
    if (params.misspelledWord) {
      const suggestions = params.dictionarySuggestions.slice(0, 6);
      if (suggestions.length === 0) items.push({ label: 'No spelling suggestions', enabled: false });
      for (const word of suggestions) {
        items.push({ label: word, click: () => window.webContents.replaceMisspelling(word) });
      }
      items.push(
        { type: 'separator' },
        {
          label: 'Add to Dictionary',
          click: () => window.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        },
        { type: 'separator' },
      );
    }
    if (params.isEditable) {
      items.push(
        { role: 'undo', enabled: params.editFlags.canUndo },
        { role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { role: 'selectAll' },
      );
    } else if (params.selectionText.trim()) {
      items.push({ role: 'copy' });
    }
    if (items.length === 0) return;
    Menu.buildFromTemplate(items).popup({ window });
  });
};

/**
 * Spelling for a menu the page draws itself: whether a word is misspelled is
 * asked in the page (`webFrame`, in the preload), and adding a word to the
 * dictionary is the session's, so it is asked here.
 */
export const registerSpellingHandlers = (): void => {
  ipcMain.handle('spelling:add', (_event, word: unknown) => {
    if (typeof word !== 'string' || word.trim().length === 0 || word.length > 80) return false;
    session.defaultSession.addWordToSpellCheckerDictionary(word.trim());
    return true;
  });
};
