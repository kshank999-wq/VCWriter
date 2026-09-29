import { describe, expect, it } from 'vitest';
import {
  addSortCategory,
  addSource,
  beginSession,
  createProjectFile,
  extractToCategory,
  fileOnShelf,
  outlineRows,
  outlinesOf,
  referenceCard,
  rowTitle,
  sendCount,
  sendLadder,
  sendRows,
  sendToOutliner,
  researchCategoriesInOrder,
  shelfOffer,
  updateResearchItem,
  type ProjectFile,
  type ProjectFormat,
} from '../index.js';

/**
 * Send to Outliner (addendum 26 §11).
 *
 * The promises: the ladder comes off the format and nothing names a level, a
 * card arrives as a **reference** rather than a copy, a row switched off takes
 * what is under it, and a send adds without clearing.
 */

const PAGE = 'A villain who is right is the only one worth writing.\n\nDialogue is compression.';

const world = (format: ProjectFormat = 'novel') => {
  let file: ProjectFile = createProjectFile({ title: 'Villain’s Guide', format });
  const begun = beginSession(file, 'brainstorm');
  file = begun.file;
  const session = begun.session;

  const added = addSource(file, { sessionId: session.id, name: 'Brainstorm', text: PAGE, kind: 'paste' });
  file = added.file;
  const source = added.source!;

  const top = addSortCategory(file, { sessionId: session.id, name: 'Character' });
  file = top.file;
  const nested = addSortCategory(file, {
    sessionId: session.id,
    name: 'Antagonists',
    parentId: top.category!.id,
  });
  file = nested.file;

  const card = extractToCategory(file, {
    sourceId: source.id,
    from: 0,
    to: 52,
    categoryId: nested.category!.id,
  });
  file = card.file;

  return { file, session, source, top: top.category!, nested: nested.category!, card: card.card! };
};

describe('send to outliner', () => {
  it('reads the ladder off the format and names no level itself', () => {
    // A textbook has a chapter; everything else sends its top rung as the unit.
    expect(sendLadder('instructional')).toEqual({ top: 'chapter', sub: 'scene', card: 'note' });
    expect(sendLadder('novel')).toEqual({ top: 'scene', sub: 'beat', card: 'note' });
    expect(sendLadder('screenplay')).toEqual({ top: 'scene', sub: 'beat', card: 'note' });
    // A card claims least about what it is, on every format.
    for (const format of ['novel', 'screenplay', 'game', 'collection'] as ProjectFormat[]) {
      expect(sendLadder(format).card).toBe('note');
    }
  });

  it('lays the sitting out as rows, a card under the category it is filed in', () => {
    const { file, session, top, nested, card } = world();
    const rows = sendRows(file, session.id, 'novel');

    expect(rows.map((one) => [one.kind, one.title, one.depth, one.becomes])).toEqual([
      ['category', 'Character', 0, 'scene'],
      ['category', 'Antagonists', 1, 'beat'],
      ['card', card.title, 2, 'note'],
    ]);
    expect(rows.every((one) => one.sent)).toBe(true);
    expect(rows.find((one) => one.id === (top.id as string))!.cards).toBe(0);
    expect(rows.find((one) => one.id === (nested.id as string))!.cards).toBe(1);
  });

  it('a row switched off takes what is under it', () => {
    const { file, session, nested } = world();
    const rows = sendRows(file, session.id, 'novel', { out: [nested.id as string] });
    // The nested category and its card both stop going, said rather than implied.
    expect(rows.filter((one) => one.sent).map((one) => one.title)).toEqual(['Character']);
  });

  it('says what the send would do, in the caller’s own words', () => {
    const { file, session } = world();
    const name = (kind: string, many: boolean) =>
      ({ scene: 'Chapter', beat: 'Passage', note: 'Note' })[kind] + (many ? 's' : '');

    expect(sendCount(sendRows(file, session.id, 'novel'), name).says).toBe('1 chapter · 1 passage · 1 note');
    // Nothing ticked reads as nothing rather than as ready.
    const none = sendRows(file, session.id, 'novel', { out: ['nope'] }).map((one) => ({ ...one, sent: false }));
    expect(sendCount(none, name).says).toContain('Nothing is ticked');
    expect(sendCount(none, name).total).toBe(0);
  });

  it('sends the structure as rows and the card as a reference', () => {
    const { file, session, card } = world();
    const sent = sendToOutliner(file, session.id, 'novel');

    expect(sent.made).toBe(3);
    const outline = outlinesOf(sent.file)[0]!;
    expect(outline.items).toHaveLength(3);

    // The card is not copied: the row references it and reads its title through,
    // so renaming the card in Refine renames the row with nothing run.
    const row = outline.items.find((one) => one.source?.type === 'research_item')!;
    expect(row.source!.id).toBe(card.id as string);
    expect(rowTitle(sent.file, row)).toBe(card.title);
    const renamed = updateResearchItem(sent.file, card.id, { title: 'The right villain' });
    expect(rowTitle(renamed, row)).toBe('The right villain');

    // And the card is still in the sorter.
    expect(renamed.researchItems.some((one) => (one.id as string) === (card.id as string))).toBe(true);
  });

  it('steps a nested chapter down rather than dropping the writer’s cards', () => {
    const { file, session, nested } = world('instructional');
    // Ask for the nested category to be a chapter, which the outline refuses to
    // hang under anything.
    const sent = sendToOutliner(file, session.id, 'instructional', {
      becomes: { [nested.id as string]: 'chapter' },
    });
    const outline = outlinesOf(sent.file)[0]!;
    const rows = outlineRows(outline);
    expect(rows.map((one) => one.item.kind)).toEqual(['chapter', 'scene', 'note']);
    // The card still arrived, which is the point of stepping down.
    expect(sent.made).toBe(3);
  });

  it('adds without clearing, so sending twice keeps the first', () => {
    const { file, session } = world();
    const once = sendToOutliner(file, session.id, 'novel');
    const twice = sendToOutliner(once.file, session.id, 'novel', {}, once.outlineId!);
    expect(outlinesOf(twice.file)).toHaveLength(1);
    expect(outlinesOf(twice.file)[0]!.items).toHaveLength(6);
  });

  it('lists a referenced card under both its categories', () => {
    const { file, session, top, card } = world();
    const next = referenceCard(file, card.id, top.id);
    const rows = sendRows(next, session.id, 'novel');
    expect(rows.filter((one) => one.kind === 'card')).toHaveLength(2);
    // One record, two rows: the outline can carry the same card twice.
    const sent = sendToOutliner(next, session.id, 'novel');
    expect(sent.made).toBe(4);
  });

  it('files a card on the shelf, saying what that costs before the press', () => {
    const { file, session, top, card } = world();
    const folder = researchCategoriesInOrder(file)[0]!;

    const offer = shelfOffer(file, card.id, folder.id);
    expect(offer.can).toBe(true);
    expect(offer.says).toContain(folder.name);
    // A sitting's own category is not a shelf, and the refusal says which.
    expect(shelfOffer(file, card.id, top.id).can).toBe(false);
    expect(shelfOffer(file, card.id, top.id).says).toContain('sitting');

    const moved = fileOnShelf(file, card.id, folder.id);
    expect(moved.researchItems[0]!.categoryId).toBe(folder.id);
    // The card keeps its range, so the source's grey does not move.
    expect(moved.researchItems[0]!.sourceFrom).toBe(0);
    expect(moved.researchItems[0]!.sourceTo).toBe(52);
    // And it is off the sitting's rows, having left it.
    expect(sendRows(moved, session.id, 'novel').filter((one) => one.kind === 'card')).toHaveLength(0);
  });
});
