import {
  ARC_POINT_NAMES,
  describeWork,
  isArcVerb,
  isUsed,
  usageColour,
  wasOffered,
  type ArcPoint,
  type ArcPointKind,
  type CharacterWork,
  type UsageColour,
} from './character-creator.js';
import { charactersCalled } from './characters.js';
import type {
  CharacterId,
  CharacterTraitId,
  TrackId,
  StructuralUnitId,
} from './ids.js';
import type { ProjectFile } from './project-file.js';

/**
 * Search, filters and the review modes (addendum 08 §18, stage 10).
 *
 * **One filter over everything, and three readings on top of it.** §18 asks for
 * a search, seven filters, a character review in story order, a report of what
 * is still on deck, and an arc continuity check — which sounds like five
 * features and is really one: *choose some of this character work, and put it in
 * the order the story tells it*. Written as five it would drift five ways.
 *
 * **Nothing here judges.** §7 narrows §10's *optional warnings* to a list the
 * writer asks for, so every reading in this file is a statement of fact about
 * the manuscript — *this is on deck*, *this cause is written after its effect* —
 * and never an opinion about whether a character is thin.
 */

export type WorkStanding = 'in_the_writing' | 'on_deck' | 'set_aside';

/** §18's seven filters, each of them optional. */
export interface WorkFilter {
  /** Matched against the work itself, its trait's name and the character's. */
  query?: string;
  characterId?: CharacterId | null;
  traitId?: CharacterTraitId | null;
  standing?: WorkStanding | null;
  /** An arc point of this kind — §18's *arc stage*. */
  arcKind?: ArcPointKind | null;
  unitId?: StructuralUnitId | null;
  trackId?: TrackId | null;
  /** Only people who have a relationship with this one, either way round. */
  relatedTo?: CharacterId | null;
}

/** One piece of character work, placed where the story puts it. */
export interface ReviewRow {
  work: CharacterWork;
  standing: WorkStanding;
  colour: UsageColour;
  /** The scene and beat it is in, when it is in one. */
  unitTitle: string | null;
  beatTitle: string | null;
  /** Where in the story, for ordering. Null for anything not written yet. */
  where: number | null;
}

const standingOf = (input: { retired: boolean; used: boolean }): WorkStanding =>
  input.retired ? 'set_aside' : input.used ? 'in_the_writing' : 'on_deck';

/**
 * The three words, as the review says them.
 *
 * Named apart from the Writers Room's `STANDING_WORDS`, which answers a
 * completely different question (*where does this copy stand against the
 * master*): two exports with one name would be an invitation to import the
 * wrong one.
 */
export const WORK_STANDING_WORDS: Record<WorkStanding, string> = {
  in_the_writing: 'In the writing',
  on_deck: 'On deck',
  set_aside: 'Set aside',
};

/**
 * Everything the module holds, filtered, **in the order the story tells it**.
 *
 * Story order rather than the order things were written down, because §18's
 * review mode is for reading a character the way an audience meets them. What is
 * not on the page yet has no place in that order, so it follows at the end in
 * the writer's own.
 */
export const reviewRows = (file: ProjectFile, filter: WorkFilter = {}): ReviewRow[] => {
  const order = new Map(
    [...file.units]
      .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
      .map((unit, index) => [unit.id as string, index] as const),
  );

  const related = filter.relatedTo
    ? new Set(
        file.characterRelationships
          .filter(
            (one) =>
              (one.fromCharacterId as string) === (filter.relatedTo as string) ||
              (one.toCharacterId as string) === (filter.relatedTo as string),
          )
          .flatMap((one) => [one.fromCharacterId as string, one.toCharacterId as string])
          .filter((id) => id !== (filter.relatedTo as string)),
      )
    : null;

  const nameOf = (characterId: CharacterId): string =>
    file.characters.find((one) => (one.id as string) === (characterId as string))?.name ?? '';

  /** The first living pin of a piece of work, which is where it sits. */
  const pinOf = (kind: CharacterWork['kind'], id: string) =>
    file.usageLinks.find((link) => {
      if (link.ownerKind !== kind || link.ownerId !== id) return false;
      return file.beats.some((beat) => (beat.id as string) === (link.beatId as string));
    });

  const rows: ReviewRow[] = [];

  const push = (work: CharacterWork, retired: boolean) => {
    const used = isUsed({ kind: work.kind, id: work.id }, file.usageLinks, file);
    const pin = pinOf(work.kind, work.id);
    const beat = pin ? file.beats.find((one) => (one.id as string) === (pin.beatId as string)) : undefined;
    const unit = beat ? file.units.find((one) => (one.id as string) === (beat.unitId as string)) : undefined;

    rows.push({
      work,
      standing: standingOf({ retired, used }),
      colour: usageColour({ retired, used }),
      unitTitle: unit ? `${unit.sequenceLabel} ${unit.title}`.trim() || 'Untitled scene' : null,
      beatTitle: beat ? beat.title : null,
      where: unit ? (order.get(unit.id as string) ?? null) : null,
    });
  };

  for (const item of file.characterizationItems) {
    const trait = file.characterTraits.find((one) => (one.id as string) === (item.traitId as string | null));
    push(
      {
        kind: 'characterization',
        id: item.id as string,
        characterId: item.characterId,
        characterName: nameOf(item.characterId),
        text: item.text,
        pointKind: null,
        traitName: trait?.name ?? null,
      },
      item.retired,
    );
  }

  for (const point of file.arcPoints) {
    push(
      {
        kind: 'arc_point',
        id: point.id as string,
        characterId: point.characterId,
        characterName: nameOf(point.characterId),
        text: point.text,
        pointKind: point.kind,
        traitName: null,
      },
      point.retired,
    );
  }

  const needle = (filter.query ?? '').trim().toLowerCase();

  return rows
    .filter((row) => {
      if (filter.characterId && (row.work.characterId as string) !== (filter.characterId as string)) {
        return false;
      }
      if (related && !related.has(row.work.characterId as string)) return false;
      if (filter.standing && row.standing !== filter.standing) return false;
      if (filter.arcKind && row.work.pointKind !== filter.arcKind) return false;
      if (filter.traitId) {
        const item = file.characterizationItems.find((one) => (one.id as string) === row.work.id);
        if (!item || (item.traitId as string | null) !== (filter.traitId as string)) return false;
      }
      if (filter.unitId || filter.trackId) {
        const pin = pinOf(row.work.kind, row.work.id);
        const beat = pin ? file.beats.find((one) => (one.id as string) === (pin.beatId as string)) : undefined;
        const unit = beat ? file.units.find((one) => (one.id as string) === (beat.unitId as string)) : undefined;
        if (!unit) return false;
        if (filter.unitId && (unit.id as string) !== (filter.unitId as string)) return false;
        if (filter.trackId && (unit.trackId as string) !== (filter.trackId as string)) return false;
      }
      if (needle.length > 0) {
        // The trait's name and the person's are searched as well as the work
        // itself: somebody looking for "greedy" wants what it makes her do, and
        // the trait is the only place that word appears.
        const hay = [row.work.text, row.work.traitName ?? '', row.work.characterName]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.where === null && b.where === null) {
        return a.work.characterName === b.work.characterName
          ? a.work.text.localeCompare(b.work.text)
          : a.work.characterName.localeCompare(b.work.characterName);
      }
      if (a.where === null) return 1;
      if (b.where === null) return -1;
      return a.where - b.where;
    });
};

/**
 * §18's **Unused Character Material report**: everything still on deck.
 *
 * Set-aside work is left out — it is a decision already made, and a report that
 * kept listing it would be the nagging §7 rules out. Grouped by person, because
 * the question it answers is *who have I got ideas for that are not on the page
 * yet*.
 */
export const unusedCharacterMaterial = (
  file: ProjectFile,
  filter: WorkFilter = {},
): { characterId: CharacterId; characterName: string; rows: ReviewRow[] }[] => {
  const rows = reviewRows(file, { ...filter, standing: 'on_deck' });
  const groups = new Map<string, { characterId: CharacterId; characterName: string; rows: ReviewRow[] }>();

  for (const row of rows) {
    const key = row.work.characterId as string;
    if (!groups.has(key)) {
      groups.set(key, {
        characterId: row.work.characterId,
        characterName: row.work.characterName,
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  return [...groups.values()].sort((a, b) => a.characterName.localeCompare(b.characterName));
};

// ------------------------------------------------------- arc continuity

/**
 * Something worth a second look, said as a fact.
 *
 * **Never a judgement about the writing.** Each of these is checkable against
 * the manuscript, which is the only kind of flag §7 allows: a cause written
 * after its effect is either true or it is not, and *this character is thin* is
 * not a thing software gets to say.
 */
export interface ContinuityNote {
  kind: 'cause_after_effect' | 'refusal_never_offered';
  characterId: CharacterId;
  text: string;
}

export interface ArcContinuity {
  /** The arc points that are written, in the order the manuscript tells them. */
  inOrder: ReviewRow[];
  notes: ContinuityNote[];
}

/**
 * §18's **Arc Continuity review**: the arc points in manuscript order, and the
 * two gaps that can be checked rather than guessed at.
 *
 * *A cause written after its effect* — the writer said this moment causes that
 * one, and the scenes are the other way round. That is worth knowing and it is a
 * fact, not an opinion; it may also be deliberate, which is why it is a note and
 * not a warning.
 *
 * *A refusal nobody was offered* — §9's own logic: a character who refuses a
 * change the arc never offered them is missing the moment that makes the refusal
 * mean anything. `wasOffered` has answered this since stage 0.
 */
export const arcContinuity = (
  file: ProjectFile,
  characterId?: CharacterId | null,
): ArcContinuity => {
  const rows = reviewRows(file, {
    ...(characterId ? { characterId } : {}),
  }).filter((row) => row.work.kind === 'arc_point');

  const nameOf = (id: CharacterId): string =>
    file.characters.find((one) => (one.id as string) === (id as string))?.name ?? '';
  const placeOf = new Map(rows.map((row) => [row.work.id, row.where]));

  const notes: ContinuityNote[] = [];

  for (const link of file.links) {
    if (!isArcVerb(link.type)) continue;
    if (link.from.type !== 'arc_point' || link.to.type !== 'arc_point') continue;
    const cause = placeOf.get(link.from.id);
    const effect = placeOf.get(link.to.id);
    if (cause === undefined || effect === undefined || cause === null || effect === null) continue;
    if (cause <= effect) continue;

    const from = file.arcPoints.find((one) => (one.id as string) === link.from.id);
    const to = file.arcPoints.find((one) => (one.id as string) === link.to.id);
    if (!from || !to) continue;
    notes.push({
      kind: 'cause_after_effect',
      characterId: from.characterId,
      text: `“${from.text}” ${link.type} “${to.text}”, but it is written later in the story.`,
    });
  }

  const arcsToCheck = characterId
    ? file.characterArcs.filter((arc) => (arc.characterId as string) === (characterId as string))
    : file.characterArcs;

  for (const arc of arcsToCheck) {
    const points = file.arcPoints.filter((point) => (point.arcId as string) === (arc.id as string));
    const refuses = points.filter(
      (point) => point.kind === 'refusal' || point.kind === 'doubling_down',
    );
    if (refuses.length > 0 && !wasOffered(points)) {
      notes.push({
        kind: 'refusal_never_offered',
        characterId: arc.characterId,
        text: `${nameOf(arc.characterId)} refuses a change their arc never offers.`,
      });
    }
  }

  return { inOrder: rows, notes };
};

// --------------------------------------------------- what the script says

/**
 * A character's presence in the manuscript (stage 13).
 *
 * The review, like the map before it, only ever showed what somebody had
 * written down — so on a finished screenplay with no Creator records it said
 * *nothing matches that*, which was true and useless. The manuscript can
 * already answer a real question: **where is this person, across the story.**
 *
 * Every number here is countable and none of them is an opinion. How many
 * scenes, how many speeches, where they come in, where they go out, and the
 * longest stretch in between. Whether any of that is a problem is the writer's
 * to decide, which is why this reads as a report and never as a warning.
 */
export interface SceneAppearance {
  // Named apart from `editor-final.ts`'s Appearance, which is about how a line
  // looks on the page rather than who is in a scene.
  unitId: StructuralUnitId;
  unitTitle: string;
  /** Where in the story, counting scenes from zero. */
  where: number;
  /** How many times they speak in it. */
  speeches: number;
}

export interface PresenceRow {
  characterId: CharacterId;
  characterName: string;
  appearances: SceneAppearance[];
  scenes: number;
  speeches: number;
  /**
   * The longest run of scenes they are absent from **between** two appearances.
   *
   * Before the first and after the last are not gaps — they are when the
   * character arrives and when they leave, which is not the same fact at all.
   */
  gap: { after: SceneAppearance; before: SceneAppearance; scenes: number } | null;
}

/**
 * Who is in the script, where, read off the cues.
 *
 * Honours the review's own filters where they mean something here: a person, a
 * plot track, a scene, and the search — matched against the name, since a name
 * is all a presence row has to search.
 */
export const scriptPresence = (file: ProjectFile, filter: WorkFilter = {}): PresenceRow[] => {
  const units = [...file.units].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  const place = new Map(units.map((unit, index) => [unit.id as string, index] as const));
  const titleOf = (unitId: string) => {
    const unit = units.find((one) => (one.id as string) === unitId);
    return unit ? `${unit.sequenceLabel} ${unit.title}`.trim() || 'Untitled scene' : 'Untitled scene';
  };

  const wanted = (unitId: string): boolean => {
    const unit = units.find((one) => (one.id as string) === unitId);
    if (!unit) return false;
    if (filter.unitId && (unit.id as string) !== (filter.unitId as string)) return false;
    if (filter.trackId && (unit.trackId as string) !== (filter.trackId as string)) return false;
    return true;
  };

  /** characterId -> unitId -> speeches */
  const tally = new Map<string, Map<string, number>>();
  for (const beat of file.beats) {
    const unitId = beat.unitId as string;
    if (!wanted(unitId)) continue;
    for (const element of beat.manuscript.elements) {
      if (element.type !== 'character') continue;
      for (const person of charactersCalled(file, element.text)) {
        if (person.archived) continue;
        const key = person.id as string;
        if (!tally.has(key)) tally.set(key, new Map());
        const scenes = tally.get(key)!;
        scenes.set(unitId, (scenes.get(unitId) ?? 0) + 1);
      }
    }
  }

  const needle = (filter.query ?? '').trim().toLowerCase();

  return file.characters
    .filter((person) => !person.archived && tally.has(person.id as string))
    .filter((person) => !filter.characterId || (person.id as string) === (filter.characterId as string))
    .filter((person) => needle.length === 0 || person.name.toLowerCase().includes(needle))
    .map((person) => {
      const appearances: SceneAppearance[] = [...tally.get(person.id as string)!.entries()]
        .map(([unitId, speeches]) => ({
          unitId: unitId as StructuralUnitId,
          unitTitle: titleOf(unitId),
          where: place.get(unitId) ?? 0,
          speeches,
        }))
        .sort((a, b) => a.where - b.where);

      let gap: PresenceRow['gap'] = null;
      for (let i = 1; i < appearances.length; i += 1) {
        const between = appearances[i]!.where - appearances[i - 1]!.where - 1;
        if (between > (gap?.scenes ?? 0)) {
          gap = { after: appearances[i - 1]!, before: appearances[i]!, scenes: between };
        }
      }

      return {
        characterId: person.id,
        characterName: person.name,
        appearances,
        scenes: appearances.length,
        speeches: appearances.reduce((total, one) => total + one.speeches, 0),
        gap,
      };
    })
    .sort((a, b) => b.speeches - a.speeches || a.characterName.localeCompare(b.characterName));
};

/**
 * A cue in the manuscript that matches nobody in the cast (stage 13).
 *
 * Checkable, and usually one of two things: a character who was typed straight
 * into the script and never filed, or a typo in a name. Both are worth seeing
 * and neither is a judgement, so it is a row in a report rather than a warning
 * on the page.
 */
export interface UnknownCue {
  /** The cue as the manuscript has it, extensions stripped. */
  cue: string;
  speeches: number;
  /** Where they first speak, so the writer can go and look. */
  firstUnitTitle: string;
  firstWhere: number;
}

export const cuesWithoutCharacter = (file: ProjectFile): UnknownCue[] => {
  const units = [...file.units].sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1));
  const place = new Map(units.map((unit, index) => [unit.id as string, index] as const));

  const found = new Map<string, UnknownCue>();
  for (const beat of file.beats) {
    const where = place.get(beat.unitId as string);
    if (where === undefined) continue;
    const unit = units[where]!;
    for (const element of beat.manuscript.elements) {
      if (element.type !== 'character') continue;
      if (charactersCalled(file, element.text).length > 0) continue;
      // The same normalising the cast list does, so MAEVE and MAEVE (V.O.) are
      // one unknown person rather than two.
      const cue = element.text.replace(/\s*\((?:[^)]*)\)\s*$/, '').replace(/\s*\^\s*$/, '').trim();
      if (cue.length === 0) continue;
      const already = found.get(cue.toUpperCase());
      if (already) already.speeches += 1;
      else
        found.set(cue.toUpperCase(), {
          cue,
          speeches: 1,
          firstUnitTitle: `${unit.sequenceLabel} ${unit.title}`.trim() || 'Untitled scene',
          firstWhere: where,
        });
    }
  }

  return [...found.values()].sort((a, b) => a.firstWhere - b.firstWhere);
};

/**
 * Somebody in the cast who never speaks (stage 13).
 *
 * Not a fault — a background character with no lines is a perfectly ordinary
 * thing, and so is somebody written down before they have been written in. It
 * is here because the presence report would otherwise silently omit them, and a
 * report that leaves people out without saying so is a report you cannot trust.
 */
export const castNeverSpoken = (file: ProjectFile): CharacterId[] => {
  const speaks = new Set(scriptPresence(file).map((row) => row.characterId as string));
  return file.characters
    .filter((person) => !person.archived && !speaks.has(person.id as string))
    .map((person) => person.id);
};

/** How a review row reads on one line, wherever it is listed. */
export const describeRow = (row: ReviewRow): string =>
  row.work.kind === 'arc_point'
    ? `${ARC_POINT_NAMES[row.work.pointKind ?? 'movement']}: ${row.work.text}`
    : describeWork(row.work);

/** A count of the arc points of each kind, for the filter to say what exists. */
export const arcKindsPresent = (file: ProjectFile): ArcPointKind[] =>
  [...new Set(file.arcPoints.map((point: ArcPoint) => point.kind))].sort();
