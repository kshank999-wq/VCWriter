/**
 * The projects this machine has, and taking one away (spec §4).
 *
 * A writer accumulates projects — a real one, three false starts, a script
 * somebody sent them, two imports of the same PDF — and until now the only way
 * to be rid of one was to find the file. So there is a list, and it is in the
 * File menu where the rest of a project's life already is.
 *
 * **Deleting is the one thing in the application that cannot be undone**, so
 * it is the one thing that asks. The question names the project rather than
 * asking whether you are sure — nobody can answer *are you sure?* about a
 * thing they cannot see the name of — and the answer has to be given on
 * purpose: the button that deletes is never the one under the pointer.
 */

export interface ProjectEntry {
  /** Where it is: a file path on the desktop, a key in the browser. */
  path: string;
  /** The project's own title. Empty where the file could not be read. */
  title: string;
  /** When it was last written, where that is known. */
  savedAt: string | null;
  sizeBytes: number | null;
  /** The list remembers it; the file is not there any more. */
  missing: boolean;
}

/** The last part of a path, which is what a file is called. */
export const fileNameOf = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/**
 * What to call a project in the list.
 *
 * Its own title, and the file's name where it has none — never the whole path,
 * which is how a list of projects becomes a list of directories.
 */
export const projectName = (entry: ProjectEntry): string =>
  entry.title.trim().length > 0 ? entry.title.trim() : fileNameOf(entry.path);

/** Newest first, which is the order a writer looks for a project in. */
export const projectsNewestFirst = (entries: readonly ProjectEntry[]): ProjectEntry[] =>
  [...entries].sort((a, b) => {
    if (a.savedAt === b.savedAt) return projectName(a).localeCompare(projectName(b));
    if (a.savedAt === null) return 1;
    if (b.savedAt === null) return -1;
    return a.savedAt < b.savedAt ? 1 : -1;
  });

/**
 * Why this one cannot be deleted from here.
 *
 * **The project you have open is not deletable**, and refusing is better than
 * handling it: deleting the file under an open document leaves a window whose
 * every save fails, and "close it first" is one click the writer understands.
 */
export type DeleteRefusal = { reason: 'open' };

export const deleteRefusal = (input: { entry: ProjectEntry; openPath: string | null }): DeleteRefusal | null =>
  input.openPath !== null && input.openPath === input.entry.path ? { reason: 'open' } : null;

export const deleteRefusalText = (_refusal: DeleteRefusal): string =>
  'This is the project you have open. Close it first.';

/** The question, which names the project rather than asking about nothing. */
export const deletionQuestion = (entry: ProjectEntry): string => `Delete “${projectName(entry)}”?`;

/**
 * What is true about deleting this one, in the words of the machine it is on.
 *
 * `binName` is the platform's own — Trash, Recycle Bin — because a writer who
 * is told their work went to the Trash knows exactly where to look, and one
 * who is told it was "removed" does not. Where nothing can be recovered, this
 * says so instead of reassuring anybody.
 */
export const deletionNote = (input: { entry: ProjectEntry; recoverable: boolean; binName: string }): string => {
  if (input.entry.missing) return 'The file is already gone. This only takes it off the list.';
  return input.recoverable
    ? `It goes to the ${input.binName}, so it can be put back.`
    : 'It cannot be recovered from here afterwards.';
};

/** How big a project is, for the row. Rounded, because nobody counts bytes. */
export const projectSize = (entry: ProjectEntry): string => {
  if (entry.missing) return 'missing';
  if (entry.sizeBytes === null) return '';
  if (entry.sizeBytes < 1024) return `${entry.sizeBytes} bytes`;
  const kb = entry.sizeBytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

/** What the list says when there is nothing in it. */
export const NO_PROJECTS = 'No projects on this machine yet. The ones you make and open appear here.';
