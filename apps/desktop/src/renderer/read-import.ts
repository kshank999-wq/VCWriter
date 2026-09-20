import { docxToProse, docxToScript, readDocx, readFinalDraft, readLaidOutLines, summarise, type ImportedScript } from '@vcwriter/domain';

/**
 * Reading a file for an import (addendum 21, addendum 22 §4): the host turns
 * bytes into what the domain reads. One place for it, because two dialogs
 * read the same kinds of file — the import that starts a project and the
 * one that adds to it — and the answer to *what is a .docx as a script* must
 * not be given twice.
 */

export const bareName = (name: string): string => name.replace(/\.[^.]+$/, '');

/** A plain-text file as one story: its paragraphs, divided by blank lines. */
export const plainStory = (name: string, text: string): ImportedScript =>
  summarise({
    title: bareName(name),
    author: '',
    scenes: [
      {
        heading: '',
        elements: text
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
          .filter((paragraph) => paragraph.length > 0)
          .map((paragraph) => ({ type: 'paragraph' as const, text: paragraph })),
      },
    ],
    warnings: [],
    source: 'text',
  });

/** A file read as prose: a Word document by its headings, or plain text. */
export const readProseFile = async (chosen: File): Promise<ImportedScript> => {
  if (/\.docx$/i.test(chosen.name)) {
    const { readDocxParts } = await import('./read-docx');
    const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
    return docxToProse(doc, { title: bareName(chosen.name) });
  }
  if (/\.(txt|md|markdown|text)$/i.test(chosen.name)) return plainStory(chosen.name, await chosen.text());
  throw new Error(`${chosen.name} is not a Word document or a text file.`);
};

/** A file read as a script: Final Draft as it says, a Word document or a PDF by its geometry. */
export const readScriptFile = async (chosen: File): Promise<ImportedScript> => {
  if (/\.fdx$/i.test(chosen.name)) return readFinalDraft(await chosen.text());
  if (/\.docx$/i.test(chosen.name)) {
    const { readDocxParts } = await import('./read-docx');
    const doc = readDocx(await readDocxParts(await chosen.arrayBuffer()));
    return docxToScript(doc, { title: bareName(chosen.name) });
  }
  if (/\.pdf$/i.test(chosen.name)) {
    const { readPdfLines } = await import('./read-pdf');
    const { lines, title } = await readPdfLines(await chosen.arrayBuffer());
    return readLaidOutLines(lines, { title: title || bareName(chosen.name) });
  }
  throw new Error(`${chosen.name} is not a Final Draft document, a Word document or a PDF.`);
};

/** How much a read document holds: its divisions (scenes or sections) and words. */
export const countOf = (script: ImportedScript): { divisions: number; words: number } => {
  const scenes = script.scenes.filter((scene) => scene.heading.trim().length > 0 || scene.elements.length > 0);
  const words = scenes.reduce(
    (total, scene) => total + scene.elements.reduce((sum, element) => sum + element.text.trim().split(/\s+/).filter(Boolean).length, 0),
    0,
  );
  return { divisions: scenes.length, words };
};

/**
 * The list with one entry moved a step up or down; the ends stay where they
 * are. The order of the files chosen is the order they go into the book, so
 * this is how a season picked out of order is put right.
 */
export const shifted = <T,>(list: readonly T[], index: number, by: -1 | 1): T[] => {
  const to = index + by;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(to, 0, moved as T);
  return next;
};
