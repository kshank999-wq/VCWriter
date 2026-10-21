import { describe, expect, it } from 'vitest';
import {
  addCategory,
  applyTransfer,
  beatsForUnit,
  categoriesOf,
  createExtract,
  createProjectFile,
  ensureExtractPalettes,
  mainDocument,
  newId,
  palettesOf,
  planTransfer,
  recordTransfer,
  unitsInStoryOrder,
  choiceFromKey,
  destinationOptions,
  updateCategory,
  type ExtractId,
  type ExtractKind,
  type ProjectFile,
} from '../index.js';

/**
 * Sending extracts to a project (addendum 42 §10). TR-01: a batch of mixed
 * extracts to another project, with a receipt for each. TR-02: a category
 * with no place of its own goes to Notes, and the preview says so. TR-03: a
 * second send makes no second copy unless asked.
 */

const source = (): { file: ProjectFile; ids: string[] } => {
  let file = ensureExtractPalettes(createProjectFile({ title: 'Notes', format: 'document' }));
  const palette = palettesOf(file)[0]!;
  const custom = addCategory(file, palette.id, 'Multiplication');
  file = custom.file;
  const byKind = (kind: ExtractKind) => categoriesOf(file, palette.id).find((category) => category.kind === kind)!;
  const ids: string[] = [];
  const take = (categoryId: string, text: string) => {
    const made = createExtract(file, {
      id: newId<ExtractId>(),
      documentId: mainDocument(file)!.id,
      categoryId: categoryId as never,
      textPlain: text,
    });
    file = made.file;
    ids.push(made.extract.id);
  };
  take(byKind('character').id, 'Sarah never sleeps before two.');
  take(byKind('characterization').id, 'She keeps a lamp lit.');
  take(byKind('location').id, 'The old house on Cutter Street.');
  take(byKind('idea').id, 'The lamp is a signal.');
  take(byKind('scene').id, 'Night. The harbour.\nA boat answers the lamp.');
  take(byKind('beat').id, 'Sarah sees the answer.');
  take(byKind('dialogue').id, '“Who is out there?”');
  take(byKind('setup').id, 'The lamp.');
  take(byKind('object').id, 'A brass lamp.');
  take(custom.category.id, 'Seven times eight.');
  return { file, ids };
};

describe('sending extracts', () => {
  it('TR-01 / TR-02: ten mixed extracts land where their kinds say, with a receipt each', () => {
    const { file, ids } = source();
    const target = createProjectFile({ title: 'The Lamp', format: 'screenplay' });
    const plan = planTransfer(file, ids, target);
    expect(plan.steps.map((step) => step.areaName)).toEqual([
      'Research › Characters',
      'Research › Characters',
      'Research › Locations',
      'Research › Ideas',
      'A new scene',
      // Into the scene just made from the extract before it.
      'A beat in “Night. The harbour. A boat answers the lamp.”',
      'Research › Notes',
      expect.stringMatching(/^Research › /),
      'Research › Props',
      'Research › Notes',
    ]);

    const result = applyTransfer(file, ids, target, { path: '/x/The Lamp.vcw' });
    expect(result.receipts.size).toBe(10);
    const characters = result.target.researchCategories.find((category) => category.systemKey === 'characters')!;
    expect(
      result.target.researchItems.filter((item) => item.categoryId === characters.id).map((item) => item.body),
    ).toEqual(['Sarah never sleeps before two.', 'She keeps a lamp lit.']);
    expect(result.target.researchItems[0]!.source).toBe('From “Notes” in Notes');
    const scene = unitsInStoryOrder(result.target).find((unit) => unit.title === 'Night. The harbour. A boat answers the lamp.')!;
    expect(beatsForUnit(result.target, scene.id)[0]!.manuscript.elements.map((element) => element.text)).toEqual([
      'Night. The harbour.',
      'A boat answers the lamp.',
    ]);
    // Notes did not exist in a screenplay, so it was made, once.
    expect(result.target.researchCategories.filter((category) => category.systemKey === 'notes')).toHaveLength(1);

    const recorded = recordTransfer(file, result.receipts, 'copy');
    expect(recorded.extracts.every((extract) => extract.status === 'exported' && extract.sentTo.length === 1)).toBe(true);
    expect(recorded.extracts[0]!.sentTo[0]).toMatchObject({ projectTitle: 'The Lamp', path: '/x/The Lamp.vcw', area: 'research' });
  });

  it('TR-03: a second send skips what has gone before, unless asked again', () => {
    const { file, ids } = source();
    const target = createProjectFile({ title: 'The Lamp', format: 'novel' });
    const first = applyTransfer(file, ids, target);
    const recorded = recordTransfer(file, first.receipts, 'copy');
    expect(planTransfer(recorded, ids, first.target).steps.every((step) => step.already !== null)).toBe(true);
    const second = applyTransfer(recorded, ids, first.target);
    expect(second.receipts.size).toBe(0);
    expect(second.target).toBe(first.target);
    expect(applyTransfer(recorded, ids.slice(0, 1), first.target, { again: true }).receipts.size).toBe(1);
  });

  it('a move takes the extracts out of the bins and leaves the document alone', () => {
    const { file, ids } = source();
    const document = JSON.stringify(mainDocument(file)!.content);
    const result = applyTransfer(file, ids.slice(0, 2), file);
    const moved = recordTransfer(result.target, result.receipts, 'move');
    expect(moved.extracts).toHaveLength(ids.length - 2);
    expect(JSON.stringify(mainDocument(moved)!.content)).toBe(document);
    // Sent to its own project: research shelves, since a document has no scenes.
    expect(moved.researchItems).toHaveLength(2);
  });
});

describe('choosing the destination (addendum 42 §11)', () => {
  it('offers every shelf, a new scene and a beat in each scene, and sends where it is told', () => {
    const { file, ids } = source();
    const target = createProjectFile({ title: 'The Lamp', format: 'screenplay' });
    const options = destinationOptions(target);
    const labels = options.map((option) => option.label);
    expect(labels).toContain('Research › Themes');
    expect(labels).toContain('A new scene');
    expect(labels.some((label) => label.startsWith('A beat in'))).toBe(true);

    const themes = options.find((option) => option.label === 'Research › Themes')!;
    const plan = planTransfer(file, ids.slice(0, 1), target, { [ids[0]!]: choiceFromKey(themes.key)! });
    expect(plan.steps[0]).toMatchObject({ areaName: 'Research › Themes', key: themes.key });
    const result = applyTransfer(file, ids.slice(0, 1), target, { choices: { [ids[0]!]: choiceFromKey(themes.key)! } });
    const shelf = result.target.researchCategories.find((category) => category.name === 'Themes')!;
    expect(result.target.researchItems.at(-1)!.categoryId).toBe(shelf.id);

    // A beat in a chosen scene.
    const beat = options.find((option) => option.key.startsWith('beat:'))!;
    const sent = applyTransfer(file, ids.slice(5, 6), target, { choices: { [ids[5]!]: choiceFromKey(beat.key)! } });
    expect(sent.receipts.get(ids[5]!)!.area).toBe('beat');
    expect(beatsForUnit(sent.target, beat.key.slice(5) as never)).toHaveLength(beatsForUnit(target, beat.key.slice(5) as never).length + 1);
  });

  it('adds to an existing item, or replaces its words, and says which', () => {
    const { file, ids } = source();
    const first = applyTransfer(file, ids.slice(0, 1), createProjectFile({ title: 'The Lamp', format: 'novel' }));
    const item = first.target.researchItems.at(-1)!;
    const shelfId = item.categoryId as string;
    const appended = applyTransfer(file, ids.slice(1, 2), first.target, {
      choices: { [ids[1]!]: { area: 'research', shelfId, into: { itemId: item.id, mode: 'append' } } },
    });
    expect(appended.target.researchItems).toHaveLength(first.target.researchItems.length);
    expect(appended.target.researchItems.find((one) => one.id === item.id)!.body).toBe(
      'Sarah never sleeps before two.\n\nShe keeps a lamp lit.',
    );
    expect(appended.receipts.get(ids[1]!)).toMatchObject({ resultId: item.id });
    expect(appended.receipts.get(ids[1]!)!.areaName).toContain('(added to)');

    const replaced = applyTransfer(file, ids.slice(1, 2), first.target, {
      choices: { [ids[1]!]: { area: 'research', shelfId, into: { itemId: item.id, mode: 'replace' } } },
    });
    expect(replaced.target.researchItems.find((one) => one.id === item.id)!.body).toBe('She keeps a lamp lit.');
  });

  it("follows a button's default shelf, making it in the target where it is missing", () => {
    let { file, ids } = source();
    const multiplication = file.extractCategories.find((category) => category.label === 'Multiplication')!;
    file = updateCategory(file, multiplication.id, { targetShelf: 'Times tables' });
    const target = createProjectFile({ title: 'Arithmetic', format: 'instructional' });
    const plan = planTransfer(file, ids.slice(9), target);
    expect(plan.steps[0]!.areaName).toBe('Research › Times tables');
    const result = applyTransfer(file, ids.slice(9), target);
    expect(result.target.researchCategories.filter((category) => category.name === 'Times tables')).toHaveLength(1);
    // A second extract finds the shelf rather than making another.
    const again = applyTransfer(file, ids.slice(9), result.target, { again: true });
    expect(again.target.researchCategories.filter((category) => category.name === 'Times tables')).toHaveLength(1);
  });
});
