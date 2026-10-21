import { describe, expect, it } from 'vitest';
import {
  addItem,
  createExtract,
  createProjectFile,
  docPlainText,
  documentFromOutline,
  documentOutlineNumbers,
  ensureDocumentOutline,
  ensureExtractPalettes,
  findOutline,
  headingNumbers,
  headingsOf,
  indentItem,
  linkExtractToOutline,
  mainDocument,
  moveItem,
  newId,
  outlineChildren,
  outlineFromDocument,
  palettesOf,
  categoriesOf,
  removeItems,
  setDocumentContent,
  setHeadingNumbering,
  updateItem,
  type DocNode,
  type ExtractId,
  type Outline,
  type OutlineId,
  type ProjectFile,
} from '../index.js';

/**
 * The Outliner tab of a document (addendum 42 §9). OL-01: a heading makes a
 * linked outline row, and the writer navigates and reorganises **without
 * loss of text**.
 */

const heading = (headingId: string, level: number, text: string): DocNode => ({
  type: 'heading',
  attrs: { level, headingId },
  content: [{ type: 'text', text }],
});
const para = (text: string): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text }] });

const BODY: DocNode = {
  type: 'doc',
  content: [
    para('Preface.'),
    heading('h1', 1, 'Arrival'),
    para('The ferry docks.'),
    heading('h2', 2, 'The harbour'),
    para('Gulls.'),
    heading('h3', 1, 'Departure'),
    para('She leaves.'),
  ],
};

const start = (content: DocNode = BODY): { file: ProjectFile; outlineId: OutlineId } => {
  const file = createProjectFile({ title: 'Story', format: 'document' });
  const filled = setDocumentContent(file, mainDocument(file)!.id, content);
  const made = ensureDocumentOutline(filled, mainDocument(filled)!.id);
  return { file: made.file, outlineId: made.outlineId! };
};

const outlineOf = (file: ProjectFile, outlineId: OutlineId): Outline => findOutline(file, outlineId)!;
const tree = (outline: Outline, parentId: string | null = null): unknown[] =>
  outlineChildren(outline, parentId as never).map((item) => {
    const children = tree(outline, item.id);
    return children.length > 0 ? [item.title, children] : item.title;
  });
const doc = (file: ProjectFile) => mainDocument(file)!;
const sync = (file: ProjectFile) => documentFromOutline(file, doc(file).id);

describe('document → outline', () => {
  it('OL-01: every heading makes a linked row, nested as the levels nest', () => {
    const { file, outlineId } = start();
    expect(tree(outlineOf(file, outlineId))).toEqual([['Arrival', ['The harbour']], 'Departure']);
    expect(doc(file).outlineLinks.map((link) => link.headingId)).toEqual(['h1', 'h2', 'h3']);
  });

  it('follows a renamed, reordered or deleted heading, and is a no-op when nothing changed', () => {
    const { file, outlineId } = start();
    expect(outlineFromDocument(file, doc(file).id)).toBe(file);
    const next = setDocumentContent(file, doc(file).id, {
      type: 'doc',
      content: [heading('h3', 1, 'Leaving'), para('She leaves.'), heading('h1', 1, 'Arrival'), para('x')],
    });
    const synced = outlineFromDocument(next, doc(next).id);
    expect(tree(outlineOf(synced, outlineId))).toEqual(['Leaving', 'Arrival']);
  });

  it('keeps a row the writer added beside the heading it followed, and a row with words on it when its heading goes', () => {
    const { file, outlineId } = start();
    const arrival = doc(file).outlineLinks[0]!.itemId;
    const noted = addItem(file, outlineId, { afterId: arrival as never, kind: 'note', title: 'Check ferry times' });
    let next = outlineFromDocument(noted.file, doc(noted.file).id);
    expect(tree(outlineOf(next, outlineId))).toEqual([['Arrival', ['The harbour']], 'Check ferry times', 'Departure']);

    const departure = doc(next).outlineLinks[2]!.itemId;
    next = updateItem(next, outlineId, departure as never, { body: 'Rain, maybe.' });
    next = setDocumentContent(next, doc(next).id, { type: 'doc', content: BODY.content!.slice(0, 5) });
    next = outlineFromDocument(next, doc(next).id);
    const kept = outlineOf(next, outlineId).items.find((item) => item.id === departure)!;
    expect(kept.kind).toBe('note');
    expect(kept.body).toBe('Rain, maybe.');
  });
});

describe('outline → document', () => {
  it('moves a section with its body, and every word stays', () => {
    const { file, outlineId } = start();
    const [arrival, , departure] = doc(file).outlineLinks.map((link) => link.itemId);
    const moved = sync(moveItem(file, outlineId, departure as never, { parentId: null, beforeId: arrival as never }));
    expect(docPlainText(doc(moved).content).split('\n')).toEqual([
      'Preface.',
      'Departure',
      'She leaves.',
      'Arrival',
      'The ferry docks.',
      'The harbour',
      'Gulls.',
    ]);
  });

  it('retitles and re-levels a heading from its row', () => {
    const { file, outlineId } = start();
    const [, , departure] = doc(file).outlineLinks.map((link) => link.itemId);
    let next = sync(updateItem(file, outlineId, departure as never, { title: 'Leaving' }));
    next = sync(indentItem(next, outlineId, departure as never));
    expect(headingsOf(doc(next).content)).toEqual([
      { headingId: 'h1', level: 1, text: 'Arrival' },
      { headingId: 'h2', level: 2, text: 'The harbour' },
      { headingId: 'h3', level: 2, text: 'Leaving' },
    ]);
    // And back the other way, nothing moves.
    expect(outlineFromDocument(next, doc(next).id)).toBe(next);
  });

  it('a removed row leaves its heading as a paragraph, where it was', () => {
    const { file, outlineId } = start();
    const [, harbour] = doc(file).outlineLinks.map((link) => link.itemId);
    const next = sync(removeItems(file, outlineId, [harbour as never]));
    const blocks = doc(next).content.content!;
    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'heading', 'paragraph', 'paragraph', 'paragraph', 'heading', 'paragraph']);
    expect(docPlainText(doc(next).content)).toBe(docPlainText(BODY));
  });

  it('a heading row added in the outliner becomes a heading', () => {
    const { file, outlineId } = start();
    const added = addItem(file, outlineId, { kind: 'heading', title: 'Epilogue' });
    const next = sync(added.file);
    const last = headingsOf(doc(next).content).at(-1)!;
    expect(last).toMatchObject({ level: 1, text: 'Epilogue' });
    expect(doc(next).outlineLinks.find((link) => link.itemId === added.itemId)!.headingId).toBe(last.headingId);
  });

  it('keeps a Heading 3 straight under a Heading 1 at 3 when nothing about it changed', () => {
    const { file, outlineId } = start({ type: 'doc', content: [heading('a', 1, 'One'), heading('b', 3, 'Deep')] });
    const folded = updateItem(file, outlineId, doc(file).outlineLinks[0]!.itemId as never, { collapsed: true });
    expect(sync(folded).documents[0]!.content).toEqual(folded.documents[0]!.content);
  });
});

describe('numbering', () => {
  it('numbers by nesting, in either scheme', () => {
    expect([...headingNumbers(BODY, 'decimal').values()]).toEqual(['1', '1.1', '2']);
    expect([...headingNumbers(BODY, 'outline').values()]).toEqual(['I.', 'A.', 'II.']);
    expect(headingNumbers(BODY, 'none').size).toBe(0);
    const { file } = start();
    const numbered = setHeadingNumbering(file, doc(file).id, 'decimal');
    expect([...documentOutlineNumbers(doc(numbered)).values()]).toEqual(['1', '1.1', '2']);
  });
});

describe('extracts into the outline', () => {
  it('makes one linked row with the words, once', () => {
    let file = ensureExtractPalettes(createProjectFile({ title: 'Story', format: 'document' }));
    const idea = categoriesOf(file, palettesOf(file)[0]!.id).find((category) => category.kind === 'idea')!;
    const made = createExtract(file, {
      id: newId<ExtractId>(),
      documentId: doc(file).id,
      categoryId: idea.id,
      textPlain: 'What if the lamp is a signal?',
    });
    file = made.file;
    const first = linkExtractToOutline(file, doc(file).id, made.extract.id);
    const again = linkExtractToOutline(first.file, doc(first.file).id, made.extract.id);
    expect(again.existed).toBe(true);
    expect(again.itemId).toBe(first.itemId);
    const row = findOutline(first.file, doc(first.file).outlineId as OutlineId)!.items[0]!;
    expect(row).toMatchObject({ kind: 'idea', body: 'What if the lamp is a signal?' });
  });
});
