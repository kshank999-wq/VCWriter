import { isInstructional, nounsFor } from './formats.js';
import type { ProjectFormat } from './entities/project.js';

/**
 * What a writer may **say** into the phone, and what each word means
 * (addendum 09 §10, from Ken).
 *
 * This revises §2's *five, and no more*, and the revision is worth stating
 * because the reason for the five has not gone away. §2 fixed the list at
 * Character, Plot Point, Idea, Theme and Arc for a phone that **did not know
 * which project it was in**, where the only honest thing to offer is kinds of
 * thought. The app has opened on a project list since stage 5, so a note is
 * addressed to a project before a word is spoken — and once the project is
 * known, the words that project uses are the right words. A textbook writer
 * saying *beat* means nothing; saying *section* means something exact.
 *
 * **What makes this a voice notebook is not the length of the list.** It is
 * that nothing here is filed into the manuscript: saying *character, Tom*
 * makes a note about Tom, never a character record, and the desktop still
 * places it. §2's line — the phone captures and the desktop places — is
 * untouched, and it is the line that matters.
 *
 * Three rules hold the table.
 *
 * **The structural words are the noun table's** (addendum 16 §6c): nothing
 * here spells *Scene*, so a screenplay hears Scene and Beat, a novel Chapter
 * and Passage, a textbook Section and Subsection. **What may be said is
 * generous and what is stored is one key** — a writer half-remembering their
 * own program may say *chapter* at a textbook, and it files as the unit either
 * way, because a note lost to a synonym is worse than a note in a near-enough
 * group. And **absent rather than renamed** where a format has none (addendum
 * 16 §6a): a textbook has no cast, no locations and no plot, so it is offered
 * none of them.
 */

/**
 * The stable key stored on the note.
 *
 * `unit` and `sub` are **the format's structural pair rather than a word**,
 * which is what lets one key mean Scene on a screenplay and Chapter in a
 * novel without the phone, the inbox and the database disagreeing about which
 * it was. The five §2 named keep their old spellings exactly, so every note
 * ever captured reads back as what it was.
 */
export type CaptureKey =
  | 'character'
  | 'plot_point'
  | 'idea'
  | 'theme'
  | 'arc'
  | 'setting'
  | 'research'
  | 'dialogue'
  | 'scene'
  | 'unit'
  | 'sub';

export interface SpokenCategory {
  key: CaptureKey;
  /** What it is called where a writer reads it, in this format's words. */
  name: string;
  /** Everything that starts this category, lower case, longest first. */
  spoken: string[];
  /** Whether a name may follow it after a pause — *character, Tom*. */
  takesName: boolean;
}

/** Said of every format, whatever is being written. */
const ANYWHERE: ReadonlyArray<Omit<SpokenCategory, 'name'> & { name: string }> = [
  { key: 'idea', name: 'Idea', spoken: ['idea'], takesName: false },
  { key: 'theme', name: 'Theme', spoken: ['theme'], takesName: false },
  { key: 'research', name: 'Research', spoken: ['research', 'note to look up'], takesName: false },
];

/**
 * Said of anything with people and places in it, which is every story.
 *
 * **Dialogue is a kind of thought and never a destination** (§2), which is
 * what makes it belong here rather than being a reason to build something:
 * a line overheard on a walk is a note about how somebody talks, and the
 * desktop still places it. It takes a name for the same reason *character*
 * does — *dialogue, Mara* is the commonest thing anybody says about a line —
 * and its spoken words are deliberately **short of a bare *line***: only the
 * opening of an utterance is a command, so *line up the shot*, said with
 * nothing open, would file *up the shot* under Dialogue. A word common enough
 * to start an ordinary sentence is a word this table must not take.
 */
const STORY: ReadonlyArray<SpokenCategory> = [
  { key: 'character', name: 'Character', spoken: ['character'], takesName: true },
  { key: 'setting', name: 'Setting', spoken: ['setting', 'location', 'place'], takesName: true },
  { key: 'dialogue', name: 'Dialogue', spoken: ['dialogue', 'dialog', 'line of dialogue'], takesName: true },
  { key: 'plot_point', name: 'Plot Point', spoken: ['plot point', 'plotpoint', 'plot'], takesName: false },
  { key: 'arc', name: 'Arc', spoken: ['arc'], takesName: true },
];

/**
 * What can be said at this project, in the order the screen lists them.
 *
 * Nothing is stored: it is read off the format every time, so a project made
 * as a screenplay and re-read as a novel offers the novel's words with nothing
 * run — which is the same rule the rest of the program applies to a noun.
 */
export const captureVocabulary = (format: ProjectFormat): SpokenCategory[] => {
  const nouns = nounsFor(format);
  const unit = nouns.unit.toLowerCase();
  const sub = nouns.sub.toLowerCase();

  /**
   * **The noun table's two words and no synonyms**, which is the one place the
   * generosity above is refused — and it was refused after a test caught what
   * it costs. Ken said *just chapter and section in that educational book*, and
   * the program calls those Section and Subsection; offering *chapter* and
   * *section* as well put **`section` on both rungs at once**, where it meant
   * the unit to somebody who knows the program and the sub to somebody using
   * Ken's words. Two levels behind one spoken word is the one ambiguity a tool
   * you cannot look at must not have, so the program's own words win and a
   * word that fits neither is kept as writing.
   */
  const structural: SpokenCategory[] = [
    { key: 'unit', name: nouns.unit, spoken: [unit], takesName: false },
    { key: 'sub', name: nouns.sub, spoken: [sub], takesName: false },
  ];

  /**
   * **Scene, where the format has not already taken the word**, from Ken
   * (*there also needs to be additional categories like a scene*).
   *
   * The two halves of that are one rule read twice. On a screenplay the
   * structural unit **is** a Scene, so *scene* already files as the unit and a
   * second key spelled the same way would be `section`-at-a-textbook over
   * again — two levels behind one spoken word, the one ambiguity a tool you
   * cannot look at must not have. On a novel the unit is a Chapter, and a
   * novelist saying *scene* means the dramatic unit inside one, which this
   * table had no word for at all: the note went into the writing.
   *
   * So it is **absent rather than renamed** where the word is taken, which is
   * the same answer the cast and the plot get at a textbook, and it is a story
   * word, so a textbook is offered none of it either.
   */
  const scene: SpokenCategory[] =
    unit === 'scene' || sub === 'scene'
      ? []
      : [{ key: 'scene', name: 'Scene', spoken: ['scene'], takesName: false }];

  return isInstructional(format)
    ? [...structural, ...ANYWHERE]
    : [...STORY, ...scene, ...structural, ...ANYWHERE];
};

/**
 * What a stored key is called, in a format's own words.
 *
 * Falls back to the key itself rather than to nothing: a note captured under a
 * word this build has never heard of is still a note, and `inboxGroups`'
 * promise is that **the last group is never hidden**.
 */
export const captureKeyName = (key: string, format: ProjectFormat | null): string => {
  if (format) {
    const found = captureVocabulary(format).find((one) => one.key === key);
    if (found) return found.name;
  }
  const loose: Record<string, string> = {
    character: 'Character',
    plot_point: 'Plot Point',
    idea: 'Idea',
    theme: 'Theme',
    arc: 'Arc',
    setting: 'Setting',
    research: 'Research',
    dialogue: 'Dialogue',
    // A note said at a novel, read at a screenplay, where the word is the
    // unit's: still a note, still headed by what the writer said.
    scene: 'Scene',
    unit: 'Scene or chapter',
    sub: 'Beat or passage',
  };
  return loose[key] ?? key;
};

// ------------------------------------------------- what a format is called

/**
 * The formats a writer may name out loud (addendum 09 §11, from Ken: *you can
 * say that it's a novel, a screenplay, an educational book*).
 *
 * **Generous in, one key out**, which is the vocabulary's own rule — somebody
 * says *script*, *feature* or *movie* and means a screenplay. But §10.2's
 * lesson is applied harder here than anywhere, because **making a project of
 * the wrong shape is not a note in the wrong group**: it is a document whose
 * chapters are scenes, found out about a fortnight later. So no word appears
 * on two formats, and the words that would — a bare *book*, a bare *story* —
 * are **deliberately absent**, because *book* is a novel to one writer and a
 * textbook to the next and there is no way to ask which from a pocket.
 *
 * `stage_play` before `screenplay` would be wrong for the opposite reason, so
 * matching is longest-first: *screenplay* is not read as *play*.
 */
const SPOKEN_FORMATS: ReadonlyArray<{ format: ProjectFormat; name: string; spoken: string[] }> = [
  {
    format: 'screenplay',
    name: 'Screenplay',
    spoken: ['screenplay', 'script', 'feature', 'feature film', 'film', 'movie'],
  },
  { format: 'series', name: 'Series', spoken: ['series', 'tv series', 'television series', 'tv show'] },
  { format: 'novel', name: 'Novel', spoken: ['novel'] },
  {
    format: 'instructional',
    name: 'Educational book',
    spoken: ['educational book', 'textbook', 'text book', 'instructional book', 'non-fiction book', 'course'],
  },
  {
    format: 'short_story',
    name: 'Short stories and collections',
    spoken: ['short stories', 'short story', 'collection'],
  },
  { format: 'stage_play', name: 'Stage play', spoken: ['stage play', 'play', 'theatre', 'theater'] },
  { format: 'short_form', name: 'Short form', spoken: ['short form', 'commercial', 'music video'] },
  { format: 'game', name: 'Game', spoken: ['game', 'video game', 'interactive'] },
];

/** What a format is called where a writer hears it read back. */
export const formatSpokenName = (format: ProjectFormat): string =>
  SPOKEN_FORMATS.find((one) => one.format === format)?.name ?? format;

/** Every format a writer can name, for the sentence that lists the choices. */
export const spokenFormatNames = (): string[] => SPOKEN_FORMATS.map((one) => one.name);

/**
 * The format somebody named, or null.
 *
 * **The whole utterance has to be the format**, give or take an article: *a
 * novel* names one and *the novel is about her brother* does not. A looser
 * match would read the first sentence of a description as a choice of format,
 * and this is the one question where a wrong answer is expensive.
 */
export const formatNamed = (spoken: string): ProjectFormat | null => {
  const said = spoken
    .trim()
    .toLowerCase()
    // Both apostrophes: a recogniser writes whichever its host prefers, and a
    // format refused for the shape of a punctuation mark is the kind of failure
    // nobody can diagnose from a pocket.
    .replace(/^(it['’]?s |it is |a |an |the )+/g, '')
    .replace(/[.!?,]+$/g, '')
    .trim();
  if (said.length === 0) return null;
  for (const one of SPOKEN_FORMATS) {
    if (one.spoken.some((phrase) => phrase === said)) return one.format;
  }
  return null;
};
