import { z } from 'zod';
import { extractToCategory, piecesOf, sortCategories, sourcesOf, titleFrom, cardsIn } from './note-sorter.js';
import type { NoteSessionId, NoteSourceId, ResearchCategoryId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Auto-sort suggestions (addendum 26 §14), from spec §15's *Optional AI
 * Assistance*: **Suggest Categories**, **Suggest Destination** and
 * **Auto-Sort Suggestions**, with the spec's own caveat — *the writer remains
 * in control; AI should not silently reorganize source material.*
 *
 * **All three are one scorer, and the scorer is a reading rather than a model
 * call.** That is the decision the stage rests on, and the argument for it is
 * not thrift: for *this* question the writer has already given the answer.
 * Asking a model *which of these six categories does this paragraph belong in*
 * gets general knowledge about the words; asking the sitting gets **what this
 * writer did with these categories half an hour ago** — they made *Dialogue*
 * and filed three passages in it, and the fourth passage that talks the same
 * way belongs there because of those three. A model cannot see that and a
 * reading cannot see anything else.
 *
 * Four things follow, and each is one this project has paid for before.
 *
 * **It says why, in something a writer can check.** *3 cards in Dialogue use
 * “dialogue”, “speed”* is a fact about their own filing; a category named with
 * no reason is what makes a suggestion panel get switched off after the second
 * wrong guess (the narrative validator's *not crying wolf*, addendum 18 stage
 * 3).
 *
 * **Nothing is stored, so nothing moves until you approve is true by
 * construction** rather than by care. There is no suggestion record to write,
 * approve or clean up: extracting the passage takes it out of the unsorted
 * stretches and it stops being suggested with nothing run — `coverageOf`'s own
 * rule (§4) one layer up.
 *
 * **It is testable rather than merely demonstrable** (addendum 09 §4), which a
 * model call is not: every rule below is pinned by a test that says what was
 * suggested and why.
 *
 * And **it costs nothing and needs no account**, so there is no cap to hit, no
 * meter to read and no network to be without — which for a panel a writer
 * leaves switched on through a whole afternoon of sorting is the difference
 * between a feature and a bill.
 */

/**
 * Words that say nothing about what a passage is about.
 *
 * **Deliberately short.** A long list is a second set of editorial judgements
 * hidden in a constant, and the scorer already ignores a term that appears
 * everywhere — a word in every category tells the categories apart no better
 * than *the* does, and is dropped for that reason rather than for being on a
 * list. What is here is the closed class of English: the words that carry
 * grammar rather than subject.
 */
const NOISE = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did', 'done',
  'have', 'has', 'had', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'into', 'over', 'under',
  'out', 'up', 'down', 'off', 'as', 'so', 'not', 'no', 'nor', 'only', 'very', 'just', 'more',
  'most', 'much', 'many', 'some', 'any', 'all', 'both', 'each', 'other', 'such', 'own', 'same',
  'it', 'its', 'he', 'him', 'his', 'she', 'her', 'hers', 'they', 'them', 'their', 'we', 'us',
  'our', 'you', 'your', 'i', 'me', 'my', 'who', 'whom', 'whose', 'which', 'what', 'when',
  'where', 'why', 'how', 'there', 'here', 'been', 'because', 'while', 'after', 'before',
  'one', 'two', 'three', 'get', 'got', 'go', 'goes', 'went', 'make', 'makes', 'made',
  'thing', 'things', 'way', 'ways', 'like', 'also', 'even', 'still', 'never', 'always',
]);

/** The shortest a word may be and still mean something. */
const SHORTEST = 4;

/**
 * The words of a passage, lowercased, once each.
 *
 * **Once each**, because a paragraph that says *dialogue* nine times is about
 * dialogue exactly as much as one that says it twice: counting repetition
 * would let one long card drown out five short ones in the same category.
 */
export const termsOf = (text: string): Set<string> => {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9’']+/)) {
    const word = raw.replace(/['’]s$/, '');
    if (word.length < SHORTEST || NOISE.has(word)) continue;
    out.add(word);
  }
  return out;
};

/** What a category has been taught: each of its terms, and by how many cards. */
export interface CategoryProfile {
  categoryId: ResearchCategoryId;
  name: string;
  /** How many cards are filed here. */
  cards: number;
  /** Term → how many of its **cards** use it. The name is not a card. */
  terms: Map<string, number>;
  /**
   * The words of its own name, kept apart from its cards' (§14).
   *
   * They have to be apart or the panel says *1 card in Dialogue use
   * “dialogue”* about a category nothing is filed in — a sentence that is
   * ungrammatical and, worse, false: it is the writer's own naming, and saying
   * so is what makes the row checkable.
   */
  named: Set<string>;
}

/**
 * What each of the sitting's categories has been taught by what is filed in it.
 *
 * **The name counts as one card's worth**, because a writer who makes a
 * category called *Dialogue* and files nothing in it has still said the most
 * useful thing about it — and without this the panel is silent until somebody
 * has done by hand exactly the work it exists to save.
 */
export const profilesOf = (file: ProjectFile, sessionId: NoteSessionId): CategoryProfile[] =>
  sortCategories(file, sessionId).map((category) => {
    const terms = new Map<string, number>();
    const cards = cardsIn(file, category.id);
    for (const card of cards) {
      for (const term of termsOf(`${card.title}\n${card.body}`)) {
        terms.set(term, (terms.get(term) ?? 0) + 1);
      }
    }
    return {
      categoryId: category.id,
      name: category.name,
      cards: cards.length,
      terms,
      named: termsOf(category.name),
    };
  });

/** How well a passage matches one category, and the words that say so. */
export interface Score {
  categoryId: ResearchCategoryId;
  name: string;
  /**
   * 0 to 1, and **nothing is drawn from it but the order**.
   *
   * It is a density — matched words against the passage's own length — which
   * is right for ranking and wrong for a threshold, since the same evidence
   * scores lower in a longer paragraph. What decides whether a row is shown at
   * all is `worthSaying`, which counts evidence rather than measuring it.
   */
  strength: number;
  /** The terms that earned it, strongest first. */
  words: string[];
  /** How many of the matched terms **no other category** knows. */
  own: number;
  /** How many matched terms in all. */
  shared: number;
  /** How many of this category's own cards use the best term. */
  cards: number;
  /** Whether its own name is one of the words that matched. */
  byName: boolean;
}

/**
 * Score a passage against every category of the sitting (spec §15's **Suggest
 * Destination**, and the engine under the other two).
 *
 * A term is worth more where it is **common inside one category and rare
 * across the rest** — the oldest idea in retrieval, and here it does something
 * specific: it stops a word the writer uses everywhere (*scene*, in a book
 * about writing scenes) from putting every passage in whichever category
 * happens to hold the most cards.
 */
export const scoreCategories = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  passage: string,
): Score[] => {
  const profiles = profilesOf(file, sessionId);
  if (profiles.length === 0) return [];
  const terms = termsOf(passage);
  if (terms.size === 0) return [];

  /** How many categories know each term at all, by name or by a card. */
  const spread = new Map<string, number>();
  for (const profile of profiles) {
    for (const term of new Set([...profile.terms.keys(), ...profile.named])) {
      spread.set(term, (spread.get(term) ?? 0) + 1);
    }
  }

  const scores = profiles.map((profile) => {
    const earned: Array<{ word: string; weight: number; cards: number; named: boolean }> = [];
    for (const term of terms) {
      const cards = profile.terms.get(term) ?? 0;
      const named = profile.named.has(term);
      if (cards === 0 && !named) continue;
      // Rare across the categories counts for more than common in this one:
      // a word every category uses tells them apart no better than "the".
      const rarity = 1 / (spread.get(term) ?? 1);
      earned.push({ word: term, weight: (cards + (named ? 1 : 0)) * rarity, cards, named });
    }
    const total = earned.reduce((sum, one) => sum + one.weight, 0);
    earned.sort((a, b) => b.weight - a.weight);
    return {
      categoryId: profile.categoryId,
      name: profile.name,
      // Against the passage's own length, so a long paragraph matching three
      // words is not ranked above a short one matching all of them.
      strength: Math.min(1, total / Math.max(3, terms.size)),
      words: earned.slice(0, 3).map((one) => one.word),
      own: earned.filter((one) => (spread.get(one.word) ?? 1) === 1).length,
      shared: earned.length,
      cards: earned[0]?.cards ?? 0,
      byName: earned[0]?.named ?? false,
    };
  });

  return scores.filter((one) => one.shared > 0).sort((a, b) => b.strength - a.strength);
};

/**
 * Whether a match is worth putting in front of somebody.
 *
 * **A rule rather than a number**, and the first draft had a number: a floor on
 * `strength`, which is a *density*, so the same evidence fell below it in a
 * longer paragraph and an obviously-Dialogue paragraph went unoffered at 0.125
 * while a shorter one cleared at 0.167. A threshold on a density is a threshold
 * on paragraph length wearing a disguise.
 *
 * What it asks instead is about the **evidence**: **two words**, or **one word
 * that is the category's own name or that two of its cards share** — and in
 * either of those the word must be one no other category knows.
 *
 * The single-word clause earned its two conditions on the screen. The first
 * draft accepted any word unique to a category, and the panel duly proposed a
 * paragraph about *revision* for **Character**, because one card there happened
 * to contain *write* — a real word, uniquely in that category, and an accident.
 * A passage that says the category's **name** is different in kind, and so is a
 * word the writer has filed on **twice**: those are evidence, and one card's
 * incidental vocabulary is not.
 *
 * Both halves are things the row then says out loud, which is the whole
 * discipline — a suggestion list that is always full is one a writer stops
 * reading, and after that it catches nothing (the narrative validator's rule,
 * addendum 18 stage 3).
 */
export const worthSaying = (score: Score): boolean =>
  score.shared >= 2 || (score.own > 0 && (score.byName || score.cards >= 2));

/** A passage of a source, and where it is proposed to go. */
export interface Placement {
  sourceId: NoteSourceId;
  from: number;
  to: number;
  categoryId: ResearchCategoryId;
  /** What the card would be called. */
  title: string;
  /** The passage itself. */
  passage: string;
  strength: number;
  /** Why, in a sentence the writer can check against their own filing. */
  because: string;
}

/** A row's own key, so a screen can tick and dismiss without inventing ids. */
export const placementKey = (one: Placement): string =>
  `${one.sourceId as string}:${one.from}:${one.to}`;

/**
 * Why a passage was put where it was, said so the writer can check it against
 * their own filing rather than take it on trust.
 */
export const sayWhy = (score: Score): string => {
  const words = score.words.map((one) => `“${one}”`).join(', ');
  if (score.cards === 0) return `${score.name} is named for ${words}.`;
  const many = score.cards === 1 ? '1 card uses' : `${score.cards} cards use`;
  return `${many} ${words} in ${score.name}.`;
};

/**
 * What is still unsorted, paragraph by paragraph, with where each would go
 * (spec §15's **Auto-Sort Suggestions**).
 *
 * Four rules keep it honest.
 *
 * **Only what is unsorted.** A passage a card already covers is dealt with,
 * and proposing it again would be the panel arguing with the writer's own
 * work. `piecesOf` answers that, so it is the same reading the greying uses
 * and the two cannot disagree.
 *
 * **A paragraph is the unit**, because that is what a writer highlights.
 * Proposing half a sentence would make approving one worse than doing it by
 * hand, which is the only way this feature can fail to be worth its screen.
 *
 * **One category per passage, the best one.** Two suggestions for one
 * paragraph is a question rather than a suggestion, and a writer who wanted to
 * weigh two answers can drag it themselves.
 *
 * **Nothing that is not `worthSaying`.**
 */
export const suggestPlacements = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  options: { sourceId?: NoteSourceId; limit?: number } = {},
): Placement[] => {
  const sources = sourcesOf(file, sessionId).filter(
    (one) => options.sourceId === undefined || (one.id as string) === (options.sourceId as string),
  );
  const out: Placement[] = [];

  for (const source of sources) {
    for (const piece of piecesOf(file, source)) {
      if (piece.sorted) continue;
      // Paragraphs inside the unsorted stretch, keeping each one's real place
      // in the source: the range is the lineage, so it has to be exact.
      let at = piece.from;
      for (const part of piece.text.split(/(\n\s*\n)/)) {
        const from = at;
        at += part.length;
        if (/^\s*$/.test(part)) continue;
        const lead = part.length - part.trimStart().length;
        const passage = part.trim();
        if (passage.length < 24) continue;
        const best = scoreCategories(file, sessionId, passage)[0];
        if (!best || !worthSaying(best)) continue;
        out.push({
          sourceId: source.id,
          from: from + lead,
          to: from + lead + passage.length,
          categoryId: best.categoryId,
          title: titleFrom(passage),
          passage,
          strength: best.strength,
          because: sayWhy(best),
        });
      }
    }
  }

  out.sort((a, b) => b.strength - a.strength);
  return options.limit === undefined ? out : out.slice(0, options.limit);
};

/**
 * Approve some of them (spec §15's *individual or batch approval*).
 *
 * It is **`extractToCategory` and nothing else** — the same act the drag and
 * the press run, so an approved suggestion is indistinguishable afterwards from
 * a passage the writer dragged across, and there is no second kind of card to
 * explain. They are applied **longest-first within a source** so two
 * overlapping proposals cannot half-cover each other; in practice paragraphs do
 * not overlap, and this is the belt beside the braces.
 */
export const approvePlacements = (
  file: ProjectFile,
  placements: readonly Placement[],
): { file: ProjectFile; made: number } => {
  let next = file;
  let made = 0;
  for (const one of [...placements].sort((a, b) => b.to - b.from - (a.to - a.from))) {
    const done = extractToCategory(next, {
      sourceId: one.sourceId,
      from: one.from,
      to: one.to,
      categoryId: one.categoryId,
    });
    if (done.card === null) continue;
    next = done.file;
    made += 1;
  }
  return { file: next, made };
};

/**
 * A grouping the sitting has no category for.
 *
 * **This shape is the permission** (§14a). It is what a model is allowed to
 * hand back, and it is a **name and a sentence** — there is no field here for a
 * card, a passage, a range or a category id, so a model that decided to sort
 * the notes itself has nowhere to put the answer. Spec §15's *AI should not
 * silently reorganize source material* is kept by the type rather than by care,
 * which is the room AI's rule (addendum 07 §12) and the learning aid's
 * (addendum 16 §10) for the third time.
 */
export const categoryIdeaSchema = z.object({
  /** What it would be called. */
  name: z.string().trim().min(1).max(60),
  /** Why. */
  because: z.string().trim().max(240).default(''),
  /**
   * How it was arrived at, and it is on the row because the two are not the
   * same kind of claim: a counted one a writer can go and check, a suggested
   * one they can only judge. `found`'s own argument (addendum 25 §2).
   */
  found: z.enum(['read', 'suggested']).default('read'),
  /** How many unsorted paragraphs it would take. Counted only where it is read. */
  passages: z.number().int().min(0).default(0),
});
export type CategoryIdea = z.infer<typeof categoryIdeaSchema>;

/** What a model may hand back, and the whole of it. */
export const suggestedCategoriesSchema = z.object({
  ideas: z.array(categoryIdeaSchema.pick({ name: true, because: true })).max(12),
});
export type SuggestedCategories = z.infer<typeof suggestedCategoriesSchema>;

/** How many paragraphs a word must run through before it is worth a category. */
const ENOUGH_TO_BE_A_CATEGORY = 3;

/**
 * Groupings the unsorted notes suggest (spec §15's **Suggest Categories**).
 *
 * **It proposes a name and never makes one.** The writer presses it and gets
 * an empty category, exactly as if they had typed the name — after which the
 * placements suggest themselves, because the name is a card's worth of
 * teaching (`profilesOf`). Making the category *and* filling it on one press
 * would be the *silently reorganize* the spec's own caveat forbids.
 *
 * It reads only **what is still unsorted**, and only words no category already
 * knows: a term the writer has a category for is not a new grouping, it is a
 * placement, and offering it here would be the two halves of the panel arguing.
 */
export const suggestCategories = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  options: { limit?: number } = {},
): CategoryIdea[] => {
  // By name **or** by a card: a category the writer has just made from one of
  // these ideas has no cards yet, and must stop being suggested at once or the
  // panel goes on offering what it has already been taken up on.
  const known = new Set<string>();
  for (const profile of profilesOf(file, sessionId)) {
    for (const term of profile.terms.keys()) known.add(term);
    for (const term of profile.named) known.add(term);
  }

  const seen = new Map<string, number>();
  for (const source of sourcesOf(file, sessionId)) {
    for (const piece of piecesOf(file, source)) {
      if (piece.sorted) continue;
      for (const part of piece.text.split(/\n\s*\n/)) {
        const passage = part.trim();
        if (passage.length < 24) continue;
        for (const term of termsOf(passage)) {
          if (known.has(term)) continue;
          seen.set(term, (seen.get(term) ?? 0) + 1);
        }
      }
    }
  }

  return [...seen.entries()]
    .filter(([, count]) => count >= ENOUGH_TO_BE_A_CATEGORY)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, options.limit ?? 6)
    .map(([term, count]) => ({
      // Title case, because it is going to stand as a heading. The writer
      // renames it the moment it is made if they want it otherwise.
      name: term.charAt(0).toUpperCase() + term.slice(1),
      passages: count,
      because: `${count} unsorted paragraphs mention it, and no category does.`,
      found: 'read' as const,
    }));
};

/**
 * What a model is given to name groupings from (§14a).
 *
 * **The unsorted paragraphs and the category names, and nothing else** — no
 * ids, no cards, no sources, no project. What leaves the writer's machine is
 * what they pressed a button to have read, which is the learning aid's rule
 * (addendum 16 §10) and is why the screen says so beside the press.
 */
export const whatToRead = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  options: { most?: number } = {},
): { passages: string[]; categories: string[] } => {
  const passages: string[] = [];
  for (const source of sourcesOf(file, sessionId)) {
    for (const piece of piecesOf(file, source)) {
      if (piece.sorted) continue;
      for (const part of piece.text.split(/\n\s*\n/)) {
        const passage = part.trim();
        if (passage.length >= 24) passages.push(passage);
      }
    }
  }
  return {
    passages: passages.slice(0, options.most ?? 120),
    categories: sortCategories(file, sessionId).map((one) => one.name),
  };
};

/**
 * The read ideas and the suggested ones as one list (§14a).
 *
 * **Counted first, then suggested**, because a writer scanning the list should
 * meet what they can check before what they must judge. A name a category
 * already has is dropped, and so is one the reading already offers — a model
 * agreeing with the count is not a second idea, and showing it twice would make
 * the panel look as though the two halves were arguing.
 */
export const mergeIdeas = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  read: readonly CategoryIdea[],
  suggested: readonly { name: string; because: string }[],
): CategoryIdea[] => {
  const taken = new Set<string>();
  for (const category of sortCategories(file, sessionId)) taken.add(category.name.trim().toLowerCase());
  for (const idea of read) taken.add(idea.name.trim().toLowerCase());

  const extra: CategoryIdea[] = [];
  for (const one of suggested) {
    const key = one.name.trim().toLowerCase();
    if (key.length === 0 || taken.has(key)) continue;
    taken.add(key);
    extra.push(categoryIdeaSchema.parse({ ...one, found: 'suggested', passages: 0 }));
  }
  return [...read, ...extra];
};

/**
 * Why the panel has nothing to say, where it has nothing to say.
 *
 * **It is told how many were put aside**, because without that it says *nothing
 * here looks enough like any of your categories* to a writer who has just
 * dismissed four things that did — a sentence that is not merely unhelpful but
 * false, and false about the one thing the panel is asking to be trusted on.
 * Driving the room is what caught it.
 */
export const describeSuggestions = (
  file: ProjectFile,
  sessionId: NoteSessionId,
  placements: readonly Placement[],
  putAside = 0,
): string => {
  if (placements.length > 0) {
    return placements.length === 1
      ? '1 passage looks like it belongs somewhere. Nothing moves until you approve it.'
      : `${placements.length} passages look like they belong somewhere. Nothing moves until you approve them.`;
  }
  if (putAside > 0) {
    const many = putAside === 1 ? '1 suggestion is' : `${putAside} suggestions are`;
    return `${many} put aside for now. New ones appear as you file things.`;
  }
  if (sortCategories(file, sessionId).length === 0) {
    return 'Make a category or two first — these are read from what you have already filed.';
  }
  const left = sourcesOf(file, sessionId).some((source) =>
    piecesOf(file, source).some((piece) => !piece.sorted && piece.text.trim().length > 24),
  );
  if (!left) return 'Everything is sorted. Nothing left to suggest.';
  return 'Nothing here looks enough like any of your categories to be worth guessing at.';
};
