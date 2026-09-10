import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { countWords } from './entities/manuscript.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, StructuralUnitId } from './ids.js';

/**
 * The AV sheet (addendum 05).
 *
 * What a commercial is written on: what is heard on the left, what is seen on
 * the right, in numbered rows, with a frame beside each and a running time
 * against it. In a short-form project this **replaces** the Script — it is
 * not a second view of the same pages, it is the document.
 *
 * **Nothing new is invented underneath.** A segment is a scene, a row is a
 * beat, and the numbering is the story order counted. That is what makes
 * "write it in the sheet and it is on the timeline" cost nothing to be true:
 * they are the same objects in the same order, drawn twice.
 *
 * Everything here is read off the file. The sheet holds no state of its own.
 */

/** A running time as a sheet writes it: 00:00, and 1:02:03 when it has to. */
export const formatRt = (seconds: number): string => {
  const whole = Math.max(0, Math.round(seconds));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(whole % 60)}`
    : `${pad(minutes)}:${pad(whole % 60)}`;
};

/**
 * How fast a line is read aloud, in words a second.
 *
 * The industry's own rule of thumb for a voiceover, and used here for one
 * thing only: to say whether a row's words will fit the time it has been
 * given. It never sets the time (§4).
 */
export const WORDS_PER_SECOND = 2.5;

export interface AvRow {
  beatId: BeatId;
  unitId: StructuralUnitId;
  /** "1.1", "2.3" — the segment and the row within it. */
  number: string;
  /** What is heard: the beat's manuscript, as plain lines. */
  audio: string;
  /** What is seen: the beat's own second text. */
  visual: string;
  /** Counted from the audio, which is the only thing that is spoken. */
  words: number;
  seconds: number;
  /**
   * Whether the words can be read in the time the row has. Null where the row
   * has no time yet, because nothing has been claimed to be wrong.
   */
  fits: boolean | null;
}

export interface AvSegment {
  unitId: StructuralUnitId;
  /** 1-based, in the story order. */
  position: number;
  /** The scene's title, set in capitals above its rows. */
  name: string;
  /** The scene's summary: the italic line that says what the segment is for. */
  line: string;
  rows: AvRow[];
  words: number;
  seconds: number;
  /** The totals to the end of this segment, for the foot of it. */
  totalWords: number;
  totalSeconds: number;
}

export interface AvSheet {
  /**
   * The masthead. **Not typed on the sheet**: the title page carries it, and
   * a title typed in two places is a title that disagrees with itself (§2).
   */
  title: string;
  /** "v1", or whatever the title page calls this draft. */
  version: string;
  segments: AvSegment[];
  words: number;
  seconds: number;
}

/** The beat's manuscript as the sheet shows it: its lines, one under another. */
const audioOf = (elements: readonly { text: string }[]): string =>
  elements
    .map((element) => element.text.trim())
    .filter((text) => text.length > 0)
    .join('\n');

/**
 * What the masthead says this draft is.
 *
 * The title page's revision where it has one, and `v1` where it does not — a
 * board that has not been versioned is the first one.
 */
const versionOf = (file: ProjectFile): string => {
  const revision = file.settings.titlePage?.revision?.trim() ?? '';
  return revision.length > 0 ? revision : 'v1';
};

export const avSheet = (file: ProjectFile): AvSheet => {
  const units = unitsInStoryOrder(file).filter((unit) => unit.inScript);

  let words = 0;
  let seconds = 0;

  const segments: AvSegment[] = units.map((unit, index) => {
    const position = index + 1;
    const beats = beatsForUnit(file, unit.id).filter((beat) => beat.inScript);

    const rows: AvRow[] = beats.map((beat, row) => {
      const rowWords = countWords(beat.manuscript);
      const rowSeconds = beat.seconds ?? 0;
      return {
        beatId: beat.id,
        unitId: unit.id,
        number: `${position}.${row + 1}`,
        audio: audioOf(beat.manuscript.elements),
        visual: beat.visual ?? '',
        words: rowWords,
        seconds: rowSeconds,
        // A row with no time yet is not a row with a problem.
        fits: rowSeconds === 0 ? null : rowWords <= rowSeconds * WORDS_PER_SECOND,
      };
    });

    const segmentWords = rows.reduce((total, entry) => total + entry.words, 0);
    const segmentSeconds = rows.reduce((total, entry) => total + entry.seconds, 0);
    words += segmentWords;
    seconds += segmentSeconds;

    return {
      unitId: unit.id,
      position,
      name: unit.title,
      line: unit.summary,
      rows,
      words: segmentWords,
      seconds: segmentSeconds,
      totalWords: words,
      totalSeconds: seconds,
    };
  });

  return {
    title: file.settings.titlePage?.title?.trim() || file.project.title,
    version: versionOf(file),
    segments,
    words,
    seconds,
  };
};
