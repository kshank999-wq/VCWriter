import { z } from 'zod';
import type { BookPart, PartKind } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { bookNames } from './book-layout.js';

/**
 * **What each back-matter page holds** (addendum 20 §17, from Ken's handoff
 * §3.2–§3.7) — the four pages whose first section is a list of records rather
 * than a block of prose.
 *
 * All of it rides in the part's own `about` JSON, which is `titlePage`'s and
 * `copyright`'s precedent: these are parts of a page rather than records of
 * their own, so **there is no migration and no table**. A page nobody has
 * opened parses as its defaults and prints exactly what it printed.
 */

// ------------------------------------------------------------------ appendix

/**
 * How the appendices are lettered. **The label itself is a reading** —
 * `appendixLabel` works it out from where the appendix falls among its
 * fellows, so moving one relabels the rest with nothing run and there is
 * nowhere to type *Appendix C* by hand. It is the chapter number's rule
 * (addendum 02 §12a) and the figure number's, for the seventh time.
 */
export const APPENDIX_LABELS = ['letters', 'numbers', 'roman'] as const;
export type AppendixLabels = (typeof APPENDIX_LABELS)[number];

export const APPENDIX_LABEL_WORDS: Record<AppendixLabels, string> = {
  letters: 'A, B, C',
  numbers: '1, 2, 3',
  roman: 'I, II, III',
};

export const appendixSchema = z.object({
  /** How this book letters them. Every appendix reads the first one's. */
  labels: z.enum(APPENDIX_LABELS).default('letters'),
  /** Whether each appendix begins its own page. */
  ownPage: z.boolean().default(true),
});
export type Appendix = z.infer<typeof appendixSchema>;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

/** The label an appendix would print, from where it falls. Never stored. */
export const appendixLabel = (at: number, labels: AppendixLabels): string => {
  if (labels === 'numbers') return String(at + 1);
  if (labels === 'roman') return ROMAN[at] ?? String(at + 1);
  return String.fromCharCode(65 + (at % 26));
};

export const appendixOf = (part: Pick<BookPart, 'about'>): Appendix => appendixSchema.parse(part.about ?? {});

// ------------------------------------------------------------------ glossary

export const TERM_STYLES = ['bold', 'small_caps', 'italic'] as const;
export type TermStyle = (typeof TERM_STYLES)[number];

export const TERM_STYLE_WORDS: Record<TermStyle, string> = {
  bold: 'Bold',
  small_caps: 'Small caps',
  italic: 'Italic',
};

/** Run-in sets *Term — definition*; stacked puts the definition under it. */
export const GLOSSARY_LAYOUTS = ['run_in', 'stacked'] as const;
export type GlossaryLayout = (typeof GLOSSARY_LAYOUTS)[number];

export const glossaryTermSchema = z.object({
  id: z.string(),
  term: z.string().default(''),
  definition: z.string().default(''),
});
export type GlossaryTerm = z.infer<typeof glossaryTermSchema>;

export const glossarySchema = z.object({
  terms: z.array(glossaryTermSchema).default([]),
  sorted: z.boolean().default(true),
  /** Letters over the groups. Meaningless unsorted, so it reads `sorted` too. */
  letterHeadings: z.boolean().default(false),
  termStyle: z.enum(TERM_STYLES).default('bold'),
  layout: z.enum(GLOSSARY_LAYOUTS).default('run_in'),
});
export type Glossary = z.infer<typeof glossarySchema>;

export const glossaryOf = (part: Pick<BookPart, 'about'>): Glossary => glossarySchema.parse(part.about ?? {});

/**
 * The terms as the page prints them: sorted where the page asks, in the
 * writer's order where it does not. **A reading**, so nothing holds a second
 * copy of the order.
 */
export const glossaryEntries = (part: Pick<BookPart, 'about'>): GlossaryTerm[] => {
  const own = glossaryOf(part);
  const terms = own.terms.filter((one) => one.term.trim().length > 0);
  return own.sorted ? [...terms].sort((a, b) => a.term.localeCompare(b.term)) : terms;
};

/** Which letter each entry falls under, for the headings the page may print. */
export const glossaryLetter = (term: string): string => (term.trim()[0] ?? '').toUpperCase() || '#';

// -------------------------------------------------------------- bibliography

export const CITATION_STYLES = ['chicago', 'mla', 'apa'] as const;
export type CitationStyle = (typeof CITATION_STYLES)[number];

export const CITATION_STYLE_WORDS: Record<CitationStyle, string> = {
  chicago: 'Chicago',
  mla: 'MLA',
  apa: 'APA',
};

export const sourceSchema = z.object({
  id: z.string(),
  /** *Last, First*, as a book's bibliography prints it. */
  author: z.string().default(''),
  title: z.string().default(''),
  city: z.string().default(''),
  publisher: z.string().default(''),
  year: z.string().default(''),
  /**
   * An entry the writer typed or a file gave whole. **A style never rewrites
   * it** — the handoff's own rule — because the fields it would need are not
   * there and guessing them would put words in a citation.
   */
  raw: z.string().default(''),
});
export type Source = z.infer<typeof sourceSchema>;

export const bibliographySchema = z.object({
  sources: z.array(sourceSchema).default([]),
  style: z.enum(CITATION_STYLES).default('chicago'),
  hangingIndent: z.boolean().default(true),
  /** Off is the order they were added, which an import's order preserves. */
  sortByAuthor: z.boolean().default(true),
});
export type Bibliography = z.infer<typeof bibliographySchema>;

export const bibliographyOf = (part: Pick<BookPart, 'about'>): Bibliography =>
  bibliographySchema.parse(part.about ?? {});

/** The surname a source sorts under: what stands before the first comma. */
const surname = (author: string): string => (author.split(',')[0] ?? author).trim().toLowerCase();

/** An author's initial, for APA's *Last, F.* */
const initial = (author: string): string => {
  const first = (author.split(',')[1] ?? '').trim();
  return first ? `${first[0]}.` : '';
};

/**
 * One source, set in the style the page has chosen.
 *
 * **A free-text entry is returned as written.** A style is a rule about
 * *fields*, and an entry that has none cannot be restyled without inventing
 * the parts — so it is kept, and the screen says a style does not reach it.
 */
export const citation = (source: Source, style: CitationStyle): string => {
  const own = source.raw.trim();
  if (own.length > 0) return own;
  const author = source.author.trim();
  const title = source.title.trim();
  const year = source.year.trim();
  const city = source.city.trim();
  const publisher = source.publisher.trim();
  const bits: string[] = [];
  if (style === 'apa') {
    const named = author ? `${(author.split(',')[0] ?? '').trim()}, ${initial(author)}`.trim() : '';
    if (named) bits.push(named);
    if (year) bits.push(`(${year}).`);
    if (title) bits.push(`${title}.`);
    if (publisher) bits.push(`${publisher}.`);
    return bits.join(' ').replace(/\s+/g, ' ').trim();
  }
  if (author) bits.push(`${author}.`);
  if (title) bits.push(`${title}.`);
  if (style === 'chicago') {
    const house = [city, publisher].filter(Boolean).join(': ');
    const tail = [house, year].filter(Boolean).join(', ');
    if (tail) bits.push(`${tail}.`);
  } else {
    const tail = [publisher, year].filter(Boolean).join(', ');
    if (tail) bits.push(`${tail}.`);
  }
  return bits.join(' ').replace(/\s+/g, ' ').trim();
};

/** Whether a style reaches this entry at all — free text is kept as written. */
export const styleReaches = (source: Source): boolean => source.raw.trim().length === 0;

/** The sources as the page prints them, each already set in its style. */
export const bibliographyEntries = (
  part: Pick<BookPart, 'about'>,
): Array<{ source: Source; text: string; styled: boolean }> => {
  const own = bibliographyOf(part);
  const listed = own.sources.filter((one) => citation(one, own.style).length > 0);
  const order = own.sortByAuthor ? [...listed].sort((a, b) => surname(a.author).localeCompare(surname(b.author))) : listed;
  return order.map((source) => ({ source, text: citation(source, own.style), styled: styleReaches(source) }));
};

// ------------------------------------------------------------- reader extras

export const EXTRA_KINDS = ['newsletter', 'questions', 'preview', 'also_by'] as const;
export type ExtraKind = (typeof EXTRA_KINDS)[number];

export const EXTRA_WORDS: Record<ExtraKind, { label: string; note: string; heading: string }> = {
  newsletter: { label: 'Newsletter sign-up', note: 'a link, and a code to scan', heading: 'Want More?' },
  questions: { label: 'Discussion questions', note: 'for a reading group', heading: 'Questions for Discussion' },
  preview: { label: 'Preview chapter', note: 'the opening of the next book', heading: 'A Sneak Peek' },
  also_by: { label: 'Also by the author', note: 'the other titles', heading: 'Also by' },
};

export const QUESTION_NUMBERING = ['numbers', 'bullets'] as const;
export type QuestionNumbering = (typeof QUESTION_NUMBERING)[number];

export const ALSO_BY_LAYOUTS = ['titles', 'covers'] as const;
export type AlsoByLayout = (typeof ALSO_BY_LAYOUTS)[number];

export const readerExtraSchema = z.object({
  kind: z.enum(EXTRA_KINDS).default('newsletter'),
  /** The newsletter's. */
  message: z.string().default(''),
  link: z.string().default(''),
  /** A printed code, made from the link when the book is exported. */
  qr: z.boolean().default(true),
  liveLink: z.boolean().default(true),
  /** The discussion questions'. */
  questions: z.array(z.object({ id: z.string(), text: z.string().default('') })).default([]),
  numbering: z.enum(QUESTION_NUMBERING).default('numbers'),
  /** The other titles'. */
  titles: z.array(z.object({ id: z.string(), title: z.string().default(''), series: z.string().default('') })).default([]),
  layout: z.enum(ALSO_BY_LAYOUTS).default('titles'),
  /** The preview chapter's lead-in, set in italic above the extract. */
  leadIn: z.string().default(''),
});
export type ReaderExtra = z.infer<typeof readerExtraSchema>;

export const readerExtraOf = (part: Pick<BookPart, 'about'>): ReaderExtra => readerExtraSchema.parse(part.about ?? {});

/**
 * The heading a kind gives itself. *Also by* takes the book's author, which
 * is why it is a reading rather than a string in the table: renaming the
 * author renames the page with nothing run.
 */
export const extraHeading = (file: ProjectFile, kind: ExtraKind): string =>
  kind === 'also_by' ? `Also by ${bookNames(file).author}` : EXTRA_WORDS[kind].heading;

/** The smallest a printed code may be and still scan (the handoff's §3.7). */
export const QR_MINIMUM_INCHES = 0.8;

/**
 * What a reader extra will print, or why it will not. A link that cannot be
 * read is **warned about and never blocked**, which is the handoff's own
 * rule: a book with a rough URL in it is the writer's business.
 */
export const extraWarning = (part: Pick<BookPart, 'about'>): string | null => {
  const own = readerExtraOf(part);
  if (own.kind !== 'newsletter') return null;
  const link = own.link.trim();
  if (link.length === 0) return own.qr ? 'No link yet, so no code will print.' : null;
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(link) ? null : 'That does not read as a web address. It will print as written.';
};

// ------------------------------------------------------------------ defaults

/**
 * **What each page starts as** (the handoff's §3 table): the sink, the text
 * size, the columns, the folio and the side it opens on, per kind.
 *
 * It corrects what shipped an hour before it, and the correction is worth
 * keeping. The first version gave all seven *At the head* on §7a's rule —
 * a style starts as exactly what the page prints, and a prose part's `drop`
 * had been stored and never read. That rule is about **not moving work
 * somebody did**; it is not a reason to withhold a design from a page that
 * has never had one, which is what the handoff is for. So the table is the
 * default and **At the head stays as the fourth step**, so a writer who
 * wants the older look can say so in one press.
 */
export const BACK_MATTER_DEFAULTS: Partial<
  Record<PartKind, { sink: 'head' | 'shallow' | 'standard' | 'deep'; size: number; columns: number; folio: boolean; recto: boolean }>
> = {
  acknowledgements: { sink: 'standard', size: 11, columns: 1, folio: true, recto: false },
  appendix: { sink: 'standard', size: 10, columns: 1, folio: true, recto: false },
  glossary: { sink: 'standard', size: 10, columns: 1, folio: true, recto: false },
  bibliography: { sink: 'standard', size: 10, columns: 1, folio: true, recto: false },
  index: { sink: 'shallow', size: 9.5, columns: 2, folio: true, recto: false },
  about_the_author: { sink: 'standard', size: 11, columns: 1, folio: false, recto: false },
  reader_extra: { sink: 'deep', size: 11, columns: 1, folio: false, recto: true },
};
