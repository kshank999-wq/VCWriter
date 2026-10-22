import { nowIso } from './entities/common.js';
import { docPlainText, setDocumentContent } from './document.js';
import { textToDocContent } from './document-import.js';
import { headingSection } from './document-outline.js';
import { isWordProcessor } from './formats.js';
import { addBeat, addUnit, updateBeat, updateUnit } from './mutations.js';
import { findOutline, outlineChildren } from './outline.js';
import { destinationOptions, transferInternals, type DestinationChoice, type DestinationOption, type Resolved, type TransferPlan, type TransferResult } from './transfers.js';
import type { DocNode, WpDocument } from './entities/document.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ExtractReceipt } from './entities/receipt.js';
import type { ProjectFile } from './project-file.js';
import type { OutlineId, StructuralUnitId, WpDocumentId } from './ids.js';

/**
 * **Sending outline rows** (addendum 42 §13, WP spec §6: *send outline nodes
 * into the appropriate authoring destination*).
 *
 * A row goes with everything under it, and as what it is:
 *
 * - **A heading** into a story becomes a **scene** (a chapter in prose): the
 *   row's notes are the scene's summary, the words under the heading in the
 *   document are its first beat, and each subheading is a beat after it with
 *   its own words. A note or idea hanging under the heading goes into the
 *   scene's notes. Into another document, the heading and its whole section
 *   go on **at the end** of that document, as written. Anywhere else it is a
 *   research note carrying the section's words.
 * - **A note or an idea** goes onto Notes or Ideas.
 *
 * Any row can be pointed somewhere else in the dialog: a shelf (new item,
 * added to one, or replacing one's words), a beat in a chosen scene, a new
 * scene, or the end of the document. The same engine as extracts does the
 * writing, so the same rules hold: a preview that is the send done on a copy,
 * a receipt per row, and no second copy unless asked.
 */

const { liveShelf, takesScenes, lastUnit, researchTo, sceneTo, beatTo, segmentOf, writeResearch } = transferInternals;

const KIND_NAMES: Record<string, string> = { heading: 'Heading', note: 'Note', idea: 'Idea' };

/** The target's own document, where it is a Document project: the end of it is a place to send a section. */
const targetDocument = (target: ProjectFile): WpDocument | null =>
  isWordProcessor(target.project.format) ? target.documents[0] ?? null : null;

/** Where rows can go: the end of the target's document first, where it has one, then what extracts can go to. */
export const rowDestinationOptions = (target: ProjectFile): DestinationOption[] => {
  const document = targetDocument(target);
  return [
    ...(document ? [{ key: 'document', label: `The end of “${document.title || target.project.title || 'the document'}”` }] : []),
    ...destinationOptions(target),
  ];
};

interface Rows {
  document: WpDocument;
  outline: Outline;
}

const rowsOf = (source: ProjectFile, documentId: string): Rows | null => {
  const document = source.documents.find((one) => one.id === documentId);
  const outline = document?.outlineId ? findOutline(source, document.outlineId as OutlineId) : null;
  return document && outline ? { document, outline } : null;
};

/** The rows asked for, in reading order, leaving out any already inside another one asked for. */
const topRows = (outline: Outline, ids: readonly string[]): OutlineItem[] => {
  const wanted = new Set(ids);
  const out: OutlineItem[] = [];
  const walk = (parentId: OutlineItem['parentId']): void => {
    for (const item of outlineChildren(outline, parentId)) {
      if (wanted.has(item.id)) out.push(item);
      else walk(item.id);
    }
  };
  walk(null);
  return out;
};

const descendantCount = (outline: Outline, item: OutlineItem): number =>
  outlineChildren(outline, item.id).reduce((sum, child) => sum + 1 + descendantCount(outline, child), 0);

const headingOf = (rows: Rows, item: OutlineItem): string | null =>
  rows.document.outlineLinks.find((link) => link.itemId === item.id)?.headingId ?? null;

const plain = (blocks: DocNode[]): string => docPlainText({ type: 'doc', content: blocks });

/** The words under a row's heading in the document, up to the next heading. */
const ownWords = (rows: Rows, item: OutlineItem): string => {
  const headingId = headingOf(rows, item);
  return headingId ? plain(headingSection(rows.document.content, headingId).own) : '';
};

/** A row and everything under it as text: its notes, its words, and each row below with its title. */
const subtreeText = (rows: Rows, item: OutlineItem): string =>
  [
    item.body.trim(),
    ownWords(rows, item),
    ...outlineChildren(rows.outline, item.id).map((child) =>
      [child.title.trim(), subtreeText(rows, child)].filter((part) => part.length > 0).join('\n'),
    ),
  ]
    .filter((part) => part.length > 0)
    .join('\n\n');

const documentTo = (target: ProjectFile): Resolved | null => {
  const document = targetDocument(target);
  return document
    ? {
        area: 'document',
        areaName: `The end of “${document.title || target.project.title || 'the document'}”`,
        key: 'document',
        shelf: null,
        unitId: null,
        into: null,
        fallback: false,
      }
    : null;
};

/** Where one row goes in the target. */
const rowDestination = (item: OutlineItem, target: ProjectFile, choice?: DestinationChoice | null): Resolved => {
  if (choice) {
    if (choice.area === 'document') {
      const document = documentTo(target);
      if (document) return document;
    }
    if (choice.area === 'scene' && takesScenes(target)) return sceneTo(target);
    if (choice.area === 'beat' && takesScenes(target)) return beatTo(target, choice.unitId);
    if (choice.area === 'research' && 'shelfId' in choice && target.researchCategories.some((one) => one.id === choice.shelfId)) {
      return researchTo(target, { id: choice.shelfId }, false, choice.into ?? null);
    }
    if (choice.area === 'research' && 'shelfName' in choice && choice.shelfName.trim()) {
      return researchTo(target, { name: choice.shelfName });
    }
  }
  if (item.kind === 'heading') {
    if (takesScenes(target)) return sceneTo(target);
    const document = documentTo(target);
    if (document) return document;
    return researchTo(target, { systemKey: 'notes' });
  }
  if (item.kind === 'idea' && liveShelf(target, 'ideas')) return researchTo(target, { systemKey: 'ideas' });
  return researchTo(target, { systemKey: 'notes' });
};

/** A copy of a section for another document: its own heading ids go (the target gives new ones), and so do extract marks. */
const cleanBlock = (node: DocNode): DocNode => {
  const marks = node.marks?.filter((mark) => mark.type !== 'extract');
  const attrs = node.type === 'heading' && node.attrs ? (({ headingId: _drop, ...rest }) => rest)(node.attrs) : node.attrs;
  return {
    ...node,
    ...(attrs ? { attrs } : {}),
    ...(node.marks ? (marks && marks.length > 0 ? { marks } : { marks: undefined }) : {}),
    ...(node.content ? { content: node.content.map(cleanBlock) } : {}),
  };
};

/** The blocks a row puts at the end of a document: a heading's whole section, or a note's title and words. */
const rowBlocks = (rows: Rows, item: OutlineItem): DocNode[] => {
  const headingId = headingOf(rows, item);
  if (headingId) {
    const { whole } = headingSection(rows.document.content, headingId);
    if (whole.length > 0) return whole.map(cleanBlock).map((block) => JSON.parse(JSON.stringify(block)) as DocNode);
  }
  const title: DocNode = item.kind === 'heading'
    ? { type: 'heading', attrs: { level: 1 }, ...(item.title ? { content: [{ type: 'text', text: item.title }] } : {}) }
    : { type: 'paragraph', ...(item.title ? { content: [{ type: 'text', text: item.title, marks: [{ type: 'bold' }] }] } : {}) };
  const body = subtreeText(rows, item);
  return [title, ...(body ? textToDocContent(body).content ?? [] : [])];
};

const isBlank = (content: DocNode): boolean =>
  (content.content ?? []).every((block) => block.type === 'paragraph' && !(block.content ?? []).length);

const rowReceiptFor = (document: WpDocument, itemId: string, projectId: string): ExtractReceipt | null =>
  document.rowReceipts.find((receipt) => receipt.itemId === itemId && receipt.projectId === projectId) ?? null;

/** Write the rows into the target. Rows already sent there are skipped unless `again`. */
export const applyRowTransfer = (
  source: ProjectFile,
  documentId: WpDocumentId,
  itemIds: readonly string[],
  target: ProjectFile,
  options: { path?: string | null; again?: boolean; choices?: Readonly<Record<string, DestinationChoice>> } = {},
): TransferResult => {
  const receipts = new Map<string, ExtractReceipt>();
  const keys = new Map<string, string>();
  const rows = rowsOf(source, documentId);
  if (!rows) return { target, receipts, keys };
  const documentTitle = rows.document.title || source.project.title;
  const credit =
    source.project.id === target.project.id
      ? `From the outline of “${documentTitle}”`
      : `From the outline of “${documentTitle}” in ${source.project.title}`;

  let next = target;
  for (const item of topRows(rows.outline, itemIds)) {
    if (!options.again && rowReceiptFor(rows.document, item.id, target.project.id)) continue;
    const where = rowDestination(item, next, options.choices?.[item.id]);
    let resultId: string;
    let areaName = where.areaName;

    if (where.area === 'research') {
      const written = writeResearch(next, where, { title: item.title || 'Untitled', body: subtreeText(rows, item), tags: [], credit });
      next = written.file;
      resultId = written.resultId;
      areaName = written.areaName;
    } else if (where.area === 'document') {
      const document = targetDocument(next)!;
      const blocks = rowBlocks(rows, item);
      const before = isBlank(document.content) ? [] : document.content.content ?? [];
      next = setDocumentContent(next, document.id, { ...document.content, content: [...before, ...blocks] });
      resultId = document.id;
    } else if (where.area === 'scene') {
      const made = addUnit(next, { trackId: next.tracks[0]!.id, title: item.title });
      next = made.file;
      const unitId = made.unit.id;
      const notes: string[] = [];
      if (item.body.trim()) next = updateUnit(next, unitId, { summary: item.body.trim() });
      const own = ownWords(rows, item);
      if (own) {
        const opening = addBeat(next, { unitId });
        next = updateBeat(opening.file, opening.beat.id, { manuscript: segmentOf(next, own) });
      }
      for (const child of outlineChildren(rows.outline, item.id)) {
        if (child.kind !== 'heading') {
          notes.push([child.title.trim(), subtreeText(rows, child)].filter((part) => part.length > 0).join(': '));
          continue;
        }
        const beat = addBeat(next, { unitId, title: child.title, summary: child.body.trim() });
        const words = [ownWords(rows, child), ...outlineChildren(rows.outline, child.id).map((deeper) => [deeper.title.trim(), subtreeText(rows, deeper)].filter((part) => part.length > 0).join('\n'))]
          .filter((part) => part.length > 0)
          .join('\n\n');
        next = words ? updateBeat(beat.file, beat.beat.id, { manuscript: segmentOf(next, words) }) : beat.file;
      }
      if (notes.length > 0) next = updateUnit(next, unitId, { notes: notes.join('\n\n') });
      resultId = unitId;
    } else {
      let unit = next.units.find((one) => one.id === where.unitId) ?? lastUnit(next);
      if (!unit) {
        const made = addUnit(next, { trackId: next.tracks[0]!.id, title: item.title });
        next = made.file;
        unit = made.unit;
      }
      const words = [ownWords(rows, item), ...outlineChildren(rows.outline, item.id).map((child) => [child.title.trim(), subtreeText(rows, child)].filter((part) => part.length > 0).join('\n'))]
        .filter((part) => part.length > 0)
        .join('\n\n');
      const beat = addBeat(next, { unitId: unit.id as StructuralUnitId, title: item.title, summary: item.body.trim() });
      next = words ? updateBeat(beat.file, beat.beat.id, { manuscript: segmentOf(next, words) }) : beat.file;
      resultId = beat.beat.id;
    }

    keys.set(item.id, where.area === 'beat' ? `beat:${where.unitId ?? ''}` : where.key);
    receipts.set(item.id, {
      projectId: target.project.id,
      projectTitle: target.project.title,
      path: options.path ?? null,
      area: where.area,
      areaName,
      resultId,
      at: nowIso(),
    });
  }
  return { target: next, receipts, keys };
};

/** The preview: the send done on a copy, one step per row sent (rows inside another go with it). */
export const planRowTransfer = (
  source: ProjectFile,
  documentId: WpDocumentId,
  itemIds: readonly string[],
  target: ProjectFile,
  choices: Readonly<Record<string, DestinationChoice>> = {},
): TransferPlan => {
  const rows = rowsOf(source, documentId);
  const trial = applyRowTransfer(source, documentId, itemIds, target, { again: true, choices });
  return {
    projectId: target.project.id,
    projectTitle: target.project.title,
    steps: rows
      ? topRows(rows.outline, itemIds).flatMap((item) => {
          const receipt = trial.receipts.get(item.id);
          if (!receipt) return [];
          const under = descendantCount(rows.outline, item);
          return [
            {
              extractId: item.id,
              title: item.title,
              categoryName: `${KIND_NAMES[item.kind] ?? 'Row'}${under ? ` (+${under} under it)` : ''}`,
              area: receipt.area,
              areaName: receipt.areaName,
              fallback: false,
              already: rowReceiptFor(rows.document, item.id, target.project.id),
              key: trial.keys.get(item.id) ?? '',
            },
          ];
        })
      : [],
  };
};

/** The receipts, kept on the document once the target is safely written. The rows themselves stay as they are. */
export const recordRowTransfer = (
  source: ProjectFile,
  documentId: WpDocumentId,
  receipts: ReadonlyMap<string, ExtractReceipt>,
): ProjectFile => {
  if (receipts.size === 0) return source;
  return {
    ...source,
    documents: source.documents.map((document) =>
      document.id === documentId
        ? {
            ...document,
            rowReceipts: [...document.rowReceipts, ...[...receipts].map(([itemId, receipt]) => ({ ...receipt, itemId }))],
            updatedAt: nowIso(),
          }
        : document,
    ),
  };
};

/** Every send a row has had, for the Outliner to show. */
export const rowReceipts = (document: WpDocument, itemId: string): ExtractReceipt[] =>
  document.rowReceipts.filter((receipt) => receipt.itemId === itemId);
