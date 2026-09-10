import { avSheet, isSpoken } from './av-sheet.js';
import { beatsForUnit } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, CharacterId, StructuralUnitId } from './ids.js';
import type { VoiceAssignment } from './entities/project.js';
import type { Asset } from './entities/asset.js';

/**
 * Playing the board (addendum 05 §5).
 *
 * An animatic made of what is already in the document: the frames advance at
 * their own durations and the audio is read aloud in the voices already
 * assigned (spec §10). Nothing is rendered to a file — this is a way of
 * hearing whether a thirty is a thirty, which is the question the format
 * exists to ask.
 *
 * **The board has a clock and the sheet does not.** A sheet is a column of
 * durations; a playback is those durations laid end to end, so that at any
 * second there is exactly one shot on screen and at most one line being read.
 * That is the whole of what this module works out, and it works it out from
 * the sheet rather than from the manuscript — the sheet is already the
 * arithmetic of head, line, tail and clip (§4, §4b).
 */

/** A line of a shot's audio, as the player says it. */
export interface BoardLine {
  /** Said aloud with the quotation marks taken off, which is how it is read. */
  text: string;
  /** Whether the line is spoken by somebody rather than narrated (§3b). */
  spoken: boolean;
  characterId: CharacterId | null;
  /** Who says it, for the line the player shows while it is saying it. */
  speaker: string | null;
  /** The character's voice, the narrator's, or none — the platform default. */
  voice: VoiceAssignment | null;
}

export interface BoardShot {
  beatId: BeatId;
  unitId: StructuralUnitId;
  /** "1.1", "2.3", as the sheet numbers it. */
  number: string;
  /** The segment it belongs to, so the player can say where it is. */
  segment: string;
  /** Where the shot starts on the board's clock, in seconds. */
  at: number;
  /** How long it holds: the sound or the picture, whichever is longer (§4b). */
  seconds: number;
  /** When the reading starts — after the header's action, not before it. */
  saidAt: number;
  head: number;
  dialogue: number;
  tail: number;
  video: number;
  lines: BoardLine[];
  /** What is on screen while it runs. Null holds the last frame there was. */
  frame: Asset | null;
  moving: boolean;
}

export interface BoardPlayback {
  shots: BoardShot[];
  /** The whole board, which is the sheet's own total. */
  seconds: number;
  /** Characters heard here that have no voice yet, read by the narrator. */
  unassigned: string[];
}

/**
 * The board laid end to end, ready to play.
 *
 * Read off the sheet, so the times here and the times on the sheet cannot
 * disagree: they are the same numbers, with a running start added to each.
 */
export const boardPlayback = (file: ProjectFile): BoardPlayback => {
  const sheet = avSheet(file);
  const nameFor = (characterId: CharacterId | null): string | null =>
    characterId ? file.characters.find((character) => character.id === characterId)?.name ?? null : null;
  const voiceFor = (characterId: CharacterId | null): VoiceAssignment | null =>
    characterId ? file.characters.find((character) => character.id === characterId)?.voice ?? null : null;

  const narrator = file.settings.narratorVoice ?? null;
  const unassigned = new Set<string>();
  const shots: BoardShot[] = [];
  let at = 0;

  for (const segment of sheet.segments) {
    const beats = beatsForUnit(file, segment.unitId).filter((beat) => beat.inScript);

    for (const row of segment.rows) {
      const beat = beats.find((candidate) => candidate.id === row.beatId);
      const elements = beat?.manuscript.elements ?? [];

      /**
       * A character cue names the speaker for what follows it, exactly as it
       * does anywhere else in the document — so a row written in the beat
       * window and then tidied on the sheet is still read by the right voice.
       */
      let pending: CharacterId | null = null;
      const lines: BoardLine[] = [];

      for (const element of elements) {
        const text = element.text.trim();
        if (text.length === 0) continue;
        if (element.type === 'character') {
          pending = element.characterId ?? null;
          continue;
        }

        const spoken = isSpoken(text) || element.type === 'dialogue';
        const characterId = spoken ? (element.characterId ?? pending) : null;
        const speaker = nameFor(characterId);
        // A commercial is mostly narration, so a line with nobody attached to
        // it is the narrator's rather than silence.
        const voice = voiceFor(characterId) ?? narrator;
        if (spoken && speaker && !voiceFor(characterId)) unassigned.add(speaker);

        lines.push({
          text: spoken ? text.replace(/^"+|"+$/g, '').trim() : text,
          spoken,
          characterId,
          speaker,
          voice,
        });
      }

      shots.push({
        beatId: row.beatId,
        unitId: segment.unitId,
        number: row.number,
        segment: segment.name || `Segment ${segment.position}`,
        at,
        seconds: row.seconds,
        saidAt: at + row.head,
        head: row.head,
        dialogue: row.dialogue,
        tail: row.tail,
        video: row.video,
        lines,
        frame: row.frame,
        moving: row.moving,
      });
      at += row.seconds;
    }
  }

  return { shots, seconds: at, unassigned: [...unassigned] };
};

/**
 * The shot on screen at a given second.
 *
 * A shot holds from where it starts until the next one begins, so the last
 * frame stays up for its own tail rather than cutting to nothing. Past the end
 * of the board there is no shot, which is what stops playback.
 */
export const shotAt = (playback: BoardPlayback, seconds: number): BoardShot | null => {
  if (seconds < 0) return null;
  for (const shot of playback.shots) {
    if (seconds < shot.at + shot.seconds) return shot;
  }
  // A board of nothing but untimed shots has no length; hold the first one.
  return seconds === 0 ? playback.shots[0] ?? null : null;
};

/**
 * Where a shot starts, for clicking one on the sheet and playing from there.
 */
export const shotStart = (playback: BoardPlayback, beatId: BeatId): number =>
  playback.shots.find((shot) => shot.beatId === beatId)?.at ?? 0;
