import { addBeat, markResearchUsed, setResearchArchived, updateBeat } from './mutations.js';
import { beatsForUnit, noteOnTrack, shelvedItems } from './selectors.js';
import { onlyLiving } from './graveyard.js';
import { outlineNumbers } from './numbering.js';
import { addItem, findOutline, findOutlineItem, outlineRows, rowTitle, updateItem } from './outline.js';
import { canPromote, divisionSpan, promoteRow } from './outline-binding.js';
import { defaultElementType } from './editing.js';
import { contentsShelf, placeKey, placeNow, placeOf, placeStillThere, type NotePlace } from './chapter-notes.js';
import { nowIso } from './entities/common.js';
import { manuscriptElementSchema } from './entities/manuscript.js';
import { researchItemSchema } from './entities/research.js';
import { newId } from './ids.js';
import type { Outline, OutlineItem } from './entities/outline.js';
import type { ResearchItem } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, ManuscriptElementId, OutlineId, OutlineItemId, ResearchItemId, StructuralUnitId } from './ids.js';

/**
 * The outline beside the notes, and the rewrite screen (addendum 28 §7).
 *
 * From Ken: *I want to be able to bundle ideas in folders by dragging from the
 * notes screen into the right side bar which will have the sections or
 * categories from the outline — chapter and subsections. This is especially
 * important for instructional books… When you click on a note within a folder
 * — double click it — it brings up a rewrite screen like the beat screen with a
 * side split showing you the original note so you can cut and paste or rewrite,
 * and you can place that on the track.*
 *
 * And: *until it is in the timeline track it will show as not used — when used
 * a red X will be placed in the corner and it moves to the "used in book"
 * folder.* That is `noteOnTrack`, read off the beats.
 *
 * Filing is still `fileNoteUnder`: one field on the note, a reference to the
 * outline row, read through the row's binding (`placeNow`), so the table of
 * contents and this sidebar are one answer to where a note belongs.
 */

/** What an outline row is, in the sidebar's words. */
export type FolderKind = 'chapter' | 'section' | 'subsection' | 'idea' | 'heading';

const FOLDER_KINDS: Record<string, FolderKind> = {
  chapter: 'chapter',
  scene: 'section',
  beat: 'subsection',
  idea: 'idea',
  heading: 'heading',
};

/** One folder of the sidebar: an outline row, or a part of the book the outline does not have. */
export interface OutlineFolder {
  /** `placeKey` of where a note dropped here is filed. */
  key: string;
  place: NotePlace;
  /** `1`, `1.2`, `1.2.1` — derived, stored nowhere. Empty for an idea. */
  number: string;
  title: string;
  kind: FolderKind;
  depth: number;
  /** True where it came from the Outliner; false for a part of the book the outline lacks. */
  fromOutline: boolean;
  /** The notes filed here, in the order they were filed. */
  notes: ResearchItem[];
  /** How many of those are on the track. */
  used: number;
}

/**
 * Every folder a note can be dragged into: the Outliner's chapters, sections,
 * subsections and ideas in the outline's order, each at its own depth, then any
 * chapter or section of the book the outline does not have.
 *
 * A row that has been added to the track files under what it became, so
 * nothing is lost on promotion and the table of contents agrees with this.
 */
export const outlineFolders = (file: ProjectFile): OutlineFolder[] => {
  const filed = new Map<string, ResearchItem[]>();
  for (const item of onlyLiving(file.researchItems)) {
    // A note already worked into the outline is archived (§9): processed.
    if (item.archived) continue;
    const place = placeNow(file, placeOf(item.place));
    if (!place || !placeStillThere(file, place)) continue;
    const key = placeKey(place);
    filed.set(key, [...(filed.get(key) ?? []), item]);
  }

  const folders: OutlineFolder[] = [];
  const seen = new Set<string>();
  const add = (folder: Omit<OutlineFolder, 'key' | 'notes' | 'used'>): void => {
    const key = placeKey(folder.place);
    if (seen.has(key)) return;
    seen.add(key);
    const notes = filed.get(key) ?? [];
    folders.push({ ...folder, key, notes, used: notes.filter((note) => noteOnTrack(file, note)).length });
  };

  for (const outline of file.outlines ?? []) {
    const numbers = outlineNumbers(file, outline);
    const everything = new Set(outline.items.map((item) => item.id as string));
    const byId = new Map(outline.items.map((item) => [item.id as string, item]));
    const depthOf = (item: OutlineItem): number => {
      let depth = 0;
      let parent = item.parentId ? byId.get(item.parentId as string) : undefined;
      while (parent) {
        if (FOLDER_KINDS[parent.kind]) depth += 1;
        parent = parent.parentId ? byId.get(parent.parentId as string) : undefined;
      }
      return depth;
    };
    for (const { item } of outlineRows(outline, everything)) {
      const kind = FOLDER_KINDS[item.kind];
      if (!kind) continue;
      const place = placeNow(file, { kind: 'plan', itemId: item.id }) as NotePlace;
      add({
        place,
        number: kind === 'idea' ? '' : (numbers.get(item.id as string) ?? ''),
        title: rowTitle(file, item),
        kind,
        depth: depthOf(item),
        fromOutline: true,
      });
    }
  }

  for (const row of contentsShelf(file)) {
    if (row.planned) continue;
    add({
      place: row.place,
      number: row.number,
      title: row.title,
      kind: row.place.kind === 'chapter' ? 'chapter' : 'section',
      depth: row.depth,
      fromOutline: false,
    });
  }

  return folders;
};

// ------------------------------------------------------------ the rewrite

/** Keep the writer's rewrite of a note. The note's own words are untouched. */
export const setNoteRewrite = (file: ProjectFile, itemId: ResearchItemId, rewrite: string): ProjectFile => {
  const item = file.researchItems.find((one) => (one.id as string) === (itemId as string));
  if (!item || item.rewrite === rewrite) return file;
  return {
    ...file,
    researchItems: file.researchItems.map((one) =>
      one === item ? researchItemSchema.parse({ ...one, rewrite, updatedAt: nowIso() }) : one,
    ),
  };
};

/** What placing would put on the track: the rewrite where there is one, else the note. */
export const textToPlace = (item: ResearchItem): string => (item.rewrite.trim() ? item.rewrite : item.body).trim();

export type PlaceOnTrack =
  | { ok: true; file: ProjectFile; beatId: BeatId; unitId: StructuralUnitId }
  | { ok: false; why: string };

type Target = { unitId: StructuralUnitId; index: number } | { why: string } | { promote: { outline: Outline; item: OutlineItem } };

/** The beats in a unit that some outline row is bound to — a subsection's own beat. */
const boundBeats = (file: ProjectFile): Set<string> =>
  new Set(
    (file.outlines ?? []).flatMap((outline) =>
      outline.items.flatMap((row) => (row.boundBeatId ? [row.boundBeatId as string] : [])),
    ),
  );

/** Just after a subsection's beat, and after anything already placed there. */
const afterBeat = (file: ProjectFile, beatId: BeatId): { unitId: StructuralUnitId; index: number } | null => {
  const beat = file.beats.find((one) => one.id === beatId);
  if (!beat) return null;
  const order = beatsForUnit(file, beat.unitId);
  const at = order.findIndex((one) => one.id === beatId);
  const bound = boundBeats(file);
  const next = order.findIndex((one, index) => index > at && bound.has(one.id as string));
  return { unitId: beat.unitId, index: next === -1 ? order.length : next };
};

const endOfUnit = (file: ProjectFile, unitId: StructuralUnitId) => ({ unitId, index: beatsForUnit(file, unitId).length });

const targetFor = (file: ProjectFile, item: ResearchItem, afterBeatId: BeatId | null): Target => {
  const place = placeNow(file, placeOf(item.place));
  if (!place || !placeStillThere(file, place)) {
    const after = afterBeatId ? afterBeat(file, afterBeatId) : null;
    if (after) return after;
    return { why: 'Drag it into a chapter or section first, so it knows where in the book it goes.' };
  }
  if (place.kind === 'section') return endOfUnit(file, place.unitId);
  if (place.kind === 'chapter') {
    const span = divisionSpan(file, place.markerId);
    const last = span[span.length - 1];
    return last ? endOfUnit(file, last.id) : { why: 'That chapter has no section to write in yet.' };
  }

  const outline = (file.outlines ?? []).find((one) => one.items.some((row) => row.id === place.itemId));
  const row = outline?.items.find((one) => one.id === place.itemId);
  if (!outline || !row) return { why: 'That part of the outline is not there any more.' };
  // The row and everything above it, nearest first.
  const chain: OutlineItem[] = [];
  for (let at: OutlineItem | undefined = row; at; at = at.parentId ? outline.items.find((one) => one.id === at!.parentId) : undefined) {
    chain.push(at);
  }
  for (const one of chain) {
    if (one.boundBeatId) {
      const after = afterBeat(file, one.boundBeatId);
      if (after) return after;
    }
    if (one.boundUnitId && file.units.some((unit) => unit.id === one.boundUnitId)) return endOfUnit(file, one.boundUnitId);
    if (one.boundMarkerId) {
      const span = divisionSpan(file, one.boundMarkerId);
      const last = span[span.length - 1];
      if (last) return endOfUnit(file, last.id);
    }
  }
  // Nothing above it is in the book yet: add the highest part that can go,
  // which brings its sections and subsections with it.
  let refusal: string | null = null;
  for (const one of [...chain].reverse()) {
    if (one.kind !== 'chapter' && one.kind !== 'scene' && one.kind !== 'beat') continue;
    const why = canPromote(file, outline, one);
    if (why === null) return { promote: { outline, item: one } };
    refusal ??= why;
    if (one.kind !== 'chapter') break;
  }
  if (refusal === 'a chapter starts on a section, and this one has none yet') {
    return { why: 'Add a section under this chapter in the Outliner first, so the writing has somewhere to start.' };
  }
  if (refusal === 'there is no track to put a scene in') return { why: 'There is no track to put it on yet.' };
  return { why: 'It is filed under an idea that is not in the book. Drag it into a chapter or section to place it.' };
};

/** The words as manuscript lines, a paragraph each. */
const linesOf = (file: ProjectFile, text: string) => {
  const type = defaultElementType(file.project.format);
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) =>
      manuscriptElementSchema.parse({ id: newId<ManuscriptElementId>(), type, text: paragraph, characterId: null, attributes: {} }),
    );
};

/**
 * **Place on the track**: the rewrite (or the note, where nobody has rewritten
 * it) becomes a beat where the note is filed, and the note reads used.
 *
 * Where it is filed under a part of the outline that is still a plan, that
 * part is added to the track first — the Outliner's own *Add to track*, which
 * brings its sections and subsections with it — so the beat lands in the
 * section it was sorted into. A subsection's note goes just after that
 * subsection's beat, after anything placed there before it.
 */
export const placeNoteOnTrack = (
  file: ProjectFile,
  itemId: ResearchItemId,
  options: { text?: string; afterBeatId?: BeatId | null } = {},
): PlaceOnTrack => {
  const item = onlyLiving(file.researchItems).find((one) => (one.id as string) === (itemId as string));
  if (!item) return { ok: false, why: 'That note is not on the shelf any more.' };
  const text = (options.text ?? textToPlace(item)).trim();
  if (!text) return { ok: false, why: 'There is nothing written to place yet.' };

  let current = file;
  let target = targetFor(current, item, options.afterBeatId ?? null);
  for (let round = 0; round < 3 && 'promote' in target; round += 1) {
    current = promoteRow(current, target.promote.outline.id, target.promote.item.id).file;
    target = targetFor(current, item, options.afterBeatId ?? null);
  }
  if ('why' in target) return { ok: false, why: target.why };
  if ('promote' in target) return { ok: false, why: 'That part of the outline could not be added to the track.' };

  const added = addBeat(current, { unitId: target.unitId, title: item.title, index: target.index });
  current = updateBeat(added.file, added.beat.id, { manuscript: { elements: linesOf(current, text) } });
  current = markResearchUsed(current, { itemId: item.id, beatId: added.beat.id });
  return { ok: true, file: current, beatId: added.beat.id, unitId: target.unitId };
};

// ------------------------------------------------- sorting in the Outliner

/**
 * The notes filed under one part of the outline and still to be worked in
 * (addendum 28 §9, from Ken: *when you click on one of the sections or
 * subsections that has those notes in it… it'll open up in that split screen…
 * and when you clean it up and rewrite it, then you add it, and it'll add as a
 * subsection or a note in the outliner*). Archived notes are done.
 */
export const notesToProcess = (file: ProjectFile, place: NotePlace): ResearchItem[] => {
  const here = placeNow(file, place);
  if (!here) return [];
  const key = placeKey(here);
  return onlyLiving(file.researchItems).filter((item) => {
    if (item.archived) return false;
    const at = placeNow(file, placeOf(item.place));
    return at !== null && placeKey(at) === key;
  });
};

/**
 * The notes nobody has sorted yet: on the shelf, not archived, and filed
 * nowhere that still exists. What the Outliner's shelf lists to drag from;
 * a note dropped into the outline leaves this list.
 */
export const unsortedNotes = (file: ProjectFile): ResearchItem[] =>
  shelvedItems(file).filter((item) => {
    if (item.archived) return false;
    const at = placeNow(file, placeOf(item.place));
    return !(at && placeStillThere(file, at));
  });

/**
 * **Add to the outline**: the rewrite (or the note) becomes a row under the
 * part of the outline it was sorted into — a subsection, a note, whatever kind
 * was asked for — titled with the note's title and carrying the words as its
 * own. The note is then archived: worked in, kept, out of the way.
 */
export const addNoteToOutline = (
  file: ProjectFile,
  itemId: ResearchItemId,
  outlineId: OutlineId,
  parentId: OutlineItemId,
  kind: string,
): { file: ProjectFile; rowId: OutlineItemId | null } => {
  const item = onlyLiving(file.researchItems).find((one) => (one.id as string) === (itemId as string));
  const outline = findOutline(file, outlineId);
  if (!item || !outline || !findOutlineItem(outline, parentId)) return { file, rowId: null };
  const made = addItem(file, outlineId, { parentId, kind, title: item.title });
  if (!made.itemId) return { file, rowId: null };
  const written = updateItem(made.file, outlineId, made.itemId, { body: textToPlace(item) });
  return { file: setResearchArchived(written, item.id, true), rowId: made.itemId };
};
