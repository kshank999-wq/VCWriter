import { z } from 'zod';
import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { orderKeyBetween } from './ordering.js';
import { beatSchema, structuralUnitSchema } from './entities/structure.js';
import { roleCan, seatName, type RoomRole, type Seat } from './room.js';
import type { Beat, StructuralUnit } from './entities/structure.js';
import type { BeatId, StructuralUnitId } from './ids.js';
import type { ProjectFile } from './project-file.js';
import type { Submission } from './submission.js';

/**
 * The Curation Tray, and the master merge (addendum 07 §12, stage 9).
 *
 * **This is the point of the module.** Everything before it makes it possible
 * to see what a room wrote; this is where the room's work becomes the script.
 *
 * Two rules carry the file, and they are the same rule twice.
 *
 * **A merge makes a new version. It never rewrites the contribution it drew
 * from** (§1). Nothing here touches a submission, a branch or the version a
 * piece came out of: `applyTray` takes the master as it stands and returns a
 * *different* master, and committing that writes a new row beside the old one.
 * A scene the room changed its mind about is recovered by looking at the
 * version it came from, which is exactly where it still is.
 *
 * **Attribution survives the journey.** A record carries `origin` since stage
 * 4, and taking it into the master carries `origin` with it — so a scene
 * assembled from two writers' beats genuinely has two authors and says so,
 * without anybody having to remember to write that down. §12 asks for it; it
 * falls out of stage 4 rather than being built again here.
 */

// ------------------------------------------------------------- what a tray holds

/**
 * What can be taken.
 *
 * A scene, or a beat — and a beat *is* §12's "precise excerpt", because a beat
 * is where the manuscript lives. Finer than that (a range of elements inside
 * one beat) would be a different and much more delicate thing, and pretending
 * a beat is not precise enough would be building it badly today rather than
 * properly later.
 */
export const TRAY_KINDS = ['scene', 'beat'] as const;
export const trayKindSchema = z.enum(TRAY_KINDS);
export type TrayKind = (typeof TRAY_KINDS)[number];

/**
 * What taking it does to the master.
 *
 * **`add` is the default and the safer of the two**, because it is the one that
 * answers §12's *compare alternate scenes*: the piece arrives beside what is
 * there, with an id of its own, and the room keeps both. `replace` is for the
 * ordinary case where a writer was asked for a pass on a scene and this is it.
 *
 * Neither destroys anything: the master this produces is a *new* version, and
 * the one before it is still a version.
 */
export const TRAY_HOWS = ['add', 'replace'] as const;
export const trayHowSchema = z.enum(TRAY_HOWS);
export type TrayHow = (typeof TRAY_HOWS)[number];

export const HOW_NAMES: Record<TrayHow, string> = {
  add: 'Alongside what is there',
  replace: 'In place of it',
};

export const trayItemSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  /** The contribution it was taken from, so the merge record can name it. */
  submissionId: z.string().nullable().default(null),
  versionId: z.string(),
  /** Whose contribution. Not necessarily the record's own author. */
  authorId: z.string(),
  kind: trayKindSchema,
  /** The record's id inside that version. */
  recordId: z.string(),
  /** What it was called when it was taken, so the tray reads without the document. */
  label: z.string().default(''),
  how: trayHowSchema.default('add'),
  /** Which scene a beat joins, where the master does not already have it. */
  intoUnitId: z.string().nullable().default(null),
  /** What the showrunner said about taking it. */
  note: z.string().default(''),
  orderKey: z.string(),
  createdAt: z.string(),
});
export type TrayItem = z.infer<typeof trayItemSchema>;

/** Whether this role assembles a master at all (§7 — the showrunner's). */
export const canCurate = (role: RoomRole | null): boolean => role !== null && roleCan(role, 'curate');

// ------------------------------------------------------- what there is to take

/** Something a contribution offers the tray. */
export interface Curatable {
  kind: TrayKind;
  id: string;
  label: string;
  /** Whose it is, where the record says. Null on unsigned work. */
  authorId: string | null;
  /** For a beat: the scene it sits in, so the tray knows where it belongs. */
  unitId: string | null;
  /** How much of it there is, in words — a beat with nothing in it is noise. */
  words: number;
}

const wordsIn = (beat: Beat): number =>
  beat.manuscript.elements.reduce(
    (total, element) => total + element.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );

/**
 * What a submitted version offers, in story order.
 *
 * Read out of the document rather than recorded when it was submitted: a
 * submission references a version and copies nothing (§10), so this is where
 * the reading happens — the same arrangement the brainstorming room uses.
 */
export const curatableFrom = (file: ProjectFile): Curatable[] => {
  const units = [...file.units].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  return units.flatMap((unit) => [
    {
      kind: 'scene' as const,
      id: unit.id as string,
      label: unit.title || 'Untitled scene',
      authorId: unit.origin?.authorId ?? null,
      unitId: null,
      words: file.beats.filter((beat) => beat.unitId === unit.id).reduce((n, beat) => n + wordsIn(beat), 0),
    },
    ...file.beats
      .filter((beat) => beat.unitId === unit.id)
      .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
      .map((beat) => ({
        kind: 'beat' as const,
        id: beat.id as string,
        label: beat.title || 'Untitled beat',
        authorId: beat.origin?.authorId ?? null,
        unitId: unit.id as string,
        words: wordsIn(beat),
      })),
  ]);
};

// ------------------------------------------------------------------ the merge

/** A piece of a contribution, read out of the version it came from. */
export interface TrayPiece {
  item: TrayItem;
  /** The scene, where the item is a scene. */
  unit: StructuralUnit | null;
  /** What it brings: a scene's beats, or the one beat. */
  beats: Beat[];
}

export type MergeRefusal =
  | { reason: 'nothing_in_tray' }
  | { reason: 'no_such_record'; label: string }
  | { reason: 'no_such_scene'; label: string };

export const mergeRefusalText = (refusal: MergeRefusal): string => {
  switch (refusal.reason) {
    case 'nothing_in_tray':
      return 'There is nothing in the tray to take.';
    case 'no_such_record':
      return `“${refusal.label}” is not in the version it was taken from any more.`;
    case 'no_such_scene':
      return `“${refusal.label}” has no scene to go into. Say which scene it joins.`;
  }
};

/** One line of the record §12 asks for: every source the master drew from. */
export interface MergeSource {
  submissionId: string | null;
  versionId: string;
  authorId: string;
  kind: TrayKind;
  recordId: string;
  label: string;
  how: TrayHow;
  /** The id it took in the master, which is a new one where it went alongside. */
  becameId: string;
}

export interface MergeRecord {
  at: string;
  sources: MergeSource[];
}

/**
 * Take the tray into the master (§12).
 *
 * **Pure, and that is what makes the preview honest**: §12 asks to see the
 * resulting master sequence before committing, and the only way to show it
 * truthfully is to actually build it. So this is the preview *and* the commit,
 * called twice — the page draws what it returns, and the route writes the same
 * thing. There is no second code path that could disagree with the picture.
 *
 * Nothing here touches the master it was given. It returns a different one.
 */
export const applyTray = (
  master: ProjectFile,
  pieces: readonly TrayPiece[],
  options: { at?: string } = {},
): { file: ProjectFile; record: MergeRecord } | MergeRefusal => {
  if (pieces.length === 0) return { reason: 'nothing_in_tray' };

  const at = options.at ?? nowIso();
  let units = [...master.units];
  let beats = [...master.beats];
  const sources: MergeSource[] = [];

  const lastUnitKey = (): string | null =>
    units.length === 0 ? null : units.map((one) => one.orderKey).sort()[units.length - 1]!;
  const lastBeatKeyIn = (unitId: string): string | null => {
    const keys = beats.filter((one) => one.unitId === unitId).map((one) => one.orderKey).sort();
    return keys.length === 0 ? null : keys[keys.length - 1]!;
  };

  for (const piece of pieces) {
    const { item } = piece;

    if (item.kind === 'scene') {
      if (!piece.unit) return { reason: 'no_such_record', label: item.label };

      const sitting = units.find((one) => (one.id as string) === (piece.unit!.id as string));
      if (item.how === 'replace' && sitting) {
        // In place of it: the master's own id, the contribution's content, and
        // every beat under it swapped for the ones that came with it. The scene
        // that was here is not gone — it is in the version before this one.
        units = units.map((one) =>
          one === sitting
            ? structuralUnitSchema.parse({
                ...piece.unit,
                projectId: master.project.id,
                laneId: sitting.laneId,
                orderKey: sitting.orderKey,
                updatedAt: at,
              })
            : one,
        );
        beats = [
          ...beats.filter((one) => (one.unitId as string) !== (sitting.id as string)),
          ...piece.beats.map((beat) =>
            beatSchema.parse({
              ...beat,
              projectId: master.project.id,
              unitId: sitting.id,
              updatedAt: at,
            }),
          ),
        ];
        sources.push({ ...asSource(item), becameId: sitting.id as string });
        continue;
      }

      // Alongside: a new id, so the room keeps both and can compare them.
      const unitId = newId<StructuralUnitId>();
      const orderKey = orderKeyBetween(lastUnitKey(), null);
      units = [
        ...units,
        structuralUnitSchema.parse({
          ...piece.unit,
          id: unitId,
          projectId: master.project.id,
          laneId: master.lanes[0]?.id ?? piece.unit.laneId,
          orderKey,
          createdAt: at,
          updatedAt: at,
        }),
      ];
      let after: string | null = null;
      for (const beat of piece.beats) {
        const key = orderKeyBetween(after, null);
        after = key;
        beats = [
          ...beats,
          beatSchema.parse({
            ...beat,
            id: newId<BeatId>(),
            projectId: master.project.id,
            unitId,
            orderKey: key,
            createdAt: at,
            updatedAt: at,
          }),
        ];
      }
      sources.push({ ...asSource(item), becameId: unitId as string });
      continue;
    }

    // A beat.
    const brought = piece.beats[0];
    if (!brought) return { reason: 'no_such_record', label: item.label };

    const sitting = beats.find((one) => (one.id as string) === (brought.id as string));
    if (item.how === 'replace' && sitting) {
      beats = beats.map((one) =>
        one === sitting
          ? beatSchema.parse({
              ...brought,
              projectId: master.project.id,
              unitId: sitting.unitId,
              orderKey: sitting.orderKey,
              updatedAt: at,
            })
          : one,
      );
      sources.push({ ...asSource(item), becameId: sitting.id as string });
      continue;
    }

    // Which scene it joins: the one the showrunner said, or the one it sat in
    // where the master still has that scene.
    const intoId =
      item.intoUnitId && units.some((one) => (one.id as string) === item.intoUnitId)
        ? item.intoUnitId
        : units.some((one) => (one.id as string) === (brought.unitId as string))
          ? (brought.unitId as string)
          : null;
    if (!intoId) return { reason: 'no_such_scene', label: item.label };

    const beatId = newId<BeatId>();
    beats = [
      ...beats,
      beatSchema.parse({
        ...brought,
        id: beatId,
        projectId: master.project.id,
        unitId: intoId,
        orderKey: orderKeyBetween(lastBeatKeyIn(intoId), null),
        createdAt: at,
        updatedAt: at,
      }),
    ];
    sources.push({ ...asSource(item), becameId: beatId as string });
  }

  return {
    file: {
      ...master,
      units,
      beats,
      project: { ...master.project, updatedAt: at },
      savedAt: at,
    },
    record: { at, sources },
  };
};

const asSource = (item: TrayItem): Omit<MergeSource, 'becameId'> => ({
  submissionId: item.submissionId,
  versionId: item.versionId,
  authorId: item.authorId,
  kind: item.kind,
  recordId: item.recordId,
  label: item.label,
  how: item.how,
});

// ----------------------------------------------------------------- the preview

/** One scene of the master as it would stand, and who wrote it. */
export interface SequenceRow {
  id: string;
  label: string;
  /** Everybody with work in it — the scene's own author and every beat's. */
  authorIds: string[];
  beats: number;
  /** Whether this scene is new in the merge, or changed by it. */
  change: 'added' | 'changed' | null;
}

/**
 * The master sequence as it would read, for looking at before committing (§12).
 *
 * **More than one author per scene, and it says so** — that is the column §12
 * asks for and the reason the preview is worth drawing at all. It falls out of
 * reading `origin` off the records rather than being tracked separately.
 */
export const sequenceOf = (file: ProjectFile, record?: MergeRecord): SequenceRow[] => {
  const touched = new Map(record?.sources.map((source) => [source.becameId, source.how]) ?? []);
  return [...file.units]
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
    .map((unit) => {
      const inScene = file.beats.filter((beat) => (beat.unitId as string) === (unit.id as string));
      const authors = new Set<string>();
      if (unit.origin) authors.add(unit.origin.authorId);
      for (const beat of inScene) if (beat.origin) authors.add(beat.origin.authorId);

      const own = touched.get(unit.id as string);
      const byBeat = inScene.some((beat) => touched.has(beat.id as string));
      return {
        id: unit.id as string,
        label: unit.title || 'Untitled scene',
        authorIds: [...authors],
        beats: inScene.length,
        change: own === 'add' ? 'added' : own === 'replace' || byBeat ? 'changed' : null,
      };
    });
};

/**
 * What the merge did, in one line, for the version's own label.
 *
 * `describeMasterMerge`, not `describeMerge`: `sync-merge.ts` already has one,
 * and §3.3 is emphatic that these are *different merges* — that one resolves
 * one writer's two machines and decides; this one assembles a room's work and
 * never decides anything. Two names a word apart for those two would be the
 * exact confusion §3.3 exists to prevent.
 */
export const describeMasterMerge = (record: MergeRecord, seats: readonly Seat[]): string => {
  const people = new Set(record.sources.map((source) => source.authorId));
  const names = [...people]
    .map((id) => seats.find((seat) => seat.userId === id))
    .map((seat) => (seat ? seatName(seat) : 'somebody no longer in the room'));
  const pieces = record.sources.length === 1 ? '1 piece' : `${record.sources.length} pieces`;
  return names.length === 0 ? pieces : `${pieces} from ${names.join(', ')}`;
};

/** The submissions a merge drew from, so they can be marked incorporated. */
export const submissionsBehind = (record: MergeRecord): string[] => [
  ...new Set(record.sources.map((source) => source.submissionId).filter((id): id is string => id !== null)),
];

/**
 * What is still waiting to be curated: submitted work with nothing in the tray.
 *
 * Approved *and* submitted alike, because §12's tray is where competing ideas
 * are compared and a decision has not necessarily been made yet — a queue that
 * only offered approved work would make the showrunner decide before looking.
 */
export const awaitingCuration = (
  submissions: readonly Submission[],
  tray: readonly TrayItem[],
): Submission[] => {
  const taken = new Set(tray.map((item) => item.submissionId));
  return submissions.filter(
    (one) =>
      one.kind === 'script' &&
      one.state !== 'incorporated' &&
      one.state !== 'rejected' &&
      !taken.has(one.id),
  );
};
