import { describe, expect, it } from 'vitest';
import {
  asDuration,
  createProjectFile,
  daysOfWriting,
  defaultMarkerKind,
  defaultMarkerNumbering,
  hasChapterPages,
  layoutFor,
  placedMarkers,
  addMarker,
  recordWriting,
  sessionMinutes,
  sessionWords,
  updateBeat,
  writingReport,
  type ProjectFile,
} from '../index.js';

/**
 * Writing sessions and what a report makes of them (addendum 02 §15), and
 * the two formats added with them (§14).
 */

const project = (): ProjectFile => createProjectFile({ title: 'Lighthouse', format: 'screenplay' });

/** Put `words` words in the manuscript, so a session has something to count. */
const write = (file: ProjectFile, words: number): ProjectFile =>
  updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [
        {
          id: 's1' as never,
          type: 'action',
          text: Array.from({ length: words }, (_, index) => `word${index}`).join(' '),
          characterId: null,
          attributes: {},
        },
      ],
    },
  });

const at = (day: string, time: string) => new Date(`${day}T${time}`).toISOString();

/**
 * A sitting, as the app actually records one: it ticks every few minutes
 * while the writer is working, and the manuscript reaches `words` early on.
 * The ticks are what hold one sitting open — a gap is what ends it.
 */
const sat = (file: ProjectFile, day: string, from: string, to: string, words: number): ProjectFile => {
  const end = new Date(`${day}T${to}`).getTime();
  let wrote = false;
  for (let t = new Date(`${day}T${from}`).getTime(); t < end; t += 4 * 60_000) {
    file = recordWriting(file, new Date(t).toISOString());
    if (!wrote) {
      file = write(file, words);
      wrote = true;
    }
  }
  return recordWriting(file, new Date(end).toISOString());
};

describe('a sitting', () => {
  it('starts when the writing does, and records the day, the hours and the words', () => {
    const file = sat(write(project(), 100), '2026-09-01', '09:00', '10:30', 400);

    expect(file.sessions).toHaveLength(1);
    const session = file.sessions[0]!;
    expect(sessionMinutes(session)).toBe(90);
    expect(sessionWords(session)).toBe(300);
    expect(daysOfWriting(file)[0]?.day).toBe('2026-09-01');
  });

  it('is one sitting while the writing continues, and a new one after a gap', () => {
    let file = write(project(), 10);
    file = recordWriting(file, at('2026-09-01', '09:00'));
    // Four minutes later is the same sitting; two hours later is not.
    file = recordWriting(file, at('2026-09-01', '09:04'));
    expect(file.sessions).toHaveLength(1);

    file = recordWriting(file, at('2026-09-01', '11:04'));
    expect(file.sessions).toHaveLength(2);
  });

  it('reports a day spent cutting as the loss it was', () => {
    const file = sat(write(project(), 500), '2026-09-01', '09:00', '09:40', 320);
    expect(sessionWords(file.sessions[0]!)).toBe(-180);
    expect(writingReport(file, '2026-09-01').words).toBe(-180);
  });

  it('says how long in the way a person would', () => {
    expect(asDuration(45)).toBe('45m');
    expect(asDuration(60)).toBe('1h');
    expect(asDuration(135)).toBe('2h 15m');
  });
});

describe('the report', () => {
  /** Three days running, then a gap, then two more. */
  const history = (): ProjectFile => {
    let file = write(project(), 0);
    const days: [string, number][] = [
      ['2026-09-01', 300],
      ['2026-09-02', 600],
      ['2026-09-03', 900],
      ['2026-09-07', 1200],
      ['2026-09-08', 1500],
    ];
    for (const [day, words] of days) file = sat(file, day, '20:00', '21:00', words);
    return file;
  };

  it('adds up the days, the time and the words, and works out the rate', () => {
    const report = writingReport(history(), '2026-09-08');
    expect(report.days).toBe(5);
    expect(report.sessions).toBe(5);
    expect(report.minutes).toBe(300);
    expect(report.words).toBe(1500);
    expect(report.wordsPerHour).toBe(300);
    expect(report.firstDay).toBe('2026-09-01');
    expect(report.lastDay).toBe('2026-09-08');
  });

  it('counts a streak only while it is still alive', () => {
    const file = history();
    // Read on the last day written: two days running.
    expect(writingReport(file, '2026-09-08').streak).toBe(2);
    // Read the next day: still alive, because yesterday counts.
    expect(writingReport(file, '2026-09-09').streak).toBe(2);
    // Read a week later: history, not a streak.
    expect(writingReport(file, '2026-09-15').streak).toBe(0);
    // The longest run is the three days at the start, whenever it is read.
    expect(writingReport(file, '2026-09-15').longestStreak).toBe(3);
  });

  it('has nothing to say about a project nobody has written in yet', () => {
    const report = writingReport(project(), '2026-09-08');
    expect(report).toMatchObject({ days: 0, minutes: 0, words: 0, streak: 0, wordsPerHour: 0 });
  });
});

describe('the formats a project can be', () => {
  it('divides a series into episodes, numbered the way a call sheet numbers them', () => {
    let file = createProjectFile({ title: 'The Lighthouse', format: 'series' });
    expect(defaultMarkerKind('series')).toBe('episode');
    expect(defaultMarkerNumbering('series')).toBe('numeric');

    file = addMarker(file, { unitId: file.units[0]!.id, title: 'Pilot', kind: 'episode' }).file;
    expect(placedMarkers(file)[0]?.label).toBe('EPISODE 1');
    // An episode opens with a title card, the way a chapter opens with a leaf.
    expect(hasChapterPages('series')).toBe(true);
  });

  it('writes a series and a short-form piece in script format', () => {
    expect(layoutFor('series')).toBe(layoutFor('screenplay'));
    expect(layoutFor('short_form')).toBe(layoutFor('screenplay'));
    // …and a book in the other one.
    expect(layoutFor('novel')).not.toBe(layoutFor('screenplay'));
  });

  it('makes a project in either of the new formats, with a scene to write in', () => {
    for (const format of ['series', 'short_form'] as const) {
      const file = createProjectFile({ title: 'T', format });
      expect(file.project.format).toBe(format);
      expect(file.units).toHaveLength(1);
      expect(file.beats).toHaveLength(1);
    }
  });
});
