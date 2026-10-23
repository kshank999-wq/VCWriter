import { nowIso } from './entities/common.js';
import { referenceSchema, type LocatorKind, type Reference, type ReferenceType } from './entities/reference.js';
import { citationOccurrences, flattened } from './citations.js';
import type { ReferenceId } from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * **Reading a Word footnote's parts** (addendum 43 §20).
 *
 * A Word footnote comes in as one line with its parts run together (§9). Most
 * of the notes a writer has typed follow Chicago's note form, which is regular
 * enough to read back:
 *
 * - a book: `Robert Jones, *On Tides* (Boston: Sea Press, 2019), 12.`
 * - a chapter: `Ann Hall, "Charts," in *The Sea Book*, ed. Bo Kim (London: Wave, 2010), 45.`
 * - an article: `Ada Lee, "The Pull," *Journal of Tides* 4, no. 2 (2018): 33.`
 * - a web page: `"Tide Tables," Harbour Board, accessed May 1, 2024, https://…`
 * - a short note: `Jones, *On Tides*, 20.` — and `Ibid., 14.`
 *
 * A note is read only when the whole of it fits one of these shapes. Anything
 * else is left as it was written, flagged for the writer, because a guess
 * that splits a title in the wrong place is worse than a line kept whole.
 *
 * The pinpoint (the page, the section) belongs to the place cited, not the
 * source, so it comes back apart: a full note and the short notes after it
 * are one source cited at several pages.
 */

/** The facts a note gave about its source. */
export type NoteFacts = Partial<Pick<Reference, 'type' | 'authors' | 'editors' | 'organization' | 'title' | 'container' | 'publisher' | 'place' | 'edition' | 'date' | 'volume' | 'issue' | 'url' | 'doi' | 'accessed'>>;

export type RecognisedNote =
  | { kind: 'full'; source: NoteFacts & { type: ReferenceType; title: string }; locatorKind: LocatorKind; locator: string }
  | { kind: 'short'; surname: string; title: string; locatorKind: LocatorKind; locator: string }
  | { kind: 'ibid'; locatorKind: LocatorKind; locator: string };

/** A person as the note writes them, "Robert Jones", as the library keeps them, "Jones, Robert". */
const inverted = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return name.trim();
  const last = words.pop() as string;
  return `${last}, ${words.join(' ')}`;
};

/** "Robert Jones, Ada Lee, and Bo Kim" — or an organisation, which has no first name to turn round. */
const peopleOf = (text: string): string[] =>
  text
    .replace(/\s+et al\.?$/, '')
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map((one) => one.trim())
    .filter(Boolean);

/** Whether a run of words reads as one or more personal names. */
const BODIES = /\b(?:Board|Society|Institute|Ministry|Department|Association|Company|University|Office|Council|Agency|Press|Museum|Library|Commission|Committee|Trust|Foundation|Service|Bureau|Group|Inc|Ltd|Corporation|Centre|Center|Authority|Survey|Organi[sz]ation|Agency|Bank|Court|Parliament|Congress|Government)\b/;

const readsAsPeople = (text: string): boolean =>
  !BODIES.test(text) &&
  peopleOf(text).every((one) => /^[\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){1,3}$/u.test(one));

const creators = (text: string): Pick<NoteFacts, 'authors' | 'organization'> => {
  const said = text.trim();
  if (!said) return {};
  if (readsAsPeople(said)) return { authors: peopleOf(said).map(inverted) };
  return { organization: said };
};

/** The pinpoint, and what kind it is: 12 is a page, 12–14 pages, chap. 3 a chapter. */
export const readLocator = (text: string): { locatorKind: LocatorKind; locator: string } => {
  const said = text.trim().replace(/[.]$/, '');
  const word = (pattern: RegExp, kind: LocatorKind) => {
    const found = said.match(pattern);
    return found ? { locatorKind: kind, locator: (found[1] as string).trim() } : null;
  };
  return (
    word(/^(?:pp?\.\s*)?(\d+[a-z]?)$/i, 'page') ??
    word(/^(?:pp?\.\s*)?(\d+[a-z]?\s*[–-]\s*\d+[a-z]?)$/i, 'pages') ??
    word(/^(?:sec(?:tion)?\.?|§)\s*(.+)$/i, 'section') ??
    word(/^(?:chap(?:ter)?\.?|ch\.)\s*(.+)$/i, 'chapter') ??
    word(/^(?:para(?:graph)?\.?|par\.)\s*(.+)$/i, 'paragraph') ??
    word(/^at\s+(\d{1,2}(?::\d{2}){1,2})$/i, 'timestamp') ?? { locatorKind: said ? 'other' : 'page', locator: said }
  );
};

/** The publication facts in a book's parentheses: `Boston: Sea Press, 2019`, `Sea Press, 2019`, `2019`. */
const imprint = (text: string): Pick<NoteFacts, 'place' | 'publisher' | 'date'> | null => {
  const found = text.match(/^(?:(?:([^:]+):\s*)?([^,]+),\s*)?(\d{4}[a-z]?|n\.d\.)$/);
  if (!found) return null;
  return {
    ...(found[1] ? { place: found[1].trim() } : {}),
    ...(found[2] ? { publisher: found[2].trim() } : {}),
    date: found[3] === 'n.d.' ? '' : (found[3] as string).slice(0, 4),
  };
};

/** The part of a note before an *italic title* or a "quoted title": who wrote it, and whether they edited it. */
const lead = (text: string): Pick<NoteFacts, 'authors' | 'editors' | 'organization'> => {
  const said = text.trim().replace(/,$/, '').trim();
  const edited = said.match(/^(.*?),\s*eds?\.$/);
  if (edited) return { editors: peopleOf(edited[1] as string).map(inverted) };
  return creators(said);
};

/** The quotation marks a note may use, straight or curly. */
const Q_OPEN = `["“]`;
const Q_CLOSE = `["”]`;

const SHAPES: { pattern: RegExp; read(found: RegExpMatchArray): Omit<Extract<RecognisedNote, { kind: 'full' }>, 'kind'> | null }[] = [
  // A book: [Authors,] *Title*[, 2nd ed.] (Place: Publisher, 2019)[, 12]
  {
    pattern: /^(?:(.+?),\s*)?\*([^*]+)\*(?:,\s*(\d+\w*)\s+ed\.)?\s*\(([^()]+)\)(?:,\s*(.+))?$/,
    read: (found) => {
      const facts = imprint(found[4] as string);
      if (!facts) return null;
      return {
        source: { type: 'book', ...lead(found[1] ?? ''), title: (found[2] as string).trim(), ...(found[3] ? { edition: found[3] } : {}), ...facts },
        ...readLocator(found[5] ?? ''),
      };
    },
  },
  // A chapter: Authors, "Title," in *Book*, ed. Editors (Place: Publisher, 2010)[, 45]
  {
    pattern: new RegExp(`^(.+?),\\s*${Q_OPEN}([^"“”]+?),?${Q_CLOSE}\\s+in\\s+\\*([^*]+)\\*,\\s*eds?\\.\\s+([^()]+?)\\s*\\(([^()]+)\\)(?:,\\s*(.+))?$`),
    read: (found) => {
      const facts = imprint(found[5] as string);
      if (!facts) return null;
      return {
        source: {
          type: 'chapter',
          ...creators(found[1] as string),
          title: (found[2] as string).trim(),
          container: (found[3] as string).trim(),
          editors: peopleOf(found[4] as string).map(inverted),
          ...facts,
        },
        ...readLocator(found[6] ?? ''),
      };
    },
  },
  // An article: Authors, "Title," *Journal* 4, no. 2 (2018)[: 33]
  {
    pattern: new RegExp(`^(.+?),\\s*${Q_OPEN}([^"“”]+?),?${Q_CLOSE}\\s+\\*([^*]+)\\*(?:\\s+(\\d+))?(?:,\\s*no\\.\\s*(\\w+))?\\s*\\(([^()]*?\\d{4})\\)(?::\\s*(.+))?$`),
    read: (found) => ({
      source: {
        type: 'journal',
        ...creators(found[1] as string),
        title: (found[2] as string).trim(),
        container: (found[3] as string).trim(),
        ...(found[4] ? { volume: found[4] } : {}),
        ...(found[5] ? { issue: found[5] } : {}),
        date: ((found[6] as string).match(/\d{4}/) as RegExpMatchArray)[0],
      },
      ...readLocator(found[7] ?? ''),
    }),
  },
];

/** A web page: [Authors,] "Title," Site[, Month D, YYYY][, accessed Month D, YYYY], https://… */
const webPage = (body: string, url: string): Extract<RecognisedNote, { kind: 'full' }> | null => {
  const found = body.match(new RegExp(`^(?:(.+?),\\s*)?${Q_OPEN}([^"“”]+?),?${Q_CLOSE}\\s+(?:\\*([^*]+)\\*|([^,]+))(.*)$`));
  if (!found) return null;
  let rest = (found[5] as string).trim();
  let accessed = '';
  const visit = rest.match(/,?\s*accessed\s+([^,]+,\s*\d{4})\s*,?$/i);
  if (visit) {
    accessed = (visit[1] as string).trim();
    rest = rest.slice(0, visit.index).trim();
  }
  const dated = rest.match(/^,\s*(.*\d{4})\s*,?$/);
  if (rest && !dated) return null;
  const year = dated ? ((dated[1] as string).match(/\d{4}/) as RegExpMatchArray)[0] : '';
  return {
    kind: 'full',
    source: {
      type: 'website',
      ...creators(found[1] ?? ''),
      title: (found[2] as string).trim(),
      container: (found[3] ?? found[4] ?? '').trim(),
      ...(year ? { date: year } : {}),
      ...(accessed ? { accessed } : {}),
      url,
    },
    locatorKind: 'page',
    locator: '',
  };
};

/**
 * **One note's parts**, or null where the note fits no shape it can be read
 * by with confidence. The words are in the inline marks: `*title*` is italic.
 */
export const recogniseNote = (text: string): RecognisedNote | null => {
  let said = text.replace(/\s+/g, ' ').trim().replace(/\.$/, '').trim();
  if (!said) return null;

  const ibid = said.match(/^ibid\.?(?:,?\s*(.+))?$/i);
  if (ibid) return { kind: 'ibid', ...readLocator(ibid[1] ?? '') };

  // A DOI or an address at the end belongs to the source, whatever the shape.
  let url = '';
  let doi = '';
  const link = said.match(/,?\s*(?:doi:\s*(10\.\S+)|(https?:\/\/\S+))$/i);
  if (link) {
    said = said.slice(0, link.index).trim();
    const address = link[2] ?? '';
    const fromDoi = address.match(/^https?:\/\/(?:dx\.)?doi\.org\/(10\.\S+)$/i);
    doi = link[1] ?? fromDoi?.[1] ?? '';
    url = doi ? '' : address.replace(/[.]$/, '');
  }

  for (const shape of SHAPES) {
    const found = said.match(shape.pattern);
    if (!found) continue;
    const read = shape.read(found);
    if (!read) continue;
    return { kind: 'full', ...read, source: { ...read.source, ...(doi ? { doi } : {}), ...(url ? { url } : {}) } };
  }
  if (url) return webPage(said, url);

  // A short note: Surname[ and Surname], *Short Title*[, 20] — or "Short Title,"[ 20]
  const short =
    said.match(/^([\p{Lu}][^,*"“”]*?),\s*\*([^*]+)\*(?:,\s*(.+))?$/u) ??
    said.match(new RegExp(`^([\\p{Lu}][^,*"“”]*?),\\s*${Q_OPEN}([^"“”]+?),?${Q_CLOSE}(?:,?\\s*(.+))?$`, 'u'));
  if (short) {
    const surname = (short[1] as string).split(/\s+and\s+|,\s*/)[0]?.trim() ?? '';
    // A short note names people by surname alone: one word each.
    if (!/^[\p{Lu}][\p{L}'’-]*$/u.test(surname)) return null;
    return { kind: 'short', surname, title: (short[2] as string).trim(), ...readLocator(short[3] ?? '') };
  }
  return null;
};

// ------------------------------------------------------- a run of notes

const squash = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');

const surnameOf = (source: NoteFacts): string => {
  const first = source.authors?.[0] ?? source.editors?.[0] ?? source.organization ?? '';
  return (first.split(',')[0] ?? '').trim();
};

/** One source the notes gave, and whether its parts were read. */
export interface NoteSourceRead {
  /** The parts read from its full note, or null where it is kept as written. */
  source: NoteFacts | null;
  /** The note it came from, as written: the first one, where several cite it. */
  asWritten: string;
}

/** The notes of a Word file, read into sources and the places that cite them. */
export interface NotesRead {
  sources: NoteSourceRead[];
  /** Each note in order: the source it cites (an index into `sources`) and its pinpoint. */
  cited: { key: string; source: number; locatorKind: LocatorKind; locator: string }[];
}

/**
 * **A Word file's notes, read in order** (addendum 43 §20). A full note gives
 * a source; a short note and an *Ibid.* cite the source a note before them
 * gave, at their own page. The same source in two full notes is one source.
 * A note that is not read stays a source of its own, kept as written — once
 * however many times the same words appear, as before.
 */
export const readNotes = (notes: readonly { key: string; text: string }[]): NotesRead => {
  const sources: NoteSourceRead[] = [];
  const cited: NotesRead['cited'] = [];
  const byFacts = new Map<string, number>();
  const byWords = new Map<string, number>();
  let last: number | null = null;
  const asWritten = (text: string): number => {
    const same = text.toLowerCase();
    const known = byWords.get(same);
    if (known !== undefined) return known;
    sources.push({ source: null, asWritten: text });
    byWords.set(same, sources.length - 1);
    return sources.length - 1;
  };
  for (const note of notes) {
    const read = recogniseNote(note.text);
    let at: number | null = null;
    let pinpoint: { locatorKind: LocatorKind; locator: string } = { locatorKind: 'page', locator: '' };
    if (read?.kind === 'full') {
      const facts = `${squash(surnameOf(read.source))}|${squash(read.source.title)}`;
      at = byFacts.get(facts) ?? null;
      if (at === null) {
        sources.push({ source: read.source, asWritten: note.text });
        at = sources.length - 1;
        byFacts.set(facts, at);
      }
      pinpoint = { locatorKind: read.locatorKind, locator: read.locator };
    } else if (read?.kind === 'ibid' && last !== null) {
      at = last;
      pinpoint = { locatorKind: read.locatorKind, locator: read.locator };
    } else if (read?.kind === 'short') {
      const surname = squash(read.surname);
      const title = squash(read.title);
      // The latest source by that author whose title holds the short one.
      for (let index = sources.length - 1; index >= 0 && at === null; index -= 1) {
        const source = sources[index]?.source;
        if (source && squash(surnameOf(source)) === surname && title.length > 0 && squash(source.title ?? '').includes(title)) at = index;
      }
      if (at !== null) pinpoint = { locatorKind: read.locatorKind, locator: read.locator };
    }
    if (at === null) at = asWritten(note.text);
    // Ibid. refers to the note before it, read or not.
    last = at;
    cited.push({ key: note.key, source: at, ...pinpoint });
  }
  return { sources, cited };
};

// ------------------------------------------- sources already in the library

/**
 * **Read the parts of the sources already brought in from Word** (addendum
 * 43 §20): a book imported before notes were read, its sources each one line.
 *
 * The citations are walked in the order the book prints them, so a short note
 * and an *Ibid.* find the source a note before them gave, as the import does.
 * A full note fills its source's fields and keeps its page on the citation
 * (where the citation has none of its own); a short note or an *Ibid.* moves
 * its citation onto the source it names, and a line left citing nothing is
 * taken out of the library. A note that cannot be read is left as it was.
 */
export const recogniseFromWord = (file: ProjectFile): { file: ProjectFile; read: number } => {
  const references = new Map(file.references.map((reference) => [reference.id as string, reference]));
  const citations = new Map(file.citations.map((citation) => [citation.key, citation]));
  const factsOf = (reference: Reference): string => `${squash(surnameOf(reference))}|${squash(reference.title)}`;
  const byFacts = new Map<string, string>();
  for (const reference of references.values()) if (!flattened(reference) && reference.title.trim()) byFacts.set(factsOf(reference), reference.id);
  const emptied = new Set<string>();
  let read = 0;
  let last: string | null = null;
  const timestamp = nowIso();
  const cite = (key: string, referenceId: string, pinpoint: { locatorKind: LocatorKind; locator: string }) => {
    const citation = citations.get(key);
    if (!citation) return;
    const moved = citation.referenceId !== referenceId;
    if (moved) emptied.add(citation.referenceId);
    const placed = !citation.locator.trim() && pinpoint.locator;
    if (!moved && !placed) return;
    citations.set(key, {
      ...citation,
      referenceId: referenceId as ReferenceId,
      ...(placed ? { locatorKind: pinpoint.locatorKind, locator: pinpoint.locator } : {}),
      updatedAt: timestamp,
    });
    read += 1;
  };
  for (const occurrence of citationOccurrences(file)) {
    if (occurrence.documentId !== null) continue;
    const citation = citations.get(occurrence.key);
    const reference = citation ? references.get(citation.referenceId) : undefined;
    if (!citation || !reference) {
      last = null;
      continue;
    }
    const note = flattened(reference) ? recogniseNote(reference.asWritten) : null;
    let target: string = reference.id;
    if (note?.kind === 'full') {
      const facts = `${squash(surnameOf(note.source))}|${squash(note.source.title)}`;
      const known = byFacts.get(facts);
      if (known) target = known;
      else {
        references.set(reference.id, referenceSchema.parse({ ...reference, ...note.source, updatedAt: timestamp }));
        byFacts.set(facts, reference.id);
        read += 1;
      }
      cite(occurrence.key, target, note);
    } else if (note?.kind === 'ibid' && last) {
      target = last;
      cite(occurrence.key, target, note);
    } else if (note?.kind === 'short') {
      const surname = squash(note.surname);
      const title = squash(note.title);
      const found = [...references.values()].find(
        (one) => !flattened(one) && one.archivedAt === null && squash(surnameOf(one)) === surname && title.length > 0 && squash(one.title).includes(title),
      );
      if (found) {
        target = found.id;
        cite(occurrence.key, target, note);
      }
    }
    last = target;
  }
  const stillCited = new Set([...citations.values()].map((citation) => citation.referenceId as string));
  const kept = [...references.values()].filter((reference) => !emptied.has(reference.id) || stillCited.has(reference.id));
  if (read === 0) return { file, read };
  return { file: { ...file, references: kept, citations: file.citations.map((citation) => citations.get(citation.key) ?? citation) }, read };
};

/** How many sources in the library are still one line from Word, which `recogniseFromWord` can try to read. */
export const fromWordUnread = (file: ProjectFile): number =>
  file.references.filter((reference) => reference.archivedAt === null && flattened(reference)).length;

/** How many of those could be read: the ones whose Word text fits a shape. */
export const fromWordReadable = (file: ProjectFile): number =>
  file.references.filter((reference) => reference.archivedAt === null && flattened(reference) && recogniseNote(reference.asWritten) !== null).length;
