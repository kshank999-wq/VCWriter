import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { importBatchSchema, importEntrySchema } from './entities/import-batch.js';
import type { ImportBatch, ImportEntry, ImportOutcome } from './entities/import-batch.js';
import { addGraphic } from './instructional.js';
import { addResearchItem } from './mutations.js';
import type { ProjectFile } from './project-file.js';
import type { ImportBatchId, ResearchCategoryId } from './ids.js';

/**
 * The research importer (addendum 16 §4).
 *
 * For an author who already has the material — lecture notes, papers, a
 * folder of diagrams — scattered across files, and wants it in the book's
 * research rather than retyped.
 *
 * **One rule outranks everything else here**, and §4 states it outright:
 * *never silently discard unsupported content; flag it and preserve the source
 * file reference for review.* So every file offered comes back with an entry
 * saying what became of it, and a file nothing could be made of is **named**.
 * An import that quietly skipped nine of two hundred notes is
 * indistinguishable from one that took them all, until the author goes looking
 * a year later for a note that was never there.
 *
 * **What splits is what the file says splits.** A markdown file's headings are
 * the author having already decided where the divisions are, so they become
 * separate items. A plain text file is one item however many blank lines it
 * has, because a blank line is not a decision — and shattering somebody's
 * lecture notes into forty fragments is much harder to undo than not having
 * split them.
 *
 * This is deliberately **not** `importing.ts`, which reads screenplays into a
 * script. Nothing here makes structure; it makes research.
 */

// ------------------------------------------------------------- what comes in

/**
 * A file, as far as the domain is concerned.
 *
 * The **host** turns bytes into one of these: it unzips a `.docx`, decodes an
 * image, reads a text file. The domain then decides what it becomes. That
 * split is what makes §4's *extensible architecture* real — a new format is a
 * new extractor on the host and, where it needs different handling, one entry
 * in `READERS` below. Neither change touches the research model.
 */
export interface ImportedFile {
  name: string;
  /** The words, where the host could get any. */
  text?: string | undefined;
  /** `data:image/png;base64,…`, where the file is a picture. */
  dataUrl?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

/** A note on its way in, before it is a record. */
export interface DraftItem {
  title: string;
  body: string;
}

/**
 * How one kind of file becomes research.
 *
 * Adding a format is adding one of these. `handles` is asked in order, so a
 * more specific reader may sit above a general one.
 */
export interface Reader {
  name: string;
  handles: (file: ImportedFile) => boolean;
  /** Notes to file, or an empty list where the file had nothing in it. */
  read: (file: ImportedFile) => DraftItem[];
}

const extensionOf = (name: string): string => {
  const at = name.lastIndexOf('.');
  return at < 0 ? '' : name.slice(at + 1).toLowerCase();
};

/** The name without its extension, which is what a note is called by default. */
export const bareName = (name: string): string => {
  const cut = name.replace(/\\/g, '/').split('/').pop() ?? name;
  const at = cut.lastIndexOf('.');
  return (at <= 0 ? cut : cut.slice(0, at)).trim() || cut;
};

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tif', 'tiff']);

export const isImageFile = (file: ImportedFile): boolean =>
  Boolean(file.dataUrl) || IMAGE_EXTENSIONS.has(extensionOf(file.name));

/**
 * Split a markdown file on its headings.
 *
 * The heading is the title and what follows is the body. Anything before the
 * first heading is kept as its own item rather than thrown away — a file that
 * opens with two paragraphs and then starts using headings is common, and
 * those two paragraphs are usually the point of it.
 */
export const splitMarkdown = (name: string, text: string): DraftItem[] => {
  const lines = text.split(/\r?\n/);
  const items: DraftItem[] = [];
  let title = bareName(name);
  let body: string[] = [];

  const flush = () => {
    const joined = body.join('\n').trim();
    if (joined.length > 0 || items.length === 0) {
      if (joined.length > 0) items.push({ title, body: joined });
    }
    body = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      title = (heading[2] ?? '').trim() || bareName(name);
      continue;
    }
    body.push(line);
  }
  flush();

  return items;
};

/**
 * The readers, in the order they are asked.
 *
 * Exported so a future format is one entry in one list, which is §4's
 * extensibility requirement made concrete.
 */
export const READERS: Reader[] = [
  {
    name: 'markdown',
    handles: (file) => ['md', 'markdown', 'mdown'].includes(extensionOf(file.name)),
    read: (file) => splitMarkdown(file.name, file.text ?? ''),
  },
  {
    name: 'text',
    // Everything the host managed to get words out of, whatever it was: a
    // `.docx` the host unzipped arrives here as text, and so does a `.txt`.
    handles: (file) => typeof file.text === 'string',
    read: (file) => {
      const body = (file.text ?? '').trim();
      // One item. A blank line is not the author saying "these are separate".
      return body.length === 0 ? [] : [{ title: bareName(file.name), body }];
    },
  },
];

// -------------------------------------------------------------- the import

export interface ImportPlan {
  /** Where notes go. The instructional General Notes shelf, ordinarily. */
  notesCategoryId: ResearchCategoryId;
  /**
   * Where notes go instead when the author has not said — the Imported inbox
   * (§4's staging area). Optional: without it, notes land straight in notes.
   */
  inboxCategoryId?: ResearchCategoryId | undefined;
  /** File them in the inbox rather than in notes, to be classified later. */
  toInbox?: boolean | undefined;
}

export interface NoteImportResult {
  file: ProjectFile;
  batch: ImportBatch;
}

/**
 * Bring a set of files in.
 *
 * Every file gets an entry. Nothing is dropped, nothing is merged, and the
 * order of the entries is the order the files were offered, so the list reads
 * like the folder it came from.
 *
 * Each note keeps its **original filename as its source**, which is the field
 * stage 2 added for exactly this: a title is the author's to change, and the
 * moment they change it the trail back to `lecture-notes-final-v3.txt` is gone
 * unless it was written down.
 */
export const importFiles = (
  file: ProjectFile,
  files: readonly ImportedFile[],
  plan: ImportPlan,
): NoteImportResult => {
  let current = file;
  const entries: ImportEntry[] = [];

  const categoryId =
    plan.toInbox && plan.inboxCategoryId ? plan.inboxCategoryId : plan.notesCategoryId;

  for (const one of files) {
    const entry = (outcome: ImportOutcome, detail: string, ids: { items?: string[]; assets?: string[] } = {}) =>
      importEntrySchema.parse({
        name: one.name,
        outcome,
        detail,
        itemIds: ids.items ?? [],
        assetIds: ids.assets ?? [],
      });

    // A picture. Goes to the graphics library rather than becoming a note,
    // where §9's caption and alt text are waiting for it.
    if (isImageFile(one)) {
      if (!one.dataUrl) {
        // Named as an image and the host could not decode it. Said, not dropped.
        entries.push(entry('failed', 'This looks like a picture, but it could not be read.'));
        continue;
      }
      const made = addGraphic(current, {
        name: one.name,
        data: one.dataUrl,
        ...(one.width === undefined ? {} : { width: one.width }),
        ...(one.height === undefined ? {} : { height: one.height }),
      });
      current = made.file;
      entries.push(entry('read', '', { assets: [made.asset.id as string] }));
      continue;
    }

    const reader = READERS.find((candidate) => candidate.handles(one));
    if (!reader) {
      // §4's rule, and the reason this function returns a batch at all.
      entries.push(
        entry('skipped', `Nothing here reads ${extensionOf(one.name) || 'this kind of file'} yet.`),
      );
      continue;
    }

    const drafts = reader.read(one);
    if (drafts.length === 0) {
      // Read fine and had nothing in it. Not a failure, and worth saying so —
      // an author who expected notes from it should find out here.
      entries.push(entry('empty', 'The file was read and had nothing in it.'));
      continue;
    }

    const madeIds: string[] = [];
    for (const draft of drafts) {
      current = addResearchItem(current, {
        categoryId,
        title: draft.title,
        body: draft.body,
        source: one.name,
        origin: 'import',
      });
      const added = current.researchItems[current.researchItems.length - 1];
      if (added) madeIds.push(added.id as string);
    }
    entries.push(entry('read', '', { items: madeIds }));
  }

  const at = nowIso();
  const batch = importBatchSchema.parse({
    id: newId<ImportBatchId>(),
    projectId: current.project.id,
    entries,
    createdAt: at,
    updatedAt: at,
  });

  return {
    file: { ...current, importBatches: [...(current.importBatches ?? []), batch] },
    batch,
  };
};

// -------------------------------------------------------------- the reading

/** The files that need somebody to look at them. A reading of the entries. */
export const warningsIn = (batch: ImportBatch): ImportEntry[] =>
  batch.entries.filter((one) => one.outcome !== 'read');

export const itemsMadeBy = (batch: ImportBatch): number =>
  batch.entries.reduce((count, one) => count + one.itemIds.length, 0);

export const graphicsMadeBy = (batch: ImportBatch): number =>
  batch.entries.reduce((count, one) => count + one.assetIds.length, 0);

/**
 * What an import did, in one line.
 *
 * **Leads with what came in and says what did not in the same breath.** A
 * message that said only "47 notes imported" would be technically true and
 * would hide the three files nobody read, which is the failure §4 is written
 * to prevent.
 */
export const describeBatch = (batch: ImportBatch): string => {
  const items = itemsMadeBy(batch);
  const graphics = graphicsMadeBy(batch);
  const missed = warningsIn(batch).length;

  const made: string[] = [];
  if (items > 0) made.push(`${items} ${items === 1 ? 'note' : 'notes'}`);
  if (graphics > 0) made.push(`${graphics} ${graphics === 1 ? 'graphic' : 'graphics'}`);

  const head = made.length === 0 ? 'Nothing was brought in' : `Brought in ${made.join(' and ')}`;
  if (missed === 0) return `${head}.`;
  return `${head} · ${missed} ${missed === 1 ? 'file needs' : 'files need'} a look`;
};

/** The imports this project has had, newest first. */
export const batchesInOrder = (file: ProjectFile): ImportBatch[] =>
  [...(file.importBatches ?? [])].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export { importBatchSchema, IMPORT_OUTCOMES } from './entities/import-batch.js';
export type { ImportBatch, ImportEntry, ImportOutcome } from './entities/import-batch.js';
