import { nowIso } from './entities/common.js';
import { indexMarkSchema, indexRefSchema, type IndexMark, type IndexRef } from './entities/book-index.js';
import { newId } from './ids.js';
import type { BeatId, IndexMarkId, IndexRefId, ManuscriptElementId } from './ids.js';
import type { ProjectFile } from './project-file.js';
import type { ProjectFormat } from './entities/project.js';
import { isProseFormat } from './formats.js';

/**
 * The back-of-book index (addendum 10).
 *
 * A contents page and an index are not the same thing said twice. A contents
 * page lists the **divisions of the work in the order they happen**, and this
 * product has had one since addendum 02 §17. An index lists **what the book is
 * about, alphabetically, wherever it is discussed**, and nothing before this
 * built one.
 *
 * Four decisions carry it.
 *
 * **A mark is an anchor the writer places; it is never a search.** Indexing
 * every occurrence of a word is what a concordance does, and it produces an
 * index full of the word turning up in passing. A real index says *where this
 * is discussed*, and only the person who wrote it knows where that is. So the
 * writer marks the passage — helped by a search, which is a different thing
 * from being replaced by one.
 *
 * **The heading is the writer's words, not the passage's.** A paragraph about
 * the lens is filed under *lenses, Fresnel*. An index that could only use the
 * words on the page would be the concordance again, wearing a hat.
 *
 * **No page number is ever stored.** A page is where something lands once the
 * book is laid out, so the index is computed from the pagination every time —
 * the same decision the contents page makes, and the reason Ken's *it
 * automatically updates the page number if it shifts* needs nothing to run.
 * There is no *rebuild the index* anywhere, because there is nothing to
 * rebuild.
 *
 * **Consecutive pages collapse into a run.** `14–17`, not `14, 15, 16, 17`.
 * That is what an index looks like, and it is a pure reading of the numbers
 * rather than anything the writer has to maintain.
 */

// ------------------------------------------------------------ whose book

/**
 * Whether this format has an index at all.
 *
 * A book has one. A screenplay does not, and neither does a series — a stack
 * of scripts each numbering from its own page one (addendum 02 §17) has no
 * single page 34 for an entry to point at, which is the same reason its
 * contents page counts sheets instead.
 */
export const hasBookIndex = (format: ProjectFormat): boolean =>
  isProseFormat(format);

// ------------------------------------------------------------- the marks

export const markForIndex = (
  file: ProjectFile,
  input: {
    term: string;
    subTerm?: string;
    beatId: BeatId;
    elementId: ManuscriptElementId;
    quote?: string;
    principal?: boolean;
  },
): { file: ProjectFile; mark: IndexMark | null } => {
  const term = input.term.trim();
  // A heading with no words is not a heading. Refused rather than stored
  // empty, because an index with a blank entry in it reads as a bug.
  if (term.length === 0) return { file, mark: null };

  const subTerm = (input.subTerm ?? '').trim();
  // The same passage under the same heading twice is one mark: marking it
  // again is not a second occurrence, it is the same writer doing the same
  // thing twice.
  const standing = (file.indexMarks ?? []).find(
    (one) =>
      one.elementId === input.elementId &&
      sameHeading(one.term, term) &&
      sameHeading(one.subTerm, subTerm),
  );
  if (standing) return { file, mark: standing };

  const at = nowIso();
  const mark = indexMarkSchema.parse({
    id: newId<IndexMarkId>(),
    projectId: file.project.id,
    term,
    subTerm,
    beatId: input.beatId,
    elementId: input.elementId,
    quote: (input.quote ?? '').slice(0, 400),
    principal: input.principal ?? false,
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, indexMarks: [...(file.indexMarks ?? []), mark] }, mark };
};

export const updateIndexMark = (
  file: ProjectFile,
  markId: IndexMarkId,
  patch: Partial<Pick<IndexMark, 'term' | 'subTerm' | 'principal'>>,
): ProjectFile => ({
  ...file,
  indexMarks: (file.indexMarks ?? []).map((mark) =>
    mark.id === markId
      ? indexMarkSchema.parse({
          ...mark,
          ...patch,
          ...(patch.term === undefined ? {} : { term: patch.term.trim() }),
          ...(patch.subTerm === undefined ? {} : { subTerm: patch.subTerm.trim() }),
          updatedAt: nowIso(),
        })
      : mark,
  ),
});

export const unmarkIndex = (file: ProjectFile, markId: IndexMarkId): ProjectFile => ({
  ...file,
  indexMarks: (file.indexMarks ?? []).filter((mark) => mark.id !== markId),
});

/**
 * Rename a heading everywhere it is used.
 *
 * The one bulk edit an index needs and the one a writer will reach for: having
 * filed forty passages under *lighthouse* they decide it should be
 * *lighthouses*. Doing it mark by mark is how an index ends up with both.
 */
export const renameHeading = (
  file: ProjectFile,
  from: { term: string; subTerm?: string },
  to: { term: string; subTerm?: string },
): ProjectFile => {
  const term = to.term.trim();
  if (term.length === 0) return file;
  const subTerm = (to.subTerm ?? '').trim();
  const at = nowIso();
  const matches = (one: { term: string; subTerm: string }) =>
    sameHeading(one.term, from.term) && sameHeading(one.subTerm, from.subTerm ?? '');

  return {
    ...file,
    indexMarks: (file.indexMarks ?? []).map((mark) =>
      matches(mark) ? { ...mark, term, subTerm, updatedAt: at } : mark,
    ),
    indexRefs: (file.indexRefs ?? []).map((ref) =>
      matches(ref) ? { ...ref, term, subTerm, updatedAt: at } : ref,
    ),
  };
};

// --------------------------------------------------- see, and see also

export const addIndexRef = (
  file: ProjectFile,
  input: { term: string; subTerm?: string; kind: IndexRef['kind']; target: string },
): { file: ProjectFile; ref: IndexRef | null } => {
  const term = input.term.trim();
  const target = input.target.trim();
  // Both ends or neither: a cross-reference to nowhere is a line of print
  // that wastes the reader's time, and one under no heading cannot be shown.
  if (term.length === 0 || target.length === 0) return { file, ref: null };
  // *lighthouse, see lighthouse* is a loop somebody will follow once.
  if (sameHeading(term, target) && (input.subTerm ?? '').trim().length === 0) {
    return { file, ref: null };
  }

  const at = nowIso();
  const ref = indexRefSchema.parse({
    id: newId<IndexRefId>(),
    projectId: file.project.id,
    term,
    subTerm: (input.subTerm ?? '').trim(),
    kind: input.kind,
    target,
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, indexRefs: [...(file.indexRefs ?? []), ref] }, ref };
};

export const removeIndexRef = (file: ProjectFile, refId: IndexRefId): ProjectFile => ({
  ...file,
  indexRefs: (file.indexRefs ?? []).filter((ref) => ref.id !== refId),
});

// ----------------------------------------------------------- page runs

export interface PageRun {
  from: number;
  to: number;
  /** Whether this run is a principal discussion, printed bold. */
  principal: boolean;
}

/**
 * Page numbers as an index prints them.
 *
 * Consecutive pages collapse — `14–17` rather than four numbers — which is
 * what an index looks like and is a reading rather than anything to maintain.
 *
 * **A principal discussion never merges with a passing mention**, even when
 * they are next to each other: the bold is the only thing on the line
 * distinguishing the two, and `14–17` set half bold is not a thing type can
 * do. So 14 bold and 15 plain stay `14, 15`, which says the true thing.
 */
export const collapseRuns = (pages: readonly { page: number; principal: boolean }[]): PageRun[] => {
  const seen = new Map<number, boolean>();
  for (const entry of pages) {
    if (entry.page <= 0) continue;
    // Marked once as principal is principal: a writer saying *this is the
    // discussion* is not undone by a second mark on the same page.
    seen.set(entry.page, (seen.get(entry.page) ?? false) || entry.principal);
  }

  const runs: PageRun[] = [];
  for (const page of [...seen.keys()].sort((a, b) => a - b)) {
    const principal = seen.get(page) as boolean;
    const last = runs[runs.length - 1];
    if (last && last.principal === principal && page === last.to + 1) last.to = page;
    else runs.push({ from: page, to: page, principal });
  }
  return runs;
};

/** A run as it reads on the page: `14`, `14–17`. An en dash, as books use. */
export const runText = (run: PageRun): string =>
  run.from === run.to ? String(run.from) : `${run.from}–${run.to}`;

/** Every run of a heading, as one string. */
export const runsText = (runs: readonly PageRun[]): string => runs.map(runText).join(', ');

// ----------------------------------------------------------- the reading

export interface IndexSubEntry {
  subTerm: string;
  runs: PageRun[];
  seeAlso: string[];
  /** Marks whose passage has gone from the manuscript. */
  orphans: number;
}

export interface IndexHeading {
  term: string;
  /** The heading's own pages — marks filed under it with no sub-heading. */
  runs: PageRun[];
  subEntries: IndexSubEntry[];
  /** A redirect: this heading has no pages of its own and points elsewhere. */
  see: string[];
  seeAlso: string[];
  orphans: number;
}

/** A letter of the alphabet, and the headings under it. */
export interface IndexLetter {
  letter: string;
  headings: IndexHeading[];
}

export interface BookIndex {
  letters: IndexLetter[];
  /** Every heading, flat, for a screen that lists them. */
  headings: IndexHeading[];
  /** Marks pointing at writing that has gone. Shown, never silently dropped. */
  orphans: IndexMark[];
}

/** Two headings are the same heading if they differ only in case or padding. */
export const sameHeading = (one: string, two: string): boolean =>
  one.trim().toLocaleLowerCase() === two.trim().toLocaleLowerCase();

/**
 * How an index sorts: alphabetically, ignoring case, with numbers read as
 * numbers so *Chapter 2* comes before *Chapter 10*.
 */
const compareHeadings = (one: string, two: string): number =>
  one.localeCompare(two, undefined, { sensitivity: 'base', numeric: true });

/**
 * The letter a heading files under. Anything not a letter goes under a single
 * heading of its own at the front, which is what books do with numerals and
 * symbols rather than inventing twenty headings nobody reads.
 */
const letterFor = (term: string): string => {
  const first = term.trim().charAt(0).toLocaleUpperCase();
  return /\p{L}/u.test(first) ? first : '#';
};

/**
 * The index, read off the marks and the pagination.
 *
 * `pageOfElement` is handed in rather than computed here: only the paginator
 * knows where an element landed, and the domain's rule is that a page number
 * is *worked out*, never stored. An element it does not know is a mark whose
 * passage has gone — counted as an orphan and shown, because a mark silently
 * dropped is a writer wondering where their entry went.
 */
/** One sub-heading while it is being gathered. */
interface Gathered {
  subTerm: string;
  pages: { page: number; principal: boolean }[];
  seeAlso: string[];
  orphans: number;
}

/**
 * The sub-heading, made on first sight.
 *
 * One place makes it, because a sub-entry is created by whichever of a mark
 * and a cross-reference arrives first and two constructors are how the two
 * begin to differ.
 */
const subFor = (subs: Map<string, Gathered>, subTerm: string): Gathered => {
  const key = subTerm.trim().toLocaleLowerCase();
  const found = subs.get(key);
  if (found) return found;
  const made: Gathered = { subTerm: subTerm.trim(), pages: [], seeAlso: [], orphans: 0 };
  subs.set(key, made);
  return made;
};

export const bookIndex = (input: {
  marks: readonly IndexMark[];
  refs: readonly IndexRef[];
  /** Where an element landed, or 0 for one that is no longer in the book. */
  pageOfElement: (elementId: string) => number;
}): BookIndex => {
  const orphans: IndexMark[] = [];

  /** Marks and refs gathered by heading, then by sub-heading. */
  const byTerm = new Map<
    string,
    {
      term: string;
      own: { page: number; principal: boolean }[];
      ownOrphans: number;
      subs: Map<string, Gathered>;
      see: string[];
      seeAlso: string[];
    }
  >();

  const headingFor = (term: string) => {
    const key = term.trim().toLocaleLowerCase();
    const found = byTerm.get(key);
    if (found) return found;
    // The first spelling seen wins the display, so a heading typed two ways
    // still collapses into one and reads as whichever the writer wrote first.
    const made = {
      term: term.trim(),
      own: [] as { page: number; principal: boolean }[],
      ownOrphans: 0,
      subs: new Map<string, Gathered>(),
      see: [] as string[],
      seeAlso: [] as string[],
    };
    byTerm.set(key, made);
    return made;
  };

  for (const mark of input.marks) {
    if (mark.term.trim().length === 0) continue;
    const heading = headingFor(mark.term);
    const page = input.pageOfElement(mark.elementId as string);
    const gone = page <= 0;
    if (gone) orphans.push(mark);

    const sub = mark.subTerm.trim();
    if (sub.length === 0) {
      if (gone) heading.ownOrphans += 1;
      else heading.own.push({ page, principal: mark.principal });
      continue;
    }

    const entry = subFor(heading.subs, sub);
    if (gone) entry.orphans += 1;
    else entry.pages.push({ page, principal: mark.principal });
  }

  for (const ref of input.refs) {
    if (ref.term.trim().length === 0 || ref.target.trim().length === 0) continue;
    const heading = headingFor(ref.term);
    const sub = ref.subTerm.trim();
    if (sub.length === 0) {
      (ref.kind === 'see' ? heading.see : heading.seeAlso).push(ref.target.trim());
      continue;
    }
    // A sub-heading takes *see also* and not *see*: a redirect from a
    // sub-heading is a redirect from the heading it is under, said in a place
    // the reader has to find first.
    const entry = subFor(heading.subs, sub);
    if (ref.kind === 'see_also') entry.seeAlso.push(ref.target.trim());
  }

  const headings: IndexHeading[] = [...byTerm.values()]
    .map((entry) => ({
      term: entry.term,
      runs: collapseRuns(entry.own),
      subEntries: [...entry.subs.values()]
        .map((sub) => ({
          subTerm: sub.subTerm,
          runs: collapseRuns(sub.pages),
          seeAlso: sub.seeAlso,
          orphans: sub.orphans,
        }))
        .sort((a, b) => compareHeadings(a.subTerm, b.subTerm)),
      see: entry.see,
      seeAlso: entry.seeAlso,
      orphans:
        entry.ownOrphans + [...entry.subs.values()].reduce((total, sub) => total + sub.orphans, 0),
    }))
    // A heading with nothing under it at all is not printed: it has no pages,
    // no sub-entries and no cross-reference, so it is a word on its own.
    .filter(
      (heading) =>
        heading.runs.length > 0 ||
        heading.subEntries.length > 0 ||
        heading.see.length > 0 ||
        heading.seeAlso.length > 0,
    )
    .sort((a, b) => compareHeadings(a.term, b.term));

  const letters: IndexLetter[] = [];
  for (const heading of headings) {
    const letter = letterFor(heading.term);
    const last = letters[letters.length - 1];
    if (last && last.letter === letter) last.headings.push(heading);
    else letters.push({ letter, headings: [heading] });
  }

  return { letters, headings, orphans };
};

// --------------------------------------------------------- helping to mark

export interface IndexCandidate {
  beatId: BeatId;
  elementId: ManuscriptElementId;
  /** The whole line, so a writer can tell one hit from another. */
  text: string;
  /** Whether this passage is already marked under the term being searched. */
  marked: boolean;
}

/**
 * Where a phrase appears in the manuscript, so the writer can pick which of
 * them are worth indexing.
 *
 * **This helps somebody mark; it never marks anything.** That is the line the
 * whole module is drawn on: a search that filed every hit would be building a
 * concordance, and the writer's judgement about which mentions matter is the
 * only thing that makes an index worth reading.
 */
export const findForIndex = (
  file: ProjectFile,
  phrase: string,
  under = '',
): IndexCandidate[] => {
  const wanted = phrase.trim().toLocaleLowerCase();
  if (wanted.length === 0) return [];

  const marked = new Set(
    (file.indexMarks ?? [])
      .filter((mark) => under.trim().length === 0 || sameHeading(mark.term, under))
      .map((mark) => mark.elementId as string),
  );

  const found: IndexCandidate[] = [];
  for (const beat of file.beats) {
    for (const element of beat.manuscript.elements) {
      if (!element.text.toLocaleLowerCase().includes(wanted)) continue;
      found.push({
        beatId: beat.id,
        elementId: element.id,
        text: element.text,
        marked: marked.has(element.id as string),
      });
    }
  }
  return found;
};

/**
 * One printed page of the index.
 *
 * The letters it carries, and — where a letter runs over — which letter this
 * page is continuing, so it can print *L (continued)* the way books do rather
 * than starting again as if it were new.
 */
export interface IndexPage {
  title: string;
  letters: IndexLetter[];
  /** The letter carried over from the page before, or null on the first. */
  continuing: string | null;
}

/**
 * The index, broken across pages.
 *
 * **Broken by counting lines rather than by measuring type**, which is what
 * the rest of the paginator does and is as exact as a monospaced page needs.
 * A heading is a line plus however many its page numbers wrap to, a
 * sub-heading is the same, and a letter costs its own line and the blank
 * above it.
 *
 * A letter is never left alone at the foot of a page: if its heading would be
 * the last line, it goes over with its first entry, because a letter standing
 * by itself at the bottom of a column is the one thing that makes an index
 * look broken.
 */
export const indexPages = (input: {
  index: BookIndex;
  title: string;
  linesPerPage: number;
  columns: number;
}): IndexPage[] => {
  const rows = Math.max(8, input.linesPerPage);
  const width = Math.max(20, input.columns);
  const wraps = (text: string) => Math.max(1, Math.ceil(text.length / width));

  const costOf = (heading: IndexHeading): number => {
    let lines = wraps(`${heading.term}  ${runsText(heading.runs)}`);
    for (const sub of heading.subEntries) lines += wraps(`  ${sub.subTerm}  ${runsText(sub.runs)}`);
    if (heading.see.length > 0 || heading.seeAlso.length > 0) lines += 1;
    return lines;
  };

  const pages: IndexPage[] = [];
  let page: IndexPage = { title: input.title, letters: [], continuing: null };
  let used = 0;
  let letter: IndexLetter | null = null;

  const turn = (carrying: string | null) => {
    if (page.letters.length > 0) pages.push(page);
    page = { title: input.title, letters: [], continuing: carrying };
    used = 0;
    letter = null;
  };

  for (const group of input.index.letters) {
    // The letter, and the blank line above it — except at the very top of a
    // page, where there is nothing to separate it from.
    const heads = used === 0 ? 1 : 2;
    const first = group.headings[0];
    // A letter alone at the foot of a page is what makes an index look broken,
    // so it travels with its first entry or it does not go yet.
    if (first && used + heads + costOf(first) > rows) turn(null);

    letter = { letter: group.letter, headings: [] };
    page.letters.push(letter);
    used += used === 0 ? 1 : 2;

    for (const heading of group.headings) {
      const cost = costOf(heading);
      if (used + cost > rows && (letter.headings.length > 0 || page.letters.length > 1)) {
        turn(group.letter);
        letter = { letter: group.letter, headings: [] };
        page.letters.push(letter);
        used += 1;
      }
      letter.headings.push(heading);
      used += cost;
    }
  }

  if (page.letters.length > 0) pages.push(page);
  return pages;
};

/**
 * The headings the book already has, for a box that offers them while somebody
 * types a new one.
 *
 * Offered rather than required, and this is the whole of what keeps an index
 * from growing *lamp* and *Lamp* and *the lamp*: the second time a writer files
 * something, the heading they used the first time is under the cursor. A list
 * that forced the choice would stop them making the heading they actually
 * need.
 */
export const headingsSoFar = (file: ProjectFile): string[] => {
  const seen = new Map<string, string>();
  for (const one of [...(file.indexMarks ?? []), ...(file.indexRefs ?? [])]) {
    const key = one.term.trim().toLocaleLowerCase();
    if (key.length > 0 && !seen.has(key)) seen.set(key, one.term.trim());
  }
  return [...seen.values()].sort(compareHeadings);
};

/** The sub-headings already filed under one heading, offered the same way. */
export const subHeadingsUnder = (file: ProjectFile, term: string): string[] => {
  const seen = new Map<string, string>();
  for (const one of [...(file.indexMarks ?? []), ...(file.indexRefs ?? [])]) {
    if (!sameHeading(one.term, term)) continue;
    const key = one.subTerm.trim().toLocaleLowerCase();
    if (key.length > 0 && !seen.has(key)) seen.set(key, one.subTerm.trim());
  }
  return [...seen.values()].sort(compareHeadings);
};

/** A mark, and the page it prints — 0 for one whose passage has gone. */
export interface MarkPlace {
  mark: IndexMark;
  page: number;
}

/**
 * The marks filed under one heading, in the order their pages print.
 *
 * The printed index shows a heading's page numbers; the screen that manages it
 * has to show the *marks* — because a writer wanting to unfile something is
 * pointing at a passage rather than at a number, and two marks can share a
 * page.
 *
 * Orphans come last rather than being dropped or put at the front: they are
 * the thing the writer still owes, but a mark that has lost its passage has no
 * position in the book to sort into, and inventing one would be a lie about
 * where it was.
 */
export const marksUnder = (
  file: ProjectFile,
  heading: { term: string; subTerm?: string },
  pageOfElement: (elementId: string) => number,
): MarkPlace[] =>
  (file.indexMarks ?? [])
    .filter(
      (mark) =>
        sameHeading(mark.term, heading.term) &&
        sameHeading(mark.subTerm, heading.subTerm ?? ''),
    )
    .map((mark) => ({ mark, page: pageOfElement(mark.elementId as string) }))
    .sort((one, two) => {
      if (one.page === two.page) return 0;
      if (one.page === 0) return 1;
      if (two.page === 0) return -1;
      return one.page - two.page;
    });

/** What the index owes, in one line, for the screen that manages it. */
export const describeIndex = (index: BookIndex): string => {
  if (index.headings.length === 0) return 'Nothing is indexed yet.';
  const headings = `${index.headings.length} ${index.headings.length === 1 ? 'heading' : 'headings'}`;
  if (index.orphans.length === 0) return `${headings}.`;
  return `${headings} · ${index.orphans.length} pointing at writing that has gone.`;
};

export type { IndexMark, IndexRef };
export {
  INDEX_REF_KINDS,
  indexMarkSchema,
  indexRefSchema,
  type IndexRefKind,
} from './entities/book-index.js';
