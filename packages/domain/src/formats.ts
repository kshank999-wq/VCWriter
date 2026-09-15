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
  manuscript: 'Script',
  work: 'Script',
};

const NOUNS: Partial<Record<ProjectFormat, FormatNouns>> = {
  novel: {
    unit: 'Chapter',
    unitPlural: 'Chapters',
    sub: 'Passage',
    subPlural: 'Passages',
    manuscript: 'Manuscript',
    work: 'Novel',
  },
  short_story: {
    unit: 'Section',
    unitPlural: 'Sections',
    sub: 'Passage',
    subPlural: 'Passages',
    manuscript: 'Manuscript',
    work: 'Story',
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
    manuscript: 'Book',
    work: 'Book',
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
