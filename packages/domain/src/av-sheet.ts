import { beatsForUnit, unitsInStoryOrder } from './selectors.js';
import { countWords } from './entities/manuscript.js';
import { addBeat, moveBeat, updateBeat } from './mutations.js';
import { newId } from './ids.js';
import { assetSchema } from './entities/asset.js';
import { nowIso } from './entities/common.js';
import type { ProjectFile } from './project-file.js';
import type { AssetId, BeatId, ManuscriptElementId, StructuralUnitId } from './ids.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import type { Asset } from './entities/asset.js';

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

/**
 * How long a line takes to say, from the words in it.
 *
 * The one figure in the sheet that is estimated rather than typed: how long a
 * read takes really is what the words determine, and asking a writer to time
 * every line by hand when the answer is arithmetic is asking for nothing. The
 * writer can still overrule it, and then their number is the one that counts.
 */
export const readSeconds = (words: number): number => Math.ceil(Math.max(0, words) / WORDS_PER_SECOND);

export interface AvRow {
  beatId: BeatId;
  unitId: StructuralUnitId;
  /** "1.1", "2.3" — the segment and the shot within it. */
  number: string;
  /** What is heard: the beat's manuscript, as plain lines. */
  audio: string;
  /** What is seen: the beat's own second text. */
  visual: string;
  /** Counted from the audio, which is the only thing that is spoken. */
  words: number;
  /** The whole shot: what happens before the line, the line, and after it. */
  seconds: number;
  /** Action before the dialogue begins. The writer's. */
  head: number;
  /** How long the line itself takes. */
  dialogue: number;
  /** Action after the dialogue ends. The writer's. */
  tail: number;
  /**
   * Whether the dialogue's time is the words' own estimate rather than a
   * number the writer typed. A shot nobody has argued with reads as estimated.
   */
  estimated: boolean;
  /**
   * Whether the words can be read in the time the writer gave the dialogue.
   * Null where the time is the words' own estimate, which by definition fits.
   */
  fits: boolean | null;
  /** The storyboard frame beside the row, resolved. Null where there is none. */
  frame: Asset | null;
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
  const frames = new Map((file.assets ?? []).map((asset) => [asset.id as string, asset]));

  let words = 0;
  let seconds = 0;

  const segments: AvSegment[] = units.map((unit, index) => {
    const position = index + 1;
    const beats = beatsForUnit(file, unit.id).filter((beat) => beat.inScript);

    const rows: AvRow[] = beats.map((beat, row) => {
      const rowWords = countWords(beat.manuscript);
      const head = beat.headSeconds ?? 0;
      const tail = beat.tailSeconds ?? 0;
      const said = beat.seconds ?? 0;
      const estimated = said === 0;
      const dialogue = estimated ? readSeconds(rowWords) : said;
      return {
        beatId: beat.id,
        unitId: unit.id,
        number: `${position}.${row + 1}`,
        audio: audioOf(beat.manuscript.elements),
        visual: beat.visual ?? '',
        words: rowWords,
        seconds: head + dialogue + tail,
        head,
        dialogue,
        tail,
        estimated,
        // The words' own estimate always fits; a number the writer typed
        // under it is the thing worth saying out loud.
        fits: estimated ? null : rowWords <= said * WORDS_PER_SECOND,
        // A frame whose picture has gone reads as no frame rather than a gap.
        frame: beat.imageAssetId ? (frames.get(beat.imageAssetId as string) ?? null) : null,
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


// ------------------------------------------------------------------ writing

/**
 * A running time as a writer types one.
 *
 * `4`, `04`, `0:04`, `00:04` and `1:02` all mean what they look like, because
 * a writer filling in a column of times should not have to think about which
 * of those the box wants. Anything that is not a time at all leaves the value
 * where it was, which is null here for the caller to ignore.
 */
export const parseRt = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  if (!/^\d{1,2}(:\d{1,2}){0,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(':').map((part) => Number.parseInt(part, 10));
  return parts.reduce((total, part) => total * 60 + part, 0);
};

/**
 * A line of the audio column, marked as spoken (addendum 05 §3b).
 *
 * Narration and dialogue are different things in a commercial, and a board
 * says which is which with quotation marks. Tab puts them on the line you are
 * on; Tab again takes them off, because the same key that made it dialogue is
 * the key that changes its mind.
 */
export const toggleSpoken = (line: string): string => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return '""';
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 1) {
    // Every quotation mark at either end, so a line that somehow got two
    // pairs comes back clean rather than one pair at a time.
    return trimmed.replace(/^"+|"+$/g, '').trim();
  }
  return `"${trimmed.replace(/^"+|"+$/g, '').trim()}"`;
};

/** Whether a line of the audio column is spoken rather than narrated. */
export const isSpoken = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.length > 1 && trimmed.startsWith('"') && trimmed.endsWith('"');
};

/**
 * What is heard in a row, written in place.
 *
 * The audio column is plain lines, so this keeps them as plain lines: one
 * line, one element. Elements already there keep their id and their type, so
 * a speech typed in the beat window and then tidied on the sheet does not
 * lose what it was; new lines arrive as dialogue, because in a commercial
 * what is in the audio column is what somebody says.
 *
 * A row's audio opens in the beat window like anything else (§7). This is the
 * quick pass over a board, not a second writing screen.
 */
export const setRowAudio = (file: ProjectFile, beatId: BeatId, text: string): ProjectFile => {
  const beat = file.beats.find((candidate) => candidate.id === beatId);
  if (!beat) return file;

  const lines = text.split('\n');
  const existing = beat.manuscript.elements;
  const elements: ManuscriptElement[] = lines.map((line, index) => {
    const was = existing[index];
    if (was) return { ...was, text: line };
    return {
      id: newId<ManuscriptElementId>(),
      type: 'dialogue',
      text: line,
      characterId: null,
      attributes: {},
    };
  });

  // A row emptied altogether keeps one line to type into rather than none.
  return updateBeat(file, beatId, {
    manuscript: { elements: elements.length > 0 ? elements : [] },
  });
};

/** What is seen in a row. */
export const setRowVisual = (file: ProjectFile, beatId: BeatId, visual: string): ProjectFile =>
  updateBeat(file, beatId, { visual });



/**
 * A new row under the one given, or at the end of the segment.
 *
 * It goes into the story order in the place it appears in, which is the
 * whole point: the timeline has it the moment the sheet does.
 */
export const addRow = (
  file: ProjectFile,
  input: { unitId: StructuralUnitId; afterBeatId?: BeatId },
): { file: ProjectFile; beatId: BeatId } => {
  const siblings = beatsForUnit(file, input.unitId);
  const at = input.afterBeatId
    ? siblings.findIndex((beat) => beat.id === input.afterBeatId) + 1
    : siblings.length;
  const made = addBeat(file, { unitId: input.unitId, index: at < 1 ? siblings.length : at });
  return { file: made.file, beatId: made.beat.id };
};

/**
 * A row moved one place up or down the board.
 *
 * It crosses into the segment above or below when it runs off the end of its
 * own, because that is what dragging a row up past a segment head means. The
 * story order moves with it — there is no second order to keep in step.
 */
export const moveRow = (file: ProjectFile, beatId: BeatId, direction: -1 | 1): ProjectFile => {
  const units = unitsInStoryOrder(file).filter((unit) => unit.inScript);
  const unitIndex = units.findIndex((unit) => beatsForUnit(file, unit.id).some((beat) => beat.id === beatId));
  if (unitIndex === -1) return file;

  const unit = units[unitIndex] as (typeof units)[number];
  const siblings = beatsForUnit(file, unit.id);
  const at = siblings.findIndex((beat) => beat.id === beatId);
  const to = at + direction;

  if (to >= 0 && to < siblings.length) {
    return moveBeat(file, { beatId, toUnitId: unit.id, index: to });
  }

  // Off the end of this segment: into the next one along, if there is one.
  const neighbour = units[unitIndex + direction];
  if (!neighbour) return file;
  const into = beatsForUnit(file, neighbour.id);
  return moveBeat(file, {
    beatId,
    toUnitId: neighbour.id,
    index: direction === 1 ? 0 : into.length,
  });
};


/**
 * Put a picture in the document and hang it beside a row (§3c).
 *
 * The picture is stored once, in the file, and the row holds a reference to
 * it — a frame used on two rows is one picture. It arrives already scaled and
 * encoded: what a storyboard needs is a legible frame, not the original from
 * somebody's camera, and the file has to stay a file somebody can send.
 */
export const setRowFrame = (
  file: ProjectFile,
  beatId: BeatId,
  frame: { name?: string; data: string; width?: number; height?: number },
): { file: ProjectFile; assetId: AssetId } => {
  const asset = assetSchema.parse({
    id: newId<AssetId>(),
    projectId: file.project.id,
    kind: 'image',
    name: frame.name ?? '',
    data: frame.data,
    width: frame.width ?? 0,
    height: frame.height ?? 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  const withAsset: ProjectFile = { ...file, assets: [...(file.assets ?? []), asset] };
  return { file: pruneFrames(updateBeat(withAsset, beatId, { imageAssetId: asset.id })), assetId: asset.id };
};

/** Take the frame off a row. The picture goes with it if nothing else wants it. */
export const clearRowFrame = (file: ProjectFile, beatId: BeatId): ProjectFile =>
  pruneFrames(updateBeat(file, beatId, { imageAssetId: null }));

/**
 * Drop the pictures nothing points at any more.
 *
 * A frame replaced or removed would otherwise sit in the file for good, and a
 * board reworked a dozen times would carry every version of every frame with
 * it. A picture two rows share is kept while either of them wants it.
 */
export const pruneFrames = (file: ProjectFile): ProjectFile => {
  const wanted = new Set(
    file.beats.map((beat) => beat.imageAssetId as string | null).filter((id): id is string => id !== null),
  );
  const kept = (file.assets ?? []).filter((asset) => wanted.has(asset.id as string));
  if (kept.length === (file.assets ?? []).length) return file;
  return { ...file, assets: kept };
};


/** The action before the line starts. The writer's, in whole seconds. */
export const setRowHead = (file: ProjectFile, beatId: BeatId, seconds: number): ProjectFile =>
  updateBeat(file, beatId, { headSeconds: Math.max(0, Math.round(seconds)) });

/** The action after the line ends. */
export const setRowTail = (file: ProjectFile, beatId: BeatId, seconds: number): ProjectFile =>
  updateBeat(file, beatId, { tailSeconds: Math.max(0, Math.round(seconds)) });

/**
 * How long the line itself takes. Zero hands it back to the words, which is
 * how it starts and where it goes when the writer clears the box.
 */
export const setRowDialogue = (file: ProjectFile, beatId: BeatId, seconds: number): ProjectFile =>
  updateBeat(file, beatId, { seconds: Math.max(0, Math.round(seconds)) });
