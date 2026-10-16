import { beatsInScript, relatedEntities, unitsInStoryOrder } from './selectors.js';
import { chapterLeafContent } from './chapter-style.js';
import {
  chapterPagesFor,
  placedMarkers,
  contentsDivisions,
  hasContentsPage,
  type ChapterPageContent,
  type ContentsEntry,
  type ContentsPage,
  type PlacedMarker,
} from './markers.js';
import { episodeTitlePages, episodes, type Episode } from './episodes.js';
import {
  bookIndex,
  hasBookIndex,
  indexPages,
  type BookIndex,
  type IndexPage,
} from './book-index.js';
import type { TitlePage } from './entities/title-page.js';
import { groupManuscript } from './editing.js';
import { parseInline, type InlineSpan, type InlineStyle } from './entities/inline.js';
import type { ManuscriptElement, ManuscriptElementType } from './entities/manuscript.js';
import type { ParagraphStyle, ProjectFormat, ScriptFormat } from './entities/project.js';
import type { ProjectFile } from './project-file.js';
import type { StructuralUnitId } from './ids.js';
import type { StructuralUnit } from './entities/structure.js';
import { isCollection, isProseFormat } from './formats.js';
import { structureNumbers } from './numbering.js';

/**
 * Page layout for screenplays and prose manuscripts (spec §6).
 *
 * A screenplay page is a fixed physical object: 12pt Courier on US Letter is
 * 10 characters to the inch and 6 lines to the inch, which with 1" top and
 * bottom margins gives 55 lines, and with a 1.5" left and 1" right margin
 * gives a 60-character text column. Every indent and width below is that
 * geometry expressed in characters, which is why a page count from this engine
 * means what the industry means by "a page".
 *
 * The preview, the print stylesheet and the PDF export all read this one
 * layout, so they cannot drift apart.
 */

export interface PageLayoutSpec {
  linesPerPage: number;
  /** Column each element starts at, measured from the left of the text area. */
  indent: Record<string, number>;
  /**
   * Extra columns given to the **first line only**. A prose paragraph's
   * five-space indent is a first-line indent: indenting every line would make
   * a block quote of it. Absent means the block is set flush at `indent`.
   */
  firstIndent?: Record<string, number>;
  /** Characters per line before wrapping. */
  width: Record<string, number>;
  /** Element types rendered in capitals. */
  uppercase: ReadonlySet<string>;
  /**
   * Element types **centred in the text column** (addendum 37).
   *
   * A stage play's cue is centred, and a fixed indent is not centring: it is
   * right for one length of name and wrong for every other, which on a page
   * of six characters is visible. The block is set at its `indent` and
   * `width` as usual — so the wrapping, and therefore the page count, is
   * unchanged — and only where the words sit inside it differs.
   *
   * Absent on every screen format, where a cue really is at a fixed column.
   */
  centred?: ReadonlySet<string>;
  /**
   * The paper this is set on (addendum 37).
   *
   * `linesPerPage` and `columns` have always carried the *geometry*, and the
   * print stylesheet carried `@page { size: letter }` whatever the layout
   * said — so the BBC layouts, which have claimed A4 since they were written,
   * printed their 58 lines onto US Letter. A layout that knows how tall its
   * page is and not what paper it is cut from is half a layout.
   */
  paper?: 'letter' | 'a4';
  /** Prose is double spaced; screenplays are not. */
  doubleSpaced: boolean;
  /**
   * Element types double spaced on a page that otherwise is not.
   *
   * A multi-camera sitcom's speeches are set with a blank line between every
   * line of them, so the cast and the crew have somewhere to write. It is why
   * a half-hour multi-cam script runs forty-odd pages rather than thirty.
   */
  doubleSpacedTypes?: ReadonlySet<string>;
  /**
   * Element types that follow their own kind with no blank between them.
   *
   * Standard manuscript format runs paragraphs on and marks each new one
   * with a first-line indent; block style leaves the indent off and marks
   * the break with a space instead. The two are the same page set two ways,
   * so it is one set here rather than two layouts (§6.4).
   */
  runOn?: ReadonlySet<string>;
  /**
   * Elements that sit on the line straight under the one before, with no
   * blank between them.
   *
   * A speech is **one block**: the cue, its wryly and the words are
   * consecutive lines, and a blank line anywhere inside them is the mistake
   * every writer spots at a glance. Everything else on a screenplay page —
   * scene heading, action, a new cue, a transition — takes exactly one blank
   * line before it, and never two. Keyed by the element, valued by the
   * element types it may follow this closely.
   */
  follows?: Record<string, ReadonlySet<string>>;
  /**
   * Blank lines before a scene heading, where a format wants more than one.
   * Absent means the ordinary single blank that separates any two blocks.
   */
  blanksBeforeHeading?: number;
  /**
   * How many lines a figure's picture occupies (addendum 16 §9).
   *
   * A function rather than a number, because **a figure's height is a reading
   * of the picture** — set to the text column, its height follows from its own
   * aspect ratio. Storing one would be a second answer that a replaced image
   * makes wrong, and the writer would have to go and correct a number they
   * never typed.
   *
   * Absent on a layout built without a project, where a figure falls back to a
   * square. That is a guess, and it is the only one here: a layout with no
   * assets behind it cannot know, and refusing to paginate would be worse.
   */
  figureLines?: (assetId: string) => number;
  /**
   * The cue is not a line of its own: it sits in the left margin, beside the
   * first line of the speech it introduces.
   *
   * How a taped BBC script is laid out. The cue is out at the left edge and
   * the speech is a column to its right, which leaves the whole right-hand
   * side of the page clear for the crew's camera cues — the reason the format
   * exists at all.
   */
  cueBeside?: boolean;
  columns: number;
  /**
   * Two speeches printed side by side. Absent in a format that has no
   * dialogue to speak of.
   */
  dual?: {
    /** Characters in each of the two columns. */
    width: number;
    /** Characters between them. */
    gap: number;
    /** Indent of each element within its column. */
    indent: Record<string, number>;
  };
}

export const SCREENPLAY_LAYOUT: PageLayoutSpec = {
  linesPerPage: 55,
  columns: 60,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 0,
    shot: 0,
    general: 0,
    character: 22,
    parenthetical: 16,
    dialogue: 10,
    transition: 45,
  },
  width: {
    scene_heading: 60,
    action: 60,
    shot: 60,
    general: 60,
    character: 38,
    parenthetical: 25,
    dialogue: 35,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  // The cue, its wryly and the speech are one block, on consecutive lines.
  follows: {
    parenthetical: new Set(['character', 'dialogue', 'parenthetical']),
    dialogue: new Set(['character', 'parenthetical', 'dialogue']),
  },
  // Two 27-character columns with 6 between them: the 60-character body,
  // halved, with each speech's cue sitting over its own column.
  dual: {
    width: 27,
    gap: 6,
    indent: { character: 8, parenthetical: 3, dialogue: 0 },
  },
};

/**
 * US multi-camera sitcom format (spec §6.5).
 *
 * The same US Letter page, opened right up. A show shot on a stage in front
 * of an audience is rehearsed off the script, so the page is built to be
 * written on: the speech is double spaced, the cue sits in close to the left
 * rather than out in the middle, and everything that is not spoken — the
 * headings, the action, the wrylies — is set in capitals so an actor can see
 * at a glance what is theirs to say. A half-hour of this is forty-odd pages,
 * not thirty, and that is the format doing its job rather than the writer
 * overwriting.
 */
export const US_MULTI_LAYOUT: PageLayoutSpec = {
  linesPerPage: 55,
  columns: 60,
  doubleSpaced: false,
  // The speech, and only the speech: room to write between the lines.
  doubleSpacedTypes: new Set(['dialogue']),
  indent: {
    scene_heading: 0,
    action: 0,
    shot: 0,
    general: 0,
    character: 15,
    parenthetical: 10,
    dialogue: 10,
    transition: 45,
  },
  width: {
    scene_heading: 60,
    action: 60,
    shot: 60,
    general: 60,
    character: 45,
    parenthetical: 45,
    dialogue: 45,
    transition: 15,
  },
  // Everything that is not spoken is in capitals.
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot', 'action', 'general', 'parenthetical']),
  follows: {
    parenthetical: new Set(['character', 'dialogue', 'parenthetical']),
    dialogue: new Set(['character', 'parenthetical', 'dialogue']),
  },
  dual: {
    width: 27,
    gap: 6,
    indent: { character: 5, parenthetical: 0, dialogue: 0 },
  },
};

/**
 * BBC script format (spec §6.5).
 *
 * The same twelve-point Courier, set for a different job. US studio format is
 * laid out for reading and for timing; the BBC's grew up around taped
 * television, where the margins carried the crew's technical notes — so the
 * dialogue is a wide block sitting under a cue that is barely indented, rather
 * than a narrow column down the middle of the page.
 *
 * A4 rather than US Letter: 8.27" × 11.69" with the same 1.5" left, 1" right
 * and 1" top and bottom margins gives a 57-character column and 58 lines.
 *
 * A new scene heading takes a double blank line, which is how a BBC page
 * blocks out a change of setting; nothing else about the vertical spacing
 * differs. Scene headings are not set in bold — the house discourages it.
 */
export const BBC_LAYOUT: PageLayoutSpec = {
  linesPerPage: 58,
  columns: 57,
  paper: 'a4',
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 0,
    shot: 0,
    general: 0,
    // 2.5" from the paper's edge: the cue sits close to the action, not out
    // in the middle of the page.
    character: 10,
    parenthetical: 10,
    // Directly under the name, and running to the right margin.
    dialogue: 10,
    transition: 42,
  },
  width: {
    scene_heading: 57,
    action: 57,
    shot: 57,
    general: 57,
    character: 47,
    parenthetical: 47,
    dialogue: 47,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  follows: {
    parenthetical: new Set(['character', 'dialogue', 'parenthetical']),
    dialogue: new Set(['character', 'parenthetical', 'dialogue']),
  },
  // A heavy visual boundary at a change of setting.
  blanksBeforeHeading: 2,
  dual: {
    width: 26,
    gap: 5,
    indent: { character: 0, parenthetical: 0, dialogue: 0 },
  },
};

/**
 * BBC taped format (spec §6.5).
 *
 * The other BBC tradition, and the one a studio drama or a multi-camera show
 * was actually shot from. The cue does not get a line: it sits out at the left
 * edge, beside the first line of what the character says, and the speech is a
 * column to its right. That leaves the whole right-hand side of the page clear
 * — which is the point of it, because that is where the crew wrote their
 * camera cues.
 *
 * A4, like the drama layout, and the same double blank line at a change of
 * setting.
 */
export const BBC_TAPED_LAYOUT: PageLayoutSpec = {
  ...BBC_LAYOUT,
  paper: 'a4',
  cueBeside: true,
  indent: {
    ...BBC_LAYOUT.indent,
    // The speech's column. The cue is written into the margin to its left.
    character: 0,
    parenthetical: 16,
    dialogue: 16,
  },
  width: {
    ...BBC_LAYOUT.width,
    character: 15,
    parenthetical: 41,
    dialogue: 41,
  },
  // Two columns of this would leave no margin to write in, which is the whole
  // reason for the layout; two speeches at once print one after the other.
  dual: undefined as unknown as PageLayoutSpec['dual'],
};

/* ------------------------------------------------------------------ stage
 *
 * **The six a stage play is set in** (addendum 37, from Ken's own *Stage Play
 * Formatting Engine* spec). A play was set in `SCREENPLAY_LAYOUT` until now —
 * the cue out at 3.7 inches, the speech a narrow column — which is a film
 * page, and nothing in the menu offered anything else.
 *
 * Every one of them is this record and nothing new: the spec's §6 asks for a
 * configuration contract of margins, cue placement and casing, dialogue
 * column, direction indent and heading alignment, and `PageLayoutSpec` has
 * carried all of it since the screen formats were written. What it did not
 * carry is a **centred** cue and the **paper**, which are the two fields
 * above.
 *
 * Geometry is the engine's: twelve-point Courier at ten characters to the
 * inch and six lines to the inch. **Letter** with the spec's 1.5" binding
 * edge and 1" elsewhere is 60 characters and 55 lines; **A4** with its 1" all
 * round (the spec's own VC DEFAULT) is 62 characters and 58 lines.
 *
 * The spec's own caveat is kept rather than paraphrased: these are
 * recommendations, not acceptance rules, and a theatre's or publisher's own
 * instructions override them. Nothing here claims a certification.
 */

/** Letter, the spec's 1.5" binding edge: 60 characters, 55 lines. */
const STAGE_LETTER = { linesPerPage: 55, columns: 60, paper: 'letter' } as const;
/** A4, the spec's 1" all round: 62 characters, 58 lines. */
const STAGE_A4 = { linesPerPage: 58, columns: 62, paper: 'a4' } as const;

/**
 * A speech is one block wherever it is set: cue, wryly and words, no gaps —
 * and in a play with songs, the sung lines are the same speech (addendum 38
 * §3), so a lyric runs on from its cue and from the words before it, and the
 * words after it run on from the lyric.
 */
const SPEECH_RUNS_ON = {
  parenthetical: new Set(['character', 'dialogue', 'parenthetical', 'lyric']),
  dialogue: new Set(['character', 'parenthetical', 'dialogue', 'lyric']),
  lyric: new Set(['character', 'parenthetical', 'dialogue', 'lyric']),
};

/**
 * **Where a musical's lines go on a page that was not drawn for them**
 * (addendum 38 §3).
 *
 * Any stage play may hold a song (`holdsMusic`), so every stage layout has to
 * say where one is set — and a layout that did not would print a lyric flush
 * at the left margin, at the full width, which reads as a direction. So each
 * one is derived from what the layout already says:
 *
 * - the **number's title** and the **band's cue** are set where the
 *   directions are, in capitals, the title centred where the cue is;
 * - a **lyric** is the speech's column, inset five more, in capitals — sung
 *   words set apart from spoken ones, which is the musical page's one rule;
 * - a **dance** is a direction, and sits with them.
 *
 * A layout that names its own place for one — the musical preset does —
 * keeps it: this fills in, it never overrides.
 */
const withMusic = (layout: PageLayoutSpec): PageLayoutSpec => {
  const direction = { indent: layout.indent['action'] ?? 0, width: layout.width['action'] ?? layout.columns };
  const speech = { indent: layout.indent['dialogue'] ?? 0, width: layout.width['dialogue'] ?? layout.columns };
  const inset = Math.min(5, Math.max(0, speech.width - 20));
  return {
    ...layout,
    indent: {
      song_title: direction.indent,
      lyric: speech.indent + inset,
      music_cue: direction.indent,
      dance: direction.indent,
      ...layout.indent,
    },
    width: {
      song_title: direction.width,
      lyric: speech.width - inset,
      music_cue: direction.width,
      dance: direction.width,
      ...layout.width,
    },
    uppercase: new Set([...layout.uppercase, 'song_title', 'lyric', 'music_cue']),
    ...(layout.centred?.has('character') ? { centred: new Set([...layout.centred, 'song_title']) } : {}),
  };
};

/**
 * **US — Modern Play** (`us_modern`; spec §2, §4.1).
 *
 * The Dramatists Guild's modern sample. The cue is uppercase and **centred**
 * over the speech, the speech runs the full text column — 1.5" from the left
 * edge to 1" from the right, which is the whole 60 characters — and the stage
 * directions sit in a narrower region on the right, beginning 3" from the
 * paper's edge, which is column 15 of the text area.
 */
export const STAGE_US_MODERN_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_LETTER,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    // The direction's own region, out to the right of the speech.
    action: 15,
    shot: 15,
    general: 15,
    character: 0,
    parenthetical: 10,
    dialogue: 0,
    transition: 45,
  },
  width: {
    scene_heading: 60,
    action: 45,
    shot: 45,
    general: 45,
    character: 60,
    parenthetical: 40,
    dialogue: 60,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  // The heading and the cue are centred; the speech and the directions are not.
  centred: new Set(['scene_heading', 'character']),
  follows: SPEECH_RUNS_ON,
});

/**
 * **US — Traditional Play** (`us_traditional`; spec §2, §4.2).
 *
 * The same centred cue over a **narrower** speech, with the stage directions
 * a separate indented block rather than a right-hand region — the spec's
 * starting layout: dialogue edges 1.5"/1", standalone direction edges
 * 2.5"/1", which is the speech at the full column and the directions inset a
 * further inch.
 *
 * The spec asks for the two indents to be **separate and configurable rather
 * than hard-coded spaces**, which is what this record is: nothing anywhere
 * pads a line with spaces.
 */
export const STAGE_US_TRADITIONAL_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_LETTER,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 10,
    shot: 10,
    general: 10,
    character: 0,
    parenthetical: 10,
    dialogue: 5,
    transition: 45,
  },
  width: {
    scene_heading: 60,
    action: 45,
    shot: 45,
    general: 45,
    character: 60,
    parenthetical: 40,
    dialogue: 50,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  centred: new Set(['scene_heading', 'character']),
  follows: SPEECH_RUNS_ON,
});

/**
 * **US — Samuel French-inspired** (`us_publisher`; spec §2, §4.3).
 *
 * A publisher-style reading copy: the cue over the speech, set compactly, the
 * directions clearly apart from what is spoken. The spec is explicit that
 * this **implies no acceptance and no endorsement** — it is a house-style
 * starting point, and a publisher's own instructions override it.
 *
 * It is the one preset whose cue is **not centred**: a reading copy sets it
 * in from the left, which is what keeps the page compact.
 */
export const STAGE_US_PUBLISHER_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_LETTER,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 5,
    shot: 5,
    general: 5,
    character: 20,
    parenthetical: 10,
    dialogue: 0,
    transition: 45,
  },
  width: {
    scene_heading: 60,
    action: 50,
    shot: 50,
    general: 50,
    character: 40,
    parenthetical: 45,
    dialogue: 60,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  follows: SPEECH_RUNS_ON,
});

/**
 * **UK — BBC Stage** (`uk_bbc`; spec §2, §4.4).
 *
 * The BBC Writersroom stage sample, Matt Carless, 6 February 2004 — an older
 * sample rather than a statement of current UK submission rules, which is the
 * spec's own caveat and worth keeping on the screen.
 *
 * The cue is uppercase at the left margin and **the speech begins on the same
 * line**, at a fixed column — which is `cueBeside`, built for BBC taped
 * television and the same shape here. Directions are **uppercase** and shifted
 * right, which is this layout's difference from the taped one and why it is
 * its own entry rather than a reuse.
 *
 * The spec forbids space-padding to achieve the column, which is what
 * `cueBeside` is: the cue is laid in the margin, not written into the line.
 */
export const STAGE_UK_BBC_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_A4,
  doubleSpaced: false,
  cueBeside: true,
  indent: {
    scene_heading: 0,
    // Uppercase and visibly shifted right of the speech column.
    action: 20,
    shot: 20,
    general: 20,
    character: 0,
    parenthetical: 16,
    dialogue: 16,
    transition: 45,
  },
  width: {
    scene_heading: 62,
    action: 42,
    shot: 42,
    general: 42,
    character: 15,
    parenthetical: 46,
    dialogue: 46,
    transition: 15,
  },
  // The directions are in capitals too, which is what this sample does.
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot', 'action', 'general', 'parenthetical']),
  follows: SPEECH_RUNS_ON,
  // A change of setting is blocked out, as on the BBC's screen pages.
  blanksBeforeHeading: 2,
});

/**
 * **UK — Contemporary Play** (`uk_contemporary`; spec §2, §4.5).
 *
 * The common UK side-by-side convention — the spec is careful that it is not
 * the single mandatory rule. The name is at the left with the spoken text in
 * a column to its right, and the speech is **mixed case**: the cue is
 * uppercase and nothing else is, which is where this parts from the BBC
 * sample above.
 */
export const STAGE_UK_CONTEMPORARY_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_A4,
  doubleSpaced: false,
  cueBeside: true,
  indent: {
    scene_heading: 0,
    action: 14,
    shot: 14,
    general: 14,
    character: 0,
    parenthetical: 14,
    dialogue: 14,
    transition: 45,
  },
  width: {
    scene_heading: 62,
    action: 48,
    shot: 48,
    general: 48,
    character: 13,
    parenthetical: 48,
    dialogue: 48,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  follows: SPEECH_RUNS_ON,
});

/**
 * **Europe — Continental Reading Copy** (`eu_continental`; spec §2, §4.5).
 *
 * The spec says this in so many words and it is the half that must not be
 * lost: **there is no single Europe-wide convention**, so this is a
 * configurable reading-copy starting point and is labelled as one. It is not
 * called a European standard, and no preset here is named for a country whose
 * house style this has not been checked against.
 *
 * The role label stands at the left and the speech is a block to its right.
 */
export const STAGE_EU_CONTINENTAL_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_A4,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 8,
    shot: 8,
    general: 8,
    character: 0,
    parenthetical: 8,
    dialogue: 8,
    transition: 45,
  },
  width: {
    scene_heading: 62,
    action: 54,
    shot: 54,
    general: 54,
    character: 62,
    parenthetical: 54,
    dialogue: 54,
    transition: 15,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  follows: SPEECH_RUNS_ON,
});

/**
 * **US — Musical** (`musical`; spec §4.6, addendum 38).
 *
 * The modern play's page with a song in it, which is what a musical's
 * libretto is: the cue centred over the speech, the directions in their own
 * region, and **the lyrics in capitals in a narrower column** inside the
 * speech's — sung words set so an actor, a music director and a stage manager
 * can each find them at a glance, which is the reason the convention exists.
 *
 * The number's title is centred and in capitals, where a reader turning pages
 * looks for where the song starts; the band's cue and the dance are directions
 * and sit with them.
 *
 * The spec marks this preset optional in its own v1, and its caveat holds as
 * for the others: a house style's starting point, and a producing theatre's or
 * licensing house's own instructions come first.
 */
export const STAGE_US_MUSICAL_LAYOUT: PageLayoutSpec = withMusic({
  ...STAGE_LETTER,
  doubleSpaced: false,
  indent: {
    scene_heading: 0,
    action: 15,
    shot: 15,
    general: 15,
    character: 0,
    parenthetical: 10,
    dialogue: 0,
    transition: 45,
    song_title: 0,
    lyric: 10,
    music_cue: 15,
    dance: 15,
  },
  width: {
    scene_heading: 60,
    action: 45,
    shot: 45,
    general: 45,
    character: 60,
    parenthetical: 40,
    dialogue: 60,
    transition: 15,
    song_title: 60,
    lyric: 45,
    music_cue: 45,
    dance: 45,
  },
  uppercase: new Set(['scene_heading', 'character', 'transition', 'shot']),
  centred: new Set(['scene_heading', 'character']),
  follows: SPEECH_RUNS_ON,
});

/**
 * Standard manuscript format: 12pt Courier, double spaced, ~25 lines a page,
 * paragraphs running on with a five-space first-line indent.
 */
export const PROSE_LAYOUT: PageLayoutSpec = {
  linesPerPage: 25,
  columns: 60,
  doubleSpaced: true,
  indent: { paragraph: 0, heading: 0, blockquote: 5, scene_break: 28, figure: 0 },
  // Five spaces on the opening line, and the rest of the paragraph flush.
  firstIndent: { paragraph: 5 },
  width: { paragraph: 60, heading: 60, blockquote: 55, scene_break: 5, figure: 60 },
  uppercase: new Set(['heading']),
  // The indent is what says "a new paragraph", so nothing else has to.
  runOn: new Set(['paragraph']),
};

/**
 * The same page, set block style: no first-line indent, and a space between
 * paragraphs to mark the break the indent would otherwise have marked. One
 * or the other — a page with both is a page that says it twice.
 */
export const PROSE_BLOCK_LAYOUT: PageLayoutSpec = {
  ...PROSE_LAYOUT,
  firstIndent: {},
  runOn: new Set<string>(),
};

/**
 * A series and a short-form piece are both written in script format: the
 * same geometry, the same elements, the same two keys. What differs is how
 * they are divided (§14), not how a page is set.
 */
const STAGE_LAYOUTS: Record<string, PageLayoutSpec> = {
  stage_us_modern: STAGE_US_MODERN_LAYOUT,
  stage_us_traditional: STAGE_US_TRADITIONAL_LAYOUT,
  stage_us_publisher: STAGE_US_PUBLISHER_LAYOUT,
  stage_uk_bbc: STAGE_UK_BBC_LAYOUT,
  stage_uk_contemporary: STAGE_UK_CONTEMPORARY_LAYOUT,
  stage_eu_continental: STAGE_EU_CONTINENTAL_LAYOUT,
  stage_us_musical: STAGE_US_MUSICAL_LAYOUT,
};

export const layoutFor = (
  format: ProjectFormat,
  paragraphStyle?: ParagraphStyle,
  scriptFormat?: ScriptFormat,
): PageLayoutSpec => {
  if (!isProseFormat(format)) {
    // A stage play is set in a stage house style and never in a screen one
    // (addendum 37). `scriptFormatOf` has already resolved what was stored,
    // so a play carrying `us` — which is every play written before there was
    // anything else to carry, and was the fallthrough rather than anybody's
    // choice — is set as a modern play rather than as a film.
    const asked = scriptFormatOf(format, scriptFormat);
    const stage = STAGE_LAYOUTS[asked];
    if (stage) return stage;
    if (asked === 'bbc') return BBC_LAYOUT;
    if (asked === 'bbc_taped') return BBC_TAPED_LAYOUT;
    if (asked === 'us_multi') return US_MULTI_LAYOUT;
    return SCREENPLAY_LAYOUT;
  }
  return paragraphStyle === 'blocked' ? PROSE_BLOCK_LAYOUT : PROSE_LAYOUT;
};

/**
 * **The house styles this format offers** (addendum 37, from Ken: *when you
 * select stage play, you need a dropdown or some type of preference that can
 * select the proper formatting for you*).
 *
 * A stage play is offered the six stage presets and a screen script the four
 * screen ones — **absent rather than renamed**, which is `kindsFor`'s rule
 * (addendum 16 §6c): a multi-camera sitcom layout is not a thing a play can
 * be set in, and offering it is offering to format a play wrongly.
 *
 * The list is the domain's because it is a rule about the format; what each
 * one is *called* is the screen's, copy not being a reading.
 */
export const scriptFormatsFor = (format: ProjectFormat): ScriptFormat[] => {
  if (isProseFormat(format)) return [];
  if (format === 'stage_play') {
    return [
      'stage_us_modern',
      'stage_us_traditional',
      'stage_us_publisher',
      'stage_uk_bbc',
      'stage_uk_contemporary',
      'stage_eu_continental',
      'stage_us_musical',
    ];
  }
  return ['us', 'us_multi', 'bbc', 'bbc_taped'];
};

/**
 * The house style in force — what was stored where this format offers it, and
 * the format's own first otherwise.
 *
 * **One reading, so the menu and the printed page cannot disagree.** A play
 * holding `us` is not a writer who chose a screenplay: until now the menu had
 * no stage preset in it at all, so `us` is what every play was handed. It
 * reads as the modern play, which is the whole of *select the proper
 * formatting for you*.
 */
export const scriptFormatOf = (format: ProjectFormat, stored?: ScriptFormat): ScriptFormat => {
  const offered = scriptFormatsFor(format);
  if (offered.length === 0) return 'us';
  return stored && offered.includes(stored) ? stored : (offered[0] as ScriptFormat);
};

/**
 * The layout this project is written in — the format's geometry, set the way
 * the writer asked for it. Everything that paginates a whole file goes
 * through here, so the choice cannot be honoured in one place and missed in
 * another.
 */
export const layoutForFile = (file: ProjectFile): PageLayoutSpec => {
  const base = layoutFor(file.project.format, file.settings.paragraphStyle, file.settings.scriptFormat);
  // Only prose can hold a figure, so only prose gets a resolver — and a script
  // keeps the shared layout object it has always been given, identity and all.
  if (!isProseFormat(file.project.format)) return base;
  return { ...base, figureLines: (assetId) => figureLinesIn(file, assetId, base) };
};

/**
 * How many lines a picture occupies, read from the picture (addendum 16 §9).
 *
 * Set to the full text column, so its printed height follows from its aspect
 * ratio and nothing about it is stored. The geometry is standard manuscript
 * format's: 12pt Courier at ten characters to the inch, so a column is
 * `columns / 10` inches wide, and a line is a sixth of an inch single spaced
 * or a third double spaced.
 *
 * An asset that is not there, or that never reported its size, falls back to a
 * third of a page — a guess, and one that is visible as a gap rather than
 * silently collapsing the figure to nothing.
 */
export const figureLinesIn = (file: ProjectFile, assetId: string, layout: PageLayoutSpec): number => {
  const fallback = Math.round(layout.linesPerPage / 3);
  const asset = (file.assets ?? []).find((one) => (one.id as string) === assetId);
  if (!asset || asset.width <= 0 || asset.height <= 0) return fallback;

  const inchesWide = layout.columns / 10;
  const inchesTall = inchesWide * (asset.height / asset.width);
  const lineHeight = layout.doubleSpaced ? 1 / 3 : 1 / 6;
  // Never taller than the page it has to fit on.
  return Math.max(1, Math.min(layout.linesPerPage - 2, Math.round(inchesTall / lineHeight)));
};

export interface PageLine {
  /**
   * A picture set in this line and the ones after it (addendum 16 §9).
   *
   * Carried on the **first** line of a figure only; the lines it covers follow
   * as blanks, which is what reserves the room. A renderer that knows nothing
   * about figures draws a gap where the picture goes, which is wrong but not
   * broken — and one that does draws the picture at this height.
   */
  figure?: { assetId: string; lines: number };
  text: string;
  type: ManuscriptElementType | 'blank' | 'more' | 'continued' | 'act_head' | 'act_end';
  indent: number;
  /**
   * The same characters as `text`, carrying the emphasis they were written
   * with. Renderers that can show bold and italic draw these; anything that
   * cannot use `text` and loses nothing but the styling.
   */
  spans: InlineSpan[];
  /**
   * Set in the margins beside this line rather than in the column: a scene
   * number, which a shooting script prints at both edges and which must not
   * take room from the 60 characters the text is set in.
   */
  mark?: string;
  /**
   * Set centred in the column rather than flush at `indent` (addendum 37) —
   * a stage play's cue, and nothing on a screen page. `width` comes with it,
   * because centring needs the box the words are centred in.
   */
  centred?: boolean;
  /** The column's width in characters, carried only where `centred` is. */
  width?: number;
}

export interface Page {
  number: number;
  lines: PageLine[];
  /**
   * The manuscript element the page opens with, so an editor showing the
   * text as a flow can draw the page breaks where the printed page puts
   * them. Null when nothing was laid out.
   */
  startsWith: string | null;
  /**
   * Set on a chapter page (addendum 02 §11): a leaf of the book carrying the
   * chapter's number, its name and whatever the writer put on it, rather
   * than lines of manuscript. `lines` is empty on such a page.
   */
  chapter?: ChapterPageContent;
  /**
   * Set on a front page (spec §6.1, addendum 02 §17): the title page an
   * episode opens with, rather than lines of manuscript. `lines` is empty,
   * and `number` is 0 — a title page is not numbered, and does not take a
   * number from the page that follows it.
   */
  titlePage?: TitlePage;
  /**
   * Set on the contents page a season is bound with (addendum 02 §17): what
   * is in the stack, at the front of the stack. `lines` is empty, and like a
   * title page it takes no number.
   */
  contents?: ContentsPage;
  /**
   * Set on a page of the back-of-book index (addendum 10). `lines` is empty
   * and the page **is** numbered, unlike the contents and a title page: the
   * index is at the back of the book, inside the numbering, which is where a
   * reader turning to page 312 expects to find it.
   */
  index?: IndexPage;
}

/** Greedy wrap at `width`, breaking on spaces and never mid-word when avoidable. */
export const wrapText = (text: string, width: number): string[] => {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of words) {
      if (current.length === 0) {
        current = word;
      } else if (current.length + 1 + word.length <= width) {
        current = `${current} ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
      // A single word longer than the column has to be broken somewhere.
      while (current.length > width) {
        lines.push(current.slice(0, width));
        current = current.slice(width);
      }
    }
    if (current.length > 0) lines.push(current);
  }

  return lines;
};

interface Block {
  /** The element this block came from, so a page can name where it starts. */
  id: string;
  type: ManuscriptElementType;
  lines: string[];
  /** The emphasis on each of those lines, character for character. */
  spans: InlineSpan[][];
  indent: number;
  /** Extra columns on the opening line only: a paragraph's first-line indent. */
  firstIndent: number;
  /**
   * A scene heading or character cue must not be the last thing on a page —
   * the reader would turn over to find the content it introduces.
   */
  keepWithNext: boolean;
  /** Dialogue may be split across pages with (MORE) / (CONT'D). */
  splittable: boolean;
  /** Printed in the margins beside the block's first line: a scene number. */
  mark?: string;
  /**
   * The picture a figure block draws, and how many of its lines it fills
   * (addendum 16 §9). The blank lines are the room; this is what goes in them.
   */
  figure?: { assetId: string; lines: number };
  /** The speaker, so a continuation can be labelled. */
  speaker: string | null;
  /**
   * A cue printed in the left margin beside this block's opening line rather
   * than on a line of its own (`cueBeside`).
   */
  cue?: string;
}

const MIN_SPLIT_LINES = 2;

/** What a speaker says or sings, which a page carrying it on must name. */
const isSpoken = (type: ManuscriptElementType): boolean => type === 'dialogue' || type === 'lyric';

const sameStyle = (a: InlineStyle, b: InlineStyle): boolean =>
  Boolean(a.bold) === Boolean(b.bold) &&
  Boolean(a.italic) === Boolean(b.italic) &&
  Boolean(a.underline) === Boolean(b.underline);

/**
 * Wrap a written line to the column and keep its emphasis on the characters
 * it belongs to. Wrapping is done on the printed text — the marks take no
 * room on the page — and the styles are carried across by walking the two
 * strings together, which works because wrapping only ever changes spaces.
 */
const layoutText = (
  raw: string,
  width: number,
  uppercase: boolean,
): { lines: string[]; spans: InlineSpan[][] } => {
  const styles: InlineStyle[] = [];
  let plain = '';
  for (const span of parseInline(raw)) {
    const text = uppercase ? span.text.toUpperCase() : span.text;
    plain += text;
    for (let index = 0; index < text.length; index += 1) {
      styles.push({ bold: span.bold, italic: span.italic, underline: span.underline });
    }
  }

  const lines = wrapText(plain, width);
  const spans: InlineSpan[][] = [];
  let cursor = 0;
  for (const line of lines) {
    const row: InlineSpan[] = [];
    for (const character of line) {
      while (cursor < plain.length && plain[cursor] !== character) cursor += 1;
      const style = styles[cursor] ?? {};
      const last = row[row.length - 1];
      if (last && sameStyle(last, style)) last.text += character;
      else row.push({ text: character, ...style });
      cursor += 1;
    }
    spans.push(row);
  }
  return { lines, spans };
};

const toBlock = (element: ManuscriptElement, layout: PageLayoutSpec, speaker: string | null): Block => {
  const width = layout.width[element.type] ?? layout.columns;
  const indent = layout.indent[element.type] ?? 0;
  const { lines, spans } = layoutText(element.text, width, layout.uppercase.has(element.type));

  /**
   * A figure is its picture and then its caption (addendum 16 §9).
   *
   * The picture is blank lines — nothing is printed in them, they are the room
   * it takes — and the caption is the element's own text under it. They are
   * **one block** so a page break can never fall between a figure and what it
   * says it is.
   */
  if (element.type === 'figure') {
    const assetId = typeof element.attributes['assetId'] === 'string' ? element.attributes['assetId'] : '';
    const tall = Math.max(1, layout.figureLines?.(assetId) ?? Math.round(layout.linesPerPage / 3));
    const blank = Array.from({ length: tall }, () => '');
    return {
      id: element.id,
      type: element.type,
      figure: { assetId, lines: tall },
      lines: [...blank, ...lines],
      spans: [...blank.map(() => [] as InlineSpan[]), ...spans],
      indent,
      firstIndent: 0,
      keepWithNext: false,
      // Never split: half a picture on one page and half on the next is not a
      // figure, and a caption orphaned from its picture is worse.
      splittable: false,
      speaker: null,
    };
  }

  return {
    id: element.id,
    type: element.type,
    lines,
    spans,
    indent,
    firstIndent: layout.firstIndent?.[element.type] ?? 0,
    keepWithNext: element.type === 'scene_heading' || element.type === 'character' || element.type === 'parenthetical',
    // A song is split the way a speech is: what is sung is somebody's, and
    // the page it carries on to has to say whose (addendum 38 §3).
    splittable: element.type === 'dialogue' || element.type === 'lyric',
    speaker,
    mark: typeof element.attributes['sceneNumber'] === 'string' ? element.attributes['sceneNumber'] : undefined,
  };
};

/**
 * Two speeches printed side by side (addendum 02 §7.1). Each column is laid
 * out on its own and the two are set into one block of lines, so the page
 * flow below needs to know nothing about it: to the paginator a dual speech
 * is one wide block that does not split.
 */
const toDualBlock = (
  left: readonly ManuscriptElement[],
  right: readonly ManuscriptElement[],
  layout: PageLayoutSpec,
): Block => {
  const dual = layout.dual as NonNullable<PageLayoutSpec['dual']>;
  const column = (elements: readonly ManuscriptElement[]) => {
    const rows: { text: string; spans: InlineSpan[]; indent: number }[] = [];
    for (const element of elements) {
      if (element.text.trim().length === 0) continue;
      const indent = dual.indent[element.type] ?? 0;
      const { lines, spans } = layoutText(element.text, dual.width - indent, layout.uppercase.has(element.type));
      lines.forEach((text, position) => rows.push({ text, spans: spans[position] ?? [], indent }));
    }
    return rows;
  };

  const leftRows = column(left);
  const rightRows = column(right);
  const lines: string[] = [];
  const spans: InlineSpan[][] = [];
  const columnWidth = dual.width + dual.gap;

  for (let index = 0; index < Math.max(leftRows.length, rightRows.length); index += 1) {
    const leftRow = leftRows[index];
    const rightRow = rightRows[index];
    const leftText = leftRow ? ' '.repeat(leftRow.indent) + leftRow.text : '';
    const rightText = rightRow ? ' '.repeat(rightRow.indent) + rightRow.text : '';
    lines.push(rightText.length > 0 ? leftText.padEnd(columnWidth) + rightText : leftText);

    const row: InlineSpan[] = [];
    if (leftRow) {
      if (leftRow.indent > 0) row.push({ text: ' '.repeat(leftRow.indent) });
      row.push(...leftRow.spans);
    }
    if (rightText.length > 0) {
      const gap = columnWidth - leftText.length;
      if (gap > 0) row.push({ text: ' '.repeat(gap) });
      if (rightRow && rightRow.indent > 0) row.push({ text: ' '.repeat(rightRow.indent) });
      if (rightRow) row.push(...rightRow.spans);
    }
    spans.push(row);
  }

  const first = left[0] ?? right[0];
  return {
    id: first ? first.id : '',
    type: 'dialogue',
    lines,
    spans,
    indent: 0,
    firstIndent: 0,
    keepWithNext: false,
    // Two columns cannot be resumed under one (MORE); the pair moves together.
    splittable: false,
    speaker: null,
  };
};

/**
 * Flow a manuscript into pages.
 *
 * Two rules do the real work, and both exist because a page break in the wrong
 * place changes how a script reads:
 *
 *  - A scene heading or character cue never ends a page. It moves down with
 *    whatever it introduces.
 *  - Dialogue that will not fit is split with `(MORE)` and resumed under
 *    `NAME (CONT'D)`, but only if at least two lines can stay on each side;
 *    otherwise the whole speech moves to the next page.
 */
export const paginateElements = (
  elements: readonly ManuscriptElement[],
  layout: PageLayoutSpec,
  speakerFor: (element: ManuscriptElement) => string | null = () => null,
  /**
   * Lines already on the first page before the manuscript starts: an act's
   * heading, which belongs to the page rather than to the writing. Counted in
   * the page's own fifty-five, so nothing is pushed off the bottom.
   */
  lead: readonly PageLine[] = [],
): Page[] => {
  const blocks: Block[] = [];
  let currentSpeaker: string | null = null;
  /** A cue waiting to be written beside the line it introduces. */
  let pendingCue: string | null = null;
  /** The cue element it came from, so a page opening on it names it. */
  let pendingCueId = '';

  /**
   * Set the waiting cue beside the block it introduces — or, **where the name
   * will not fit in the margin**, on a line of its own above it (addendum 38
   * §6, the spec's §9 acceptance test).
   *
   * The margin is the speech's indent, and a cue needs at least one space
   * after it to be read as a name rather than as the first word of the
   * speech. A name that leaves no room — *THE SECOND GRAVEDIGGER* in a
   * fifteen-column margin — used to push its first line right, so nothing
   * collided but the line was out of its column. It drops to its own line
   * instead, and the speech under it runs on with no blank, which is the
   * speech-is-one-block rule doing the rest.
   */
  const attachCue = (block: Block) => {
    if (pendingCue === null) return;
    const cue = pendingCue;
    pendingCue = null;
    if (cue.length < block.indent) {
      block.cue = cue;
      return;
    }
    blocks.push({
      id: pendingCueId || block.id,
      type: 'character',
      lines: [cue],
      spans: [[{ text: cue }]],
      indent: 0,
      firstIndent: 0,
      keepWithNext: true,
      splittable: false,
      speaker: null,
    });
  };

  // Dual speeches are laid out as one two-column block; everything else is
  // an element on its own.
  for (const item of groupManuscript(elements)) {
    if (item.kind === 'dual') {
      if (layout.dual) {
        blocks.push(toDualBlock(item.left, item.right, layout));
        const last = item.right[item.right.length - 1];
        currentSpeaker = last ? (item.right[0] as ManuscriptElement).text.toUpperCase() : currentSpeaker;
        continue;
      }
      // A format without dual columns prints the two speeches in sequence,
      // and each one is laid out exactly as it would be on its own.
      for (const element of [...item.left, ...item.right]) {
        if (element.text.trim().length === 0) continue;
        if (element.type === 'character') currentSpeaker = element.text.toUpperCase();
        if (layout.cueBeside && element.type === 'character') {
          pendingCue = layoutText(element.text, layout.columns, layout.uppercase.has('character')).lines[0] ?? '';
          pendingCueId = element.id;
          continue;
        }
        const made = toBlock(
          element,
          layout,
          isSpoken(element.type) ? (speakerFor(element) ?? currentSpeaker) : null,
        );
        attachCue(made);
        blocks.push(made);
      }
      continue;
    }

    const element = item.element;
    if (element.text.trim().length === 0 && element.type !== 'scene_break') continue;
    if (element.type === 'character') currentSpeaker = element.text.toUpperCase();
    const speaker = speakerFor(element) ?? currentSpeaker;

    // Where the cue goes in the margin, it is held back and written beside the
    // first line of whatever it introduces, rather than being a line itself.
    if (layout.cueBeside && element.type === 'character') {
      pendingCue = layoutText(element.text, layout.columns, layout.uppercase.has('character')).lines[0] ?? '';
      pendingCueId = element.id;
      continue;
    }
    const block = toBlock(element, layout, isSpoken(element.type) ? speaker : null);
    attachCue(block);
    blocks.push(block);
  }

  // A cue with nothing after it still belongs on the page.
  if (pendingCue !== null && pendingCue.length > 0) {
    blocks.push({
      id: `cue-${blocks.length}`,
      type: 'character',
      lines: [pendingCue],
      spans: [[{ text: pendingCue }]],
      indent: 0,
      firstIndent: 0,
      keepWithNext: false,
      splittable: false,
      speaker: null,
    });
  }

  const pages: Page[] = [];
  let lines: PageLine[] = [...lead];
  const spacing = layout.doubleSpaced ? 2 : 1;
  // The element being laid out, and the one that opened the page in hand.
  let currentId: string | null = null;
  let pageStart: string | null = null;

  const remaining = () => layout.linesPerPage - lines.length;
  const startNewPage = () => {
    if (lines.length > 0) pages.push({ number: pages.length + 1, lines, startsWith: pageStart });
    lines = [];
    pageStart = null;
  };
  // What separates two blocks. A double-spaced page already carries a blank
  // under every line, so one more is a paragraph break; a single-spaced
  // screenplay page needs the whole line.
  const gap = layout.doubleSpaced ? 1 : spacing;
  const pushBlank = (howMany = gap) => {
    if (lines.length === 0) return;
    for (let i = 0; i < howMany; i += 1) lines.push({ text: '', type: 'blank', indent: 0, spans: [] });
  };
  /**
   * What goes before this block: nothing inside a speech, more than one blank
   * before a scene heading in a format that asks for it, one otherwise.
   */
  const blanksBefore = (block: Block, previous: Block | null): number => {
    if (previous === null) return 0;
    // A block carrying its own cue is a new speech, however it is typed, so
    // it takes the blank line that separates one speaker from the next.
    if (!block.cue && (layout.follows?.[block.type]?.has(previous.type) ?? false)) return 0;
    if (block.type === 'scene_heading' && layout.blanksBeforeHeading) {
      return layout.blanksBeforeHeading * gap;
    }
    return gap;
  };

  /**
   * Push one manuscript line, breaking the page when it is full. Everything
   * goes through here so a block longer than a whole page — a page-long
   * paragraph, a monologue — flows across pages instead of overflowing one.
   * A blank spacing line is never carried to the top of the next page.
   */
  const pushContent = (
    text: string,
    type: PageLine['type'],
    indent: number,
    spans: InlineSpan[],
    mark?: string,
    figure?: PageLine['figure'],
  ) => {
    if (lines.length >= layout.linesPerPage) startNewPage();
    if (pageStart === null) pageStart = currentId;
    // Centred elements carry the column they are centred in (addendum 37);
    // everything else carries nothing new, which is why no screen page moves.
    const middle = layout.centred?.has(type)
      ? { centred: true as const, width: layout.width[type] ?? layout.columns }
      : {};
    lines.push({
      text,
      type,
      indent,
      spans,
      ...middle,
      ...(mark ? { mark } : {}),
      ...(figure ? { figure } : {}),
    });
    const doubled = layout.doubleSpaced || (layout.doubleSpacedTypes?.has(type) ?? false);
    if (doubled && lines.length < layout.linesPerPage) {
      lines.push({ text: '', type: 'blank', indent: 0, spans: [] });
    }
  };

  const pushBlockLines = (block: Block, from = 0, to = Number.POSITIVE_INFINITY) => {
    block.lines.slice(from, to).forEach((text, offset) => {
      const first = from + offset === 0;
      // The mark belongs beside the first line of the block, not every one.
      const mark = first ? block.mark : undefined;
      // The first-line indent belongs to the paragraph's opening line, so a
      // paragraph resumed at the top of a page is set flush, as it should be.
      const indent = block.indent + (first ? block.firstIndent : 0);
      const spans = block.spans[from + offset] ?? [{ text }];

      // A cue set in the margin is written into the opening line itself, so
      // the line is one line and the speech's own column is where it belongs.
      if (first && block.cue) {
        const gutter = block.cue.padEnd(block.indent, ' ');
        pushContent(gutter + text, block.type, 0, [{ text: gutter }, ...spans], mark);
        return;
      }
      pushContent(text, block.type, indent, spans, mark, first ? block.figure : undefined);
    });
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index] as Block;
    currentId = block.id;
    // A paragraph that runs on from the paragraph before it takes no blank:
    // in standard manuscript format the indent is what marks the new one. Nor
    // does a line inside a speech, which is one block down the page.
    const previous = index > 0 ? (blocks[index - 1] as Block) : null;
    const runsOn =
      previous !== null && previous.type === block.type && (layout.runOn?.has(block.type) ?? false);
    const before = runsOn ? 0 : blanksBefore(block, previous);
    const separator = lines.length === 0 ? 0 : before;
    // A block set double spaced on an otherwise single-spaced page takes two
    // lines for each of its own, and the room it needs has to say so.
    const step = layout.doubleSpacedTypes?.has(block.type) ? 2 : spacing;
    const needed = block.lines.length * step + separator;

    // A block that keeps with the next one needs room for a couple of lines of
    // that next block too, or the page break lands between them.
    const follower = blocks[index + 1];
    const followerStep = follower && layout.doubleSpacedTypes?.has(follower.type) ? 2 : spacing;
    const companionLines =
      block.keepWithNext && follower ? Math.min(2, follower.lines.length) * followerStep + gap : 0;

    if (needed + companionLines <= remaining()) {
      if (before > 0) pushBlank(before);
      pushBlockLines(block);
      continue;
    }

    // It does not fit. Split dialogue when both halves stay readable.
    const availableForLines = remaining() - separator - step; // reserve the (MORE) line
    const fittable = Math.floor(availableForLines / step);
    if (
      block.splittable &&
      fittable >= MIN_SPLIT_LINES &&
      block.lines.length - fittable >= MIN_SPLIT_LINES
    ) {
      if (before > 0) pushBlank(before);
      pushBlockLines(block, 0, fittable);
      lines.push({ text: '(MORE)', type: 'more', indent: layout.indent['parenthetical'] ?? 16, spans: [{ text: '(MORE)' }] });
      startNewPage();
      if (block.speaker) {
        const continued = `${block.speaker} (CONT'D)`;
        lines.push({
          text: continued,
          type: 'continued',
          indent: layout.indent['character'] ?? 22,
          spans: [{ text: continued }],
        });
      }
      pushBlockLines(block, fittable);
      continue;
    }

    // Otherwise the whole block moves down. `pushContent` keeps breaking pages
    // underneath it if the block is longer than a page on its own.
    startNewPage();
    pushBlockLines(block);
  }

  if (lines.length > 0) pages.push({ number: pages.length + 1, lines, startsWith: pageStart });
  return pages;
};

/**
 * What a printing carries (addendum 02 §13).
 *
 * Everything here is off unless it is part of the delivered manuscript. A
 * script sent out is scene headings, action and dialogue; a **reference
 * copy** — the one a writer prints for themselves — can carry the beat
 * labels, the scene summaries, the links, the scene numbers. Nothing in the
 * second list is the writing, so nothing in it prints by accident.
 */
export interface ManuscriptOptions {
  /**
   * Emit each beat's internal title as an annotation. Off by default and named
   * explicitly at every call site: §5.3 and §19 make the beat title authoring
   * metadata, so the delivered manuscript never contains it.
   */
  includeBeatTitles?: boolean;
  /**
   * Print the leaf a chapter opens with (addendum 02 §11). Defaults to the
   * project's own setting; a format with no chapter pages ignores it.
   */
  includeChapterPages?: boolean;
  /**
   * Print the front pages: the document's, and the one each episode opens
   * with (§6.1, addendum 02 §17). On unless asked otherwise — one switch for
   * all of them, because a writer who does not want a title page does not
   * want eleven of them.
   */
  includeTitlePage?: boolean;
  /**
   * Print the contents page a season is bound with (addendum 02 §17). On
   * unless asked otherwise, and only where there is more than one episode to
   * list.
   */
  includeContentsPage?: boolean;
  /** Whether the back-of-book index prints (addendum 10). */
  includeBookIndex?: boolean;
  /**
   * The sluglines themselves. On unless asked otherwise — a script without
   * them is a rehearsal script or a prose read-through, which is a real
   * thing to want and never the default.
   */
  includeSceneHeadings?: boolean;
  /**
   * Number the scenes, in the margins at both edges, the way a shooting
   * script does. Off: a script is not numbered until it is going into
   * production, and numbering a draft misrepresents it.
   */
  includeSceneNumbers?: boolean;
  /** Each scene's summary, as an annotation under its heading. */
  includeSceneSummary?: boolean;
  /** What each scene is linked to: setups, payoffs, research, characters. */
  includeSceneLinks?: boolean;
}

/** Every manuscript element in the project, in reading order. */
export const manuscriptElements = (file: ProjectFile, options: ManuscriptOptions = {}): ManuscriptElement[] =>
  unitsInStoryOrder(file)
    // A scene switched off stays in the structure and leaves the manuscript.
    .filter((unit) => unit.inScript)
    // Scene numbers count the scenes that are in the script, in story order:
    // a scene switched off is not scene 4 and never was.
    .flatMap((unit, index) => unitElements(file, unit.id, options, String(index + 1)));

/**
 * The whole project, paginated — with the leaves a book puts between its
 * chapters (addendum 02 §11).
 *
 * A chapter page is a page in its own right, so the story is paginated in
 * runs between them rather than as one stream. That is not a compromise: a
 * chapter starts on a fresh page in every book ever printed, which is
 * exactly what breaking the run does. A format with no chapter pages, or a
 * printing that leaves them out, paginates as one run and is unchanged.
 */
export const paginateProject = (file: ProjectFile, options: ManuscriptOptions = {}): Page[] =>
  paginated(file, options).pages;

/**
 * The index as it will print, for the screen that manages it (addendum 10).
 *
 * **The screen and the printed book read the same function**, which is the only
 * way a page number shown beside a mark can be trusted: a second reading that
 * worked the pages out its own way would be a second answer, and a writer
 * looking at two of them has no way to tell which one the book will use.
 *
 * The print toggle is deliberately overridden — somebody managing the index
 * wants to see it whether or not this printing carries it.
 */
export const bookIndexOf = (file: ProjectFile, options: ManuscriptOptions = {}): BookIndex => {
  const where = elementPages(file, options);
  return bookIndex({
    marks: file.indexMarks ?? [],
    refs: file.indexRefs ?? [],
    pageOfElement: (elementId: string) => where.get(elementId) ?? 0,
  });
};

/**
 * What page every element of the manuscript prints on.
 *
 * The index's own question, exported because a screen showing a mark beside its
 * page has to ask it too — and asking it anywhere else would be a second
 * answer.
 */
export const elementPages = (
  file: ProjectFile,
  options: ManuscriptOptions = {},
): Map<string, number> => paginated(file, { ...options, includeBookIndex: true }).where;

/**
 * The pagination, and where every element landed.
 *
 * One walk answers both, because the second question has no other honest
 * source: a page number is *worked out*, and working it out twice is how two
 * answers happen.
 */
const paginated = (
  file: ProjectFile,
  options: ManuscriptOptions = {},
): { pages: Page[]; where: Map<string, number> } => {
  const speakerFor = (element: ManuscriptElement) => {
    if (!element.characterId) return null;
    return file.characters.find((character) => character.id === element.characterId)?.name.toUpperCase() ?? null;
  };
  const layout = layoutForFile(file);
  const isProse = isProseFormat(file.project.format);

  const leaves = chapterPagesFor(file, options);
  const fronts = episodeTitlePages(file, options);
  // Every episode begins a script of its own, whether or not its front page
  // is printing: it starts on a fresh page and numbers from one (§17).
  const opensEpisode = new Map(episodes(file).map((episode) => [episode.marker.unitId as string, episode]));
  // Nothing to divide the run and nothing to list: one flat pass, unchanged.
  const anyActBreaks =
    (file.settings.actBreaks ?? false) &&
    !isProse &&
    placedMarkers(file).some((placed) => placed.marker.kind === 'act');
  if (
    leaves.length === 0 &&
    fronts.length === 0 &&
    opensEpisode.size === 0 &&
    !anyActBreaks &&
    !hasContentsPage(file, options) &&
    !wantsBookIndex(file, options)
  ) {
    return {
      pages: numbered(paginateElements(manuscriptElements(file, options), layout, speakerFor), new Set()),
      where: new Map(),
    };
  }

  // Where each leaf falls, and where each episode's front page does, by the
  // unit each is anchored to.
  const opensAt = new Map(leaves.map((placed) => [placed.marker.unitId as string, placed]));
  const frontAt = new Map(fronts.map((front) => [front.episode.marker.unitId as string, front.page]));
  const units = unitsInStoryOrder(file).filter((unit) => unit.inScript);

  // The same numbering as the flat run above, worked out once.
  const sceneNumbers = new Map(units.map((unit, index) => [unit.id as string, index + 1]));

  const pages: Page[] = [];
  /** Where a script begins: the index of each episode's own page one. */
  const restartAt = new Set<number>();
  /**
   * Each division's run: which page index it opens on, and how far into the
   * manuscript it falls. The contents page is written from these once the
   * pages exist — how long each part runs, and where to turn for it.
   */
  const runs: Division[] = [];
  /** Every element as it went in, so a division with no leaf can be placed. */
  const emitted: string[] = [];
  /** Where each unit's first line went in, so a numbered book's contents can list its sections (addendum 19 §6). */
  const starts: SectionStart[] = [];
  const divisions = new Map(contentsDivisions(file).map((placed) => [placed.marker.unitId as string, placed]));
  let run: ManuscriptElement[] = [];

  /**
   * Act breaks (spec §6.5). A network episode is written in acts with a
   * commercial between them, so each one starts on paper of its own with its
   * name at the head of the page and `END OF …` under its last line. A
   * streaming script has none of this, which is why it is a choice.
   */
  const actBreaks = (file.settings.actBreaks ?? false) && !isProse;
  const opensAct = new Map(
    actBreaks
      ? placedMarkers(file)
          .filter((placed) => placed.marker.kind === 'act')
          .map((placed) => [placed.marker.unitId as string, placed])
      : [],
  );
  /** The act being written, so its end can be marked when the next one opens. */
  let actOpen: string | null = null;
  /** A heading waiting for the page its act begins on. */
  let actHead: PageLine[] = [];

  /** One line of a script's furniture: centred in the column, and underlined. */
  const centred = (text: string, type: PageLine['type']): PageLine => ({
    text,
    type,
    indent: Math.max(0, Math.floor((layout.columns - text.length) / 2)),
    spans: [{ text, underline: true }],
  });

  const flush = () => {
    if (run.length === 0 && actHead.length === 0) return;
    pages.push(...paginateElements(run, layout, speakerFor, actHead));
    actHead = [];
    run = [];
  };

  /** `END OF ACT ONE`, under the last line of the act that is ending. */
  const closeAct = () => {
    if (actOpen === null) return;
    const line = centred(`END OF ${actOpen}`, 'act_end');
    const last = pages[pages.length - 1];
    if (last && last.lines.length + 2 <= layout.linesPerPage) {
      last.lines.push({ text: '', type: 'blank', indent: 0, spans: [] }, line);
    } else {
      pages.push({ number: 0, lines: [line], startsWith: null });
    }
    actOpen = null;
  };

  for (const unit of units) {
    /** The first page this unit opens: its cover, its leaf, or its own page one. */
    let opensAtIndex = -1;

    // An act ends where the next begins, and each starts on a page of its own.
    const act = opensAct.get(unit.id as string);
    if (act) {
      flush();
      closeAct();
      actOpen = act.label;
      actHead = [centred(act.label, 'act_head'), { text: '', type: 'blank', indent: 0, spans: [] }];
      if (opensAtIndex < 0) opensAtIndex = pages.length;
    }

    const episode = opensEpisode.get(unit.id as string);
    if (episode) {
      // The episode before it ends where it ends; this one starts on paper of
      // its own, with its front page ahead of it where it has one.
      flush();
      opensAtIndex = pages.length;
      const front = frontAt.get(unit.id as string);
      if (front) pages.push({ number: 0, lines: [], startsWith: null, titlePage: front });
      // Whatever is pushed next — a chapter leaf, or the first page of the
      // script — is this episode's page one.
      restartAt.add(pages.length);
    }

    const leaf = opensAt.get(unit.id as string);
    if (leaf) {
      flush();
      if (opensAtIndex < 0) opensAtIndex = pages.length;
      pages.push({ number: 0, lines: [], startsWith: null, chapter: chapterLeafContent(file, leaf) });
    }

    // A division opens at the first leaf of its own — its cover, its chapter
    // page — or, where it has neither, at whatever page its first line falls
    // on, which `emitted` is kept for.
    const opens = divisions.get(unit.id as string);
    if (opens) runs.push({ placed: opens, from: opensAtIndex, at: emitted.length });
    const elements = unitElements(file, unit.id, options, String(sceneNumbers.get(unit.id as string) ?? 0));
    starts.push({ unit, at: emitted.length, count: elements.length });
    emitted.push(...elements.map((element) => element.id as string));
    run.push(...elements);
  }
  flush();
  closeAct();

  const laid = numbered(pages, restartAt);
  const where = pageNumbersOfElements(laid, emitted);

  // The index at the back, which like the contents at the front can only be
  // written once the pages exist — and for the stronger reason: **every entry
  // in it is a page number nobody stored** (addendum 10). Appended before the
  // contents is unshifted, so the contents' sheet numbers still count from the
  // front of the finished stack.
  laid.push(...bookIndexPages(file, laid, where, layout, options));

  // The list at the front, which can only be written once the pages exist:
  // it says where to turn, and a page that is not there cannot be pointed at.
  if (hasContentsPage(file, options)) {
    laid.unshift({
      number: 0,
      lines: [],
      startsWith: null,
      contents: contentsOf(file, laid, runs, starts, emitted),
    });
  }
  return { pages: laid, where };
};

/**
 * Whether this printing carries an index: a book, with something in it, and
 * not turned off for this printing.
 */
const wantsBookIndex = (file: ProjectFile, options: ManuscriptOptions): boolean =>
  options.includeBookIndex !== false &&
  hasBookIndex(file.project.format) &&
  (file.indexMarks ?? []).length + (file.indexRefs ?? []).length > 0;

/**
 * Where every element landed, as the number its page actually prints.
 *
 * The index's whole job, and the one thing only the paginator can answer. An
 * element it has never heard of comes back 0, which is a mark whose passage
 * has gone — shown as an orphan rather than quietly dropped.
 */
const pageNumbersOfElements = (
  laid: readonly Page[],
  emitted: readonly string[],
): Map<string, number> => {
  const position = new Map(emitted.map((id, index) => [id, index]));
  const where = new Map<string, number>();

  // Walk the pages once, carrying the page each element belongs to: a page
  // owns every element from the one it starts with up to the next page's.
  let page = 0;
  for (let index = 0; index < laid.length; index += 1) {
    const starts = laid[index]?.startsWith;
    if (starts === null || starts === undefined) continue;
    const at = position.get(starts);
    if (at === undefined) continue;
    const nextAt = (() => {
      for (let after = index + 1; after < laid.length; after += 1) {
        const next = laid[after]?.startsWith;
        if (next === null || next === undefined) continue;
        const found = position.get(next);
        if (found !== undefined) return found;
      }
      return emitted.length;
    })();
    page = laid[index]?.number ?? 0;
    for (let element = at; element < nextAt; element += 1) {
      const id = emitted[element];
      if (id !== undefined) where.set(id, page);
    }
  }
  return where;
};

/** The index's own pages, numbered on from the last page of the book. */
const bookIndexPages = (
  file: ProjectFile,
  laid: readonly Page[],
  where: ReadonlyMap<string, number>,
  layout: PageLayoutSpec,
  options: ManuscriptOptions,
): Page[] => {
  if (!wantsBookIndex(file, options)) return [];

  const index = bookIndex({
    marks: file.indexMarks ?? [],
    refs: file.indexRefs ?? [],
    pageOfElement: (elementId: string) => where.get(elementId) ?? 0,
  });
  if (index.headings.length === 0) return [];

  const last = laid.reduce((most, page) => Math.max(most, page.number), 0);
  return indexPages({
    index,
    title: 'Index',
    linesPerPage: layout.linesPerPage,
    columns: layout.columns,
  }).map((page: IndexPage, offset: number) => ({
    number: last + offset + 1,
    lines: [],
    startsWith: null,
    index: page,
  }));
};

/** A unit, how many elements went in ahead of its first line, and how many it has. */
interface SectionStart {
  unit: StructuralUnit;
  at: number;
  count: number;
}

/** A division of the document, and where it landed once the pages were laid. */
interface Division {
  placed: PlacedMarker;
  /** The page index its own leaves begin at, or -1 where it has none. */
  from: number;
  /** How many elements went in ahead of it, for a division with no leaf. */
  at: number;
}

/**
 * What is in the stack: one line for each episode, with how long it runs.
 *
 * The length is counted from the pages themselves rather than estimated —
 * the covers between the scripts belong to no script and are not counted in
 * one — so the figure on the contents page is the figure the last page of
 * that episode carries.
 */
const contentsOf = (
  file: ProjectFile,
  pages: readonly Page[],
  runs: readonly Division[],
  starts: readonly SectionStart[],
  emitted: readonly string[],
): ContentsPage => {
  // Where each element fell, so a division with no leaf of its own can still
  // be pointed at: the page it opens on is the last one that had begun by the
  // time its first line went in.
  const position = new Map(emitted.map((id, index) => [id, index]));
  const begun = pages.map((page, index) => ({
    index,
    at: page.startsWith === null ? -1 : (position.get(page.startsWith) ?? -1),
  }));
  const pageOf = (at: number): number => {
    let found = 0;
    for (const page of begun) {
      if (page.at >= 0 && page.at <= at) found = page.index;
    }
    return found;
  };

  const opensAt = runs.map((run) => (run.from >= 0 ? run.from : pageOf(run.at)));

  // The third level (addendum 19 §6): on a book that numbers its divisions,
  // each chapter lists the sections it covers — every unit from its own to
  // the next chapter's — with the number the page itself carries, read from
  // `structureNumbers` so the two cannot disagree. Empty everywhere else.
  const numbers = structureNumbers(file).units;
  /** A collection lists each story's chapters under it (addendum 22 §6). */
  const chaptersInStories = isCollection(file.project.format);
  // Which chapter a unit falls in is its place in the story order, never how
  // many lines went in ahead of it: a book being planned has units with no
  // prose yet, and every one of those counts the same number of lines.
  const order = new Map(unitsInStoryOrder(file).map((unit, index) => [unit.id as string, index]));
  const placeOf = (unitId: string): number => order.get(unitId) ?? -1;

  const entries: ContentsEntry[] = runs.map((run, position_) => {
    const from = opensAt[position_] as number;
    const end = opensAt[position_ + 1] ?? pages.length;
    const own = pages.slice(from, end);
    const first = placeOf(run.placed.marker.unitId as string);
    const next = runs[position_ + 1];
    const until = next ? placeOf(next.placed.marker.unitId as string) : Number.POSITIVE_INFINITY;
    const opened = own.find((page) => page.number > 0)?.number ?? 0;
    // On a collection a story's sections are its chapters (addendum 22 §6):
    // there is no numbering to read, so what stands in the number's place is
    // the section's own title — *II*, *III* — which is the heading the page
    // itself prints. The first section of a story is the story's own
    // opening and is not listed under it.
    const sections =
      numbers.size === 0 && !chaptersInStories
        ? []
        : starts
            .filter((start) => {
              const place = placeOf(start.unit.id as string);
              if (place < first || place >= until) return false;
              if (chaptersInStories) return place > first && start.unit.title.trim().length > 0;
              return numbers.has(start.unit.id as string);
            })
            .map((start) => ({
              // A collection numbers nothing, so the heading goes where a
              // title goes rather than in the number's column, which would
              // hang it outside the text block.
              number: chaptersInStories ? '' : (numbers.get(start.unit.id as string) as string),
              title: start.unit.title,
              // A section with nothing written in it has no line of its own
              // to be found on, so it stands where the chapter's flow stands:
              // on the page the line before it fell on, or the chapter's own
              // page when it is the first thing in the chapter.
              page:
                start.count > 0
                  ? (pages[pageOf(start.at)]?.number ?? 0)
                  : start.at > run.at
                    ? (pages[pageOf(start.at - 1)]?.number ?? 0)
                    : opened,
            }));
    return {
      label: run.placed.label,
      title: run.placed.marker.title,
      // The covers between the scripts belong to no script; the pages do.
      pages: own.filter((page) => page.titlePage === undefined).length,
      // Sheet one is the contents page itself, which is not in `pages` yet.
      sheet: from + 2,
      // What the page it opens on prints on its own face. A cover carries no
      // number, so the number is the first one the division actually has.
      page: opened,
      sections,
    };
  });

  return {
    kind: file.project.format === 'series' ? 'episodes' : 'chapters',
    title: file.project.title,
    entries,
  };
};

/**
 * Number the pages: from one, and from one again at the head of each script.
 *
 * A series is a stack of scripts, not one long document, so **each episode
 * numbers from its own page one** (§17) — page two of episode three is page
 * two, the way it would be if that episode had been printed on its own.
 *
 * The covers and the contents page take no number and give none away: the
 * page after the front page of episode two is that episode's page one, and
 * the leaves between the scripts are counted in neither of them.
 */
const numbered = (pages: Page[], restartAt: ReadonlySet<number>): Page[] => {
  let n = 0;
  return pages.map((page, index) => {
    if (restartAt.has(index)) n = 0;
    const front = page.titlePage !== undefined || page.contents !== undefined;
    return front ? { ...page, number: 0 } : { ...page, number: (n += 1) };
  });
};

/** An annotation: the writer's own note about the text, not the text. */
const annotation = (id: string, text: string): ManuscriptElement => ({
  id: id as ManuscriptElement['id'],
  type: 'general',
  text,
  characterId: null,
  attributes: { annotation: true },
});

/**
 * One unit's manuscript, and whatever annotations this printing asked for.
 *
 * The scene's own things — its number, its summary, what it is linked to —
 * are attached at the scene, ahead of its first beat. The beat labels sit
 * with their beats. All of it is optional and all of it is off by default.
 */
export const unitElements = (
  file: ProjectFile,
  unitId: StructuralUnitId,
  options: ManuscriptOptions,
  sceneNumber?: string,
): ManuscriptElement[] => {
  const unit = file.units.find((candidate) => candidate.id === unitId);
  const body = beatsInScript(file, unitId).flatMap((beat) => {
    const elements =
      options.includeSceneHeadings === false
        ? beat.manuscript.elements.filter((element) => element.type !== 'scene_heading')
        : beat.manuscript.elements;
    if (!options.includeBeatTitles || beat.title.length === 0) return elements;
    const note = annotation(`${beat.id}-title`, `[${beat.title}]`);
    // Under the slugline, never above it: a note above the heading reads as
    // belonging to the scene before.
    return elements[0]?.type === 'scene_heading'
      ? [elements[0], note, ...elements.slice(1)]
      : [note, ...elements];
  });

  // The number rides on the heading itself, so it stays with the scene
  // wherever the page break falls, and prints in the margins rather than
  // taking room from the 60 characters the text is set in.
  const numbered =
    sceneNumber && options.includeSceneNumbers
      ? body.map((element, index) =>
          index === body.findIndex((candidate) => candidate.type === 'scene_heading')
            ? { ...element, attributes: { ...element.attributes, sceneNumber } }
            : element,
        )
      : body;

  const before: ManuscriptElement[] = [];
  if (options.includeSceneSummary && unit && unit.summary.trim().length > 0) {
    before.push(annotation(`${unitId}-summary`, `[${unit.summary.trim()}]`));
  }
  if (options.includeSceneLinks && unit) {
    const related = relatedEntities(file, { type: 'unit', id: unitId })
      .map((entry) => `${entry.link.type.replace(/_/g, ' ')}: ${entry.other.label}`)
      .filter((line) => line.trim().length > 0);
    if (related.length > 0) before.push(annotation(`${unitId}-links`, `[${related.join(' · ')}]`));
  }

  // The annotations follow the heading rather than preceding it: a note
  // above the slugline would read as belonging to the scene before.
  if (before.length === 0) return numbered;
  const headingAt = numbered.findIndex((element) => element.type === 'scene_heading');
  if (headingAt === -1) return [...before, ...numbered];
  return [...numbered.slice(0, headingAt + 1), ...before, ...numbered.slice(headingAt + 1)];
};

export const paginateUnit = (file: ProjectFile, unitId: StructuralUnitId): Page[] =>
  paginateElements(
    beatsInScript(file, unitId).flatMap((beat) => beat.manuscript.elements),
    layoutForFile(file),
  );

/** Page count in the sense the industry means it. */
export const pageCount = (file: ProjectFile): number => paginateProject(file).length;

/**
 * Where the printed pages begin, as element id -> page number, for every
 * page after the first. The Script draws the manuscript as one flow and
 * uses this to rule the page breaks exactly where the printed page has
 * them, without pagination and editing having to be the same thing.
 *
 * Every break after the document's first page of manuscript is ruled, with
 * its own number on it. That includes an episode's page one (§17): it is a
 * break in the flow like any other, and the one a reader most wants to see
 * coming. The covers are not in the flow and rule nothing.
 */
export const pageBreaks = (file: ProjectFile, options: ManuscriptOptions = {}): Map<string, number> => {
  const breaks = new Map<string, number>();
  let started = false;
  for (const page of paginateProject(file, options)) {
    if (page.titlePage || page.contents || page.chapter) continue;
    if (started && page.startsWith) breaks.set(page.startsWith, page.number);
    started = true;
  }
  return breaks;
};
