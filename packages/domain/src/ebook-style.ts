import { bookSettingsOf, faceStackOf, geometryOf, trimOf } from './book-layout.js';
import { chapterPageStyleOf, type LineStyle } from './chapter-style.js';
import type { BookFont } from './entities/book.js';
import type { ProjectFile } from './project-file.js';

/**
 * **What of the Layout room reaches the eBook** (addendum 23 §12, from Ken:
 * *I'm looking at the ebook and the formatting is all messed up compared to
 * what the layout has. The margins are right at the edge and things are
 * skewed. But the pictures aren't right to the edge. So please check the top
 * margins. And make sure that the layout transfers to the ebook*).
 *
 * §1 settled that **nothing about a page survives** — no folio, no running
 * head, no blank verso, no trim — and that is right and stays. What was
 * wrong is how far it was read: the stylesheet was **one fixed sheet of
 * literal numbers** that had never heard of the book, so a writer who set a
 * 5.5 × 8.5 novel in Garamond at eleven point, ranged left, got Times New
 * Roman justified against their own setting with **3% of side margin and
 * none at all at the head** — measured in a 412-pixel reading pane, the text
 * at twelve pixels from the edge while the book sets a tenth of the page.
 *
 * It is this project's recurring correction once more: **an argument about
 * the page, mistaken for an argument about the type.** A trim cannot survive
 * reflow and a *proportion* can; a point size cannot survive the reader's own
 * size and a *ratio to the body* can. So the line drawn here is:
 *
 * - **the page is the printer's** — the trim, the page count, the folio, the
 *   running head, the blank verso, a drop in inches, a template that places a
 *   block at a height on a sheet. None of it transfers, and the log says so;
 * - **the type is the writer's** — the face, the alignment, the indent, the
 *   hyphenation, the case, the weight, the slope, the tracking, and every
 *   size **as a share of the body**. All of it transfers;
 * - **and a margin is a proportion**, which is why the one number a writer
 *   most notices was the one most obviously missing.
 */

/**
 * **The gutter is the one margin a reflowable book has no use for**, which is
 * also the one that depends on how thick the book is (§3b: the inside walks
 * its band with the page count). A screen has no binding, so both sides take
 * the **outside** margin — the thumb margin, which is the reader's — and the
 * count cannot reach anything that is read here.
 *
 * It is passed because `geometryOf` asks for one, and named so that nobody
 * later reads a page count out of a book that has no pages.
 */
export const EBOOK_NOMINAL_PAGES = 1;

export interface EbookMargins {
  /** Each side, as the share of the trim's width the book gives the fore-edge. */
  side: string;
  /** The air at the head of a section, in ems of the body type. */
  head: string;
  /** And at its foot. */
  foot: string;
}

/**
 * **The margins as the proportions they are.**
 *
 * The sides are a percentage, because a percentage padding resolves against
 * the width and the width is what they are about. The head and the foot are
 * in **ems of the body**, because a percentage padding resolves against the
 * width *even at the top* (addendum 20 §9g, learned there by drawing a
 * chapter sink three quarters of the way to where it meant to go) — so the
 * only honest vertical unit here is the type, and *the head margin is so many
 * ems of the body* is a real typographic statement rather than a conversion
 * invented to fill the slot.
 *
 * A reading system adds margins of its own on top of these, which is why
 * nothing here tries to be the last word on the matter; what it stops is a
 * book whose text begins hard against the top of the screen.
 */
export const ebookMargins = (file: ProjectFile): EbookMargins => {
  const settings = bookSettingsOf(file);
  const trim = trimOf(settings, file.project.format);
  const { margins } = geometryOf(settings, file.project.format, EBOOK_NOMINAL_PAGES);
  const size = settings.size > 0 ? settings.size : 11;
  const share = (inches: number, against: number): string => `${((inches / against) * 100).toFixed(2)}%`;
  const ems = (inches: number): string => `${((inches * 72) / size).toFixed(2)}em`;
  return {
    side: share(margins.outside, trim.width),
    head: ems(margins.top),
    foot: ems(margins.bottom),
  };
};

/**
 * **A line of type, said in a reflowable book's own units.**
 *
 * The one conversion that makes the transfer honest is the **size**: a
 * fourteen-point heading in an eleven-point book is not fourteen points on a
 * screen whose type the reader chose, it is *a quarter again as big as the
 * body* — so every size here is a ratio and the body itself is left at the
 * reader's own. What survives is the **relationship**, which is what a book's
 * type is made of.
 *
 * `font-variant` rather than `font-variant-caps`, and both of the hyphen
 * spellings below, because a reading system is not a browser: the older
 * property is the one every one of them understands.
 */
export const lineCss = (one: LineStyle, bodyPt: number, fonts: readonly BookFont[] = []): string[] => {
  const size = bodyPt > 0 ? bodyPt : 11;
  const rules = [
    `font-size:${(one.size / size).toFixed(3)}em`,
    `text-transform:${one.case === 'capitals' ? 'uppercase' : 'none'}`,
    `font-variant:${one.case === 'small_caps' ? 'small-caps' : 'normal'}`,
    `font-weight:${one.bold ? 700 : 400}`,
    `font-style:${one.italic ? 'italic' : 'normal'}`,
    `letter-spacing:${one.tracking / 100}em`,
  ];
  // **Only where it was asked for** (§18): a line nobody has ranged or
  // re-faced says nothing, and goes on taking the page's own answer.
  if (one.align) rules.push(`text-align:${one.align}`);
  if (one.face) rules.push(`font-family:${faceStackOf(one.face, fonts)}`);
  return rules;
};

/** The same, as an attribute, or nothing where there is nothing to say. */
export const lineStyleAttr = (
  one: LineStyle | undefined,
  bodyPt: number,
  fonts: readonly BookFont[] = [],
): string => (one ? ` style="${lineCss(one, bodyPt, fonts).join(';')}"` : '');

/**
 * **The book's own stylesheet.**
 *
 * Everything in it is relative to the reader's type but for the side margins,
 * which are a share of the screen — so a reader who turns their font up gets
 * bigger type in the same proportions, which is the whole point of a
 * reflowable book and the reason nothing here sets a size on `body`.
 */
export const ebookCss = (file: ProjectFile): string => {
  const settings = bookSettingsOf(file);
  const margins = ebookMargins(file);
  const face = faceStackOf(settings.face, settings.fonts);
  const chapter = chapterPageStyleOf(file);
  const body = settings.size > 0 ? settings.size : 11;
  /**
   * **And it closes its own last declaration.** Driving the real file caught
   * it: joining with `'; '` and nothing at the end made the rule read
   * `letter-spacing:0em text-align: center`, which is one invalid
   * declaration rather than two good ones — so the heading lost its centring
   * **and** its tracking, silently, and a chapter opened ranged left in a
   * book that centres its openings. A fragment pasted into a rule has to end
   * the way a declaration ends.
   */
  const line = (one: LineStyle): string => `${lineCss(one, body, settings.fonts).join('; ')};`;
  /**
   * **The switches the writer set**, which the sheet had hard-coded against
   * them: a book ranged left printed justified in the eBook, which on a
   * narrow column is the stretched word spacing Ken saw and called skewed.
   */
  const align = settings.justify ? 'justify' : 'left';
  const hyphens = settings.hyphenate ? 'auto' : 'manual';
  /**
   * **Indented or blocked** (spec §6.4), which the book has had since before
   * there was a Layout room and the eBook indented regardless — so a writer
   * who set blocked paragraphs got a book that looked like somebody else's.
   * Blocked is an empty line between paragraphs and no indent, which is what
   * `.bk-blocked` draws on the page.
   */
  const blocked = file.settings.paragraphStyle === 'blocked';
  return `/* VC Writer eBook stylesheet: the book's own type, in the reader's own size. */
body {
  margin: 0;
  padding: ${margins.head} ${margins.side} ${margins.foot};
  font-family: ${face};
  text-align: ${align};
  hyphens: ${hyphens};
  -webkit-hyphens: ${hyphens};
  -epub-hyphens: ${hyphens};
}
h1, h2 { font-weight: normal; page-break-after: avoid; }
h1.book-title { ${line(chapter.title)} text-align: center; margin: 3em 0 1em; }
p.subtitle { text-align: center; margin: 0.5em 0 1em; }
p.author { text-align: center; font-size: 1.2em; margin: 1em 0; }
p.imprint { text-align: center; font-size: 0.9em; margin-top: 4em; }
h1.chapter-title, h1.part-title { ${line(chapter.title)} text-align: center; margin: 3em 0 1.5em; }
.chapter-label { display: block; ${line(chapter.number)} margin-bottom: 0.6em; }
.chapter-name { display: block; }
p.device { text-align: center; margin: 1em 0; }
p.device img { max-width: 40%; height: auto; }
blockquote.epigraph { margin: 1em 15% 2em; ${line(chapter.epigraph)} }
p.summary { margin: 0 8% 2em; ${line(chapter.summary)} }
p.p { margin: 0 0 ${blocked ? '1em' : '0'}; text-indent: ${blocked ? '0' : '1.5em'}; text-align: ${align}; }
p.p.first { text-indent: 0; }
p.p.opens-small-caps::first-line { font-variant: small-caps; }
p.p.opens-drop::first-letter { font-size: 3em; float: left; line-height: 0.8; margin: 0.05em 0.1em 0 0; }
p.p.left { text-align: left; text-indent: 0; }
p.p.center { text-align: center; text-indent: 0; }
p.p.right { text-align: right; text-indent: 0; }
p.p.justify { text-align: justify; }
h2.heading { font-size: 1.2em; margin: 2em 0 1em; text-align: left; }
blockquote { margin: 1em 8%; }
blockquote p { text-indent: 0; }
p.break { text-align: center; margin: 1.5em 0; text-indent: 0; }
figure { margin: 1.5em 0; text-align: center; page-break-inside: avoid; }
.inset { float: left; margin: 0.2em 1em 0.3em 0; }
.inset-right { float: right; margin: 0.2em 0 0.3em 1em; }
.inset img { display: block; width: 100%; height: auto; }
.inset .cap { display: block; font-size: 0.8em; text-align: center; margin-top: 0.3em; }
figure img { max-width: 100%; height: auto; }
figcaption { font-size: 0.85em; margin-top: 0.5em; }
img.cover { max-width: 100%; max-height: 100%; margin: 0 auto; display: block; }
.words p { text-align: center; text-indent: 0; margin: 0.3em 0; }
/* **A blank line the writer typed takes a line** (addendum 20 §9as), by
   generated content rather than by a character in their own words — the
   printed page's rule, said in the reader's own units. */
p.gap::before { content: "\\200B"; }
.words { margin-top: 30%; }
.copyright p { font-size: 0.85em; text-indent: 0; margin: 0.2em 0; }
.u { text-decoration: underline; }
`;
};

/**
 * **What the journey did to the book, in the writer's own words** — and the
 * half of it that is now a transfer rather than a loss.
 *
 * The old log said *the trim and margins were ignored* and *the face and size
 * are the reader's*, both of which were true and one and a half of which were
 * a decision rather than a necessity. What is said now is the line this
 * module draws, which is also what a writer needs to know before they look at
 * the file and conclude their Layout work went nowhere.
 */
export const ebookTransferLog = (file: ProjectFile): string[] => {
  const settings = bookSettingsOf(file);
  const trim = trimOf(settings, file.project.format);
  const margins = ebookMargins(file);
  return [
    'Page numbers, running heads and blank versos were left out: a reflowable book has no pages.',
    `The trim (${trim.width} × ${trim.height} in) could not travel, but its proportions did: the margins are ${margins.side} of the screen at the sides and ${margins.head} of the body type at the head.`,
    `The book's type travelled — the face, how it is ranged, the indent, the hyphenation, and every size as a share of the body — so the reader's own size still rules. No font file was embedded, so a device without ${settings.face.replace(/_/g, ' ')} falls back.`,
  ];
};
