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

/** Said of anything with people and places in it, which is every story. */
const STORY: ReadonlyArray<SpokenCategory> = [
  { key: 'character', name: 'Character', spoken: ['character'], takesName: true },
  { key: 'setting', name: 'Setting', spoken: ['setting', 'location', 'place'], takesName: true },
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

  return isInstructional(format)
    ? [...structural, ...ANYWHERE]
    : [...STORY, ...structural, ...ANYWHERE];
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
    unit: 'Scene or chapter',
    sub: 'Beat or passage',
  };
  return loose[key] ?? key;
};
