import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys } from './ordering.js';
import { addItem, createOutline, findOutline, madeItem, outlineChildren } from './outline.js';
import type { DocNode, DocumentOutlineLink, WpDocument } from './entities/document.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';
import type { ExtractId, OutlineId, OutlineItemId, WpDocumentId } from './ids.js';

/**
 * **The Outliner tab** of a document (addendum 42 §9, the WP spec's §6).
 *
 * The document's headings and the shared Outliner's tree are kept in step in
 * both directions, through a stable id on each heading (`headingId`) and the
 * document's `outlineLinks`, which say which row stands for which heading:
 *
 * - **Document → outline** (`outlineFromDocument`): every heading has a row,
 *   nested as the heading levels nest, titled with the heading's words and in
 *   the document's order. A row the writer added (a note, an idea) keeps its
 *   place beside the heading it followed.
 * - **Outline → document** (`documentFromOutline`): the document's sections —
 *   a heading and everything under it up to the next — are put in the
 *   outline's order, at the levels its nesting gives, with the rows' titles.
 *
 * **Not a word is lost either way** (WP spec OL-01). A heading whose row is
 * removed stays in the document as an ordinary paragraph, with its text where
 * it was; a row whose heading is deleted stays in the outline as a note if
 * anything was written on it.
 */

// ------------------------------------------------------------- headings

export interface HeadingRef {
  headingId: string;
  level: number;
  text: string;
}

const inlineText = (node: DocNode): string =>
  node.type === 'text' ? (node.text ?? '') : (node.content ?? []).map(inlineText).join('');

const headingIdOf = (block: DocNode): string | null => {
  if (block.type !== 'heading') return null;
  const value = block.attrs?.['headingId'];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const levelOf = (block: DocNode): number => Math.min(6, Math.max(1, Number(block.attrs?.['level'] ?? 1)));

/**
 * The document's headings with their ids, in order. A heading the editor has
 * not yet given an id, or a second copy of one id, is not one here: the
 * editor assigns ids on its next change, and until then it is body text.
 */
export const headingsOf = (content: DocNode): HeadingRef[] => {
  const seen = new Set<string>();
  const headings: HeadingRef[] = [];
  for (const block of content.content ?? []) {
    const headingId = headingIdOf(block);
    if (headingId === null || seen.has(headingId)) continue;
    seen.add(headingId);
    headings.push({ headingId, level: levelOf(block), text: inlineText(block).trim() });
  }
  return headings;
};

/** Each heading's parent heading, as the levels nest: the nearest heading above it at a lower level. */
const headingParents = (headings: readonly HeadingRef[]): Map<string, string | null> => {
  const parents = new Map<string, string | null>();
  const stack: HeadingRef[] = [];
  for (const heading of headings) {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= heading.level) stack.pop();
    parents.set(heading.headingId, stack[stack.length - 1]?.headingId ?? null);
    stack.push(heading);
  }
  return parents;
};

// ------------------------------------------------------------- numbering

export type HeadingNumbering = WpDocument['headingNumbering'];

export const HEADING_NUMBERINGS: ReadonlyArray<{ value: HeadingNumbering; name: string }> = [
  { value: 'none', name: 'None' },
  { value: 'decimal', name: '1, 1.1, 1.1.1' },
  { value: 'outline', name: 'I, A, 1, a, i' },
];

const roman = (value: number): string => {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rest = value;
  let out = '';
  for (const [size, mark] of table) {
    for (; rest >= size; rest -= size) out += mark;
  }
  return out;
};

const letters = (value: number): string => {
  let rest = value;
  let out = '';
  for (; rest > 0; rest = Math.floor((rest - 1) / 26)) out = String.fromCharCode(65 + ((rest - 1) % 26)) + out;
  return out;
};

/** The outline scheme's mark for the nth heading at one depth: I, A, 1, a, i, then (1). */
const outlineMark = (depth: number, at: number): string => {
  switch (depth) {
    case 0:
      return `${roman(at)}.`;
    case 1:
      return `${letters(at)}.`;
    case 2:
      return `${at}.`;
    case 3:
      return `${letters(at).toLowerCase()}.`;
    case 4:
      return `${roman(at).toLowerCase()}.`;
    default:
      return `(${at})`;
  }
};

/**
 * Each heading's number under a scheme, by heading id. The depth is the
 * nesting, not the style's level, so a Heading 3 straight under a Heading 1
 * is 1.1 rather than 1.0.1 — the same answer the outline gives.
 */
export const headingNumbers = (content: DocNode, scheme: HeadingNumbering): Map<string, string> => {
  const numbers = new Map<string, string>();
  if (scheme === 'none') return numbers;
  const headings = headingsOf(content);
  const parents = headingParents(headings);
  const counts = new Map<string | null, number>();
  const depth = new Map<string, number>();
  for (const heading of headings) {
    const parent = parents.get(heading.headingId) ?? null;
    const at = (counts.get(parent) ?? 0) + 1;
    counts.set(parent, at);
    const level = parent === null ? 0 : (depth.get(parent) ?? 0) + 1;
    depth.set(heading.headingId, level);
    numbers.set(
      heading.headingId,
      scheme === 'decimal'
        ? `${parent === null ? '' : `${(numbers.get(parent) ?? '').replace(/\.$/, '')}.`}${at}`
        : outlineMark(level, at),
    );
  }
  return numbers;
};

/** The same numbers keyed by outline row, for the Outliner tab. */
export const documentOutlineNumbers = (document: WpDocument): Map<string, string> => {
  const byHeading = headingNumbers(document.content, document.headingNumbering);
  const numbers = new Map<string, string>();
  for (const link of document.outlineLinks) {
    const number = link.headingId === null ? undefined : byHeading.get(link.headingId);
    if (number !== undefined) numbers.set(link.itemId, number);
  }
  return numbers;
};

// ---------------------------------------------------------- the document

const findDocument = (file: ProjectFile, id: WpDocumentId): WpDocument | null =>
  file.documents.find((document) => document.id === id) ?? null;

const withDocument = (file: ProjectFile, id: WpDocumentId, change: (document: WpDocument) => WpDocument): ProjectFile => ({
  ...file,
  documents: file.documents.map((document) => (document.id === id ? change(document) : document)),
});

export const setHeadingNumbering = (file: ProjectFile, id: WpDocumentId, scheme: HeadingNumbering): ProjectFile =>
  withDocument(file, id, (document) => ({ ...document, headingNumbering: scheme, updatedAt: nowIso() }));

/** The document's outline, made the first time the tab is opened, and filled from its headings. */
export const ensureDocumentOutline = (
  file: ProjectFile,
  id: WpDocumentId,
): { file: ProjectFile; outlineId: OutlineId | null } => {
  const document = findDocument(file, id);
  if (!document) return { file, outlineId: null };
  if (document.outlineId !== null && findOutline(file, document.outlineId as OutlineId)) {
    return { file, outlineId: document.outlineId as OutlineId };
  }
  const made = createOutline(file, { name: document.title || 'Outline' });
  const linked = withDocument(made.file, id, (current) => ({ ...current, outlineId: made.outline.id, outlineLinks: [] }));
  return { file: outlineFromDocument(linked, id), outlineId: made.outline.id };
};

const replaceOutline = (file: ProjectFile, outline: Outline): ProjectFile => ({
  ...file,
  outlines: (file.outlines ?? []).map((one) => (one.id === outline.id ? outline : one)),
});

const byOrder = (a: OutlineItem, b: OutlineItem): number =>
  a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0;

/**
 * **Document → outline.** Every heading gets its row, and every row its
 * heading's words, place and nesting. Returns the same file when the outline
 * already says what the document says, so it is safe to run on every save.
 */
export const outlineFromDocument = (file: ProjectFile, id: WpDocumentId): ProjectFile => {
  const document = findDocument(file, id);
  const outline = document?.outlineId ? findOutline(file, document.outlineId as OutlineId) : null;
  if (!document || !outline) return file;

  const headings = headingsOf(document.content);
  const parents = headingParents(headings);
  const before = new Map(outline.items.map((item) => [item.id as string, item]));
  const items = new Map(outline.items.map((item) => [item.id as string, { ...item }]));

  // Which row each heading has, keeping the links that still point somewhere.
  const rowOf = new Map<string, string>();
  const links: DocumentOutlineLink[] = [];
  for (const link of document.outlineLinks) {
    if (!items.has(link.itemId)) continue;
    if (link.headingId !== null) {
      if (rowOf.has(link.headingId) || !headings.some((heading) => heading.headingId === link.headingId)) {
        // Its heading has gone: keep the extract half of the link, if any.
        if (link.extractId !== null) links.push({ ...link, headingId: null });
        continue;
      }
      rowOf.set(link.headingId, link.itemId);
    }
    links.push(link);
  }
  const boundRows = new Set(rowOf.values());

  for (const heading of headings) {
    if (rowOf.has(heading.headingId)) continue;
    const item = madeItem({
      outlineId: outline.id,
      parentId: null,
      orderKey: '',
      kind: 'heading',
      title: heading.text,
    });
    items.set(item.id as string, item);
    rowOf.set(heading.headingId, item.id as string);
    boundRows.add(item.id as string);
    links.push({ itemId: item.id as string, headingId: heading.headingId, extractId: null });
  }

  // A row whose heading has gone: a note, if anything was written on it or
  // hangs under it, and otherwise nothing.
  const wasBound = new Set(
    document.outlineLinks.filter((link) => link.headingId !== null).map((link) => link.itemId),
  );
  for (const itemId of wasBound) {
    if (boundRows.has(itemId)) continue;
    const item = items.get(itemId);
    if (!item) continue;
    const hasChildren = [...items.values()].some((other) => other.parentId === item.id);
    if (item.body.trim().length === 0 && !hasChildren && !links.some((link) => link.itemId === itemId)) {
      items.delete(itemId);
    } else if (item.kind === 'heading') {
      item.kind = 'note';
    }
  }

  // Each bound row's title, kind and parent, from its heading.
  for (const heading of headings) {
    const item = items.get(rowOf.get(heading.headingId)!)!;
    const parentHeading = parents.get(heading.headingId) ?? null;
    item.parentId = (parentHeading === null ? null : rowOf.get(parentHeading)!) as OutlineItemId | null;
    item.title = heading.text;
    item.kind = 'heading';
  }

  // Order under each parent: the bound rows in the document's order, each
  // followed by the unbound rows that followed it before.
  const parentsToOrder = new Set<string | null>([...items.values()].map((item) => item.parentId as string | null));
  for (const parentId of parentsToOrder) {
    const members = [...items.values()].filter((item) => item.parentId === parentId);
    const bound = headings
      .map((heading) => rowOf.get(heading.headingId)!)
      .filter((itemId) => items.get(itemId)!.parentId === parentId);
    const followers = new Map<string | null, string[]>();
    let anchor: string | null = null;
    const previous = outline.items
      .filter((item) => item.parentId === parentId && items.has(item.id as string))
      .sort(byOrder);
    for (const item of previous) {
      const itemId = item.id as string;
      if (boundRows.has(itemId)) {
        if (items.get(itemId)!.parentId === parentId) anchor = itemId;
        continue;
      }
      if (items.get(itemId)!.parentId !== parentId) continue;
      followers.set(anchor, [...(followers.get(anchor) ?? []), itemId]);
    }
    const placed = new Set<string>([...bound, ...[...followers.values()].flat()]);
    const order = [
      ...(followers.get(null) ?? []),
      ...bound.flatMap((itemId) => [itemId, ...(followers.get(itemId) ?? [])]),
      // Anything that arrived here unbound from elsewhere goes at the end.
      ...members.filter((item) => !placed.has(item.id as string)).sort(byOrder).map((item) => item.id as string),
    ];
    const current = [...members].sort(byOrder).map((item) => item.id as string);
    const keysOk = members.every((item) => item.orderKey.length > 0);
    if (keysOk && current.join() === order.join()) continue;
    const keys = initialOrderKeys(order.length);
    order.forEach((itemId, index) => {
      items.get(itemId)!.orderKey = keys[index]!;
    });
  }

  const changed =
    items.size !== before.size ||
    [...items.values()].some((item) => {
      const was = before.get(item.id as string);
      return (
        !was ||
        was.parentId !== item.parentId ||
        was.orderKey !== item.orderKey ||
        was.title !== item.title ||
        was.kind !== item.kind
      );
    });
  const linksChanged = JSON.stringify(links) !== JSON.stringify(document.outlineLinks);
  if (!changed && !linksChanged) return file;

  const at = nowIso();
  const nextItems = [...items.values()].map((item) => {
    const was = before.get(item.id as string);
    const same =
      was &&
      was.parentId === item.parentId &&
      was.orderKey === item.orderKey &&
      was.title === item.title &&
      was.kind === item.kind;
    return same ? was : { ...item, updatedAt: at };
  });
  const next = changed ? replaceOutline(file, { ...outline, items: nextItems, updatedAt: at }) : file;
  return withDocument(next, id, (current) => ({ ...current, outlineLinks: links }));
};

// ------------------------------------------------------ outline → document

/** The document cut at its headings: what comes before the first, and each heading with its body. */
interface Section {
  headingId: string;
  heading: DocNode;
  body: DocNode[];
}

const sectionsOf = (content: DocNode): { preamble: DocNode[]; sections: Section[] } => {
  const preamble: DocNode[] = [];
  const sections: Section[] = [];
  const seen = new Set<string>();
  for (const block of content.content ?? []) {
    const headingId = headingIdOf(block);
    if (headingId !== null && !seen.has(headingId)) {
      seen.add(headingId);
      sections.push({ headingId, heading: block, body: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1]!.body.push(block);
    } else {
      preamble.push(block);
    }
  }
  return { preamble, sections };
};

const headingNode = (headingId: string, level: number, title: string): DocNode => ({
  type: 'heading',
  attrs: { level, headingId },
  ...(title.length > 0 ? { content: [{ type: 'text', text: title }] } : {}),
});

/**
 * **Outline → document.** The sections are put in the outline's order, at
 * the levels its nesting gives and under its titles; a heading row added in
 * the Outliner becomes a heading. Returns the same file when the document
 * already says what the outline says.
 *
 * A heading keeps its own level wherever the outline left its parent alone,
 * so a Heading 3 straight under a Heading 1 is not quietly made a 2 by a
 * change somewhere else.
 */
export const documentFromOutline = (file: ProjectFile, id: WpDocumentId): ProjectFile => {
  const document = findDocument(file, id);
  const outline = document?.outlineId ? findOutline(file, document.outlineId as OutlineId) : null;
  if (!document || !outline) return file;

  const { preamble, sections } = sectionsOf(document.content);
  const sectionOf = new Map(sections.map((section) => [section.headingId, section]));
  const docParents = headingParents(headingsOf(document.content));

  const links = document.outlineLinks.filter((link) => outline.items.some((item) => item.id === link.itemId));
  const headingOfRow = new Map<string, string>();
  for (const link of links) {
    if (link.headingId !== null && sectionOf.has(link.headingId)) headingOfRow.set(link.itemId, link.headingId);
  }

  // The plan: the heading rows, in the outline's reading order.
  const plan: Array<{ headingId: string; level: number; title: string; isNew: boolean }> = [];
  const walk = (parentId: OutlineItemId | null, parentHeading: string | null, parentLevel: number): void => {
    for (const item of outlineChildren(outline, parentId)) {
      if (item.kind !== 'heading') {
        walk(item.id, parentHeading, parentLevel);
        continue;
      }
      let headingId = headingOfRow.get(item.id as string);
      const isNew = headingId === undefined;
      if (headingId === undefined) {
        headingId = newId<OutlineItemId>() as string;
        headingOfRow.set(item.id as string, headingId);
        const existing = links.find((link) => link.itemId === item.id);
        if (existing) existing.headingId = headingId;
        else links.push({ itemId: item.id as string, headingId, extractId: null });
      }
      const section = sectionOf.get(headingId);
      const own = section ? levelOf(section.heading) : null;
      const sameParent = section !== undefined && (docParents.get(headingId) ?? null) === parentHeading;
      const level = Math.min(6, own !== null && sameParent && own > parentLevel ? own : parentLevel + 1);
      plan.push({ headingId, level, title: item.title.trim(), isNew });
      walk(item.id, headingId, level);
    }
  };
  walk(null, null, 0);

  // A section with no row left: its heading becomes a paragraph, and it stays
  // after the section it followed.
  const planned = new Set(plan.map((step) => step.headingId));
  const tagAlong = new Map<string | null, DocNode[]>();
  let lastKept: string | null = null;
  for (const section of sections) {
    if (planned.has(section.headingId)) {
      lastKept = section.headingId;
      continue;
    }
    const { level: _level, headingId: _headingId, ...attrs } = section.heading.attrs ?? {};
    const paragraph: DocNode = {
      type: 'paragraph',
      ...(Object.keys(attrs).length > 0 ? { attrs } : {}),
      ...(section.heading.content ? { content: section.heading.content } : {}),
    };
    tagAlong.set(lastKept, [...(tagAlong.get(lastKept) ?? []), paragraph, ...section.body]);
  }

  const blocks: DocNode[] = [...preamble, ...(tagAlong.get(null) ?? [])];
  for (const step of plan) {
    const section = sectionOf.get(step.headingId);
    if (!section) {
      blocks.push(headingNode(step.headingId, step.level, step.title));
      continue;
    }
    const words = inlineText(section.heading).trim();
    const heading: DocNode =
      words === step.title
        ? { ...section.heading, attrs: { ...section.heading.attrs, level: step.level } }
        : { ...headingNode(step.headingId, step.level, step.title), attrs: { ...section.heading.attrs, level: step.level } };
    blocks.push(heading, ...section.body, ...(tagAlong.get(step.headingId) ?? []));
  }
  if (blocks.length === 0) blocks.push({ type: 'paragraph' });

  const content: DocNode = { ...document.content, content: blocks };
  const contentChanged = JSON.stringify(content) !== JSON.stringify(document.content);
  const linksChanged = JSON.stringify(links) !== JSON.stringify(document.outlineLinks);
  if (!contentChanged && !linksChanged) return file;
  return withDocument(file, id, (current) => ({
    ...current,
    ...(contentChanged ? { content, revision: current.revision + 1 } : {}),
    outlineLinks: links,
    updatedAt: nowIso(),
  }));
};

// ------------------------------------------------------------- extracts

/**
 * An extract dragged or sent into the outline: a row titled with it and
 * carrying its words, linked back to it (WP spec §6). Once only — a second
 * time finds the row already there.
 */
export const linkExtractToOutline = (
  file: ProjectFile,
  id: WpDocumentId,
  extractId: ExtractId,
  at: { parentId?: OutlineItemId | null; afterId?: OutlineItemId | null } = {},
): { file: ProjectFile; itemId: OutlineItemId | null; existed: boolean } => {
  const extract = file.extracts.find((one) => one.id === extractId);
  if (!extract) return { file, itemId: null, existed: false };
  const ensured = ensureDocumentOutline(file, id);
  const document = findDocument(ensured.file, id);
  if (!document || ensured.outlineId === null) return { file, itemId: null, existed: false };
  const outline = findOutline(ensured.file, ensured.outlineId)!;
  const already = document.outlineLinks.find(
    (link) => link.extractId === extractId && outline.items.some((item) => item.id === link.itemId),
  );
  if (already) return { file: ensured.file, itemId: already.itemId as OutlineItemId, existed: true };

  const category = ensured.file.extractCategories.find((one) => one.id === extract.categoryId);
  const added = addItem(ensured.file, ensured.outlineId, {
    parentId: at.parentId ?? null,
    afterId: at.afterId ?? null,
    kind: category?.kind === 'idea' ? 'idea' : 'note',
    title: extract.title,
  });
  if (added.itemId === null) return { file: ensured.file, itemId: null, existed: false };
  const itemId = added.itemId;
  const withBody: ProjectFile = {
    ...added.file,
    outlines: (added.file.outlines ?? []).map((one) =>
      one.id === ensured.outlineId
        ? { ...one, items: one.items.map((item) => (item.id === itemId ? { ...item, body: extract.textPlain } : item)) }
        : one,
    ),
  };
  return {
    file: withDocument(withBody, id, (current) => ({
      ...current,
      outlineLinks: [...current.outlineLinks, { itemId: itemId as string, headingId: null, extractId: extractId as string }],
    })),
    itemId,
    existed: false,
  };
};

/** The extract a row was made from, if it was. */
export const extractOfRow = (document: WpDocument, itemId: string): string | null =>
  document.outlineLinks.find((link) => link.itemId === itemId)?.extractId ?? null;

/** The heading a row stands for, if it does. */
export const headingOfRow = (document: WpDocument, itemId: string): string | null =>
  document.outlineLinks.find((link) => link.itemId === itemId)?.headingId ?? null;
