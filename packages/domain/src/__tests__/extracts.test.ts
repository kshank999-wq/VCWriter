import { describe, expect, it } from 'vitest';
import {
  GENERAL_WRITING,
  addCategory,
  addPalette,
  binsOf,
  categoriesOf,
  createExtract,
  createProjectFile,
  deleteExtract,
  duplicatePalette,
  ensureExtractPalettes,
  isDuplicateExtract,
  mainDocument,
  matchesExtract,
  moveCategory,
  moveExtract,
  newId,
  nudgeExtract,
  palettesOf,
  parseProjectFile,
  removeCategory,
  removePalette,
  serializeProjectFile,
  updateExtract,
  type ExtractId,
  type ProjectFile,
} from '../index.js';

/**
 * Extract & Organize (addendum 42 §8): the bins behind the buttons.
 *
 * The WP spec's acceptance tests name what matters. EX-01: a capture leaves
 * one extract in the matching bin. EX-04: a custom palette with its own
 * buttons persists. EX-05: overlapping captures are separate extracts. And
 * throughout, **no extract is ever silently discarded**.
 */

const start = (): ProjectFile => ensureExtractPalettes(createProjectFile({ title: 'Notes', format: 'document' }));
const general = (file: ProjectFile) => palettesOf(file)[0]!;
const category = (file: ProjectFile, label: string) => categoriesOf(file, general(file).id).find((one) => one.label === label)!;

const capture = (file: ProjectFile, label: string, text: string) =>
  createExtract(file, {
    id: newId<ExtractId>(),
    documentId: mainDocument(file)!.id,
    categoryId: category(file, label).id,
    textPlain: text,
  });

describe('General Writing', () => {
  it('ships with the fifteen categories of the spec, in order, each with its kind', () => {
    const file = start();
    expect(palettesOf(file).map((one) => one.name)).toEqual(['General Writing']);
    expect(categoriesOf(file, general(file).id).map((one) => one.label)).toEqual(GENERAL_WRITING.map((one) => one.label));
    expect(category(file, 'Plot Point').kind).toBe('plot_point');
  });

  it('is added once, however often the sidebar opens', () => {
    const file = start();
    expect(ensureExtractPalettes(file)).toBe(file);
  });
});

describe('capturing (EX-01, EX-05)', () => {
  it('puts one extract in the matching bin, titled with its first words', () => {
    const { file, extract } = capture(start(), 'Character', 'Sarah never sleeps before two.');
    const bin = binsOf(file, general(file).id).find((one) => one.category.label === 'Character')!;
    expect(bin.extracts).toEqual([extract]);
    expect(extract.title).toBe('Sarah never sleeps before two.');
    expect(extract.status).toBe('unassigned');
  });

  it('keeps overlapping captures as separate extracts, and warns only of the same words in the same bin', () => {
    let file = start();
    file = capture(file, 'Character', 'Sarah never sleeps').file;
    file = capture(file, 'Description', 'Sarah never sleeps before two.').file;
    expect(file.extracts).toHaveLength(2);
    const doc = mainDocument(file)!.id;
    expect(isDuplicateExtract(file, { documentId: doc, categoryId: category(file, 'Character').id, textPlain: 'Sarah never sleeps ' })).toBe(true);
    expect(isDuplicateExtract(file, { documentId: doc, categoryId: category(file, 'Idea').id, textPlain: 'Sarah never sleeps' })).toBe(false);
  });

  it('keeps twenty captures in the order they were taken', () => {
    let file = start();
    for (let index = 0; index < 20; index += 1) file = capture(file, 'Idea', `Idea ${index}`).file;
    const bin = binsOf(file, general(file).id).find((one) => one.category.label === 'Idea')!;
    expect(bin.extracts.map((one) => one.textPlain)).toEqual(Array.from({ length: 20 }, (_, index) => `Idea ${index}`));
  });

  it('survives a save and a reopen', () => {
    const { file } = capture(start(), 'Scene', 'The kitchen at dawn.');
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(reopened.extracts).toEqual(file.extracts);
    expect(reopened.extractPalettes).toEqual(file.extractPalettes);
  });
});

describe('the bins', () => {
  it('moves an extract to another bin, and reorders within one', () => {
    let file = start();
    const first = capture(file, 'Idea', 'one');
    file = first.file;
    const second = capture(file, 'Idea', 'two');
    file = second.file;
    file = nudgeExtract(file, second.extract.id, -1);
    expect(binsOf(file, general(file).id).find((one) => one.category.label === 'Idea')!.extracts.map((one) => one.textPlain)).toEqual(['two', 'one']);
    file = moveExtract(file, first.extract.id, category(file, 'Note').id);
    expect(binsOf(file, general(file).id).find((one) => one.category.label === 'Note')!.extracts.map((one) => one.textPlain)).toEqual(['one']);
  });

  it('edits a title and a status, and deletes only the copy', () => {
    const made = capture(start(), 'Idea', 'A clock that runs backwards.');
    let file = updateExtract(made.file, made.extract.id, { title: 'Clock', status: 'ready' });
    expect(file.extracts[0]).toMatchObject({ title: 'Clock', status: 'ready' });
    const content = mainDocument(file)!.content;
    file = deleteExtract(file, made.extract.id);
    expect(file.extracts).toEqual([]);
    expect(mainDocument(file)!.content).toBe(content);
  });

  it('finds extracts by title, words or tag, and by status', () => {
    const made = capture(start(), 'Idea', 'A clock that runs backwards.');
    const extract = { ...made.extract, tags: ['time'] };
    expect(matchesExtract(extract, 'CLOCK')).toBe(true);
    expect(matchesExtract(extract, 'time')).toBe(true);
    expect(matchesExtract(extract, 'dog')).toBe(false);
    expect(matchesExtract(extract, '', 'ready')).toBe(false);
  });
});

describe('palettes of your own (EX-04)', () => {
  it('makes Math Instruction with four buttons, and it persists', () => {
    let file = start();
    const made = addPalette(file, 'Math Instruction');
    file = made.file;
    for (const label of ['Addition', 'Subtraction', 'Multiplication', 'Division']) {
      file = addCategory(file, made.palette.id, label).file;
    }
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(palettesOf(reopened).map((one) => one.name)).toEqual(['General Writing', 'Math Instruction']);
    expect(categoriesOf(reopened, made.palette.id).map((one) => one.label)).toEqual(['Addition', 'Subtraction', 'Multiplication', 'Division']);
    // New buttons take turns at the swatches, so neighbours differ.
    const colours = categoriesOf(reopened, made.palette.id).map((one) => one.color);
    expect(new Set(colours).size).toBe(4);
  });

  it('reorders a button, and copies a palette as the start of another', () => {
    let file = start();
    const scene = category(file, 'Scene');
    file = moveCategory(file, scene.id, 1);
    expect(categoriesOf(file, general(file).id).slice(0, 2).map((one) => one.label)).toEqual(['Beat', 'Scene']);
    const copy = duplicatePalette(file, general(file).id, 'My General');
    expect(categoriesOf(copy.file, copy.palette.id)).toHaveLength(GENERAL_WRITING.length);
  });

  it('never throws extracts away: a full bin turns its button off, a full palette is archived', () => {
    let file = start();
    const made = addPalette(file, 'Math');
    file = made.file;
    const addition = addCategory(file, made.palette.id, 'Addition');
    file = addition.file;
    file = createExtract(file, { id: newId<ExtractId>(), documentId: mainDocument(file)!.id, categoryId: addition.category.id, textPlain: '2 + 2' }).file;

    const offButton = removeCategory(file, addition.category.id);
    expect(offButton.disabled).toBe(true);
    expect(offButton.file.extracts).toHaveLength(1);
    expect(binsOf(offButton.file, made.palette.id).map((bin) => bin.category.label)).toEqual(['Addition']);

    const archived = removePalette(file, made.palette.id);
    expect(archived.archived).toBe(true);
    expect(palettesOf(archived.file).map((one) => one.name)).toEqual(['General Writing']);
    expect(archived.file.extracts).toHaveLength(1);
    expect(binsOf(archived.file, null).some((bin) => bin.category.label === 'Addition')).toBe(true);

    const empty = addPalette(start(), 'Empty');
    expect(removePalette(empty.file, empty.palette.id).file.extractPalettes).toHaveLength(1);
    expect(removePalette(file, general(file).id).file).toBe(file);
  });
});
