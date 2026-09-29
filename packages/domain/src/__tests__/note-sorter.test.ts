import { describe, expect, it } from 'vitest';
import {
  addSortCategory,
  addSource,
  beginSession,
  cardsIn,
  categoryRemoval,
  coverageOf,
  createProjectFile,
  extractOffer,
  extractToCategory,
  mergeCards,
  moveCard,
  passageOf,
  piecesOf,
  progressOf,
  referenceCard,
  removeSortCategory,
  researchCategoriesInOrder,
  searchSession,
  sessionCards,
  sessionProgress,
  unsortedOf,
  splitCard,
  titleFrom,
  whereFrom,
  type ProjectFile,
} from '../index.js';

/**
 * The Note Sorter (addendum 26).
 *
 * What the tests are about is the module's promises rather than its screen:
 * the source is never touched, *processed* is counted rather than stored, a
 * card's lineage survives every act, and a sorting category never appears on
 * the research shelf.
 */

const PAGE = [
  'Rule one: the villain thinks he is the hero.',
  '',
  'Most writers do not have a talent problem. They have a finishing problem.',
  '',
  'Dialogue is two people not saying what they mean, at speed.',
].join('\n');

const world = () => {
  let file: ProjectFile = createProjectFile({ title: 'Villain’s Guide', format: 'novel' });
  const begun = beginSession(file, 'Villain’s Guide · brainstorm');
  file = begun.file;
  const session = begun.session;

  const added = addSource(file, {
    sessionId: session.id,
    name: 'Brainstorm',
    text: PAGE,
    kind: 'file',
  });
  file = added.file;
  const source = added.source!;

  const made = addSortCategory(file, { sessionId: session.id, name: 'Character' });
  file = made.file;
  const character = made.category!;

  const second = addSortCategory(file, { sessionId: session.id, name: 'Dialogue' });
  file = second.file;

  return { file, session, source, character, dialogue: second.category! };
};

/** Where a phrase starts and ends in the page. */
const at = (phrase: string) => ({ from: PAGE.indexOf(phrase), to: PAGE.indexOf(phrase) + phrase.length });

describe('the note sorter', () => {
  it('takes a passage onto a category and never touches the source', () => {
    const { file, source, character } = world();
    const range = at('Rule one: the villain thinks he is the hero.');

    const offer = extractOffer(file, { sourceId: source.id, ...range, categoryId: character.id });
    expect(offer.can).toBe(true);
    expect(offer.says).toContain('Character');

    const done = extractToCategory(file, { sourceId: source.id, ...range, categoryId: character.id });
    expect(done.card).toBeTruthy();
    // **The source is immutable**: not a character of it moved.
    expect(done.file.noteSources[0]!.text).toBe(PAGE);
    // The card carries the range, and the passage is read back off the source.
    expect(passageOf(done.file, done.card!)).toBe('Rule one: the villain thinks he is the hero.');
    expect(whereFrom(done.file, done.card!)).toBe('Brainstorm ¶1');
  });

  it('refuses a drop with nothing highlighted, and says so', () => {
    const { file, source, character } = world();
    const offer = extractOffer(file, { sourceId: source.id, from: 4, to: 4, categoryId: character.id });
    expect(offer.can).toBe(false);
    expect(offer.says).toContain('Highlight');
    // And the act refuses it again rather than trusting the reading was read.
    expect(
      extractToCategory(file, { sourceId: source.id, from: 4, to: 4, categoryId: character.id }).card,
    ).toBeNull();
  });

  it('counts what is sorted rather than storing it, and stops when the card goes', () => {
    const { file, source, character } = world();
    const range = at('Dialogue is two people not saying what they mean, at speed.');
    const done = extractToCategory(file, { sourceId: source.id, ...range, categoryId: character.id });

    expect(coverageOf(done.file, source.id)).toEqual([{ from: range.from, to: range.to }]);
    const before = progressOf(done.file, done.file.noteSources[0]!);
    expect(before.sorted).toBe(range.to - range.from);
    expect(before.share).toBeGreaterThan(0);

    // Bury the card and the passage is unsorted again, with nothing run.
    const gone = {
      ...done.file,
      researchItems: done.file.researchItems.map((one) => ({ ...one, deletedAt: '2026-01-01T00:00:00.000Z' })),
    };
    expect(coverageOf(gone, source.id)).toEqual([]);
    expect(progressOf(gone, gone.noteSources[0]!).sorted).toBe(0);
  });

  it('merges two overlapping cards into one run rather than two', () => {
    const { file, source, character, dialogue } = world();
    let next = extractToCategory(file, { sourceId: source.id, from: 0, to: 30, categoryId: character.id }).file;
    next = extractToCategory(next, { sourceId: source.id, from: 20, to: 44, categoryId: dialogue.id }).file;
    // A character covered twice is covered once: the question is *is this
    // dealt with*, and two cards over one stretch is still one stretch.
    expect(coverageOf(next, source.id)).toEqual([{ from: 0, to: 44 }]);
  });

  it('cuts the source into sorted and unsorted pieces, whole and in order', () => {
    const { file, source, character } = world();
    const range = at('Most writers do not have a talent problem. They have a finishing problem.');
    const done = extractToCategory(file, { sourceId: source.id, ...range, categoryId: character.id });

    const pieces = piecesOf(done.file, done.file.noteSources[0]!);
    // Every character of the source is in exactly one piece, in order.
    expect(pieces.map((one) => one.text).join('')).toBe(PAGE);
    expect(pieces.filter((one) => one.sorted)).toHaveLength(1);
    expect(pieces.find((one) => one.sorted)!.text).toBe(range.from >= 0 ? PAGE.slice(range.from, range.to) : '');
  });

  it('names a card by its opening words and nothing else', () => {
    expect(titleFrom('Most writers do not have a talent problem. They have a finishing problem.'))
      .toBe('Most writers do not have a talent…');
    // Under the cut it is the words themselves, with no ellipsis promising more.
    expect(titleFrom('Rule one: the villain')).toBe('Rule one: the villain');
    expect(titleFrom('   ')).toBe('');
  });

  it('keeps a sorting category off the research shelf', () => {
    const { file, session } = world();
    // The project's seeded research folders are there; the sitting's are not,
    // and the predicate is research's own reading rather than a copy here.
    const shelf = researchCategoriesInOrder(file);
    expect(shelf.length).toBeGreaterThan(0);
    expect(shelf.some((one) => one.name === 'Character')).toBe(false);
    expect(shelf.every((one) => one.sessionId === null)).toBe(true);
    // Two of the writer's own, plus the unsorted pile every sitting is born with.
    expect(file.researchCategories.filter((one) => (one.sessionId as string | null) === (session.id as string)))
      .toHaveLength(3);
    expect(unsortedOf(file, session.id)!.name).toBe('Unsorted');
  });

  it('shows one card in a second category without copying it', () => {
    const { file, source, character, dialogue } = world();
    const made = extractToCategory(file, {
      sourceId: source.id,
      ...at('Dialogue is two people not saying what they mean, at speed.'),
      categoryId: character.id,
    });
    const next = referenceCard(made.file, made.card!.id, dialogue.id);

    // One record, two lists.
    expect(next.researchItems).toHaveLength(1);
    expect(cardsIn(next, character.id)).toHaveLength(1);
    expect(cardsIn(next, dialogue.id)).toHaveLength(1);
    expect(cardsIn(next, dialogue.id)[0]!.id).toBe(made.card!.id);
  });

  it('moves a card home and drops the reference it no longer needs', () => {
    const { file, source, character, dialogue } = world();
    const made = extractToCategory(file, { sourceId: source.id, from: 0, to: 20, categoryId: character.id });
    let next = referenceCard(made.file, made.card!.id, dialogue.id);
    next = moveCard(next, made.card!.id, dialogue.id);
    const card = next.researchItems[0]!;
    expect(card.categoryId).toBe(dialogue.id);
    expect(card.alsoIn).toHaveLength(0);
  });

  it('splits a card and both halves keep the source', () => {
    const { file, source, character } = world();
    const range = at('Most writers do not have a talent problem. They have a finishing problem.');
    const made = extractToCategory(file, { sourceId: source.id, ...range, categoryId: character.id });

    const cut = made.card!.body.indexOf(' They have');
    const split = splitCard(made.file, made.card!.id, cut);
    expect(split.made).toBeTruthy();

    const cards = sessionCards(split.file, file.noteSessions[0]!.id);
    expect(cards).toHaveLength(2);
    expect(cards.every((one) => (one.sourceId as string) === (source.id as string))).toBe(true);
    // Between them they still cover exactly what the one card covered.
    expect(coverageOf(split.file, source.id)).toEqual([{ from: range.from, to: range.to }]);
  });

  it('joins cards into one, keeping the widest range and burying the rest', () => {
    const { file, source, character } = world();
    let next = extractToCategory(file, { sourceId: source.id, from: 0, to: 20, categoryId: character.id });
    const first = next.card!;
    const second = extractToCategory(next.file, {
      sourceId: source.id,
      from: 46,
      to: 80,
      categoryId: character.id,
    });

    const joined = mergeCards(second.file, [first.id, second.card!.id]);
    expect(joined.card).toBeTruthy();
    expect(joined.card!.sourceFrom).toBe(0);
    expect(joined.card!.sourceTo).toBe(80);
    // The one it absorbed is buried rather than destroyed, so restoring works.
    expect(sessionCards(joined.file, file.noteSessions[0]!.id)).toHaveLength(1);
    expect(joined.file.researchItems).toHaveLength(2);
  });

  it('sends a deleted category’s cards back to unsorted, losing nothing', () => {
    const { file, source, character, dialogue } = world();
    const made = extractToCategory(file, { sourceId: source.id, from: 0, to: 44, categoryId: character.id });

    expect(categoryRemoval(made.file, character.id)).toContain('to unsorted');
    // Merge into… is the same act with a different target, and says so.
    expect(categoryRemoval(made.file, character.id, dialogue.id)).toContain('to Dialogue');
    const gone = removeSortCategory(made.file, character.id, dialogue.id);

    expect(gone.researchCategories.some((one) => (one.id as string) === (character.id as string))).toBe(false);
    expect(cardsIn(gone, dialogue.id)).toHaveLength(1);
    // And the source's grey does not move: the card kept its range.
    expect(coverageOf(gone, source.id)).toEqual([{ from: 0, to: 44 }]);
  });

  it('searches the raw notes and the cards together', () => {
    const { file, source, character, session } = world();
    const made = extractToCategory(file, {
      sourceId: source.id,
      ...at('Dialogue is two people not saying what they mean, at speed.'),
      categoryId: character.id,
    });

    const hits = searchSession(made.file, session.id, 'dialogue');
    // Both halves: the passage still in the raw notes, and the card made of it.
    expect(hits.some((one) => one.kind === 'source')).toBe(true);
    expect(hits.some((one) => one.kind === 'card')).toBe(true);
    expect(searchSession(made.file, session.id, '   ')).toEqual([]);
  });

  it('reads a sitting’s progress across every source, and an empty one as nothing', () => {
    const { file, session, source, character } = world();
    expect(sessionProgress(file, session.id).share).toBe(0);

    const made = extractToCategory(file, { sourceId: source.id, from: 0, to: PAGE.length, categoryId: character.id });
    const whole = sessionProgress(made.file, session.id);
    expect(whole.share).toBe(1);
    expect(whole.total).toBe(PAGE.length);
  });
});
