import { newId } from './ids.js';
import { onlyLiving, sendToGraveyard } from './graveyard.js';
import { nowIso } from './entities/common.js';
import { beatsForUnit, findUnit, unitsInStoryOrder } from './selectors.js';
import { usageLinkSchema, type UsageLink } from './character-creator.js';
import {
  motifTypeSchema,
  researchMotifSchema,
  researchThemeSchema,
  themeMotifLinkSchema,
  type MotifType,
  type ResearchMotif,
  type ResearchTheme,
  type ThematicState,
} from './entities/themes.js';
import type { ProjectFile } from './project-file.js';
import type {
  BeatId,
  ManuscriptElementId,
  ResearchMotifId,
  ResearchThemeId,
  ThemeMotifLinkId,
  UsageLinkId,
} from './ids.js';

/**
 * Themes and motifs (addendum 12).
 *
 * Three things decide the shape of everything here.
 *
 * **They are two kinds, all the way down.** Separate records, separate lists,
 * separate tracks, separate choices on the right-click. There is no function in
 * this file that takes "a thematic thing" and works out which — because the one
 * place that blurred them would be the place the interface started to.
 *
 * **An occurrence is a `usageLink`.** Not a new table: that record already had
 * an owner kind, a beat, an element, a quote and a scene for navigation, which
 * is every field the spec's §5 asks for. Widening its `ownerKind` was the whole
 * of the data work.
 *
 * **Whether an occurrence still points at anything is a reading.** The spec
 * asks for an *unresolved/orphaned* status; storing one would mean something
 * has to notice the beat was cut. `occurrencesOf` works it out from the
 * manuscript every time, so cutting the scene orphans the occurrence with
 * nothing running — the same absence the book index's page numbers and the
 * Character Creator's colour rest on.
 */

// ------------------------------------------------------------------- themes

export const addTheme = (
  file: ProjectFile,
  input: { name: string; description?: string; arcNotes?: string },
): { file: ProjectFile; theme: ResearchTheme } => {
  const at = nowIso();
  const theme = researchThemeSchema.parse({
    id: newId<ResearchThemeId>(),
    projectId: file.project.id,
    name: input.name.trim(),
    description: input.description ?? '',
    arcNotes: input.arcNotes ?? '',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, themes: [...(file.themes ?? []), theme] }, theme };
};

export const updateTheme = (
  file: ProjectFile,
  themeId: ResearchThemeId,
  patch: Partial<Pick<ResearchTheme, 'name' | 'description' | 'arcNotes' | 'notes' | 'state'>>,
): ProjectFile => ({
  ...file,
  themes: (file.themes ?? []).map((theme) =>
    theme.id === themeId ? researchThemeSchema.parse({ ...theme, ...patch, updatedAt: nowIso() }) : theme,
  ),
});

/**
 * Take a theme away, and its occurrences with it.
 *
 * §3 asks the question and this is the answer: an occurrence is a link *to* the
 * theme, so a theme that is gone leaves links to nothing. What survives is the
 * writing — the passage is untouched, which is the only thing that would be a
 * loss.
 */
  // Deleting sends it to the graveyard rather than destroying it
  // (addendum 24): it keeps its place and gains a stamp, so everything
  // pointing at it goes on pointing at it and restoring is clearing a field.
export const removeTheme = (file: ProjectFile, themeId: ResearchThemeId): ProjectFile =>
  sendToGraveyard(file, { kind: 'theme', id: themeId as string });

/** Gone for good, used only when the graveyard is emptied. */
export const destroyTheme = (file: ProjectFile, themeId: ResearchThemeId): ProjectFile => ({
  ...file,
  themes: (file.themes ?? []).filter((theme) => theme.id !== themeId),
  themeMotifLinks: (file.themeMotifLinks ?? []).filter((link) => link.themeId !== themeId),
  usageLinks: file.usageLinks.filter(
    (link) => !(link.ownerKind === 'theme' && link.ownerId === (themeId as string)),
  ),
});

// ------------------------------------------------------------------- motifs

export const addMotif = (
  file: ProjectFile,
  input: { name: string; description?: string; motifType?: MotifType },
): { file: ProjectFile; motif: ResearchMotif } => {
  const at = nowIso();
  const motif = researchMotifSchema.parse({
    id: newId<ResearchMotifId>(),
    projectId: file.project.id,
    name: input.name.trim(),
    description: input.description ?? '',
    motifType: motifTypeSchema.parse(input.motifType ?? 'visual'),
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, motifs: [...(file.motifs ?? []), motif] }, motif };
};

export const updateMotif = (
  file: ProjectFile,
  motifId: ResearchMotifId,
  patch: Partial<Pick<ResearchMotif, 'name' | 'description' | 'motifType' | 'notes' | 'state'>>,
): ProjectFile => ({
  ...file,
  motifs: (file.motifs ?? []).map((motif) =>
    motif.id === motifId ? researchMotifSchema.parse({ ...motif, ...patch, updatedAt: nowIso() }) : motif,
  ),
});

  // Deleting sends it to the graveyard rather than destroying it
  // (addendum 24): it keeps its place and gains a stamp, so everything
  // pointing at it goes on pointing at it and restoring is clearing a field.
export const removeMotif = (file: ProjectFile, motifId: ResearchMotifId): ProjectFile =>
  sendToGraveyard(file, { kind: 'motif', id: motifId as string });

/** Gone for good, used only when the graveyard is emptied. */
export const destroyMotif = (file: ProjectFile, motifId: ResearchMotifId): ProjectFile => ({
  ...file,
  motifs: (file.motifs ?? []).filter((motif) => motif.id !== motifId),
  themeMotifLinks: (file.themeMotifLinks ?? []).filter((link) => link.motifId !== motifId),
  usageLinks: file.usageLinks.filter(
    (link) => !(link.ownerKind === 'motif' && link.ownerId === (motifId as string)),
  ),
});

// -------------------------------------------------- relating the two kinds

/** Say a motif belongs to a theme. Once; saying it twice is saying it once. */
export const relateMotifToTheme = (
  file: ProjectFile,
  themeId: ResearchThemeId,
  motifId: ResearchMotifId,
): ProjectFile => {
  const standing = (file.themeMotifLinks ?? []).some(
    (link) => link.themeId === themeId && link.motifId === motifId,
  );
  if (standing) return file;
  const at = nowIso();
  return {
    ...file,
    themeMotifLinks: [
      ...(file.themeMotifLinks ?? []),
      themeMotifLinkSchema.parse({
        id: newId<ThemeMotifLinkId>(),
        projectId: file.project.id,
        themeId,
        motifId,
        createdAt: at,
        updatedAt: at,
      }),
    ],
  };
};

export const unrelateMotifFromTheme = (
  file: ProjectFile,
  themeId: ResearchThemeId,
  motifId: ResearchMotifId,
): ProjectFile => ({
  ...file,
  themeMotifLinks: (file.themeMotifLinks ?? []).filter(
    (link) => !(link.themeId === themeId && link.motifId === motifId),
  ),
});

/** The motifs of a theme, and the themes of a motif. Separate lists, by design. */
/**
 * Every theme, and every motif, that is still in the project (addendum 24).
 * The screens read these rather than the collections, so a buried one is off
 * the list without every panel remembering to ask.
 */
export const themesInOrder = (file: ProjectFile): ResearchTheme[] => onlyLiving(file.themes ?? []);
export const motifsInOrder = (file: ProjectFile): ResearchMotif[] => onlyLiving(file.motifs ?? []);

export const motifsOfTheme = (file: ProjectFile, themeId: ResearchThemeId): ResearchMotif[] => {
  const wanted = new Set(
    (file.themeMotifLinks ?? []).filter((link) => link.themeId === themeId).map((link) => link.motifId as string),
  );
  // Off `motifsInOrder` rather than the collection: a buried motif keeps its
  // links (addendum 24 §2), so reading the collection here would list one.
  return motifsInOrder(file).filter((motif) => wanted.has(motif.id as string));
};

export const themesOfMotif = (file: ProjectFile, motifId: ResearchMotifId): ResearchTheme[] => {
  const wanted = new Set(
    (file.themeMotifLinks ?? []).filter((link) => link.motifId === motifId).map((link) => link.themeId as string),
  );
  return themesInOrder(file).filter((theme) => wanted.has(theme.id as string));
};

// ---------------------------------------------------------------- tagging

export type ThematicKind = 'theme' | 'motif';

/**
 * File a passage under a theme or a motif.
 *
 * The same passage under the same thing twice is once: tagging it again is the
 * writer doing the same thing twice, not the reader meeting it twice.
 */
export const tagPassage = (
  file: ProjectFile,
  input: {
    kind: ThematicKind;
    ownerId: string;
    beatId: BeatId;
    elementId?: ManuscriptElementId | null;
    quote?: string;
    note?: string;
  },
): { file: ProjectFile; link: UsageLink | null } => {
  const beat = file.beats.find((one) => one.id === input.beatId);
  if (!beat) return { file, link: null };

  const standing = file.usageLinks.find(
    (link) =>
      link.ownerKind === input.kind &&
      link.ownerId === input.ownerId &&
      link.beatId === input.beatId &&
      (link.elementId ?? null) === (input.elementId ?? null),
  );
  if (standing) return { file, link: standing };

  const at = nowIso();
  const link = usageLinkSchema.parse({
    id: newId<UsageLinkId>(),
    projectId: file.project.id,
    ownerKind: input.kind,
    ownerId: input.ownerId,
    unitId: beat.unitId,
    beatId: input.beatId,
    elementId: input.elementId ?? null,
    quote: (input.quote ?? '').slice(0, 400),
    note: input.note ?? '',
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, usageLinks: [...file.usageLinks, link] }, link };
};

/** Untag one occurrence. The writing is untouched — only the association goes. */
export const untagPassage = (file: ProjectFile, linkId: UsageLinkId): ProjectFile => ({
  ...file,
  usageLinks: file.usageLinks.filter((link) => link.id !== linkId),
});

/** What this moment contributes, in the writer's words (§6). */
export const noteOccurrence = (file: ProjectFile, linkId: UsageLinkId, note: string): ProjectFile => ({
  ...file,
  usageLinks: file.usageLinks.map((link) =>
    link.id === linkId ? { ...link, note, updatedAt: nowIso() } : link,
  ),
});

// -------------------------------------------------------------- the reading

export interface Occurrence {
  link: UsageLink;
  /** Story index of the scene, for ordering. -1 when the writing has gone. */
  unitIndex: number;
  beatIndex: number;
  /** "Scene 12 · Beat 3", or what is true instead. */
  where: string;
  /** The passage as it stands now, or '' when it has gone. */
  text: string;
  /**
   * Whether the passage this was tagged on is still in the manuscript.
   *
   * Read, never stored: the spec's *unresolved* status with nothing to keep up
   * to date. Cutting the scene orphans it by itself.
   */
  resolved: boolean;
}

/**
 * Every place a theme or a motif has been tagged, in story order.
 *
 * Orphans come last rather than being dropped: a passage that has been cut is
 * something the writer may want to re-tag or throw away, and it is theirs to
 * decide. Nothing here deletes one.
 */
export const occurrencesOf = (file: ProjectFile, kind: ThematicKind, ownerId: string): Occurrence[] => {
  const order = unitsInStoryOrder(file);
  const indexOf = new Map(order.map((unit, at) => [unit.id as string, at]));

  const found = file.usageLinks
    .filter((link) => link.ownerKind === kind && link.ownerId === ownerId)
    .map((link): Occurrence => {
      const beat = file.beats.find((one) => one.id === link.beatId);
      if (!beat) {
        return { link, unitIndex: -1, beatIndex: -1, where: 'The writing it was on has gone', text: '', resolved: false };
      }
      const unitIndex = indexOf.get(beat.unitId as string) ?? -1;
      const beatIndex = beatsForUnit(file, beat.unitId).findIndex((one) => one.id === beat.id);
      const element = link.elementId
        ? beat.manuscript.elements.find((one) => (one.id as string) === (link.elementId as string))
        : undefined;
      // A tag on the whole beat resolves as long as the beat is there; a tag on
      // a paragraph wants that paragraph.
      const resolved = unitIndex >= 0 && (!link.elementId || element !== undefined);
      const unit = findUnit(file, beat.unitId);
      const where = resolved
        ? `Scene ${unitIndex + 1} · Beat ${beatIndex + 1}${unit?.title ? ` — ${unit.title}` : ''}`
        : 'The writing it was on has gone';
      return {
        link,
        unitIndex,
        beatIndex,
        where,
        text: element?.text ?? (resolved ? beat.title : ''),
        resolved,
      };
    });

  return found.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? -1 : 1;
    if (a.unitIndex !== b.unitIndex) return a.unitIndex - b.unitIndex;
    return a.beatIndex - b.beatIndex;
  });
};

/** How many times something has been met, and how many of those have gone. */
export interface ThematicCount {
  total: number;
  resolved: number;
  orphans: number;
}

export const countOf = (file: ProjectFile, kind: ThematicKind, ownerId: string): ThematicCount => {
  const found = occurrencesOf(file, kind, ownerId);
  const resolved = found.filter((one) => one.resolved).length;
  return { total: found.length, resolved, orphans: found.length - resolved };
};

/** Everything tagged in one beat, so the writing can say what it is carrying. */
export const thematicWorkIn = (
  file: ProjectFile,
  beatId: BeatId,
): { themes: ResearchTheme[]; motifs: ResearchMotif[] } => {
  const here = file.usageLinks.filter((link) => link.beatId === beatId);
  const themeIds = new Set(here.filter((link) => link.ownerKind === 'theme').map((link) => link.ownerId));
  const motifIds = new Set(here.filter((link) => link.ownerKind === 'motif').map((link) => link.ownerId));
  return {
    themes: themesInOrder(file).filter((theme) => themeIds.has(theme.id as string)),
    motifs: motifsInOrder(file).filter((motif) => motifIds.has(motif.id as string)),
  };
};

/** One line about the module, for the menu. */
export const describeThematics = (file: ProjectFile): string => {
  const themes = themesInOrder(file).length;
  const motifs = motifsInOrder(file).length;
  if (themes + motifs === 0) return 'Nothing named yet.';
  return `${themes} ${themes === 1 ? 'theme' : 'themes'} · ${motifs} ${motifs === 1 ? 'motif' : 'motifs'}`;
};

// ------------------------------------------------------------ the two tracks

/** One tagged moment, at the scene it falls in. */
export interface ThematicMark {
  linkId: string;
  unitIndex: number;
  resolved: boolean;
  label: string;
}

/** One theme's or one motif's row. */
export interface ThematicTrackRow {
  kind: ThematicKind;
  ownerId: string;
  name: string;
  /** A motif's type, for the row's label. Empty on a theme. */
  detail: string;
  marks: ThematicMark[];
}

/**
 * The two tracks (§8).
 *
 * **Two groups, never one.** §8 is explicit, and the reason it matters is that
 * a reader meets a motif and understands a theme: nine marks on a motif's row
 * is recurrence working, and nine on a theme's row is a different claim
 * entirely. One combined track would average them into nothing.
 *
 * A row per theme and a row per motif, so one can be hidden without hiding the
 * other — and an orphaned mark is not drawn, because it has no position to be
 * drawn at.
 */
export const thematicTracks = (
  file: ProjectFile,
): { themes: ThematicTrackRow[]; motifs: ThematicTrackRow[] } => {
  const rowFor = (kind: ThematicKind, ownerId: string, name: string, detail: string): ThematicTrackRow => ({
    kind,
    ownerId,
    name,
    detail,
    marks: occurrencesOf(file, kind, ownerId)
      .filter((one) => one.resolved)
      .map((one) => ({
        linkId: one.link.id as string,
        unitIndex: one.unitIndex,
        resolved: true,
        label: `${name} — ${one.where}${one.link.note ? ` · ${one.link.note}` : ''}`,
      })),
  });

  return {
    themes: themesInOrder(file)
      .filter((theme) => theme.state !== 'set_aside')
      .map((theme) => rowFor('theme', theme.id as string, theme.name || 'Untitled theme', '')),
    motifs: motifsInOrder(file)
      .filter((motif) => motif.state !== 'set_aside')
      .map((motif) => rowFor('motif', motif.id as string, motif.name || 'Untitled motif', motif.motifType)),
  };
};

export {
  MOTIF_TYPES,
  THEMATIC_STATES,
  motifTypeSchema,
  researchMotifSchema,
  researchThemeSchema,
  themeMotifLinkSchema,
  thematicStateSchema,
  type MotifType,
  type ResearchMotif,
  type ResearchTheme,
  type ThemeMotifLink,
  type ThematicState,
} from './entities/themes.js';
