import { castColours } from './story-threads.js';
import { nounsFor } from './formats.js';
import { placedMarkerForUnit } from './markers.js';
import {
  arcBoard,
  characterBoard,
  peopleSpeakingIn,
  relationshipsOf,
  unfiledItems,
  type CharacterizationRow,
  type UsageColour,
} from './character-creator.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * The two readings on the Overview (addendum 25 §3, the handoff's *At a
 * glance* and *Up next*).
 *
 * **Both are read every time and neither stores a thing.** That is addendum
 * 08 §2 arriving on a summary: a bar that was written down would go on saying
 * *7 used* after the scene was cut, and a to-do list that was written down
 * would go on asking for something already done. Doing the work is what makes
 * the line go, with nothing run.
 */

// --------------------------------------------------------------- at a glance

export interface Glance {
  /** Ways to show them: in the writing, and still waiting for a scene. */
  moments: { used: number; onDeck: number; setAside: number };
  /**
   * The arc as a line: every point in story order, green where it is in the
   * writing and red where it is not, so the card can draw the shape of the
   * work rather than a number.
   */
  arc: { placed: number; total: number; dots: UsageColour[] };
  /** Everybody this person is joined to, once each, in the cast's own colours. */
  people: { id: string; name: string; colour: string }[];
}

export const characterGlance = (input: { characterId: string; file: ProjectFile }): Glance => {
  const { characterId, file } = input;
  const board = characterBoard({ characterId, file });
  const arc = arcBoard({ characterId, file });
  const { outward, inward } = relationshipsOf({ characterId, file });
  const colours = castColours(file);

  // Once each: a pair with a reading in both directions is one person.
  const seen = new Map<string, { id: string; name: string; colour: string }>();
  for (const row of [...outward, ...inward]) {
    const id = row.otherId as string;
    if (seen.has(id)) continue;
    seen.set(id, {
      id,
      name: row.otherName,
      colour: colours.get(row.otherName.trim().toUpperCase()) ?? '#8a8371',
    });
  }

  return {
    moments: { used: board.counts.shown, onDeck: board.counts.onDeck, setAside: board.counts.setAside },
    arc: {
      placed: arc.placed.length,
      total: arc.placed.length + arc.onDeck.length,
      // The placed ones first, in the story's order, then what is waiting —
      // which is `arcBoard`'s own split (addendum 08 §5) and the only honest
      // order for a line that claims to show a journey.
      dots: [...arc.placed.map((row) => row.colour), ...arc.onDeck.map((row) => row.colour)],
    },
    people: [...seen.values()],
  };
};

// ------------------------------------------------------------------ up next

/** Which tab a step wants, and what it wants opened there. */
export type NextWhere =
  | { tab: 'traits'; traitId: string | null }
  | { tab: 'arc' }
  | { tab: 'relationships' };

export interface NextStep {
  /** For a key, and so a test can name a step without matching its sentence. */
  kind: 'on_deck' | 'unfiled' | 'arc_on_deck' | 'unanswered';
  /** What is true, said as a fact rather than as a fault. */
  text: string;
  /** What a press would do. */
  act: string;
  where: NextWhere;
  /**
   * Whether the mark is a **red ring** — something planned and not yet in the
   * writing — or the hollow one, which is a blank the writer may simply not
   * have got to. The distinction is the module's own: red means *made and
   * waiting*, and an empty field was never made.
   */
  waiting: boolean;
}

/** How many lines the card shows before it says how many more there are. */
export const UP_NEXT_LIMIT = 3;

/**
 * What there is to do next, in plain words (§3).
 *
 * **It offers and never warns** (addendum 08 §7). Every line is a fact plus a
 * way to act on it — *3 ways to show "Miserly" are still on deck · Place one*
 * — because a character with things on deck is in the middle of the work
 * rather than behind on it, and a module that said so in red would be telling
 * a writer off for planning ahead.
 *
 * The order is the work's: the ways to show them, then the arc, then the
 * people. Retired items are not here at all (§17).
 */
export const upNext = (input: { characterId: string; file: ProjectFile }): NextStep[] => {
  const { characterId, file } = input;
  const board = characterBoard({ characterId, file });
  const steps: NextStep[] = [];

  // The trait with the most waiting, named — a line that says *5 moments are
  // on deck* over four traits tells a writer nothing about where to go.
  const byTrait = board.traits
    .map((entry) => ({ entry, waiting: entry.items.filter((row) => row.colour === 'red') }))
    .filter((one) => one.waiting.length > 0)
    .sort((a, b) => b.waiting.length - a.waiting.length);
  for (const { entry, waiting } of byTrait) {
    steps.push({
      kind: 'on_deck',
      text:
        waiting.length === 1
          ? `One way to show “${entry.trait.name}” is still on deck.`
          : `${waiting.length} ways to show “${entry.trait.name}” are still on deck.`,
      act: 'Place one',
      where: { tab: 'traits', traitId: entry.trait.id as string },
      waiting: true,
    });
  }

  // Something captured from the script and not filed yet. It is **not** an
  // error — addendum 08 §8 makes the trait optional on purpose, so somebody
  // can notice a thing before deciding what it shows.
  const unfiled = unfiledItems({ characterId, items: file.characterizationItems }).filter(
    (item) => !item.retired,
  );
  if (unfiled.length > 0) {
    steps.push({
      kind: 'unfiled',
      text:
        unfiled.length === 1
          ? 'One moment is not under a trait yet.'
          : `${unfiled.length} moments are not under a trait yet.`,
      act: 'File them',
      where: { tab: 'traits', traitId: null },
      waiting: false,
    });
  }

  const arc = arcBoard({ characterId, file });
  for (const row of arc.onDeck) {
    if (row.point.retired) continue;
    steps.push({
      kind: 'arc_on_deck',
      text: `Arc point “${row.point.text}” has no scene yet.`,
      act: 'Open the arc',
      where: { tab: 'arc' },
      waiting: true,
    });
  }

  // A reading somebody made about this person that has not been returned.
  // **An offer and never a warning** (addendum 08 §7): plenty of
  // relationships are only worth writing down from one side.
  const { outward, inward } = relationshipsOf({ characterId, file });
  for (const row of [...outward, ...inward]) {
    if (row.relationship.state.trim().length > 0) continue;
    const towards = outward.includes(row);
    steps.push({
      kind: 'unanswered',
      text: towards
        ? `Where it stands with ${row.otherName} is not set yet.`
        : `${row.otherName} → them has no current state.`,
      act: 'Fill it in',
      where: { tab: 'relationships' },
      waiting: false,
    });
  }

  return steps;
};

/**
 * What the card says when there is nothing on it.
 *
 * Said out loud rather than left blank: an empty box looks broken, which is
 * the lesson the narrative validator's *nothing to report* came from.
 */
export const describeUpNext = (steps: readonly NextStep[]): string =>
  steps.length === 0
    ? 'Nothing waiting. Everything planned for them is in the writing.'
    : steps.length <= UP_NEXT_LIMIT
      ? ''
      : `${steps.length - UP_NEXT_LIMIT} more.`;

/** A count for the header's pills: the two the handoff puts beside the name. */
export const glancePills = (glance: Glance): { used: string; onDeck: string; arc: string | null } => ({
  used: `${glance.moments.used} used`,
  onDeck: `${glance.moments.onDeck} on deck`,
  // Absent where there is no arc: a pill reading *0 / 0 placed* says nothing,
  // and most characters in most scripts have no arc (addendum 08 §9).
  arc: glance.arc.total === 0 ? null : `Arc ${glance.arc.placed} / ${glance.arc.total} placed`,
});

export type { CharacterizationRow };

// ------------------------------------------------------------- the story panel

/**
 * One scene, as a place to put something (addendum 25 §3, the handoff's
 * *Story* panel).
 */
export interface StoryRow {
  unitId: StructuralUnitId;
  /** What the panel calls it — the division it opens, then the scene's name. */
  label: string;
  /** The division it falls under, where there is one: *Ch 1*, *Episode 2*. */
  division: string;
  /**
   * They are **in** it: somebody speaks their cue there. Bright on the panel;
   * everything else is dimmed and says *not in scene*.
   *
   * Read from the manuscript every time (addendum 08 §2), so writing a cue
   * lights the row with nothing run — and it is `castCalled`'s rule, so
   * MARABEL's lines are not MARA's.
   */
  appears: boolean;
  /**
   * Where a drop lands: the scene's **first beat**, because a scene is what a
   * writer points at and a beat is where the link lives. Null where the scene
   * has no beats at all, and such a row takes no drop — a link with nowhere to
   * anchor is a link that would be broken the moment it was made.
   */
  beatId: BeatId | null;
  /** How much of this person's work is already pinned in it. */
  pinned: number;
}

/**
 * The scenes, in story order, as somewhere to put a moment (§3).
 *
 * **Nothing about it is stored.** Which scenes somebody is in is read off the
 * cues, so the panel re-lights itself as the writing changes; what is pinned
 * where is read off the usage links, for the same reason the colours are.
 */
export const storyPanel = (input: { characterId: string; file: ProjectFile }): StoryRow[] => {
  const { characterId, file } = input;
  const nouns = nounsFor(file.project.format);
  const beatsOf = new Map<string, ProjectFile['beats']>();
  for (const beat of file.beats) {
    const held = beatsOf.get(beat.unitId as string) ?? [];
    held.push(beat);
    beatsOf.set(beat.unitId as string, held);
  }

  /**
   * **The division a scene falls under, not only the one that carries its
   * marker** (addendum 25 §3). A marker sits on the scene a chapter opens on,
   * so reading it per unit labelled the first scene *Ch 1* and left every
   * other scene in that chapter blank — which is exactly the question the
   * column is there to answer. It is `divisionSpan`'s rule pointed at a list:
   * the nearest marker at or before this scene.
   */
  let division = '';
  return [...file.units]
    .sort((a, b) => (a.orderKey < b.orderKey ? -1 : 1))
    .map((unit) => {
      const beats = (beatsOf.get(unit.id as string) ?? []).sort((a, b) =>
        a.orderKey < b.orderKey ? -1 : 1,
      );
      const appears = beats.some((beat) =>
        peopleSpeakingIn(file, beat).some((one) => (one as unknown as string) === characterId),
      );
      const ids = new Set(beats.map((beat) => beat.id as string));
      const pinned = file.usageLinks.filter((link) => {
        if (!ids.has(link.beatId as string)) return false;
        if (link.ownerKind === 'characterization') {
          return file.characterizationItems.some(
            (item) =>
              (item.id as string) === link.ownerId && (item.characterId as string) === characterId,
          );
        }
        if (link.ownerKind === 'arc_point') {
          return file.arcPoints.some(
            (point) =>
              (point.id as string) === link.ownerId && (point.characterId as string) === characterId,
          );
        }
        return false;
      }).length;

      const placed = placedMarkerForUnit(file, unit.id as string);
      if (placed) division = placed.label;
      return {
        unitId: unit.id,
        label: unit.title.trim() || `Untitled ${nouns.unit.toLowerCase()}`,
        division: division || unit.sequenceLabel.trim(),
        appears,
        beatId: beats[0]?.id ?? null,
        pinned,
      };
    });
};

/** What the panel says under its heading, in the format's own nouns. */
export const describeStoryPanel = (file: ProjectFile, name: string): string =>
  `Drag something on deck onto a ${nounsFor(file.project.format).unit.toLowerCase()} to use it. ` +
  `${name.trim() || 'They'} is in the bright ones.`;
