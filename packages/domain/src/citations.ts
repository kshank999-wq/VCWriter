import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { CITATION_TOKEN, parseInline } from './entities/inline.js';
import {
  citationSchema,
  citationSettingsSchema,
  referenceSchema,
  type Citation,
  type CitationSettings,
  type LocatorKind,
  type MarkerScheme,
  type Reference,
  type ReferenceType,
} from './entities/reference.js';
import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, CitationId, ManuscriptElementId, ReferenceId, StructuralUnitId } from './ids.js';

/**
 * **The Reference Library and its citations** (addendum 43).
 *
 * The library is the project's sources; a citation is one place a source is
 * cited, a `[^ab12cd]` token in the manuscript's text naming the citation by
 * its key. Everything printed — the marker's number, the note, the
 * bibliography — is a reading of the two, worked out afresh each time, so an
 * edit to a source shows in every note at once, and inserting, moving or
 * deleting a citation renumbers the rest without anyone renumbering them.
 */

// ---------------------------------------------------------------- settings

export const citationSettingsOf = (file: ProjectFile): CitationSettings =>
  citationSettingsSchema.parse(file.settings.citations ?? {});

export const setCitationSettings = (file: ProjectFile, patch: Partial<CitationSettings>): ProjectFile => ({
  ...file,
  settings: { ...file.settings, citations: citationSettingsSchema.parse({ ...citationSettingsOf(file), ...patch }) },
  project: { ...file.project, updatedAt: nowIso() },
});

// ----------------------------------------------------------------- library

export const REFERENCE_TYPE_NAMES: Record<ReferenceType, string> = {
  book: 'Book',
  chapter: 'Chapter in a book',
  journal: 'Journal article',
  website: 'Website',
  report: 'Report',
  interview: 'Interview',
  video: 'Video',
  other: 'Other',
};

export type ReferenceField = Exclude<keyof Reference, 'id' | 'projectId' | 'type' | 'archivedAt' | 'createdAt' | 'updatedAt' | 'tags' | 'notes' | 'shortCode'>;

/** The fields each kind of source shows, in the order a reader fills them in (spec §3: *show/hide fields by source type*). */
export const REFERENCE_FIELDS: Record<ReferenceType, ReferenceField[]> = {
  book: ['authors', 'editors', 'organization', 'title', 'edition', 'place', 'publisher', 'date', 'isbn', 'doi', 'url'],
  chapter: ['authors', 'title', 'container', 'editors', 'edition', 'place', 'publisher', 'date', 'pages', 'isbn', 'doi', 'url'],
  journal: ['authors', 'title', 'container', 'volume', 'issue', 'date', 'pages', 'doi', 'url', 'accessed'],
  website: ['authors', 'organization', 'title', 'container', 'date', 'url', 'accessed'],
  report: ['authors', 'organization', 'title', 'volume', 'place', 'publisher', 'date', 'doi', 'url', 'accessed'],
  interview: ['authors', 'editors', 'title', 'container', 'date', 'url', 'accessed'],
  video: ['authors', 'organization', 'title', 'container', 'publisher', 'date', 'url', 'accessed'],
  other: ['authors', 'editors', 'organization', 'title', 'container', 'publisher', 'place', 'edition', 'date', 'volume', 'issue', 'pages', 'doi', 'url', 'accessed', 'isbn'],
};

/** What each field is called, for a type where the general name would mislead. */
export const fieldLabel = (type: ReferenceType, field: ReferenceField): string => {
  const special: Partial<Record<ReferenceType, Partial<Record<ReferenceField, string>>>> = {
    chapter: { title: 'Chapter title', container: 'Book title', editors: 'Book editors' },
    journal: { title: 'Article title', container: 'Journal' },
    website: { title: 'Page title', container: 'Website', organization: 'Organisation (as author)' },
    report: { volume: 'Report number', publisher: 'Institution', organization: 'Organisation (as author)' },
    interview: { authors: 'Interviewee', editors: 'Interviewer', container: 'Where it appeared' },
    video: { authors: 'Creator or director', container: 'Platform or channel', organization: 'Organisation (as author)' },
  };
  const general: Record<ReferenceField, string> = {
    authors: 'Authors',
    editors: 'Editors',
    organization: 'Organisation',
    title: 'Title',
    container: 'Published in',
    publisher: 'Publisher',
    place: 'Place of publication',
    edition: 'Edition',
    date: 'Date',
    volume: 'Volume',
    issue: 'Issue',
    pages: 'Pages',
    doi: 'DOI',
    url: 'URL',
    accessed: 'Accessed',
    isbn: 'ISBN',
  };
  return special[type]?.[field] ?? general[field];
};

export type ReferenceInput = Partial<Omit<Reference, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'archivedAt'>>;

export const addReference = (file: ProjectFile, input: ReferenceInput = {}): { file: ProjectFile; reference: Reference } => {
  const at = nowIso();
  const reference = referenceSchema.parse({ ...input, id: newId<ReferenceId>(), projectId: file.project.id, createdAt: at, updatedAt: at });
  return { file: { ...file, references: [...file.references, reference] }, reference };
};

export const updateReference = (file: ProjectFile, id: ReferenceId, patch: ReferenceInput): ProjectFile => ({
  ...file,
  references: file.references.map((reference) =>
    reference.id === id ? referenceSchema.parse({ ...reference, ...patch, updatedAt: nowIso() }) : reference,
  ),
});

/** A copy to start a near relative from: the second edition, the next article in the series. */
export const duplicateReference = (file: ProjectFile, id: ReferenceId): { file: ProjectFile; reference: Reference | null } => {
  const source = file.references.find((reference) => reference.id === id);
  if (!source) return { file, reference: null };
  const { id: _id, projectId: _project, createdAt: _created, updatedAt: _updated, archivedAt: _archived, ...rest } = source;
  return addReference(file, { ...rest, shortCode: rest.shortCode ? `${rest.shortCode}-copy`.slice(0, 40) : '', title: rest.title });
};

/** Out of the pickers, or back. Every citation already made still prints from it. */
export const archiveReference = (file: ProjectFile, id: ReferenceId, archived: boolean): ProjectFile => ({
  ...file,
  references: file.references.map((reference) =>
    reference.id === id ? { ...reference, archivedAt: archived ? nowIso() : null, updatedAt: nowIso() } : reference,
  ),
});

/** Gone altogether: only a source nothing cites, so no citation is ever left pointing at nothing. */
export const removeReference = (file: ProjectFile, id: ReferenceId): ProjectFile =>
  file.citations.some((citation) => citation.referenceId === id)
    ? file
    : { ...file, references: file.references.filter((reference) => reference.id !== id) };

const lastNameOf = (person: string): string => (person.includes(',') ? person.split(',')[0]! : person.split(/\s+/).at(-1) ?? person).trim();

/** Who it is by, as the list sorts and shows it: the first author's surname, or the organisation, or the editors'. */
export const referenceCreator = (reference: Reference): string =>
  reference.authors[0] ? lastNameOf(reference.authors[0]) : reference.organization || (reference.editors[0] ? lastNameOf(reference.editors[0]) : '');

/** The library, as the dialog lists it: by creator, then title; filtered by words, type and tag. */
export const referencesOf = (
  file: ProjectFile,
  filter: { query?: string; type?: ReferenceType | 'all'; tag?: string; archived?: boolean } = {},
): Reference[] => {
  const words = (filter.query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return file.references
    .filter((reference) => (filter.archived ? reference.archivedAt !== null : reference.archivedAt === null))
    .filter((reference) => !filter.type || filter.type === 'all' || reference.type === filter.type)
    .filter((reference) => !filter.tag || reference.tags.includes(filter.tag))
    .filter((reference) => {
      if (words.length === 0) return true;
      const hay = [reference.shortCode, ...reference.authors, ...reference.editors, reference.organization, reference.title, reference.container, reference.date, reference.doi, reference.isbn, ...reference.tags]
        .join(' ')
        .toLowerCase();
      return words.every((word) => hay.includes(word));
    })
    .sort(
      (a, b) =>
        referenceCreator(a).localeCompare(referenceCreator(b), undefined, { sensitivity: 'base' }) ||
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
    );
};

export const tagsInLibrary = (file: ProjectFile): string[] =>
  [...new Set(file.references.flatMap((reference) => reference.tags))].sort((a, b) => a.localeCompare(b));

/** What is wrong with a source as entered (spec §3: *validate DOI/URL/date where possible*). Words for the writer, field by field. */
export const referenceProblems = (reference: Reference): Partial<Record<ReferenceField | 'shortCode', string>> => {
  const problems: Partial<Record<ReferenceField | 'shortCode', string>> = {};
  const datePattern = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
  if (reference.date && !datePattern.test(reference.date.trim())) problems.date = 'Write it as 2024, 2024-03 or 2024-03-15.';
  if (reference.accessed && !datePattern.test(reference.accessed.trim())) problems.accessed = 'Write it as 2024-03-15.';
  const doi = normalizeDoi(reference.doi);
  if (reference.doi && !/^10\.\d{4,9}\/\S+$/.test(doi)) problems.doi = 'A DOI starts 10. and a number, then a slash: 10.1000/xyz123.';
  if (reference.url && !/^https?:\/\/[^\s/?#.]+\.[^\s]+$/i.test(reference.url.trim())) {
    problems.url = 'That is not a complete web address. It should start https://.';
  }
  if (reference.isbn) {
    const digits = reference.isbn.replace(/[\s-]/g, '');
    if (!/^(\d{9}[\dXx]|\d{13})$/.test(digits)) problems.isbn = 'An ISBN has 10 or 13 digits.';
  }
  if (!reference.title.trim()) problems.title = 'A source needs a title.';
  return problems;
};

/** A DOI as the bare identifier, whatever it was pasted as. */
export const normalizeDoi = (doi: string): string => doi.trim().replace(/^(https?:\/\/(dx\.)?doi\.org\/|doi:\s*)/i, '');

const squash = (value: string): string => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Sources that look like the same one entered twice: same DOI, same ISBN, or same title by the same first author. */
export const possibleDuplicates = (file: ProjectFile): Reference[][] => {
  const groups = new Map<string, Reference[]>();
  for (const reference of file.references.filter((one) => one.archivedAt === null)) {
    const keys = [
      reference.doi ? `doi:${normalizeDoi(reference.doi).toLowerCase()}` : null,
      reference.isbn ? `isbn:${reference.isbn.replace(/[\s-]/g, '')}` : null,
      reference.title ? `title:${squash(reference.title)}|${squash(referenceCreator(reference))}` : null,
    ].filter((key): key is string => key !== null);
    const existing = keys.map((key) => groups.get(key)).find(Boolean);
    const group = existing ?? [];
    if (!group.includes(reference)) group.push(reference);
    for (const key of keys) groups.set(key, group);
  }
  return [...new Set(groups.values())].filter((group) => group.length > 1);
};

/**
 * One source where there were several (spec §3: *Merge Duplicates*). Every
 * citation of the others is pointed at the one kept; a field the kept one
 * lacks is filled from the others; the others go.
 */
export const mergeReferences = (file: ProjectFile, keepId: ReferenceId, otherIds: readonly ReferenceId[]): ProjectFile => {
  const keep = file.references.find((reference) => reference.id === keepId);
  if (!keep) return file;
  const others = file.references.filter((reference) => otherIds.includes(reference.id) && reference.id !== keepId);
  if (others.length === 0) return file;
  const filled = { ...keep } as Reference;
  for (const other of others) {
    for (const [field, value] of Object.entries(other) as [keyof Reference, unknown][]) {
      const current = filled[field];
      if ((current === '' || (Array.isArray(current) && current.length === 0)) && value && !(Array.isArray(value) && value.length === 0)) {
        (filled as Record<string, unknown>)[field] = value;
      }
    }
  }
  filled.tags = [...new Set([keep, ...others].flatMap((reference) => reference.tags))];
  filled.updatedAt = nowIso();
  const gone = new Set(others.map((reference) => reference.id as string));
  return {
    ...file,
    references: file.references.filter((reference) => !gone.has(reference.id)).map((reference) => (reference.id === keepId ? filled : reference)),
    citations: file.citations.map((citation) =>
      gone.has(citation.referenceId) ? { ...citation, referenceId: keepId, updatedAt: nowIso() } : citation,
    ),
  };
};

// --------------------------------------------------------------- citations

export const citationToken = (key: string): string => `[^${key}]`;

const freshKey = (file: ProjectFile): string => {
  const taken = new Set(file.citations.map((citation) => citation.key));
  for (;;) {
    const key = Math.floor(Math.random() * 0x1000000).toString(16).padStart(6, '0');
    if (!taken.has(key)) return key;
  }
};

/** A new citation of a source: the record, and the token to put in the text where it stands. */
export const insertCitation = (
  file: ProjectFile,
  input: { referenceId: ReferenceId; locatorKind?: LocatorKind; locator?: string; note?: string },
): { file: ProjectFile; citation: Citation; token: string } => {
  const at = nowIso();
  const citation = citationSchema.parse({
    id: newId<CitationId>(),
    projectId: file.project.id,
    referenceId: input.referenceId,
    key: freshKey(file),
    locatorKind: input.locatorKind ?? 'page',
    locator: input.locator ?? '',
    note: input.note ?? '',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, citations: [...file.citations, citation] }, citation, token: citationToken(citation.key) };
};

/** The pinpoint, the note, or the source itself (spec §4: *Change Source*). */
export const updateCitation = (
  file: ProjectFile,
  id: CitationId,
  patch: Partial<Pick<Citation, 'referenceId' | 'locatorKind' | 'locator' | 'note'>>,
): ProjectFile => ({
  ...file,
  citations: file.citations.map((citation) => (citation.id === id ? citationSchema.parse({ ...citation, ...patch, updatedAt: nowIso() }) : citation)),
});

export const citationByKey = (file: ProjectFile, key: string): Citation | null =>
  file.citations.find((citation) => citation.key === key) ?? null;

/** Where a token sits in a line of text: its key and its span, so a caret inside one can find it. */
export const tokensIn = (text: string): { key: string; start: number; end: number }[] => {
  const out: { key: string; start: number; end: number }[] = [];
  for (let index = text.indexOf('[^'); index >= 0; index = text.indexOf('[^', index + 1)) {
    const match = CITATION_TOKEN.exec(text.slice(index));
    if (match) out.push({ key: match[1]!, start: index, end: index + match[0].length });
  }
  return out;
};

/** One place a citation is cited, in reading order. */
export interface CitationOccurrence {
  key: string;
  citation: Citation | null;
  reference: Reference | null;
  unitId: StructuralUnitId;
  beatId: BeatId;
  elementId: ManuscriptElementId;
  /** Its place in the whole book, from 1. */
  index: number;
  /** Its place within its chapter, from 1: what a per-chapter count prints. */
  inChapter: number;
  /** The first time this source is cited in the book: a Chicago first note is in full, later ones short. */
  firstOfSource: boolean;
  /** The marker as the settings print it. */
  marker: string;
}

const SYMBOLS = ['*', '†', '‡', '§', '‖', '¶'];

/** The nth marker in a scheme (spec §4): 1, 2, 3; a, b, … z, aa; or *, †, ‡ and then doubled or numbers. */
export const markerLabel = (n: number, scheme: MarkerScheme, overflow: CitationSettings['symbolOverflow'] = 'double'): string => {
  if (scheme === 'numeric' || n < 1) return String(n);
  if (scheme === 'alpha') {
    let out = '';
    for (let rest = n; rest > 0; rest = Math.floor((rest - 1) / 26)) out = String.fromCharCode(97 + ((rest - 1) % 26)) + out;
    return out;
  }
  if (n <= SYMBOLS.length) return SYMBOLS[n - 1]!;
  if (overflow === 'numeric') return String(n);
  const symbol = SYMBOLS[(n - 1) % SYMBOLS.length]!;
  return symbol.repeat(Math.floor((n - 1) / SYMBOLS.length) + 1);
};

/**
 * Every citation in the book, in reading order, with its marker (spec §4:
 * *automatic re-sequencing by document order*). A token whose citation or
 * source has gone is still listed — with `citation` or `reference` null — so
 * it can be shown as needing attention rather than silently dropped.
 */
export const citationOccurrences = (file: ProjectFile): CitationOccurrence[] => {
  const settings = citationSettingsOf(file);
  const byKey = new Map(file.citations.map((citation) => [citation.key, citation]));
  const byId = new Map(file.references.map((reference) => [reference.id as string, reference]));
  const chapterStarts = new Set(file.markers.filter((marker) => marker.kind === 'chapter').map((marker) => marker.unitId as string));
  const seenSources = new Set<string>();
  const out: CitationOccurrence[] = [];
  let inChapter = 0;
  for (const unit of unitsInStoryOrder(file)) {
    if (chapterStarts.has(unit.id)) inChapter = 0;
    for (const beat of beatsForUnit(file, unit.id)) {
      for (const element of beat.manuscript.elements) {
        if (!element.text.includes('[^')) continue;
        for (const span of parseInline(element.text)) {
          if (!span.citation) continue;
          const citation = byKey.get(span.citation) ?? null;
          const reference = citation ? (byId.get(citation.referenceId) ?? null) : null;
          inChapter += 1;
          const index = out.length + 1;
          const firstOfSource = reference ? !seenSources.has(reference.id) : false;
          if (reference) seenSources.add(reference.id);
          out.push({
            key: span.citation,
            citation,
            reference,
            unitId: unit.id,
            beatId: beat.id,
            elementId: element.id,
            index,
            inChapter,
            firstOfSource,
            marker: markerLabel(settings.restartEach === 'chapter' ? inChapter : index, settings.markers, settings.symbolOverflow),
          });
        }
      }
    }
  }
  return out;
};

/** The marker each key prints with, its first time: what the editor's chips show. */
export const citationMarkers = (file: ProjectFile): Map<string, string> => {
  const markers = new Map<string, string>();
  for (const occurrence of citationOccurrences(file)) if (!markers.has(occurrence.key)) markers.set(occurrence.key, occurrence.marker);
  return markers;
};

/** The sources cited somewhere in the text, each once (spec §4: *one bibliography entry*). */
export const citedReferences = (file: ProjectFile): Reference[] => {
  const seen = new Set<string>();
  const out: Reference[] = [];
  for (const occurrence of citationOccurrences(file)) {
    if (occurrence.reference && !seen.has(occurrence.reference.id)) {
      seen.add(occurrence.reference.id);
      out.push(occurrence.reference);
    }
  }
  return out;
};

/** How many times each source is cited, for the library's list. */
export const citationCounts = (file: ProjectFile): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const occurrence of citationOccurrences(file)) {
    if (occurrence.reference) counts.set(occurrence.reference.id, (counts.get(occurrence.reference.id) ?? 0) + 1);
  }
  return counts;
};

/** Tokens that point at nothing: a citation deleted, or its source. Shown, so nothing prints wrong unnoticed. */
export const danglingCitations = (file: ProjectFile): CitationOccurrence[] =>
  citationOccurrences(file).filter((occurrence) => occurrence.citation === null || occurrence.reference === null);
