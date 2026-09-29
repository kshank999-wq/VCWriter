import { describe, expect, it } from 'vitest';
import {
  addSortCategory,
  addSource,
  approvePlacements,
  beginSession,
  cardsIn,
  coverageOf,
  createProjectFile,
  describeSuggestions,
  extractToCategory,
  passageOf,
  placementKey,
  profilesOf,
  scoreCategories,
  sessionCards,
  sortCategories,
  sourcesOf,
  suggestCategories,
  suggestPlacements,
  termsOf,
  worthSaying,
  unsortedOf,
  type NoteSessionId,
  type ProjectFile,
} from '../index.js';

/**
 * Auto-sort suggestions (addendum 26 §14).
 *
 * What these pin is the discipline rather than the arithmetic: **only what is
 * unsorted**, **a paragraph at a time**, **one category per passage**, nothing
 * below the floor, a reason a writer can check, and — the one that makes the
 * whole panel safe — **nothing at all is stored**, so approving is the ordinary
 * extraction and a suggestion stops being made the moment it is taken.
 */

const PARAS = [
  'Rule one: the villain thinks he is the hero. Nobody gets up in the morning and decides to be the obstacle.',
  'Dialogue is two people not saying what they mean, at speed. If both of them say what they mean the scene is over.',
  'Good dialogue has speed. Cut the greeting, cut the goodbye, and start the dialogue as late as you possibly can.',
  'The villain wants something reasonable. Write the villain a morning: what he eats, who he telephones, what he fears.',
  'Publishing is a trade. Learn the trade or somebody in the trade will learn it on your behalf, using your book.',
  'Revision is where the book happens. Revision is not tidying; it is asking what the draft turned out to be about.',
  'Start your revision by reading the whole draft in one sitting, taking no notes, because revision begins as judgement.',
  'A revision plan is three sentences long. Any longer and it is a wish rather than a revision plan you will follow.',
];
const PAGE = PARAS.join('\n\n');

const world = (names: readonly string[] = ['Character', 'Dialogue']) => {
  let file: ProjectFile = createProjectFile({ title: 'Villain’s Guide', format: 'novel' });
  const begun = beginSession(file, 'brainstorm');
  file = begun.file;
  const session: NoteSessionId = begun.session.id;

  const added = addSource(file, { sessionId: session, name: 'Brainstorm', text: PAGE, kind: 'paste' });
  file = added.file;

  for (const name of names) file = addSortCategory(file, { sessionId: session, name }).file;
  return { file, session, source: added.source! };
};

/** File one of the page's paragraphs by hand, the way a writer would. */
const fileParagraph = (
  file: ProjectFile,
  sourceId: ReturnType<typeof world>['source']['id'],
  which: number,
  categoryId: Parameters<typeof extractToCategory>[1]['categoryId'],
): ProjectFile => {
  const from = PAGE.indexOf(PARAS[which]!);
  return extractToCategory(file, { sourceId, from, to: from + PARAS[which]!.length, categoryId }).file;
};

describe('auto-sort suggestions', () => {
  it('reads the words that mean something and drops the ones that do not', () => {
    const words = termsOf('The villain thinks that he is very much the hero of it all.');
    expect([...words].sort()).toEqual(['hero', 'thinks', 'villain']);
    // Short words and grammar go; a possessive is the same word.
    expect(termsOf('the cat’s dialogue')).toEqual(new Set(['dialogue']));
    expect(termsOf('   ')).toEqual(new Set());
  });

  it('a category is taught by its name before anything is filed in it', () => {
    const { file, session } = world();
    const profiles = profilesOf(file, session);
    expect(profiles.map((one) => one.name)).toEqual(['Character', 'Dialogue']);
    // Nothing filed yet, and it already knows its own name — without which the
    // panel is silent until somebody has done the work it exists to save.
    expect(profiles.every((one) => one.cards === 0)).toBe(true);
    expect(profiles[1]!.named.has('dialogue')).toBe(true);
    // And its name is not a card: the two are kept apart so the row can say
    // which it is (`sayWhy`) rather than claiming a card that is not there.
    expect(profiles[1]!.terms.size).toBe(0);
  });

  it('scores a passage against the categories, naming the words that earned it', () => {
    const { file, session, source } = world();
    const dialogue = sortCategories(file, session).find((one) => one.name === 'Dialogue')!;
    const taught = fileParagraph(file, source.id, 1, dialogue.id);

    const best = scoreCategories(taught, session, PARAS[2]!)[0]!;
    expect(best.name).toBe('Dialogue');
    expect(best.words).toContain('dialogue');
    // The reason is a fact about the writer's own filing, countable by them.
    expect(best.cards).toBeGreaterThanOrEqual(1);
    // A passage with nothing in common with anything scores against nothing.
    expect(scoreCategories(taught, session, 'Xyzzy plugh frobnitz.')).toEqual([]);
  });

  it('proposes only what is unsorted, a paragraph at a time, one category each', () => {
    const { file, session, source } = world();
    const cats = sortCategories(file, session);
    let next = fileParagraph(file, source.id, 1, cats.find((one) => one.name === 'Dialogue')!.id);
    next = fileParagraph(next, source.id, 0, cats.find((one) => one.name === 'Character')!.id);

    const placements = suggestPlacements(next, session);
    expect(placements.length).toBeGreaterThan(0);

    // Nothing already covered by a card is proposed again.
    const covered = coverageOf(next, source.id);
    for (const one of placements) {
      expect(covered.some((run) => one.from < run.to && one.to > run.from)).toBe(false);
    }
    // Each is a whole paragraph of the source, exactly.
    for (const one of placements) {
      expect(PARAS).toContain(PAGE.slice(one.from, one.to));
      expect(one.passage).toBe(PAGE.slice(one.from, one.to));
    }
    // One row per passage, never two.
    expect(new Set(placements.map(placementKey)).size).toBe(placements.length);
    // And the third paragraph, which is about dialogue, goes to Dialogue.
    const third = placements.find((one) => one.passage === PARAS[2]);
    expect(third?.because).toContain('Dialogue');
  });

  it('says nothing rather than guessing out loud', () => {
    const { file, session } = world();
    // A row is shown for evidence rather than for a density: two words, or one
    // that is the category's own name or that two of its cards share — and in
    // either single-word case a word no other category knows.
    expect(worthSaying({ own: 0, shared: 2, byName: false, cards: 1 } as never)).toBe(true);
    expect(worthSaying({ own: 1, shared: 1, byName: true, cards: 0 } as never)).toBe(true);
    expect(worthSaying({ own: 1, shared: 1, byName: false, cards: 2 } as never)).toBe(true);
    // One card's incidental vocabulary is an accident, not evidence: this is
    // the row the panel proposed for “revision” under Character because a card
    // there happened to contain the word “write”.
    expect(worthSaying({ own: 1, shared: 1, byName: false, cards: 1 } as never)).toBe(false);
    expect(worthSaying({ own: 0, shared: 1, byName: false, cards: 9 } as never)).toBe(false);
    for (const one of suggestPlacements(file, session)) {
      const best = scoreCategories(file, session, one.passage)[0]!;
      expect(worthSaying(best)).toBe(true);
    }
    // A paragraph about revision is not proposed for Character on the strength
    // of one card that happens to contain the word “write”.
    const character = sortCategories(file, session).find((one) => one.name === 'Character')!;
    const taught = fileParagraph(file, sourcesOf(file, session)[0]!.id, 0, character.id);
    expect(
      suggestPlacements(taught, session).some(
        (one) => one.passage === PARAS[4] && (one.categoryId as string) === (character.id as string),
      ),
    ).toBe(false);
    // A sitting with no categories has been taught nothing, and says so.
    let bare: ProjectFile = createProjectFile({ title: 'Bare', format: 'novel' });
    const begun = beginSession(bare, 's');
    bare = addSource(begun.file, {
      sessionId: begun.session.id,
      name: 'Notes',
      text: PAGE,
      kind: 'paste',
    }).file;
    expect(suggestPlacements(bare, begun.session.id)).toEqual([]);
    expect(describeSuggestions(bare, begun.session.id, [])).toContain('Make a category');
  });

  it('approving is the ordinary extraction, and the suggestion then stops being made', () => {
    const { file, session, source } = world();
    const before = suggestPlacements(file, session);
    expect(before.length).toBeGreaterThan(1);

    const taken = before[0]!;
    const done = approvePlacements(file, [taken]);
    expect(done.made).toBe(1);

    const card = sessionCards(done.file, session)[0]!;
    // Indistinguishable from a passage dragged across by hand.
    expect(card.sourceFrom).toBe(taken.from);
    expect(passageOf(done.file, card)).toBe(taken.passage);
    expect(cardsIn(done.file, taken.categoryId)).toHaveLength(1);

    // Nothing was stored, so the reading simply no longer offers it.
    const after = suggestPlacements(done.file, session);
    expect(after.some((one) => placementKey(one) === placementKey(taken))).toBe(false);
    expect(after).toHaveLength(before.length - 1);
  });

  it('approves a batch, and the whole source can be taken in one press', () => {
    const { file, session } = world();
    const all = suggestPlacements(file, session);
    const done = approvePlacements(file, all);
    expect(done.made).toBe(all.length);
    expect(sessionCards(done.file, session)).toHaveLength(all.length);
    expect(describeSuggestions(done.file, session, suggestPlacements(done.file, session)))
      .toBeTruthy();
  });

  it('proposes new groupings the notes make and no category knows', () => {
    const { file, session } = world(['Character']);
    const ideas = suggestCategories(file, session);

    // "revision" runs through three paragraphs and no category knows it.
    expect(ideas.map((one) => one.name)).toContain('Revision');
    expect(ideas.find((one) => one.name === 'Revision')!.passages).toBe(3);
    for (const one of ideas) {
      expect(one.passages).toBeGreaterThanOrEqual(3);
      expect(one.because).toContain('no category does');
      // A name, ready to stand as a heading.
      expect(one.name[0]).toBe(one.name[0]!.toUpperCase());
    }
    // "villain" runs through two, which is under the bar — the bar being the
    // whole of why the list is short enough to read.
    expect(ideas.some((one) => one.name === 'Villain')).toBe(false);
    // And a word a category already knows is a placement, not a grouping.
    expect(ideas.some((one) => one.name.toLowerCase() === 'character')).toBe(false);

    // Making it is one act and it arrives empty: nothing is reorganized.
    const made = addSortCategory(file, { sessionId: session, name: 'Revision' });
    expect(cardsIn(made.file, made.category!.id)).toHaveLength(0);
    // It stops being suggested, being a category now.
    expect(suggestCategories(made.file, session).some((one) => one.name === 'Revision')).toBe(false);
    // And the three paragraphs now propose themselves into it.
    const into = suggestPlacements(made.file, session).filter(
      (one) => (one.categoryId as string) === (made.category!.id as string),
    );
    expect(into).toHaveLength(3);
    expect(into[0]!.because).toContain('Revision is named for');
  });

  it('learns from what the writer files, and says so', () => {
    const { file, session, source } = world();
    const character = sortCategories(file, session).find((one) => one.name === 'Character')!;

    // Before: the second villain paragraph looks like nothing in particular.
    expect(suggestPlacements(file, session).some((one) => one.passage === PARAS[3])).toBe(false);

    // The writer files the first one by hand. That is the whole of the training.
    const taught = fileParagraph(file, source.id, 0, character.id);
    const now = suggestPlacements(taught, session);
    const second = now.find((one) => one.passage === PARAS[3]);
    expect(second).toBeTruthy();
    expect(second!.categoryId).toBe(character.id);
    // And the reason is their own filing, countable by them.
    expect(second!.because).toBe('1 card uses “villain”, “morning” in Character.');
    // It is the strongest thing on the list, being the only one earned by a card.
    expect(now[0]!.passage).toBe(PARAS[3]);
  });

  it('never proposes the unsorted pile, which is where cards go rather than come from', () => {
    const { file, session } = world();
    const pile = unsortedOf(file, session)!;
    expect(suggestPlacements(file, session).some((one) => (one.categoryId as string) === (pile.id as string)))
      .toBe(false);
    expect(profilesOf(file, session).some((one) => (one.categoryId as string) === (pile.id as string)))
      .toBe(false);
  });

  it('narrows to one source when asked, and stores nothing either way', () => {
    const { file, session, source } = world();
    const second = addSource(file, {
      sessionId: session,
      name: 'Second',
      text: 'Dialogue carries the scene when the dialogue is doing the work of the action.',
      kind: 'paste',
    });
    const both = suggestPlacements(second.file, session);
    const one = suggestPlacements(second.file, session, { sourceId: source.id });
    expect(both.length).toBeGreaterThan(one.length);
    expect(one.every((row) => (row.sourceId as string) === (source.id as string))).toBe(true);

    // The document is untouched by reading it: no suggestion collection anywhere.
    expect(Object.keys(second.file)).not.toContain('noteSuggestions');
    expect(sourcesOf(second.file, session)[0]!.text).toBe(PAGE);
  });
});
