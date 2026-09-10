import { describe, expect, it } from 'vitest';
import {
  WORDS_PER_SECOND,
  addBeat,
  addUnit,
  avSheet,
  createProjectFile,
  formatRt,
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
