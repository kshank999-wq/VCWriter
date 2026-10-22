import { describe, expect, it } from 'vitest';
import {
  addItem,
  applyRowTransfer,
  beatsForUnit,
  choiceFromKey,
  createProjectFile,
  ensureDocumentOutline,
  findOutline,
  headingsOf,
  mainDocument,
  planRowTransfer,
  recordRowTransfer,
  rowDestinationOptions,
  rowReceipts,
  setDocumentContent,
  updateItem,
  type DocNode,
  type OutlineId,
} from '../index.js';

/**
 * Sending outline rows (addendum 42 §13, WP spec §6): a heading becomes a
 * scene with its subheadings as beats, or its section goes on at the end of
 * another document; notes and ideas go onto their shelves.
 */

const heading = (headingId: string, level: number, text: string): DocNode => ({
  type: 'heading',
  attrs: { level, headingId },
  content: [{ type: 'text', text }],
});
const para = (text: string, marks?: DocNode['marks']): DocNode => ({ type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] });

const BODY: DocNode = {
  type: 'doc',
  content: [
    heading('h1', 1, 'Arrival'),
    para('The ferry docks.', [{ type: 'extract', attrs: { id: 'x1' } }]),
    heading('h2', 2, 'The harbour'),
    para('Gulls.'),
    heading('h3', 1, 'Departure'),
    para('She leaves.'),
  ],
};

/** A document with an outline: Arrival (with The harbour and a note under it) and Departure; and an idea. */
const make = () => {
  let file = createProjectFile({ title: 'Notes', format: 'document' });
  file = setDocumentContent(file, mainDocument(file)!.id, BODY);
  const made = ensureDocumentOutline(file, mainDocument(file)!.id);
  file = made.file;
  const outlineId = made.outlineId as OutlineId;
  const doc = () => mainDocument(file)!;
  const row = (headingId: string) => doc().outlineLinks.find((link) => link.headingId === headingId)!.itemId;
  const arrival = row('h1');
  file = updateItem(file, outlineId, arrival as never, { body: 'Morning. Fog.' });
  const note = addItem(file, outlineId, { parentId: arrival as never, kind: 'note', title: 'Check ferry times' });
  file = updateItem(note.file, outlineId, note.itemId!, { body: 'Tuesdays only' });
  const idea = addItem(file, outlineId, { kind: 'idea', title: 'The lamp is a signal' });
  file = idea.file;
  return { file, outlineId, documentId: doc().id, arrival, harbour: row('h2'), departure: row('h3'), note: note.itemId!, idea: idea.itemId! };
};

describe('sending outline rows', () => {
  it('a heading into a story is a scene: its notes the summary, its words a beat, each subheading a beat', () => {
    const { file, documentId, arrival } = make();
    const target = createProjectFile({ title: 'The Lamp', format: 'screenplay' });
    const plan = planRowTransfer(file, documentId, [arrival], target);
    expect(plan.steps).toEqual([expect.objectContaining({ title: 'Arrival', categoryName: 'Heading (+2 under it)', areaName: 'A new scene' })]);

    const result = applyRowTransfer(file, documentId, [arrival], target);
    const scene = result.target.units.find((unit) => unit.title === 'Arrival')!;
    expect(scene).toMatchObject({ summary: 'Morning. Fog.', notes: 'Check ferry times: Tuesdays only' });
    const beats = beatsForUnit(result.target, scene.id);
    expect(beats.map((beat) => [beat.title, beat.manuscript.elements.map((element) => element.text)])).toEqual([
      ['', ['The ferry docks.']],
      ['The harbour', ['Gulls.']],
    ]);
    expect(result.receipts.get(arrival)).toMatchObject({ area: 'scene', resultId: scene.id });
  });

  it('a heading into another document goes on at the end, section and all, with its marks and ids left behind', () => {
    const { file, documentId, arrival } = make();
    let target = createProjectFile({ title: 'Book', format: 'document' });
    target = setDocumentContent(target, mainDocument(target)!.id, { type: 'doc', content: [para('Already here.')] });
    expect(rowDestinationOptions(target)[0]).toEqual({ key: 'document', label: 'The end of “Book”' });
    const result = applyRowTransfer(file, documentId, [arrival], target);
    const content = mainDocument(result.target)!.content;
    expect(content.content!.map((block) => block.content?.[0]?.text)).toEqual(['Already here.', 'Arrival', 'The ferry docks.', 'The harbour', 'Gulls.']);
    expect(JSON.stringify(content)).not.toContain('extract');
    // No ids carried over, so the target's editor gives its own.
    expect(headingsOf(content)).toEqual([]);
    expect(result.receipts.get(arrival)!.areaName).toBe('The end of “Book”');
  });

  it('notes and ideas go onto their shelves; a row inside another sent goes once, with it', () => {
    const { file, documentId, arrival, note, idea } = make();
    const target = createProjectFile({ title: 'The Lamp', format: 'novel' });
    const plan = planRowTransfer(file, documentId, [arrival, note, idea], target);
    expect(plan.steps.map((step) => step.title)).toEqual(['Arrival', 'The lamp is a signal']);
    const result = applyRowTransfer(file, documentId, [note, idea], target);
    expect(result.target.researchItems.map((item) => [item.title, item.body])).toEqual([
      ['Check ferry times', 'Tuesdays only'],
      ['The lamp is a signal', ''],
    ]);
    const ideas = result.target.researchCategories.find((category) => category.systemKey === 'ideas')!;
    expect(result.target.researchItems[1]!.categoryId).toBe(ideas.id);
  });

  it('goes where it is pointed: a beat in a chosen scene, or a shelf with the section as its words', () => {
    const { file, documentId, departure, arrival } = make();
    const target = createProjectFile({ title: 'The Lamp', format: 'screenplay' });
    const scene = rowDestinationOptions(target).find((option) => option.key.startsWith('beat:'))!;
    const asBeat = applyRowTransfer(file, documentId, [departure], target, { choices: { [departure]: choiceFromKey(scene.key)! } });
    const beat = asBeat.target.beats.find((one) => one.title === 'Departure')!;
    expect(beat.unitId).toBe(scene.key.slice(5));
    expect(beat.manuscript.elements.map((element) => element.text)).toEqual(['She leaves.']);

    const ideas = rowDestinationOptions(target).find((option) => option.label === 'Research › Ideas')!;
    const asNote = applyRowTransfer(file, documentId, [arrival], target, { choices: { [arrival]: choiceFromKey(ideas.key)! } });
    expect(asNote.target.researchItems.at(-1)!.body).toBe('Morning. Fog.\n\nThe ferry docks.\n\nThe harbour\nGulls.\n\nCheck ferry times\nTuesdays only');
  });

  it('keeps a receipt on the document, and a second send skips the row unless asked', () => {
    const { file, documentId, departure } = make();
    const target = createProjectFile({ title: 'The Lamp', format: 'screenplay' });
    const first = applyRowTransfer(file, documentId, [departure], target);
    const recorded = recordRowTransfer(file, documentId, first.receipts);
    expect(rowReceipts(mainDocument(recorded)!, departure)).toEqual([expect.objectContaining({ projectTitle: 'The Lamp', area: 'scene' })]);
    expect(planRowTransfer(recorded, documentId, [departure], first.target).steps[0]!.already).not.toBeNull();
    expect(applyRowTransfer(recorded, documentId, [departure], first.target).receipts.size).toBe(0);
    expect(applyRowTransfer(recorded, documentId, [departure], first.target, { again: true }).receipts.size).toBe(1);
    // The rows themselves are untouched.
    expect(findOutline(recorded, mainDocument(recorded)!.outlineId as OutlineId)).toEqual(findOutline(file, mainDocument(file)!.outlineId as OutlineId));
  });
});

