import type { BookPart, PartKind } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import { newId } from './ids.js';
import { addPart, partsOf, updatePart } from './book-plan.js';
import { glossaryOf } from './back-matter-pages.js';
import { findForIndex, sameHeading } from './book-index.js';

/**
 * **Importing a back-matter page** (addendum 20 §17c, from Ken: *for the
 * appendix and the glossary and the index, you need an option to import that
 * as text or import that as a PDF and it'll just maintain the formatting*).
 *
 * The decision the whole module rests on is that **those are two different
 * promises, and they keep two different things**.
 *
 * **Text becomes records.** The words come in as the page's own — a
 * glossary's terms, an appendix's paragraphs, an index's headings — and the
 * book then sets them in the book's own face, at the book's own size, with
 * the book's running head over them. What *maintain the formatting* means
 * here is the **structure**: which line is a term and which its definition,
 * where a paragraph breaks, which entry hangs under another. It cannot mean
 * the source document's type, because that type belongs to another book.
 *
 * **A PDF becomes pages.** Read literally — *it'll just maintain the
 * formatting* — and the only honest way to keep somebody else's typesetting
 * is to keep their pages, so a PDF comes in as art pages, drawn once at print
 * resolution exactly as §16a brings a barcode in. The cost is real and is
 * said rather than discovered: it is then **a picture of a glossary rather
 * than a glossary**. It is not re-set in this book's face, it carries no
 * running head, it cannot be searched, and it will not reflow in the eBook.
 *
 * And the third thing, which is the one a writer would not think of:
 *
 * **An imported index's page numbers are another book's.** Addendum 10 §3 is
 * that no page number is stored anywhere — this book's index is read off this
 * book's pagination every time, which is what makes it right after the
 * writing moves. So importing an index as **text keeps the headings and drops
 * the numbers**, and what arrives is a **worklist**: every heading the old
 * index had, with how many places in this manuscript mention it. It does not
 * mark anything, because `findForIndex`'s own rule is that a search helps
 * somebody mark and marks nothing — filing every hit would be building a
 * concordance, and which mentions matter is the judgement that makes an index
 * worth reading. Imported as **pages**, the old numbers come in as a picture
 * and are wrong the moment a word is added; the screen says so before the
 * press rather than after it.
 */

/** Which way a file is being brought in. */
export type ImportWay = 'records' | 'pages';

/** The three pages this module reads a file into. */
export const IMPORTABLE_KINDS: readonly PartKind[] = ['appendix', 'glossary', 'index'];

export const mayImport = (kind: PartKind): boolean => IMPORTABLE_KINDS.includes(kind);

export interface ImportedTerm {
  term: string;
  definition: string;
}

/** One line of an old index: its heading, its sub-heading, and what it said. */
export interface ImportedEntry {
  term: string;
  subTerm: string;
  /** The numbers as the file gave them — **kept to be shown as dropped**. */
  pages: string;
}

/** What a file turned into, and what of it became nothing — §4's own rule. */
export interface ReadBackMatter {
  kind: PartKind;
  terms: ImportedTerm[];
  paragraphs: string[];
  entries: ImportedEntry[];
  /** Every line read that became nothing, and why. Never silently dropped. */
  skipped: Array<{ line: string; why: string }>;
}

const empty = (kind: PartKind): ReadBackMatter => ({ kind, terms: [], paragraphs: [], entries: [], skipped: [] });

/** A term as it compares: case and outer space are not part of the word. */
const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

const LINES = /\r\n|\r|\n/;

/**
 * A letter standing alone (*A*, *B*, *— M —*) is the **source page's own
 * divider**, and this page draws its own, so it is read and dropped rather
 * than becoming a one-letter term.
 */
const isLetterDivider = (line: string): boolean => /^[\s—–-]*[A-Za-z][\s—–-]*$/.test(line.trim());

/** The separators a glossary uses between a term and what it means. */
const TERM_SPLIT = /\s*(?:\t|:\s|\s[—–]\s|\s-\s)\s*/;

/**
 * Read a text file into a glossary's terms.
 *
 * A term and its meaning on one line separated by a colon, a dash or a tab;
 * or a term alone on a line with its meaning on the next. A blank line ends
 * an entry, which is what lets a definition run to several lines.
 */
const readTerms = (text: string): ReadBackMatter => {
  const out = empty('glossary');
  const lines = text.split(LINES);
  let open: ImportedTerm | null = null;
  const close = () => {
    if (!open) return;
    if (open.term.length > 0) out.terms.push({ term: open.term, definition: open.definition.trim() });
    open = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      close();
      continue;
    }
    if (isLetterDivider(line)) {
      close();
      out.skipped.push({ line, why: 'a letter heading — this page draws its own' });
      continue;
    }
    // A continuation: the entry is open and this line carries no separator,
    // so it is more of the definition rather than a new term.
    const at = line.search(TERM_SPLIT);
    if (open && at === -1) {
      open.definition = `${open.definition} ${line}`.trim();
      continue;
    }
    close();
    if (at === -1) {
      open = { term: line, definition: '' };
      continue;
    }
    const term = line.slice(0, at).trim();
    const definition = line.slice(at).replace(TERM_SPLIT, '').trim();
    if (term.length === 0) {
      out.skipped.push({ line, why: 'no term before the separator' });
      continue;
    }
    open = { term, definition };
  }
  close();
  return out;
};

/** Read a text file into an appendix's paragraphs: a blank line divides. */
const readParagraphs = (text: string): ReadBackMatter => {
  const out = empty('appendix');
  out.paragraphs = text
    .split(/(?:\r\n|\r|\n)\s*(?:\r\n|\r|\n)/)
    // A paragraph broken across lines in the file is one paragraph: the book
    // breaks its own lines, and keeping the file's would freeze another
    // book's measure into this one.
    .map((block) => block.split(LINES).map((line) => line.trim()).filter((line) => line.length > 0).join(' '))
    .filter((block) => block.length > 0);
  return out;
};

/** The trailing run of page numbers on an index line — `14, 22–25, 31`. */
const INDEX_PAGES = /[\s,]+((?:\d+(?:\s*[–—-]\s*\d+)?)(?:\s*,\s*\d+(?:\s*[–—-]\s*\d+)?)*)\s*$/;

/**
 * Read a text file into an old index's headings.
 *
 * A sub-entry is one the file **indented**, which is how every printed index
 * shows the relation; where nothing is indented every line is a heading of
 * its own, which is the honest reading of a flat list.
 */
const readEntries = (text: string): ReadBackMatter => {
  const out = empty('index');
  let heading = '';
  for (const raw of text.split(LINES)) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim().length === 0) continue;
    if (isLetterDivider(line)) {
      out.skipped.push({ line: line.trim(), why: 'a letter heading — this page draws its own' });
      continue;
    }
    const indented = /^[\s ]{2,}|^\t/.test(raw);
    const found = line.match(INDEX_PAGES);
    const pages = found?.[1]?.trim() ?? '';
    const words = (found ? line.slice(0, found.index) : line).trim().replace(/[.,;\s]+$/, '');
    if (words.length === 0) {
      out.skipped.push({ line: line.trim(), why: 'numbers with no heading' });
      continue;
    }
    // A *see* line is a cross-reference rather than a heading with pages, and
    // the index keeps those as records of their own (addendum 10), so it is
    // read and named rather than filed as a heading nobody wrote.
    if (/\bsee(?:\s+also)?\b/i.test(words) && !found) {
      out.skipped.push({ line: line.trim(), why: 'a cross-reference — add it in Editor ▸ Index…' });
      continue;
    }
    if (indented && heading.length > 0) {
      out.entries.push({ term: heading, subTerm: words, pages });
      continue;
    }
    heading = words;
    out.entries.push({ term: words, subTerm: '', pages });
  }
  return out;
};

/** Read a text file into whatever this page keeps. */
export const readBackMatterText = (kind: PartKind, text: string): ReadBackMatter => {
  if (kind === 'glossary') return readTerms(text);
  if (kind === 'appendix') return readParagraphs(text);
  if (kind === 'index') return readEntries(text);
  return empty(kind);
};

// ------------------------------------------------------------------- offers

export interface ImportOffer {
  can: boolean;
  refusal: string | null;
  /** What pressing it would do, in words. */
  says: string;
  /** What it would add, and what it would leave alone. */
  adding: number;
  already: number;
}

const no = (refusal: string): ImportOffer => ({ can: false, refusal, says: '', adding: 0, already: 0 });

const count = (many: number, one: string, plural = `${one}s`): string => `${many} ${many === 1 ? one : plural}`;

/**
 * What bringing this file in would do, said before it can be asked for —
 * `trackRemoval`'s shape, and **it adds and never overwrites**, which is
 * §17a's rule and is what makes a second press safe.
 */
export const textImportOffer = (file: ProjectFile, part: BookPart, read: ReadBackMatter): ImportOffer => {
  if (!mayImport(part.kind)) return no('Nothing can be imported into this page.');
  if (part.kind === 'glossary') {
    const standing = glossaryOf(part).terms;
    const fresh = read.terms.filter((one) => !standing.some((had) => same(had.term, one.term)));
    if (fresh.length === 0) {
      return no(
        read.terms.length === 0
          ? 'No terms were found in that file. A glossary reads a term and what it means, one to a line.'
          : `Every one of those ${read.terms.length} terms is already on the page. Nothing would change.`,
      );
    }
    return {
      can: true,
      refusal: null,
      says: `Add ${count(fresh.length, 'term')} to the glossary. ${
        read.terms.length - fresh.length > 0
          ? `${count(read.terms.length - fresh.length, 'term')} already on the page ${read.terms.length - fresh.length === 1 ? 'is' : 'are'} left exactly as ${read.terms.length - fresh.length === 1 ? 'it is' : 'they are'}.`
          : 'Nothing already on the page is touched.'
      }`,
      adding: fresh.length,
      already: read.terms.length - fresh.length,
    };
  }
  if (part.kind === 'appendix') {
    if (read.paragraphs.length === 0) return no('There were no words in that file.');
    return {
      can: true,
      refusal: null,
      says: `Add ${count(read.paragraphs.length, 'paragraph')} to the end of this appendix. What is already here stays above ${
        read.paragraphs.length === 1 ? 'it' : 'them'
      }.`,
      adding: read.paragraphs.length,
      already: 0,
    };
  }
  const standing = indexPageOf(part).imported;
  const fresh = read.entries.filter(
    (one) => !standing.some((had) => sameHeading(had.term, one.term) && same(had.subTerm, one.subTerm)),
  );
  if (fresh.length === 0) {
    return no(
      read.entries.length === 0
        ? 'No entries were found in that file. An index reads a heading and its page numbers, one to a line.'
        : 'Every one of those entries is already on the list. Nothing would change.',
    );
  }
  const numbered = fresh.filter((one) => one.pages.length > 0).length;
  return {
    can: true,
    refusal: null,
    // **The dropped numbers are said first**, because it is the one thing a
    // writer would not guess and the one thing they would resent finding out
    // afterwards.
    says: `Take ${count(fresh.length, 'heading')} from that index${
      numbered > 0 ? `, and drop the page numbers on ${numbered === 1 ? 'one of them' : `${numbered} of them`}` : ''
    } — this book works its own out. Nothing is marked: each heading becomes a line to work through.`,
    adding: fresh.length,
    already: read.entries.length - fresh.length,
  };
};

// ------------------------------------------------------- the index worklist

/** The index page's own record: the headings an import brought in. */
export interface IndexPagePlan {
  imported: ImportedEntry[];
}

export const indexPageOf = (part: Pick<BookPart, 'about'>): IndexPagePlan => {
  const about = (part.about ?? {}) as { imported?: unknown };
  const list = Array.isArray(about.imported) ? about.imported : [];
  return {
    imported: list
      .map((one) => one as Partial<ImportedEntry>)
      .filter((one) => typeof one?.term === 'string' && one.term.trim().length > 0)
      .map((one) => ({ term: String(one.term), subTerm: String(one.subTerm ?? ''), pages: String(one.pages ?? '') })),
  };
};

export interface IndexWorkRow extends ImportedEntry {
  /** How many places in **this** manuscript say it. */
  hits: number;
  /** True once this heading carries a mark — a reading, never a stored tick. */
  done: boolean;
}

/**
 * The imported headings as work to do.
 *
 * **Done is read from the marks**, so marking a passage strikes its row off
 * with nothing run, and unmarking puts it back — the colour-is-a-reading rule
 * that the Character Creator, the setups and the book index all rest on. A
 * heading nothing in this manuscript mentions is **said rather than hidden**:
 * it is the most useful row on the list, being a subject the old book covered
 * and this one may not.
 */
export const indexWorklist = (file: ProjectFile, part: Pick<BookPart, 'about'>): IndexWorkRow[] => {
  const marks = file.indexMarks ?? [];
  return indexPageOf(part).imported.map((one) => {
    const phrase = one.subTerm.trim().length > 0 ? one.subTerm : one.term;
    return {
      ...one,
      hits: findForIndex(file, phrase).length,
      done: marks.some(
        (mark) =>
          sameHeading(mark.term, one.term) &&
          (one.subTerm.trim().length === 0 || same(mark.subTerm ?? '', one.subTerm)),
      ),
    };
  });
};

export const describeWorklist = (rows: readonly IndexWorkRow[]): string => {
  if (rows.length === 0) return '';
  const left = rows.filter((one) => !one.done);
  if (left.length === 0) return `All ${count(rows.length, 'imported heading')} ${rows.length === 1 ? 'is' : 'are'} marked.`;
  const absent = left.filter((one) => one.hits === 0).length;
  return `${count(left.length, 'heading')} still to mark${
    absent > 0 ? `, ${absent} of which this manuscript never mentions` : ''
  }.`;
};

/** Take an imported heading off the list — it was marked, or it is not wanted. */
export const dropImportedEntry = (file: ProjectFile, partId: string, at: number): ProjectFile => {
  const part = partsOf(file).find((one) => one.id === partId);
  if (!part) return file;
  const own = indexPageOf(part);
  if (at < 0 || at >= own.imported.length) return file;
  return updatePart(file, partId, {
    about: { ...(part.about ?? {}), imported: own.imported.filter((_, index) => index !== at) },
  });
};

// -------------------------------------------------------------- the imports

/**
 * Bring a read file into the page as records, making the page where the book
 * has none — `captureToGlossary`'s rule: an act makes the reading true rather
 * than requiring it.
 */
export const importTextInto = (file: ProjectFile, partId: string, read: ReadBackMatter): ProjectFile => {
  const part = partsOf(file).find((one) => one.id === partId);
  if (!part || !textImportOffer(file, part, read).can) return file;
  if (part.kind === 'glossary') {
    const own = glossaryOf(part);
    const fresh = read.terms.filter((one) => !own.terms.some((had) => same(had.term, one.term)));
    return updatePart(file, partId, {
      about: {
        ...own,
        terms: [
          ...own.terms,
          ...fresh.map((one) => ({ id: newId() as string, term: one.term, definition: one.definition })),
        ],
      },
    });
  }
  if (part.kind === 'appendix') {
    const standing = part.text.trim();
    const words = read.paragraphs.join('\n\n');
    return updatePart(file, partId, { text: standing.length > 0 ? `${standing}\n\n${words}` : words });
  }
  const own = indexPageOf(part);
  const fresh = read.entries.filter(
    (one) => !own.imported.some((had) => sameHeading(had.term, one.term) && same(had.subTerm, one.subTerm)),
  );
  return updatePart(file, partId, {
    about: { ...(part.about ?? {}), imported: [...own.imported, ...fresh] },
  });
};

// ------------------------------------------------------------ as pages

/** One page of a PDF, already drawn — the host reads, the domain places. */
export interface ReadPage {
  name: string;
  data: string;
  width: number;
  height: number;
}

/**
 * What bringing a PDF in as pages would do — **and what it costs**, which is
 * the half a writer would otherwise find out after the book is printed.
 */
export const pageImportOffer = (kind: PartKind, pages: readonly ReadPage[]): ImportOffer => {
  if (!mayImport(kind)) return no('Nothing can be imported into this page.');
  if (pages.length === 0) return no('That PDF had no pages in it.');
  const name = kind === 'index' ? 'index' : kind === 'glossary' ? 'glossary' : 'appendix';
  return {
    can: true,
    refusal: null,
    says: `Put ${count(pages.length, 'page')} into the back of the book exactly as ${
      pages.length === 1 ? 'it is' : 'they are'
    }. ${
      kind === 'index'
        ? // The refusal that is not a refusal: he asked for it, so it is built
          // — with the one fact that makes it a decision rather than a trap.
          'The page numbers in that index are the old book’s. They will not follow this book’s writing, because they are a picture.'
        : `It keeps its own type and layout, so it is a picture of ${
            name === 'appendix' ? 'an appendix' : 'a glossary'
          } rather than ${name === 'appendix' ? 'an appendix' : 'a glossary'} — no running head, no searching, and it will not reflow in the eBook.`
    }`,
    adding: pages.length,
    already: 0,
  };
};

/**
 * Place the drawn pages as art pages at the back, in order.
 *
 * **An art page is what the book already has for *a picture that is the whole
 * page*** (§8) — edge to edge, nothing set over it, no caption printed — so
 * keeping somebody else's typesetting needed no new kind of page and no new
 * rule in the cutter. The sixteenth time the mechanism was already there.
 */
export const importPagesInto = (
  file: ProjectFile,
  pages: readonly ReadPage[],
  addGraphic: (file: ProjectFile, input: ReadPage) => { file: ProjectFile; assetId: string },
): ProjectFile => {
  let out = file;
  for (const page of pages) {
    const added = addGraphic(out, page);
    const made = addPart(added.file, 'plate', { title: page.name, assetId: added.assetId, inFront: false });
    out = made.file;
  }
  return out;
};
