import type { ProjectFormat } from './entities/project.js';

/**
 * What a format *is*, and what it calls things (addendum 16 §1).
 *
 * Two readings, and they are here rather than in twelve places because they
 * were in twelve places. `format === 'novel' || format === 'short_story'` was
 * written out inline across the domain and the renderer, and every one of them
 * had to be found and agreed with before a third prose format could exist. One
 * of them had already drifted: `render.ts` asked `format !== 'novel'`, so a
 * short story was laid out as a screenplay.
 *
 * **A copied predicate is a decision made twice**, and the second copy is
 * always the one nobody updates.
 */

/**
 * Whether the manuscript is prose rather than a script.
 *
 * It decides the element types, the keyboard, the page geometry, the paragraph
 * style and whether there is an index — everything that differs between
 * *writing a book* and *writing a script*. An instructional book is prose: the
 * fact that it teaches changes what goes in the chapters, not how a paragraph
 * is set.
 */
export const isProseFormat = (format: ProjectFormat): boolean =>
  format === 'novel' || format === 'short_story' || format === 'instructional';

/**
 * Whether the format teaches (addendum 16 §2).
 *
 * The one thing that separates an instructional book from a novel, and the
 * only question any instructional feature should ask. Everything else about
 * the two is the same: both are prose, both have chapters, both paginate and
 * index identically.
 */
export const isInstructional = (format: ProjectFormat): boolean => format === 'instructional';

/**
 * A collection of stories (addendum 22): the short-story format, which holds
 * one story or many. Its divisions are **stories** — each a marker over the
 * sections it spans — so the Layout room sets a collection the way it sets a
 * novel, a story to a chapter, and the contents page lists the stories.
 */
export const isCollection = (format: ProjectFormat): boolean => format === 'short_story';

/**
 * Whether the work is played rather than read or watched (addendum 18).
 *
 * The one question the Interactive Narrative module asks, and it is named for
 * the **property** rather than for the format: what every caller wants to know
 * is *does this project have a narrative graph*, not *is this literally a video
 * game*. An interactive drama or a VR piece would answer yes to the first and
 * argue about the second.
 *
 * A game's manuscript is a **script** — sluglines, cues, dialogue — so this is
 * deliberately not a third branch of `isProseFormat`. What is different about a
 * game is not how a line is set; it is that the scenes are reached by choices
 * rather than in order, and that is what the graph is for.
 */
export const isInteractive = (format: ProjectFormat): boolean => format === 'game';

/**
 * What a format calls its parts.
 *
 * §14 of the spec asks that a writer in Book Mode never be forced to work
 * around *Scene*, *Beat* or *Script*, and this is the whole of how that is
 * kept: **no screen names a unit itself.** Every label is read from here, so
 * a format renaming its parts renames them everywhere at once, and a surface
 * that forgot is a surface still saying "Scene" — which is findable.
 *
 * `sub` is deliberately not "beat" in prose. A beat is a unit of dramatic
 * action; the same structural slot in a textbook is a *section* and in a novel
 * is a *passage*, and calling all three a beat is what makes a professor feel
 * the software was not built for them.
 */
export interface FormatNouns {
  /** The structural unit: Scene, Chapter. */
  unit: string;
  unitPlural: string;
  /** What sits inside one: Beat, Passage, Section. */
  sub: string;
  subPlural: string;
  /**
   * What the book is divided into where a marker divides it: Chapter, Story,
   * Episode, Act. **Not the unit** — a collection's unit is a Section and its
   * division is a Story — which is why it is its own word rather than one
   * borrowed from `unit`. Layout and the chapter-page dialog both name it,
   * and each held a private `isCollection(...) ? 'Story' : 'Chapter'` until
   * this entry existed.
   */
  division: string;
  divisionPlural: string;
  /** The whole manuscript, as a surface: Script, Manuscript, Book. */
  manuscript: string;
  /** What the project is, for a title bar or a new-project screen. */
  work: string;
}

const SCRIPT_NOUNS: FormatNouns = {
  unit: 'Scene',
  unitPlural: 'Scenes',
  sub: 'Beat',
  subPlural: 'Beats',
  division: 'Act',
  divisionPlural: 'Acts',
  manuscript: 'Script',
  work: 'Script',
};

const NOUNS: Partial<Record<ProjectFormat, FormatNouns>> = {
  /**
   * A series is a script in every respect but one: what a marker divides it
   * into is an **episode**, which `defaultMarkerKind` has always said and
   * which this table had no word for until now.
   */
  series: {
    ...SCRIPT_NOUNS,
    division: 'Episode',
    divisionPlural: 'Episodes',
  },
  novel: {
    unit: 'Chapter',
    unitPlural: 'Chapters',
    sub: 'Passage',
    subPlural: 'Passages',
    division: 'Chapter',
    divisionPlural: 'Chapters',
    manuscript: 'Manuscript',
    work: 'Novel',
  },
  /**
   * Short stories and collections (addendum 22). A story is a marker over
   * its sections, so the project is a collection whether it holds one story
   * or twenty, and the work is named for that.
   */
  short_story: {
    unit: 'Section',
    unitPlural: 'Sections',
    sub: 'Passage',
    subPlural: 'Passages',
    division: 'Story',
    divisionPlural: 'Stories',
    manuscript: 'Manuscript',
    work: 'Collection',
  },
  /**
   * **Sections and subsections**, not chapters and sections.
   *
   * The first draft of this table made an instructional book's parts Chapter
   * and Section, which is how a novel with teaching in it is arranged. Ken's
   * correction is that a textbook is arranged as a **numbered outline**: a
   * section, and under it 1.1, 1.2, 1.3. So the top division is a Section and
   * what sits inside one is a Subsection, and `numbering.ts` gives them the
   * decimal numbers that make the structure legible.
   *
   * The unit's *kind* stays `chapter`, because that is what drives the opening
   * leaf and the contents page — the kind is a structural fact and the noun is
   * what this format calls it, which is the whole point of the table.
   */
  instructional: {
    unit: 'Section',
    unitPlural: 'Sections',
    sub: 'Subsection',
    subPlural: 'Subsections',
    division: 'Chapter',
    divisionPlural: 'Chapters',
    manuscript: 'Book',
    work: 'Book',
  },
  /**
   * A game is written as a script, and only the last line differs.
   *
   * It would be easy to invent a vocabulary here — nodes, encounters, beats —
   * and it would be wrong. Game writers say *scene* and *beat*, they write
   * sluglines and cues, and the pages they hand to a studio are a script. The
   * thing a game has that a screenplay does not is a **graph over** those
   * scenes (addendum 18 §3), and a graph is not a renaming.
   *
   * So the table says `Game` where the project is named and repeats the script
   * nouns everywhere else — which is the table doing its job rather than
   * failing to: a format that calls its parts what its writers call them needs
   * no entry at all, and this one has an entry only for `work`.
   */
  game: {
    ...SCRIPT_NOUNS,
    work: 'Game',
  },
};

export const nounsFor = (format: ProjectFormat): FormatNouns => NOUNS[format] ?? SCRIPT_NOUNS;

/**
 * There is deliberately **no `isBookFormat`** here.
 *
 * It was written, and every use of it was wrong. A short story is prose, keeps
 * chapter-kind units, prints chapter pages and carries a back-of-book index —
 * so a predicate meaning *more of a book than a short story is* had no honest
 * users. Every place that reached for it wanted `isProseFormat`, and the one
 * that genuinely differs — whether divisions are numbered 1, 2, 3 or I, II,
 * III — is a fact about counting rather than about book-ness, and says so
 * where it is asked.
 */
