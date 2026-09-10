import { describe, expect, it } from 'vitest';
import {
  WORDS_PER_SECOND,
  addBeat,
  addUnit,
  addRow,
  avSheet,
  clearRowFrame,
  parseProjectFile,
  setRowFrame,
  moveRow,
  parseRt,
  setRowAudio,
  setRowSeconds,
  setRowVisual,
  createProjectFile,
  formatRt,
  isSpoken,
  toggleSpoken,
  setTitlePage,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '../index.js';
import { newId } from '../ids.js';
import type { ManuscriptElementId } from '../ids.js';

/**
 * The AV sheet (addendum 05 §2): a commercial as it is actually written —
 * what is heard, what is seen, and how long it runs.
 */

const line = (text: string) => ({
  id: newId<ManuscriptElementId>(),
  type: 'dialogue' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A commercial: one segment, three rows, the way the picture has it. */
const commercial = (): ProjectFile => {
  let file = createProjectFile({ title: 'Commercial 1', format: 'short_form' });
  file = updateUnit(file, file.units[0]!.id, {
    title: 'Know your enemy...',
    summary: 'More important to know who is not your enemy',
  });
  file = updateBeat(file, file.beats[0]!.id, {
    manuscript: { elements: [line('Sun Tzu said "know your enemy"')] },
    visual: 'nerdy kid walking down the street',
    seconds: 4,
  });

  const second = addBeat(file, { unitId: file.units[0]!.id, title: 'Two' });
  file = updateBeat(second.file, second.beat.id, {
    manuscript: { elements: [line('In this era - almost everyone is the enemy...')] },
    visual: 'Kid continues walking.',
    seconds: 5,
  });

  const third = addBeat(file, { unitId: file.units[0]!.id, title: 'Three' });
  return updateBeat(third.file, third.beat.id, {
    manuscript: { elements: [line('It is more important to know who is not your enemy...')] },
    visual: 'a group of preppy girls block his way',
    seconds: 6,
  });
};

describe('a running time', () => {
  it('is written the way a sheet writes it', () => {
    expect(formatRt(0)).toBe('00:00');
    expect(formatRt(7)).toBe('00:07');
    expect(formatRt(30)).toBe('00:30');
    expect(formatRt(90)).toBe('01:30');
    expect(formatRt(3723)).toBe('1:02:03');
  });
});

describe('the sheet', () => {
  it('numbers every row by where it falls in the story', () => {
    const sheet = avSheet(commercial());
    expect(sheet.segments).toHaveLength(1);
    expect(sheet.segments[0]?.rows.map((row) => row.number)).toEqual(['1.1', '1.2', '1.3']);
  });

  it('takes the segment’s name and its line from the scene', () => {
    const segment = avSheet(commercial()).segments[0]!;
    expect(segment.name).toBe('Know your enemy...');
    expect(segment.line).toBe('More important to know who is not your enemy');
  });

  it('reads the audio from the manuscript and the visual from the beat', () => {
    const row = avSheet(commercial()).segments[0]!.rows[0]!;
    expect(row.audio).toBe('Sun Tzu said "know your enemy"');
    expect(row.visual).toBe('nerdy kid walking down the street');
  });

  it('counts the audio, and only the audio', () => {
    const sheet = avSheet(commercial());
    const rows = sheet.segments[0]!.rows;
    expect(rows.map((row) => row.words)).toEqual([6, 9, 11]);
    // The visual is not spoken, so it is not counted.
    expect(sheet.words).toBe(26);
    expect(sheet.segments[0]?.words).toBe(26);
  });

  it('adds the times up, by row, by segment and altogether', () => {
    const sheet = avSheet(commercial());
    expect(sheet.segments[0]?.rows.map((row) => row.seconds)).toEqual([4, 5, 6]);
    expect(sheet.segments[0]?.seconds).toBe(15);
    expect(sheet.seconds).toBe(15);
  });

  it('carries the running totals to the foot of each segment', () => {
    let file = commercial();
    const made = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The tag' });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title: 'Tag' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [line('Villain Academy.')] },
      seconds: 3,
    });

    const sheet = avSheet(file);
    expect(sheet.segments.map((segment) => segment.position)).toEqual([1, 2]);
    expect(sheet.segments[1]?.rows.map((row) => row.number)).toEqual(['2.1']);
    // The foot of segment one says where the whole thing stands there…
    expect(sheet.segments[0]?.totalSeconds).toBe(15);
    // …and the foot of segment two says where it ends.
    expect(sheet.segments[1]?.totalSeconds).toBe(18);
    expect(sheet.seconds).toBe(18);
  });

  it('says whether a row’s words fit its time, and claims nothing without one', () => {
    let file = commercial();
    const rows = () => avSheet(file).segments[0]!.rows;
    // Six words in four seconds is a comfortable read.
    expect(rows()[0]?.fits).toBe(true);

    file = updateBeat(file, file.beats[0]!.id, { seconds: 1 });
    expect(rows()[0]?.fits).toBe(false);

    // A row nobody has timed yet is not a row with a problem.
    file = updateBeat(file, file.beats[0]!.id, { seconds: 0 });
    expect(rows()[0]?.fits).toBeNull();
    expect(WORDS_PER_SECOND).toBe(2.5);
  });

  it('takes its masthead from the title page, never from the sheet', () => {
    let file = commercial();
    // Nothing said: the project's own title, and a board that has not been
    // versioned is the first one.
    expect(avSheet(file).title).toBe('Commercial 1');
    expect(avSheet(file).version).toBe('v1');

    file = setTitlePage(file, { title: 'KNOW YOUR ENEMY', revision: 'v3' });
    expect(avSheet(file).title).toBe('KNOW YOUR ENEMY');
    expect(avSheet(file).version).toBe('v3');
  });

  it('leaves out what has been held back from the script', () => {
    let file = commercial();
    file = updateBeat(file, file.beats[1]!.id, { inScript: false });
    const rows = avSheet(file).segments[0]!.rows;
    // And the numbering closes up behind it, because it is the row's place.
    expect(rows.map((row) => row.number)).toEqual(['1.1', '1.2']);
    expect(rows[1]?.audio).toContain('more important');
  });

  it('says nothing at all about a project with nothing in it', () => {
    const empty = createProjectFile({ title: 'Untitled', format: 'short_form' });
    const sheet = avSheet(empty);
    expect(sheet.seconds).toBe(0);
    expect(sheet.words).toBe(0);
    expect(sheet.segments[0]?.rows.every((row) => row.seconds === 0)).toBe(true);
  });
});

describe('writing in the sheet', () => {
  const rowsOf = (file: ProjectFile) => avSheet(file).segments.flatMap((segment) => segment.rows);

  it('reads a time the way a writer types one', () => {
    expect(parseRt('4')).toBe(4);
    expect(parseRt('04')).toBe(4);
    expect(parseRt('0:04')).toBe(4);
    expect(parseRt('00:04')).toBe(4);
    expect(parseRt('1:02')).toBe(62);
    expect(parseRt('1:02:03')).toBe(3723);
    expect(parseRt('  30 ')).toBe(30);
    // Emptying the box means no time yet, which is a thing a writer means.
    expect(parseRt('')).toBe(0);
    // And anything that is not a time at all is not one.
    expect(parseRt('soon')).toBeNull();
    expect(parseRt('4s')).toBeNull();
  });

  it('writes the audio as plain lines, one line to an element', () => {
    let file = commercial();
    const beatId = file.beats[0]!.id;
    file = setRowAudio(file, beatId, 'This is not for you...\nThink for yourself...');

    expect(rowsOf(file)[0]?.audio).toBe('This is not for you...\nThink for yourself...');
    expect(avSheet(file).segments[0]?.rows[0]?.words).toBe(8);
  });

  it('keeps what a line already was when it is edited on the sheet', () => {
    let file = commercial();
    const beatId = file.beats[0]!.id;
    const was = file.beats[0]!.manuscript.elements[0]!;
    file = setRowAudio(file, beatId, 'Sun Tzu said something else');

    const element = file.beats.find((beat) => beat.id === beatId)!.manuscript.elements[0]!;
    // Same line, re-typed: it keeps its id and its type, so a speech written
    // in the beat window is not turned into something else by a tidy-up here.
    expect(element.id).toBe(was.id);
    expect(element.type).toBe(was.type);
    expect(element.text).toBe('Sun Tzu said something else');
  });

  it('writes the visual and the time', () => {
    let file = commercial();
    const beatId = file.beats[0]!.id;
    file = setRowVisual(file, beatId, 'The kid nods');
    file = setRowSeconds(file, beatId, 7);

    expect(rowsOf(file)[0]?.visual).toBe('The kid nods');
    expect(rowsOf(file)[0]?.seconds).toBe(7);
    // Never negative, and never a fraction of a second.
    expect(rowsOf(setRowSeconds(file, beatId, -3))[0]?.seconds).toBe(0);
    expect(rowsOf(setRowSeconds(file, beatId, 4.6))[0]?.seconds).toBe(5);
  });

  it('adds a row under the one it was asked for, not at the end', () => {
    let file = commercial();
    const made = addRow(file, { unitId: file.units[0]!.id, afterBeatId: file.beats[0]!.id });
    file = setRowAudio(made.file, made.beatId, 'A new line');

    expect(rowsOf(file).map((row) => row.number)).toEqual(['1.1', '1.2', '1.3', '1.4']);
    expect(rowsOf(file)[1]?.audio).toBe('A new line');
  });

  it('adds one at the end of the segment when nothing is named', () => {
    let file = commercial();
    const made = addRow(file, { unitId: file.units[0]!.id });
    file = setRowAudio(made.file, made.beatId, 'The tag');
    expect(rowsOf(file).at(-1)?.audio).toBe('The tag');
  });

  it('moves a row up and down, and the numbering follows it', () => {
    let file = commercial();
    const third = file.beats[2]!.id;
    file = moveRow(file, third, -1);

    const audio = rowsOf(file).map((row) => row.audio);
    expect(audio[1]).toContain('more important');
    expect(audio[2]).toContain('In this era');
    // And back again.
    file = moveRow(file, third, 1);
    expect(rowsOf(file).map((row) => row.audio)[2]).toContain('more important');
  });

  it('carries a row into the segment above or below when it runs off the end', () => {
    let file = commercial();
    const made = addUnit(file, { laneId: file.lanes[0]!.id, title: 'The tag' });
    file = made.file;
    const beat = addBeat(file, { unitId: made.unit.id, title: 'Tag' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [line('Villain Academy.')] } });

    // The tag's only row, moved up, lands at the foot of segment one.
    file = moveRow(file, beat.beat.id, -1);
    const sheet = avSheet(file);
    expect(sheet.segments[0]?.rows.map((row) => row.number)).toEqual(['1.1', '1.2', '1.3', '1.4']);
    expect(sheet.segments[0]?.rows.at(-1)?.audio).toBe('Villain Academy.');
    expect(sheet.segments[1]?.rows).toHaveLength(0);
  });

  it('leaves the board alone when there is nowhere to move to', () => {
    const file = commercial();
    const before = rowsOf(file).map((row) => row.audio);
    expect(rowsOf(moveRow(file, file.beats[0]!.id, -1)).map((row) => row.audio)).toEqual(before);
    expect(rowsOf(moveRow(file, file.beats.at(-1)!.id, 1)).map((row) => row.audio)).toEqual(before);
  });
});

describe('narration and dialogue', () => {
  it('puts a line in quotation marks, and takes them off again', () => {
    expect(toggleSpoken('You are always late')).toBe('"You are always late"');
    expect(toggleSpoken('"You are always late"')).toBe('You are always late');
    // An empty line becomes an empty pair, ready to be typed between.
    expect(toggleSpoken('')).toBe('""');
    expect(toggleSpoken('   ')).toBe('""');
  });

  it('does not stack quotation marks on a line that has them', () => {
    expect(toggleSpoken('  ""You came""  ')).toBe('You came');
    expect(toggleSpoken('"You came')).toBe('"You came"');
  });

  it('knows a spoken line from a narrated one', () => {
    expect(isSpoken('"You came"')).toBe(true);
    expect(isSpoken('The bell rings.')).toBe(false);
    // A quotation inside a line of narration is not a line of dialogue.
    expect(isSpoken('He said "hello" and left.')).toBe(false);
    expect(isSpoken('')).toBe(false);
  });
});

describe('storyboard frames', () => {
  const picture = 'data:image/png;base64,iVBORw0KGgo=';

  it('keeps the picture in the file and the reference on the row', () => {
    let file = commercial();
    const beatId = file.beats[0]!.id;
    const made = setRowFrame(file, beatId, { name: 'open.png', data: picture, width: 800, height: 450 });
    file = made.file;

    // The picture travels in the document, not as a path to somebody's disk.
    expect(file.assets).toHaveLength(1);
    expect(file.assets[0]?.data).toBe(picture);
    expect(file.assets[0]?.name).toBe('open.png');
    const row = avSheet(file).segments[0]!.rows[0]!;
    expect(row.frame?.id).toBe(made.assetId);
    expect(row.frame?.width).toBe(800);
  });

  it('says a row has no frame until one is hung on it', () => {
    expect(avSheet(commercial()).segments[0]?.rows[0]?.frame).toBeNull();
  });

  it('drops the picture when the row lets go of it', () => {
    const started = commercial();
    const beatId = started.beats[0]!.id;
    let file = setRowFrame(started, beatId, { data: picture }).file;
    expect(file.assets).toHaveLength(1);

    file = clearRowFrame(file, beatId);
    expect(file.assets).toHaveLength(0);
    expect(avSheet(file).segments[0]?.rows[0]?.frame).toBeNull();
  });

  it('does not carry every version of every frame it has ever had', () => {
    let file = commercial();
    const beatId = file.beats[0]!.id;
    for (const name of ['one', 'two', 'three']) {
      file = setRowFrame(file, beatId, { name, data: picture }).file;
    }
    // Replaced three times, and the file holds the one that is wanted.
    expect(file.assets).toHaveLength(1);
    expect(file.assets[0]?.name).toBe('three');
  });

  it('reads as no frame when the picture has gone from under it', () => {
    const started = commercial();
    let file = setRowFrame(started, started.beats[0]!.id, { data: picture }).file;

    // The row still points at it; the picture does not exist any more.
    file = { ...file, assets: [] };
    expect(avSheet(file).segments[0]?.rows[0]?.frame).toBeNull();
  });

  it('survives a save and a re-open, picture and all', () => {
    const started = commercial();
    const made = setRowFrame(started, started.beats[0]!.id, { data: picture, width: 800, height: 450 });
    const back = parseProjectFile(JSON.parse(JSON.stringify(made.file)));
    expect(back.assets[0]?.data).toBe(picture);
    expect(avSheet(back).segments[0]?.rows[0]?.frame?.height).toBe(450);
  });

  it('opens a file that predates frames with none, rather than badly', () => {
    const older = parseProjectFile({
      ...JSON.parse(JSON.stringify(commercial())),
      assets: undefined,
    });
    expect(older.assets).toEqual([]);
    expect(avSheet(older).segments[0]?.rows.every((row) => row.frame === null)).toBe(true);
  });
});
