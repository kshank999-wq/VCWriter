import type { ProjectFile } from './project-file.js';
import type { WpDocumentId } from './ids.js';
import { nowIso } from './entities/common.js';
import {
  PAPER_SIZES,
  documentPageSetupSchema,
  type DocNode,
  type DocumentPageSetup,
  type WpDocument,
} from './entities/document.js';

/**
 * Reading and changing a word-processor document (addendum 42).
 *
 * Pure, like every mutation here: the renderer hands over the editor's tree
 * and gets a new file back, so saving, undo, autosave and sync treat a
 * document exactly as they treat a beat.
 */

/** The project's document: a Document project holds exactly one. */
export const mainDocument = (file: ProjectFile): WpDocument | null => file.documents[0] ?? null;

const withDocument = (
  file: ProjectFile,
  id: WpDocumentId,
  change: (document: WpDocument) => WpDocument,
): ProjectFile => {
  let found = false;
  const documents = file.documents.map((document) => {
    if (document.id !== id) return document;
    found = true;
    return change(document);
  });
  return found ? { ...file, documents } : file;
};

/**
 * The body, as the editor now has it. The revision counts every change, which
 * is what an extract taken earlier compares itself against (spec §5.2).
 */
export const setDocumentContent = (file: ProjectFile, id: WpDocumentId, content: DocNode): ProjectFile =>
  withDocument(file, id, (document) => ({
    ...document,
    content,
    revision: document.revision + 1,
    updatedAt: nowIso(),
  }));

export const renameDocument = (file: ProjectFile, id: WpDocumentId, title: string): ProjectFile =>
  withDocument(file, id, (document) => ({ ...document, title: title.slice(0, 300), updatedAt: nowIso() }));

export const setDocumentPageSetup = (
  file: ProjectFile,
  id: WpDocumentId,
  patch: Partial<Omit<DocumentPageSetup, 'margins'>> & { margins?: Partial<DocumentPageSetup['margins']> },
): ProjectFile =>
  withDocument(file, id, (document) => ({
    ...document,
    pageSetup: documentPageSetupSchema.parse({
      ...document.pageSetup,
      ...patch,
      margins: { ...document.pageSetup.margins, ...patch.margins },
    }),
    updatedAt: nowIso(),
  }));

/** The sheet as it is turned: width and height in inches. */
export const pageSize = (setup: DocumentPageSetup): { width: number; height: number } => {
  const paper = PAPER_SIZES[setup.paper];
  return setup.orientation === 'landscape'
    ? { width: paper.height, height: paper.width }
    : { width: paper.width, height: paper.height };
};

// ------------------------------------------------------------ reading text

/** Nodes whose children are laid out one under another, not run together. */
const BLOCK_CONTAINERS = new Set([
  'doc',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
]);

const inlineText = (node: DocNode): string => {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(inlineText).join('');
};

/**
 * The document's words, one block to a line, for counting and searching
 * (spec §8: *index plain text for search*). Pictures, rules and page breaks
 * contribute nothing.
 */
export const docPlainText = (node: DocNode): string => {
  if (BLOCK_CONTAINERS.has(node.type)) {
    return (node.content ?? [])
      .map(docPlainText)
      .filter((text) => text.length > 0)
      .join('\n');
  }
  return inlineText(node);
};

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

/** Words as Word counts them: runs of letters and digits, with their apostrophes and hyphens. */
export const countTextWords = (text: string): number => text.match(WORD)?.length ?? 0;

export const docWordCount = (node: DocNode): number => countTextWords(docPlainText(node));

/** One entry per heading, in order: what the navigation pane lists. */
export interface DocHeading {
  level: number;
  text: string;
  /** Which top-level block it is, for finding it again. */
  index: number;
}

export const docHeadings = (node: DocNode): DocHeading[] =>
  (node.content ?? []).flatMap((block, index) =>
    block.type === 'heading'
      ? [{ level: Number(block.attrs?.['level'] ?? 1), text: inlineText(block).trim(), index }]
      : [],
  );
