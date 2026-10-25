import { nowIso } from './entities/common.js';
import { referenceSchema, type Reference } from './entities/reference.js';
import type { ProjectFile } from './project-file.js';

/**
 * **One library, live between projects** (addendum 43 §29).
 *
 * A project file is a whole thing of its own — kept, opened, synced and
 * printed on its own — so two projects cannot hold one record. What they can
 * do is stay **linked**: a source brought in from another project's library
 * (§11) remembers where it came from, and each time the library is opened
 * the two are compared and brought back into step.
 *
 * The project a source came from is the library; the copies point at it.
 * When the library is opened in a linked project:
 *
 * - changed there, not here: the change comes here;
 * - changed here, not there: the change goes there;
 * - changed on both sides: nothing moves, and the writer chooses;
 * - taken out of the library there (deleted or archived): the copy stays,
 *   this project's own from then on, and says so.
 *
 * What is compared is the source's **facts** — who, what, where, when, the
 * identifiers and the writer's note on it — by a fingerprint taken when the
 * two last agreed (`link.base`). A short code and tags are each project's
 * own handles and are never carried.
 */

/** The facts a linked source carries between projects. */
const FACTS = [
  'type', 'authors', 'editors', 'organization', 'title', 'container', 'publisher', 'place', 'edition', 'date',
  'volume', 'issue', 'pages', 'doi', 'url', 'accessed', 'isbn', 'notes', 'asWritten',
] as const;
type Fact = (typeof FACTS)[number];

const factsOf = (reference: Reference): Pick<Reference, Fact> =>
  Object.fromEntries(FACTS.map((field) => [field, reference[field]])) as Pick<Reference, Fact>;

/** A short fingerprint of a source's facts: equal facts, equal fingerprints. */
export const referenceFingerprint = (reference: Reference): string => {
  const text = JSON.stringify(FACTS.map((field) => reference[field]));
  let a = 0x811c9dc5;
  let b = 0;
  for (let at = 0; at < text.length; at += 1) {
    const code = text.charCodeAt(at);
    a = Math.imul(a ^ code, 0x01000193);
    b = (Math.imul(b, 31) + code) | 0;
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
};

/** A copy linked to the source it was made from in the project at `path`. */
export const linkedCopy = (copy: Reference, source: Reference, path: string, title: string): Reference => ({
  ...copy,
  link: { path, title, projectId: source.projectId, referenceId: source.id, base: referenceFingerprint(source) },
});

/** Where a linked source stands against the source it is linked to. */
export type LinkState = 'same' | 'theirs' | 'ours' | 'both' | 'gone';

export const linkState = (local: Reference, origin: Reference | null | undefined): LinkState => {
  if (!local.link) return 'same';
  if (!origin || origin.archivedAt !== null) return 'gone';
  const here = referenceFingerprint(local);
  const there = referenceFingerprint(origin);
  if (here === there) return 'same';
  const base = local.link.base;
  if (here === base) return 'theirs';
  if (there === base) return 'ours';
  return 'both';
};

/** A source changed on both sides, for the writer to choose between. */
export interface LinkConflict {
  referenceId: string;
  path: string;
  title: string;
  ours: Reference;
  theirs: Reference;
}

export interface LinkedLibrarySync {
  /** This project, with the changes that came here and the links brought up to date. */
  file: ProjectFile;
  /** The projects linked to, by path, where a change of this one goes there. */
  origins: Map<string, ProjectFile>;
  /** How many sources took a change from where they are linked, and how many sent one. */
  pulled: number;
  pushed: number;
  conflicts: LinkConflict[];
  /** Sources whose source has gone from the library they were linked to: unlinked here. */
  gone: number;
}

/**
 * **Bring this project's linked sources into step with the libraries they
 * are linked to** (§29). `origins` is each linked project as read now, by
 * path, or null where it could not be read (moved, deleted, offline) — those
 * links are left as they are, to try again next time. Pure: the caller reads
 * the projects and writes back the ones in `origins` of the result.
 */
export const syncLinkedLibrary = (file: ProjectFile, origins: ReadonlyMap<string, ProjectFile | null>): LinkedLibrarySync => {
  const timestamp = nowIso();
  const changed = new Map<string, ProjectFile>();
  const conflicts: LinkConflict[] = [];
  let pulled = 0;
  let pushed = 0;
  let gone = 0;
  const references = file.references.map((local) => {
    const link = local.link;
    if (!link) return local;
    const origin = origins.get(link.path);
    if (origin === undefined || origin === null) return local;
    const library = changed.get(link.path) ?? origin;
    const theirs = library.references.find((one) => one.id === link.referenceId);
    const state = linkState(local, theirs);
    if (state === 'same') {
      const base = referenceFingerprint(local);
      return base === link.base && link.title === library.project.title ? local : { ...local, link: { ...link, base, title: library.project.title } };
    }
    if (state === 'gone') {
      gone += 1;
      return { ...local, link: null, updatedAt: timestamp };
    }
    if (state === 'theirs' && theirs) {
      pulled += 1;
      return referenceSchema.parse({
        ...local,
        ...factsOf(theirs),
        link: { ...link, title: library.project.title, base: referenceFingerprint(theirs) },
        updatedAt: timestamp,
      });
    }
    if (state === 'ours' && theirs) {
      pushed += 1;
      const sent = referenceSchema.parse({ ...theirs, ...factsOf(local), updatedAt: timestamp });
      changed.set(link.path, { ...library, references: library.references.map((one) => (one.id === theirs.id ? sent : one)) });
      return { ...local, link: { ...link, title: library.project.title, base: referenceFingerprint(local) } };
    }
    if (theirs) conflicts.push({ referenceId: local.id, path: link.path, title: library.project.title, ours: local, theirs });
    return local;
  });
  return { file: pulled + pushed + gone > 0 || references.some((one, at) => one !== file.references[at]) ? { ...file, references } : file, origins: changed, pulled, pushed, conflicts, gone };
};

/**
 * **Settle a source changed on both sides** (§29): keep this project's facts
 * (and send them to the library) or take the library's. Returns this project
 * and, where this project's facts win, the library to write back.
 */
export const settleLink = (
  file: ProjectFile,
  conflict: LinkConflict,
  library: ProjectFile,
  keep: 'ours' | 'theirs',
): { file: ProjectFile; library: ProjectFile | null } => {
  const timestamp = nowIso();
  const local = file.references.find((one) => one.id === conflict.referenceId);
  const theirs = library.references.find((one) => one.id === conflict.theirs.id);
  if (!local?.link || !theirs) return { file, library: null };
  if (keep === 'theirs') {
    const taken = referenceSchema.parse({ ...local, ...factsOf(theirs), link: { ...local.link, base: referenceFingerprint(theirs) }, updatedAt: timestamp });
    return { file: { ...file, references: file.references.map((one) => (one.id === local.id ? taken : one)) }, library: null };
  }
  const sent = referenceSchema.parse({ ...theirs, ...factsOf(local), updatedAt: timestamp });
  const kept = { ...local, link: { ...local.link, base: referenceFingerprint(local) } };
  return {
    file: { ...file, references: file.references.map((one) => (one.id === local.id ? kept : one)) },
    library: { ...library, references: library.references.map((one) => (one.id === theirs.id ? sent : one)) },
  };
};

/** Make a linked source this project's own: it stops following the library it came from. */
export const unlinkReference = (file: ProjectFile, referenceId: string): ProjectFile => ({
  ...file,
  references: file.references.map((one) => (one.id === referenceId && one.link ? { ...one, link: null, updatedAt: nowIso() } : one)),
});

/** The projects this one's library is linked to, by path, with their names and ids. */
export const linkedLibraries = (file: ProjectFile): { path: string; title: string; projectId: string; count: number }[] => {
  const found = new Map<string, { path: string; title: string; projectId: string; count: number }>();
  for (const one of file.references) {
    if (!one.link || one.archivedAt !== null) continue;
    const entry = found.get(one.link.path) ?? { path: one.link.path, title: one.link.title, projectId: one.link.projectId, count: 0 };
    if (!entry.projectId && one.link.projectId) entry.projectId = one.link.projectId;
    entry.count += 1;
    found.set(one.link.path, entry);
  }
  return [...found.values()];
};

// ------------------------------------------------- a library that has moved

/**
 * **Whether a project read from a link's path is the library it links to**
 * (§31): the same project id, or — on a link made before ids were kept —
 * any project at all, the path being all there was to go on.
 */
export const isLinkedLibrary = (library: { projectId: string }, read: ProjectFile): boolean =>
  !library.projectId || read.project.id === library.projectId;

/**
 * **Follow a library to where it now is** (§31): every link to `from` points
 * to `to` instead, and learns the project's id where it had none. Nothing
 * else about the links changes, so the next sync carries on as before.
 */
export const relinkLibrary = (file: ProjectFile, from: string, to: string, project: { id: string; title: string }): ProjectFile => {
  let changed = false;
  const references = file.references.map((one) => {
    if (!one.link || one.link.path !== from) return one;
    if (one.link.path === to && one.link.projectId === project.id && one.link.title === project.title) return one;
    changed = true;
    return { ...one, link: { ...one.link, path: to, projectId: project.id, title: project.title || one.link.title } };
  });
  return changed ? { ...file, references } : file;
};

// ------------------------------------------- linking a source already here

/** The facts that differ between two copies of one source, for the writer to see before linking them. */
export const factDifferences = (here: Reference, there: Reference): { field: Fact; here: string; there: string }[] =>
  FACTS.filter((field) => JSON.stringify(here[field]) !== JSON.stringify(there[field])).map((field) => ({
    field,
    here: Array.isArray(here[field]) ? (here[field] as string[]).join('; ') : String(here[field] ?? ''),
    there: Array.isArray(there[field]) ? (there[field] as string[]).join('; ') : String(there[field] ?? ''),
  }));

/**
 * **Link a source this library already has to the same source in another
 * project** (addendum 43 §30). Where the two agree they are linked as they
 * stand. Where they differ the writer has said which stands:
 *
 * - `theirs`: this copy takes the library's facts now;
 * - `ours`: this copy keeps its facts, linked as though the library had not
 *   yet heard of them — so the next time the library is opened they are
 *   sent there, by the same path as any change made here (§29).
 */
export const linkExisting = (
  file: ProjectFile,
  localId: string,
  source: Reference,
  library: { path: string; title: string },
  keep: 'ours' | 'theirs',
): ProjectFile => {
  const timestamp = nowIso();
  const base = referenceFingerprint(source);
  return {
    ...file,
    references: file.references.map((one) => {
      if (one.id !== localId || one.link) return one;
      const link = { path: library.path, title: library.title, projectId: source.projectId, referenceId: source.id, base };
      return keep === 'theirs'
        ? referenceSchema.parse({ ...one, ...factsOf(source), link, updatedAt: timestamp })
        : { ...one, link, updatedAt: timestamp };
    }),
  };
};
