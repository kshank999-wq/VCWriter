/**
 * The open document's commands, for the app's menus and keys (addendum 42).
 *
 * The document keeps its own undo, as Word does, so the program's one undo
 * (addendum 02 §6c) hands Ctrl+Z to it rather than undoing the project. Set
 * while a document workspace is mounted; null otherwise.
 */
export interface DocumentCommands {
  undo(): void;
  redo(): void;
  find(): void;
  replace(): void;
  findNext(): void;
  pageSetup(): void;
  print(): void;
  exportPdf(): void;
  exportDocx(): void;
  /** Hand any typing still settling to the project, before a save. */
  flush(): void;
}

export const documentCommands: { current: DocumentCommands | null } = { current: null };
