import { noteSessionSchema, noteSourceSchema, type NoteSession, type NoteSource, type NoteSourceKind } from './entities/note-sorter.js';
import { researchCategorySchema, researchItemSchema, type ResearchCategory, type ResearchItem } from './entities/research.js';
import { nowIso } from './entities/common.js';
import { isInstructional, nounsFor } from './formats.js';
import { onlyLiving } from './graveyard.js';
import { newId } from './ids.js';
import { orderKeyBetween, orderKeyForIndex } from './ordering.js';
import type { NoteSessionId, NoteSourceId, ResearchCategoryId, ResearchItemId } from './ids.js';
import type { ProjectFormat } from './entities/project.js';
import type { ProjectFile } from './project-file.js';

/** The key that puts something after everything already in a list. */
const afterAll = (rows: readonly { orderKey: string }[]): string => {
  const last = [...rows].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1)).at(-1);
  return orderKeyBetween(last ? last.orderKey : null, null);
};

/**
 * The Note Sorter (addendum 26), from Ken's own dev spec and UI handoff:
 * *read, highlight, drag, drop*, and nothing else the writer has to do.
 *
 * Four rules hold the module up, and three of them are this project's oldest.
 *
 * **The source is immutable and sorting never touches it** (§6). Extracting
 * records a range; it does not cut, mark or move a character of the original.
 * *Show original source* is therefore a read rather than a reconstruction,
 * which is the only version of that promise a module can actually keep.
 *
 * **Processed is a reading** (§7). Nothing anywhere stores *this passage has
 * been sorted*: `coverageOf` counts it back from the notes' ranges every time,
 * so deleting a card un-greys its passage with nothing run, and *Grey* and
 * *Hide* are view settings that cannot drift from the truth because there is
 * no second copy of it. The same reading answers §11's progress bar, which is
 * why the bar cannot disagree with the page.
 *
 * **The range is the lineage and the words are the writer's.** A card's
 * `title` and `body` are its working title and working text, editable and
 * never written back; what the page said is `text.slice(from, to)` read off
 * the immutable source. §19 asks for a stored `extractedText` snapshot beside
 * the range, and with an immutable source that snapshot can only ever agree
 * with the slice or be wrong about it.
 *
 * And **a card is a research item** (§1's audit), so §17's *a note may become
 * or attach to* anything needs no machinery: `research_item` has been a story
 * entity type since the links table was built.
 */

// ---------------------------------------------------------------- the shelf

/**
 * The research folders proper — the ones a writer filed something in, rather
 * than a sitting's working categories (§2).
 *
 * There is deliberately **no `shelfCategories` of this module's own**: the shelf
 * belongs to research, so `researchCategoriesInOrder` carries the predicate and
 * the sorter asks it, exactly as every other reading in the program does. The
 * graveyard learned this the expensive way over five modules (addendum 24 §5j)
 * — a predicate every screen applies privately is one that five screens go on
 * applying after the module has changed its mind — and a second name for one
 * reading is the first step to a second answer.
 */

/**
 * The mark on a sitting's **unsorted pile** — where a deleted category's cards
 * land.
 *
 * The handoff says it in the menu: *Delete (cards return to unsorted)*, and a
 * card has to have a home, so *unsorted* is a real category rather than a null.
 * It is marked with a `systemKey` rather than by its name, which is how the
 * research shelf has told its own folders apart since it was built — a pile
 * found by matching the word *Unsorted* would be lost the moment anybody
 * renamed it, and would be found by accident in a folder somebody else called
 * that.
 */
export const UNSORTED_KEY = 'note_unsorted';

/** The categories of one sitting, in the writer's order, the pile last. */
export const sessionCategories = (
  file: ProjectFile,
  sessionId: NoteSessionId,
): ResearchCategory[] => {
  const mine = file.researchCategories
    .filter((one) => (one.sessionId as string | null) === (sessionId as string) && !one.archived)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  // The pile is not one of the writer's categories and does not stand among
  // them; it is where things go that are in none.
  return [
    ...mine.filter((one) => one.systemKey !== UNSORTED_KEY),
    ...mine.filter((one) => one.systemKey === UNSORTED_KEY),
  ];
};

/**
 * The categories a passage may be dropped into: **the writer's own, never the
 * pile** (§8).
 *
 * One reading, before the first surface rather than after the fifth — the
 * graveyard's lesson (addendum 24 §5j). Every screen that offers a target and
 * the send that walks them all ask this, so none of them can start filing
 * things into the pile the pile exists to empty.
 */
export const sortCategories = (
  file: ProjectFile,
  sessionId: NoteSessionId,
): ResearchCategory[] =>
  sessionCategories(file, sessionId).filter((one) => one.systemKey !== UNSORTED_KEY);

/** A sitting's unsorted pile. */
export const unsortedOf = (
  file: ProjectFile,
  sessionId: NoteSessionId,
): ResearchCategory | null =>
  sessionCategories(file, sessionId).find((one) => one.systemKey === UNSORTED_KEY) ?? null;

/** The sittings this project has, newest last. */
export const sortingSessions = (file: ProjectFile): NoteSession[] =>
  file.noteSessions
    .filter((one) => !one.archived)
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));

/** The sources of one sitting, in the order they were added. */
export const sourcesOf = (file: ProjectFile, sessionId: NoteSessionId): NoteSource[] =>
  file.noteSources
    .filter((one) => (one.sessionId as string) === (sessionId as string))
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));

/** Every card of one sitting: the living research items in its categories. */
export const sessionCards = (file: ProjectFile, sessionId: NoteSessionId): ResearchItem[] => {
  const mine = new Set(sessionCategories(file, sessionId).map((one) => one.id as string));
  return onlyLiving(file.researchItems)
    .filter((one) => mine.has(one.categoryId as string))
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
};

/**
 * The cards filed in one category, in the writer's order — **its home cards
 * and the ones referenced into it** (§10).
 *
 * A reference is not a copy: the same record appears in a second list, so
 * editing it in either place is editing the one card, and taking the reference
 * away leaves the card at home.
 */
export const cardsIn = (file: ProjectFile, categoryId: ResearchCategoryId): ResearchItem[] =>
  onlyLiving(file.researchItems)
    .filter(
      (one) =>
        (one.categoryId as string) === (categoryId as string) ||
        one.alsoIn.some((ref) => (ref as string) === (categoryId as string)),
    )
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));

// ----------------------------------------------------------- what is sorted

/** A stretch of a source that some card has taken. */
export interface SortedRun {
  from: number;
  to: number;
}

/**
 * Which stretches of a source have been sorted, merged and in order (§7).
 *
 * **Counted, never stored.** Two cards taken from overlapping passages make
 * one run rather than two, because the question the screen asks is *is this
 * character dealt with* and a character covered twice is covered once.
 */
export const coverageOf = (file: ProjectFile, sourceId: NoteSourceId): SortedRun[] => {
  const runs = onlyLiving(file.researchItems)
    .filter(
      (one) =>
        (one.sourceId as string | null) === (sourceId as string) &&
        one.sourceFrom !== null &&
        one.sourceTo !== null &&
        one.sourceTo > one.sourceFrom,
    )
    .map((one) => ({ from: one.sourceFrom as number, to: one.sourceTo as number }))
    .sort((a, b) => a.from - b.from);

  const merged: SortedRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && run.from <= last.to) last.to = Math.max(last.to, run.to);
    else merged.push({ ...run });
  }
  return merged;
};

/** What a source looks like broken into sorted and unsorted stretches. */
export interface SourcePiece extends SortedRun {
  text: string;
  sorted: boolean;
}

/**
 * A source cut into its sorted and unsorted stretches, in order (§7).
 *
 * This is what the left panel draws: the whole text, every character of it,
 * with each piece saying whether it has been dealt with. **The display modes
 * are the screen's business** — greying, hiding and *unsorted only* all read
 * this one list, so they cannot disagree about what is sorted and none of them
 * changes a character of the source.
 */
export const piecesOf = (file: ProjectFile, source: NoteSource): SourcePiece[] => {
  const runs = coverageOf(file, source.id);
  const pieces: SourcePiece[] = [];
  let at = 0;
  for (const run of runs) {
    const from = Math.min(run.from, source.text.length);
    const to = Math.min(run.to, source.text.length);
    if (from > at) pieces.push({ from: at, to: from, text: source.text.slice(at, from), sorted: false });
    if (to > from) pieces.push({ from, to, text: source.text.slice(from, to), sorted: true });
    at = Math.max(at, to);
  }
  if (at < source.text.length) {
    pieces.push({ from: at, to: source.text.length, text: source.text.slice(at), sorted: false });
  }
  return pieces;
};

/** How much of a source has been dealt with, as characters and a share. */
export interface SortProgress {
  total: number;
  sorted: number;
  /** 0 to 1. An empty source reads as 0 rather than as finished. */
  share: number;
}

export const progressOf = (file: ProjectFile, source: NoteSource): SortProgress => {
  const total = source.text.length;
  const sorted = coverageOf(file, source.id).reduce((sum, run) => sum + (run.to - run.from), 0);
  return { total, sorted, share: total === 0 ? 0 : Math.min(1, sorted / total) };
};

/**
 * How much of the whole sitting has been dealt with (§11).
 *
 * **It is progress and not a score**, which is the spec's own caveat and
 * decides the wording: the screen says *58% dealt with*, never *58% done* and
 * never a grade. What it answers is the practical question — *have I been
 * through all of this* — and nothing follows from the number on its own.
 */
export const sessionProgress = (file: ProjectFile, sessionId: NoteSessionId): SortProgress => {
  const sources = sourcesOf(file, sessionId);
  const total = sources.reduce((sum, one) => sum + one.text.length, 0);
  const sorted = sources.reduce((sum, one) => sum + progressOf(file, one).sorted, 0);
  return { total, sorted, share: total === 0 ? 0 : Math.min(1, sorted / total) };
};

/** What the page said where a card was taken from — read, never stored. */
export const passageOf = (file: ProjectFile, card: ResearchItem): string => {
  if (card.sourceId === null || card.sourceFrom === null || card.sourceTo === null) return '';
  const source = file.noteSources.find((one) => (one.id as string) === (card.sourceId as string));
  return source ? source.text.slice(card.sourceFrom, card.sourceTo) : '';
};

/** Where a card came from, said in a line: *Brainstorm ¶3*. */
export const whereFrom = (file: ProjectFile, card: ResearchItem): string => {
  if (card.sourceId === null || card.sourceFrom === null) return '';
  const source = file.noteSources.find((one) => (one.id as string) === (card.sourceId as string));
  if (!source) return 'Source gone';
  // Which paragraph of the source it starts in: the blank lines before it.
  const before = source.text.slice(0, card.sourceFrom);
  const paragraph = before.split(/\n\s*\n/).length;
  return `${source.name} ¶${paragraph}`;
};

// --------------------------------------------------- what a sitting opens with

/** A category a sitting is handed, before the writer has made any (§16a). */
export interface SeedCategory {
  readonly name: string;
  readonly color: string;
  /** Where a note of this kind ends up, said on the screen. */
  readonly description: string;
}

/**
 * The standard categories a sitting opens with (§16a, from Ken: *I would like
 * the note sorter to have categories set up and then you can add categories,
 * but there needs to be a character setting dialogue. theme idea set up and
 * payoff scene beat and other standard categories for storytelling*).
 *
 * Three rules decide the list, and the first is the one that makes it more
 * than a guess at what writers write about.
 *
 * **Every seed names something the program already has somewhere to put.**
 * Character is the Character Creator's, Setting is Locations', Theme is Themes
 * & Motifs', Setup & payoff is that module's, Plot is a track, Idea is the
 * Ideas shelf, Research is the shelf and its `source` — so a category here is
 * the first half of a journey the rest of the program finishes, rather than a
 * taxonomy invented for one room. **Dialogue is the one exception and it is
 * Ken's**, dialogue being a thing writers keep notes about with no record of
 * its own; it earns its place by being asked for.
 *
 * **Nothing names a unit itself** (addendum 16 §6c): the two structural seeds
 * read `nounsFor`, so a screenplay is handed *Scene* and *Beat*, a novel
 * *Chapter* and *Passage*, and a textbook *Section* and *Subsection*.
 *
 * And **absent rather than renamed where a format has none**. A textbook has
 * no cast, no locations, no cues and no setups, so it is handed none of them —
 * the research menu's own rule (addendum 16 §6a), which is why the list is
 * built per format rather than translated.
 *
 * They arrive **empty**, which costs nothing: the room draws a category with
 * nothing filed in it as a chip, so a fresh sitting is a row of chips rather
 * than ten empty stacks, and `scoreCategories` is taught by a category's own
 * name — so the suggestion panel has something to say before a writer has
 * filed anything by hand, which is the half of §14 that otherwise waits.
 */
export const seedCategoriesFor = (format: ProjectFormat): readonly SeedCategory[] => {
  const nouns = nounsFor(format);
  const structure: readonly SeedCategory[] = [
    { name: nouns.unit, color: '#8FA8C4', description: `A note about one ${nouns.unit.toLowerCase()}.` },
    { name: nouns.sub, color: '#6CC4D6', description: `A note about one ${nouns.sub.toLowerCase()}.` },
  ];
  const everywhere: readonly SeedCategory[] = [
    { name: 'Theme', color: '#9A7FC0', description: 'What the work is arguing. Themes & Motifs keeps these.' },
    { name: 'Idea', color: '#C9A45C', description: 'Anything that is not yet anything else.' },
    { name: 'Research', color: '#9C8F6D', description: 'Something looked up. The research shelf keeps these.' },
  ];
  if (isInstructional(format)) {
    return [
      { name: 'Concept', color: '#D9607A', description: 'Something the book teaches.' },
      { name: 'Example', color: '#E08A5A', description: 'A worked case that shows a concept.' },
      { name: 'Figure', color: '#6FAE5E', description: 'A picture, a diagram or a table. The graphics library keeps these.' },
      ...structure,
      ...everywhere,
    ];
  }
  return [
    { name: 'Character', color: '#D9607A', description: 'Somebody in the story. The Character Creator keeps these.' },
    { name: 'Setting', color: '#4FA39A', description: 'Somewhere it happens. Locations keeps these.' },
    { name: 'Dialogue', color: '#E08A5A', description: 'How somebody talks, or a line worth keeping.' },
    { name: 'Plot', color: '#B98A4A', description: 'What happens, and in what order. A track carries one.' },
    ...structure,
    { name: 'Setup & payoff', color: '#6FAE5E', description: 'A promise and the keeping of it. Setups & Payoffs keeps these.' },
    ...everywhere,
  ];
};

// ------------------------------------------------------------------ the acts

/**
 * Start a sitting, **with its unsorted pile** (§8).
 *
 * The pile is seeded here rather than made when it is first needed, because the
 * thing that needs it is a *delete*: a writer pressing × on a category is at
 * the worst moment to discover that the place their cards were going to has to
 * be created first. `beginSession` is the only way a sitting exists, so every
 * sitting has one by construction and `unsortedOf` never has to guess.
 */
export const beginSession = (
  file: ProjectFile,
  name: string,
): { file: ProjectFile; session: NoteSession } => {
  const at = nowIso();
  const session = noteSessionSchema.parse({
    id: newId<NoteSessionId>(),
    projectId: file.project.id,
    name: name.trim() || 'Note sorting',
    orderKey: afterAll(file.noteSessions),
    createdAt: at,
    updatedAt: at,
  });
  const pile = researchCategorySchema.parse({
    id: newId<ResearchCategoryId>(),
    projectId: file.project.id,
    name: 'Unsorted',
    systemKey: UNSORTED_KEY,
    parentId: null,
    sessionId: session.id,
    orderKey: 'm',
    createdAt: at,
    updatedAt: at,
  });
  // The standard categories (§16a). They are seeded here for the pile's own
  // reason: a writer opening the room wants somewhere to drop the first
  // passage, and a screen that asks them to invent a taxonomy before they may
  // sort anything is the one this module exists to replace.
  const seeds: ResearchCategory[] = [];
  for (const seed of seedCategoriesFor(file.project.format)) {
    seeds.push(
      researchCategorySchema.parse({
        id: newId<ResearchCategoryId>(),
        projectId: file.project.id,
        name: seed.name,
        description: seed.description,
        color: seed.color,
        systemKey: null,
        parentId: null,
        sessionId: session.id,
        orderKey: afterAll(seeds),
        createdAt: at,
        updatedAt: at,
      }),
    );
  }
  return {
    file: {
      ...file,
      noteSessions: [...file.noteSessions, session],
      researchCategories: [...file.researchCategories, ...seeds, pile],
    },
    session,
  };
};

/**
 * Put material into a sitting (§3).
 *
 * The host turns a file into text — `docxToProse`, `textToProse` and the PDF
 * reader have done that since addendum 21 — and this only writes it down.
 * **Nothing here reads a file**, which is the same split that module drew: the
 * host deals in bytes and the domain deals in a string it can be tested with.
 */
export const addSource = (
  file: ProjectFile,
  input: {
    sessionId: NoteSessionId;
    name: string;
    text: string;
    kind?: NoteSourceKind;
    fileName?: string;
  },
): { file: ProjectFile; source: NoteSource | null } => {
  const name = input.name.trim();
  if (name.length === 0) return { file, source: null };
  const at = nowIso();
  const source = noteSourceSchema.parse({
    id: newId<NoteSourceId>(),
    projectId: file.project.id,
    sessionId: input.sessionId,
    name,
    kind: input.kind ?? 'typed',
    text: input.text,
    fileName: input.fileName ?? '',
    importedAt: at,
    orderKey: afterAll(sourcesOf(file, input.sessionId)),
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, noteSources: [...file.noteSources, source] }, source };
};

/**
 * Make a category in a sitting, optionally inside another (§8).
 *
 * **It is *this one, or a new one by this name*** — a name the sitting already
 * has under the same parent gives back the category that has it rather than a
 * rival beside it. Addendum 24 §5n settled where that check belongs: in the
 * **act**, wherever a single act means both, so no caller can forget it; and
 * §16a made it necessary rather than merely tidy, because a sitting now opens
 * with ten categories and *Character* is one of them, so a writer typing it
 * would otherwise get an empty Character next to the full one and nothing in
 * the room able to tell them apart — the suggestion engine least of all, since
 * it is taught by the name.
 *
 * Case and surrounding space are ignored, a writer typing from memory not
 * being promising to match capitals (§5m's rule).
 */
export const addSortCategory = (
  file: ProjectFile,
  input: {
    sessionId: NoteSessionId;
    name: string;
    parentId?: ResearchCategoryId | null;
    color?: string | null;
  },
): { file: ProjectFile; category: ResearchCategory | null } => {
  const name = input.name.trim();
  if (name.length === 0) return { file, category: null };
  const parentId = (input.parentId ?? null) as string | null;
  const already = sessionCategories(file, input.sessionId).find(
    (one) =>
      one.name.trim().toLowerCase() === name.toLowerCase() &&
      ((one.parentId ?? null) as string | null) === parentId,
  );
  if (already) return { file, category: already };
  const at = nowIso();
  const category = researchCategorySchema.parse({
    id: newId<ResearchCategoryId>(),
    projectId: file.project.id,
    name,
    systemKey: null,
    parentId: input.parentId ?? null,
    color: input.color ?? null,
    sessionId: input.sessionId,
    orderKey: afterAll(sessionCategories(file, input.sessionId)),
    createdAt: at,
    updatedAt: at,
  });
  return {
    file: { ...file, researchCategories: [...file.researchCategories, category] },
    category,
  };
};

/**
 * What the drop would make, said before it is asked for.
 *
 * `trackRemoval`'s shape: a refusal a writer can act on, or the sentence of
 * what a press would do. The act refuses the same things again, so a caller
 * cannot get past the reading by not reading it.
 */
export interface ExtractOffer {
  can: boolean;
  /** The refusal, or what the drop will do. */
  says: string;
  /** What the card would be called. */
  title: string;
}

/** The first few words, which is what a card is called until it is renamed. */
export const titleFrom = (passage: string): string => {
  const words = passage.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const short = words.slice(0, 7).join(' ');
  return words.length > 7 ? `${short}…` : short;
};

export const extractOffer = (
  file: ProjectFile,
  input: { sourceId: NoteSourceId; from: number; to: number; categoryId: ResearchCategoryId },
): ExtractOffer => {
  const source = file.noteSources.find((one) => (one.id as string) === (input.sourceId as string));
  if (!source) return { can: false, says: 'That source is not in this session.', title: '' };
  const from = Math.max(0, Math.min(input.from, input.to));
  const to = Math.min(source.text.length, Math.max(input.from, input.to));
  const passage = source.text.slice(from, to);
  if (passage.trim().length === 0) {
    return { can: false, says: 'Highlight some words first.', title: '' };
  }
  const category = file.researchCategories.find(
    (one) => (one.id as string) === (input.categoryId as string),
  );
  if (!category) return { can: false, says: 'That category is not there.', title: '' };
  const title = titleFrom(passage);
  return { can: true, says: `A card in ${category.name}, called “${title}”.`, title };
};

/**
 * Drag a passage onto a category and get a card (§5).
 *
 * **No dialog**, which the handoff asks for by name: the card is made at once
 * with its title taken from the first few words, and renaming it is Refine's
 * business. A writer sorting twenty pages cannot be asked to name each one on
 * the way past.
 *
 * Nothing is cut from the source. The passage goes on standing exactly where
 * it stood; what the card holds is the range it covers and a working copy of
 * the words, which the writer may then edit without the source moving.
 */
export const extractToCategory = (
  file: ProjectFile,
  input: { sourceId: NoteSourceId; from: number; to: number; categoryId: ResearchCategoryId },
): { file: ProjectFile; card: ResearchItem | null } => {
  const offer = extractOffer(file, input);
  if (!offer.can) return { file, card: null };
  const source = file.noteSources.find((one) => (one.id as string) === (input.sourceId as string))!;
  const from = Math.max(0, Math.min(input.from, input.to));
  const to = Math.min(source.text.length, Math.max(input.from, input.to));
  const at = nowIso();
  const card = researchItemSchema.parse({
    id: newId<ResearchItemId>(),
    projectId: file.project.id,
    categoryId: input.categoryId,
    title: offer.title,
    // The working text starts as what the page said and is the writer's from
    // here: editing it never reaches the source.
    body: source.text.slice(from, to),
    sourceId: source.id,
    sourceFrom: from,
    sourceTo: to,
    origin: 'import',
    orderKey: afterAll(cardsIn(file, input.categoryId)),
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, researchItems: [...file.researchItems, card] }, card };
};

/** Move a card to another category, keeping its lineage (§10). */
export const moveCard = (
  file: ProjectFile,
  cardId: ResearchItemId,
  categoryId: ResearchCategoryId,
): ProjectFile => ({
  ...file,
  researchItems: file.researchItems.map((one) =>
    (one.id as string) === (cardId as string)
      ? {
          ...one,
          categoryId,
          // A card cannot be referenced into the category it now lives in.
          alsoIn: one.alsoIn.filter((ref) => (ref as string) !== (categoryId as string)),
          orderKey: afterAll(cardsIn(file, categoryId)),
          updatedAt: nowIso(),
        }
      : one,
  ),
});

/** Put a card at a place in its category's order (§9). */
export const placeCard = (
  file: ProjectFile,
  cardId: ResearchItemId,
  categoryId: ResearchCategoryId,
  index: number,
): ProjectFile => {
  const siblings = cardsIn(file, categoryId).filter((one) => (one.id as string) !== (cardId as string));
  const key = orderKeyForIndex(siblings, Math.max(0, Math.min(index, siblings.length)));
  return {
    ...file,
    researchItems: file.researchItems.map((one) =>
      (one.id as string) === (cardId as string)
        ? { ...one, categoryId, orderKey: key, updatedAt: nowIso() }
        : one,
    ),
  };
};

/**
 * Show the same card in another category as well (§10's *Reference*).
 *
 * **It copies nothing.** The card keeps one home and one set of words; this
 * says it also belongs on a second list. The alternative — a duplicate record
 * — would be two answers to what the note says the moment either is edited.
 */
export const referenceCard = (
  file: ProjectFile,
  cardId: ResearchItemId,
  categoryId: ResearchCategoryId,
): ProjectFile => ({
  ...file,
  researchItems: file.researchItems.map((one) => {
    if ((one.id as string) !== (cardId as string)) return one;
    if ((one.categoryId as string) === (categoryId as string)) return one;
    if (one.alsoIn.some((ref) => (ref as string) === (categoryId as string))) return one;
    return { ...one, alsoIn: [...one.alsoIn, categoryId], updatedAt: nowIso() };
  }),
});

export const unreferenceCard = (
  file: ProjectFile,
  cardId: ResearchItemId,
  categoryId: ResearchCategoryId,
): ProjectFile => ({
  ...file,
  researchItems: file.researchItems.map((one) =>
    (one.id as string) === (cardId as string)
      ? {
          ...one,
          alsoIn: one.alsoIn.filter((ref) => (ref as string) !== (categoryId as string)),
          updatedAt: nowIso(),
        }
      : one,
  ),
});

/**
 * Cut a card in two at a point in its working text (§10).
 *
 * **Both halves keep the source link.** The range is split in proportion where
 * the working text still matches the passage, and where the writer has rewritten
 * it both halves simply carry the whole original range — which is honest: the
 * lineage is *this came out of that stretch*, and a rewritten note came out of
 * all of it.
 */
export const splitCard = (
  file: ProjectFile,
  cardId: ResearchItemId,
  at: number,
): { file: ProjectFile; made: ResearchItem | null } => {
  const card = file.researchItems.find((one) => (one.id as string) === (cardId as string));
  if (!card) return { file, made: null };
  const head = card.body.slice(0, at).trim();
  const tail = card.body.slice(at).trim();
  if (head.length === 0 || tail.length === 0) return { file, made: null };

  const when = nowIso();
  const untouched = card.sourceFrom !== null && card.sourceTo !== null &&
    card.body.length === card.sourceTo - card.sourceFrom;
  const cut = untouched ? (card.sourceFrom as number) + at : null;

  const made = researchItemSchema.parse({
    id: newId<ResearchItemId>(),
    projectId: file.project.id,
    categoryId: card.categoryId,
    title: titleFrom(tail),
    body: tail,
    tags: card.tags,
    sourceId: card.sourceId,
    sourceFrom: cut ?? card.sourceFrom,
    sourceTo: card.sourceTo,
    alsoIn: card.alsoIn,
    origin: card.origin,
    orderKey: afterAll(cardsIn(file, card.categoryId)),
    createdAt: when,
    updatedAt: when,
  });

  return {
    file: {
      ...file,
      researchItems: [
        ...file.researchItems.map((one) =>
          (one.id as string) === (cardId as string)
            ? { ...one, body: head, sourceTo: cut ?? one.sourceTo, updatedAt: when }
            : one,
        ),
        made,
      ],
    },
    made,
  };
};

/**
 * Join several cards into one (§10).
 *
 * The survivor keeps the **widest** range of the cards that came from one
 * source, and the rest are buried rather than destroyed — the graveyard's
 * promise (addendum 24 §2), so a merge nobody meant is undone by restoring.
 * Undo takes it back anyway; this is the belt beside the braces.
 */
export const mergeCards = (
  file: ProjectFile,
  cardIds: readonly ResearchItemId[],
): { file: ProjectFile; card: ResearchItem | null } => {
  const wanted = cardIds.map((one) => one as string);
  const cards = onlyLiving(file.researchItems).filter((one) => wanted.includes(one.id as string));
  if (cards.length < 2) return { file, card: null };

  const keep = cards[0]!;
  const rest = cards.slice(1);
  const sameSource = cards.every(
    (one) => one.sourceId !== null && (one.sourceId as string) === (keep.sourceId as string),
  );
  const froms = cards.map((one) => one.sourceFrom).filter((n): n is number => n !== null);
  const tos = cards.map((one) => one.sourceTo).filter((n): n is number => n !== null);

  const when = nowIso();
  const joined = {
    ...keep,
    body: cards.map((one) => one.body.trim()).filter(Boolean).join('\n\n'),
    tags: [...new Set(cards.flatMap((one) => one.tags))],
    sourceFrom: sameSource && froms.length > 0 ? Math.min(...froms) : keep.sourceFrom,
    sourceTo: sameSource && tos.length > 0 ? Math.max(...tos) : keep.sourceTo,
    updatedAt: when,
  };

  const gone = new Set(rest.map((one) => one.id as string));
  return {
    file: {
      ...file,
      researchItems: file.researchItems.map((one) => {
        if ((one.id as string) === (keep.id as string)) return joined;
        if (gone.has(one.id as string)) return { ...one, deletedAt: when, updatedAt: when };
        return one;
      }),
    },
    card: joined,
  };
};

/**
 * Take a sorting category away (§8), **and its cards go back to unsorted**.
 *
 * The handoff says it in the menu — *Delete (cards return to unsorted)* — and
 * it is the module's own promise read from the other end: nothing about
 * sorting may lose writing. The cards keep every range they carry, so the
 * source's grey does not move; they are simply unfiled.
 */
export const removeSortCategory = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  unsortedId: ResearchCategoryId,
): ProjectFile => {
  // The pile is not the writer's category and is where the others' cards go, so
  // taking it away would be taking away the promise. Refused here as well as
  // absent on the screen: a caller cannot get past a reading by not reading it.
  const going = file.researchCategories.find((one) => (one.id as string) === (categoryId as string));
  if (!going || going.systemKey === UNSORTED_KEY) return file;
  const when = nowIso();
  return {
    ...file,
    researchCategories: file.researchCategories.filter(
      (one) => (one.id as string) !== (categoryId as string),
    ),
    researchItems: file.researchItems.map((one) => {
      const home = (one.categoryId as string) === (categoryId as string);
      const referenced = one.alsoIn.some((ref) => (ref as string) === (categoryId as string));
      if (!home && !referenced) return one;
      return {
        ...one,
        categoryId: home ? unsortedId : one.categoryId,
        alsoIn: one.alsoIn.filter((ref) => (ref as string) !== (categoryId as string)),
        updatedAt: when,
      };
    }),
  };
};

/**
 * What a writer is told before they press Delete — or **Merge into…**, which is
 * the same act with a different target (§8).
 *
 * That is worth saying rather than building twice: `removeSortCategory` takes
 * *where the cards go*, so Delete sends them to the pile and Merge sends them to
 * the category the writer picked, and there is one act with one parameter rather
 * than two functions that must agree about what happens to the writing.
 */
export const categoryRemoval = (
  file: ProjectFile,
  categoryId: ResearchCategoryId,
  intoId?: ResearchCategoryId,
): string => {
  const going = file.researchCategories.find((one) => (one.id as string) === (categoryId as string));
  if (going?.systemKey === UNSORTED_KEY) {
    return 'This is where a deleted category’s cards land, so it stays.';
  }
  const into = intoId
    ? file.researchCategories.find((one) => (one.id as string) === (intoId as string))
    : null;
  const where = into ? into.name : 'unsorted';
  const held = cardsIn(file, categoryId).filter(
    (one) => (one.categoryId as string) === (categoryId as string),
  ).length;
  if (held === 0) return 'Nothing is filed here. The category goes and nothing else changes.';
  const many = held === 1 ? '1 card goes' : `${held} cards go`;
  return `${many} to ${where}. Not a word is lost, and the source is untouched.`;
};

// -------------------------------------------------------------- the search

export interface SorterHit {
  kind: 'source' | 'card';
  id: string;
  /** What to show in the list. */
  label: string;
  /** The words around the match. */
  context: string;
}

/**
 * Search every source and every card of a sitting (§12).
 *
 * **Both halves, because the ask is both halves**: a writer who searches
 * *monologue* wants the passages they have already sorted *and* the ones still
 * sitting in the raw notes, and a search that answered only one of those would
 * send them looking twice.
 */
export const searchSession = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  query: string,
): SorterHit[] => {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const hits: SorterHit[] = [];

  for (const source of sourcesOf(file, sessionId)) {
    const at = source.text.toLowerCase().indexOf(needle);
    if (at < 0) continue;
    hits.push({
      kind: 'source',
      id: source.id as string,
      label: source.name,
      context: source.text.slice(Math.max(0, at - 40), at + needle.length + 40).trim(),
    });
  }

  for (const card of sessionCards(file, sessionId)) {
    const hay = `${card.title}\n${card.body}`.toLowerCase();
    const at = hay.indexOf(needle);
    if (at < 0) continue;
    hits.push({
      kind: 'card',
      id: card.id as string,
      label: card.title,
      context: card.body.slice(0, 120),
    });
  }
  return hits;
};
