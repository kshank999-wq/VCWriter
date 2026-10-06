import { isCollection, isProseFormat, nounsFor } from './formats.js';
import type { ProjectFormat } from './entities/project.js';

/**
 * What there is to import, and how a book is divided on the way in
 * (addendum 33).
 *
 * From Ken: *remove those two — import a script, add stories to a collection
 * — from the files menu and just put Import… This will open a center dialog
 * box that asks you what you're importing.*
 *
 * **The question comes before the file.** Every importer this program has
 * asked for the document first and the kind of thing afterwards — a format
 * select two thirds of the way down a dialog headed *Import a script*, on a
 * screen somebody opened to bring in a novel. That order is backwards twice
 * over: the title says the wrong thing before a word is read, and the control
 * that decides what will actually be made is the one nobody looks at. A
 * writer knows what they are importing before they know which file it is in.
 *
 * So this module is **the list of answers**, and what each one does with the
 * document afterwards. It names no screen: the chooser draws these rows, each
 * route reads the same kind back, and a kind added here is one the chooser
 * offers the day it is written.
 */

// --------------------------------------------------------- what can come in

export const IMPORT_KINDS = [
  /** A screenplay, a series, a stage play or short form: read by its geometry. */
  'script',
  /** A novel: read by its chapter divisions. */
  'novel',
  /** An instructional book or textbook: sections, subsections and figures. */
  'instructional',
  /** A collection of short stories, one document each. */
  'collection',
  /** More stories into the collection already open. */
  'stories',
  /** More episodes into the series already open. */
  'episodes',
  /** Notes, documents and pictures into Research, to be sorted through. */
  'notes',
  /** Pictures into the graphics library. */
  'graphics',
] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

/**
 * Whether a kind makes a project or puts something into the one that is open.
 *
 * **The distinction the old menu could not make.** `file.import` built a new
 * project and `file.importStories` added to this one, and nothing on either
 * label said which — so the one question a writer actually has about an
 * import (*is this going to replace what I am looking at?*) was answered by
 * pressing it. Said on the row now, and it is what decides which kinds are
 * offered at all when nothing is open.
 */
export type ImportLanding = 'project' | 'here';

export interface ImportChoice {
  kind: ImportKind;
  label: string;
  /** What it does, under the label rather than in a hover nobody sees. */
  note: string;
  landing: ImportLanding;
}

/**
 * What to offer, for the project that is open — or none.
 *
 * Four kinds make a project and are always offered: an import is a document
 * arriving, and `buildProjectFromImport` has made a new project from one
 * since it was written, so what is open does not narrow them.
 *
 * The other four are **absent rather than greyed** where they cannot land:
 * notes and pictures need a project to go into, more stories need a
 * collection and more episodes a series. A row that can only refuse is one a
 * writer stops trusting.
 */
export const importChoices = (format: ProjectFormat | null): ImportChoice[] => {
  const choices: ImportChoice[] = [
    {
      kind: 'script',
      label: 'A script',
      note: 'A screenplay, a series, a stage play or short form. Final Draft, Word or PDF.',
      landing: 'project',
    },
    {
      kind: 'novel',
      label: 'A novel',
      note: 'One manuscript. You say where the chapters are before anything is made.',
      landing: 'project',
    },
    {
      kind: 'instructional',
      label: 'An instructional book',
      note: 'Sections and subsections, with the figures and formatting kept.',
      landing: 'project',
    },
    {
      kind: 'collection',
      label: 'A collection of short stories',
      note: 'One document per story, added one after another. Each keeps its own chapters.',
      landing: 'project',
    },
  ];

  // **The heading says where these land, so the rows do not.** From Ken, of
  // the graphics row: *just call it graphics.* He is right and the reason is
  // the headings' own: *Into this project* is written once above all four, so
  // *Graphics, into the library* says it a second time — and a label that
  // repeats its heading is a label with nothing of its own to say. The same
  // clause came off the other three, one screen having one rule; where each
  // thing actually goes is in the note under it, which is what a note is for.
  if (format !== null && isCollection(format)) {
    choices.push({
      kind: 'stories',
      label: 'More stories',
      note: 'Each document becomes a story after the last one in this collection.',
      landing: 'here',
    });
  }
  if (format === 'series') {
    choices.push({
      kind: 'episodes',
      label: 'More episodes',
      note: 'Each document becomes the next episode of this series, on a title page of its own.',
      landing: 'here',
    });
  }
  if (format !== null) {
    choices.push({
      kind: 'notes',
      label: 'Notes',
      note: 'Documents and pictures onto the Research shelf, to sort through. Nothing reaches the manuscript.',
      landing: 'here',
    });
  }
  // **Only where there is a library to land in.** Research ▸ Graphics is
  // every prose format's and no script's (addendum 20 §9), so offering it on
  // a screenplay would be a row that routes to a shelf the menu does not
  // draw — absent rather than greyed, and the one place a writer could then
  // not get back to what they had just imported.
  if (format !== null && isProseFormat(format)) {
    choices.push({
      kind: 'graphics',
      label: 'Graphics',
      note: 'Pictures into Research ▸ Graphics, ready to place in the book.',
      landing: 'here',
    });
  }

  return choices;
};

/** The format a kind makes, where it makes a project at all. */
export const formatForKind = (kind: ImportKind): ProjectFormat | null => {
  switch (kind) {
    case 'novel':
      return 'novel';
    case 'instructional':
      return 'instructional';
    case 'collection':
      return 'short_story';
    case 'script':
      // The script kinds are four, and which of them is chosen in the dialog;
      // a screenplay is where it opens because it is much the commonest.
      return 'screenplay';
    default:
      return null;
  }
};

// ------------------------------------------------- where the chapters fall

/**
 * The marks a document divides at.
 *
 * These are **not invented for this screen**: they are the four signals
 * `opensChapter` has read since the Word importer was built, each named for
 * what a writer would call it. Ken asked for *options on how to divide it up
 * into chapters*, and the honest set of options is the set of things the
 * reader can actually see.
 *
 * Nothing counts them here. The dialog re-reads the document whenever one is
 * turned off and shows the chapter figure it already drew, so **what each
 * combination costs is read off the document rather than estimated** — which
 * is the only way a writer can tell a manuscript whose numerals are chapters
 * from one whose numerals are page numbers.
 */
export const CHAPTER_MARKS = [
  {
    id: 'heading',
    label: 'A heading',
    note: 'A line the document itself styles as a top-level heading.',
  },
  {
    id: 'chapterLine',
    label: 'The word Chapter',
    note: 'A short line reading Chapter One, Chapter 7, or Chapter 7: The Road.',
  },
  {
    id: 'numeral',
    label: 'A numeral on its own',
    note: 'I, 1 or One alone on its line — how a short story usually divides.',
  },
  {
    id: 'pageBreak',
    label: 'A new page',
    note: 'A page break whose first line is short, and centred or in capitals.',
  },
] as const;

export type ChapterMarkId = (typeof CHAPTER_MARKS)[number]['id'];
export type ChapterMarks = Readonly<Record<ChapterMarkId, boolean>>;

/**
 * Every mark, which is exactly what the reader did before there was a choice.
 *
 * The default matters more than it looks: `opensChapter` takes this when it
 * is given nothing, so every caller that existed before the options did reads
 * the same documents the same way, and the whole import suite passed
 * unedited — which is the proof.
 */
export const ALL_CHAPTER_MARKS: ChapterMarks = {
  heading: true,
  chapterLine: true,
  numeral: true,
  pageBreak: true,
};

/** Nothing marks a chapter: the document comes in whole, to be divided by hand. */
export const NO_CHAPTER_MARKS: ChapterMarks = {
  heading: false,
  chapterLine: false,
  numeral: false,
  pageBreak: false,
};

/**
 * What is in force, said in words under the controls.
 *
 * **Nothing names a unit itself** (addendum 16 §6c): the sentence stands an
 * inch under a figure reading `unitPlural`, so writing *chapters* here put
 * *3 Sections* over *3 chapters here* on a collection and on a textbook — two
 * readings of one count disagreeing on one screen. It takes the format and
 * asks the noun table, so there is one answer.
 */
export const describeMarks = (
  marks: ChapterMarks,
  chapters: number,
  format: ProjectFormat = 'novel',
): string => {
  const nouns = nounsFor(format);
  const on = CHAPTER_MARKS.filter((mark) => marks[mark.id]);
  const found = chapters === 1 ? `one ${nouns.unit.toLowerCase()}` : `${chapters} ${nouns.unitPlural.toLowerCase()}`;
  if (on.length === 0) {
    return `Nothing divides it, so the whole manuscript comes in as ${found}. The ${nouns.unit} tool on the manuscript bar divides it afterwards.`;
  }
  // **Only the first letter comes down.** A plain `toLowerCase` reads *the
  // word chapter*, and the capital is the whole of what that mark is about —
  // addendum 19 §10's rule (a capital after a word's first letter is not
  // shouting) pointed at a label rather than at a writer's own words.
  const names = on.map((mark) => mark.label.charAt(0).toLowerCase() + mark.label.slice(1));
  const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]!}`;
  return `Divided at ${list} — ${found} here.`;
};

// --------------------------------------------------- how much is in a beat

/**
 * How much of a chapter goes into one beat.
 *
 * From Ken: *each chapter, if you're importing, will go into one long beat.
 * Then you'll have to divide it up manually.* Which is the opposite of what a
 * novel did — addendum 21 §10 made **a beat of every paragraph**, at his own
 * earlier ask, and that is right for a short story being worked over scene by
 * scene and wrong for a four-hundred-page manuscript arriving as four hundred
 * beats on a timeline nobody can read.
 *
 * So it is a **per-format default** rather than a change of mind: a novel and
 * an instructional book come in whole and are divided with the Chapter and
 * Passage tools, and a collection keeps the paragraph beats §10 asked for.
 * Neither is a reading of the document — it is a decision about the timeline,
 * which is why it is stored nowhere and merely decides what is made.
 */
export type PassageSplit = 'chapter' | 'paragraph';

/**
 * Whether the import lands in the Layout room rather than the manuscript.
 *
 * From Ken, about a collection: *in between, it will create the layout where
 * you can reorder how the stories are. And then you can insert chapter pages,
 * etc. in the layout.* **A route rather than a feature** — the room has
 * dragged the parts into order and made the chapter pages since addendum 20
 * §9a — and it is a collection's alone: a novel and a book arrive as one
 * document whose order is the document's, so there is nothing there to
 * rearrange and the manuscript is what a writer wants to look at.
 *
 * Here rather than in the component so the dialog's sentence and the room
 * that opens cannot disagree: a screen promising Layout over a workspace that
 * stays put is worse than no sentence at all.
 */
export const landsInLayout = (format: ProjectFormat): boolean => isCollection(format);

export const defaultSplit = (format: ProjectFormat): PassageSplit =>
  // Only a prose format asks: a script's scene has been one beat since the
  // importer was written and this does not reach it. Of the three, the
  // collection is the one §10 was about.
  isCollection(format) ? 'paragraph' : 'chapter';
