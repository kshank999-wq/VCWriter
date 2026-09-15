import { describe, expect, it } from 'vitest';
import { addBeat, addUnit, updateBeat } from '../mutations.js';
import { createProjectFile } from '../project-file.js';
import {
  clearPoster,
  describeGaps,
  oneSheet,
  oneSheetGaps,
  posterOf,
  projectHome,
  setPoster,
  setProjectDetails,
  statusName,
  whereYouAre,
} from '../project-home.js';
import {
  oneSheetText,
  renderOneSheetBody,
  renderOneSheetHtml,
  suggestedOneSheetFileName,
} from '../print-one-sheet.js';
import type { ProjectFile } from '../project-file.js';

/**
 * The project home (master spec §4, addendum 17).
 *
 * The two rules worth a test are the two absences: **where you are is read
 * from the work rather than stored**, and **the one-sheet is assembled rather
 * than kept**. Both are the kind of thing that passes on the day it is built
 * and rots quietly afterwards, which is what a test is for.
 */

const DOT = 'data:image/png;base64,iVBORw0KGgo=';

/**
 * A project with exactly `chapters` units, one beat in each.
 *
 * `createProjectFile` seeds a starter unit and beat, and they are dropped here
 * so the figures in these tests are the figures the fixture describes.
 */
const book = (chapters = 2): { file: ProjectFile; beatIds: string[] } => {
  let file = createProjectFile({ title: 'The Brass Key', format: 'screenplay' });
  const starters = new Set(file.units.map((one) => one.id as string));
  const laneId = file.lanes[0]!.id;
  const beatIds: string[] = [];
  for (let at = 0; at < chapters; at += 1) {
    const unit = addUnit(file, { laneId, title: `Scene ${at + 1}` });
    const beat = addBeat(unit.file, { unitId: unit.unit.id, title: `Beat ${at + 1}` });
    file = beat.file;
    beatIds.push(beat.beat.id as string);
  }
  file = {
    ...file,
    units: file.units.filter((one) => !starters.has(one.id as string)),
    beats: file.beats.filter((one) => !starters.has(one.unitId as string)),
  };
  return { file, beatIds };
};

describe('the fields nothing could reach', () => {
  it('writes every one of §4’s fields, and reads them back', () => {
    const { file } = book();
    const after = setProjectDetails(file, {
      logline: 'A locksmith is asked to open a door she installed.',
      elevatorPitch: 'A thriller about the things we make for other people.',
      synopsis: 'Mara fits a lock. Years later somebody wants it opened.',
      genre: 'Thriller',
      notes: 'Working title only.',
      status: 'drafting',
    });

    expect(after.project.logline).toContain('locksmith');
    expect(after.project.elevatorPitch).toContain('thriller');
    expect(after.project.synopsis).toContain('Mara');
    expect(after.project.genre).toBe('Thriller');
    expect(after.project.notes).toBe('Working title only.');
    expect(after.project.status).toBe('drafting');
  });

  it('patches, so a screen showing three fields cannot blank the other five', () => {
    const { file } = book();
    const full = setProjectDetails(file, { logline: 'One.', synopsis: 'Two.', genre: 'Three.' });
    const after = setProjectDetails(full, { logline: 'Changed.' });

    expect(after.project.logline).toBe('Changed.');
    expect(after.project.synopsis).toBe('Two.');
    expect(after.project.genre).toBe('Three.');
  });

  it('names each status without any of them meaning anything', () => {
    expect(statusName('development')).toBe('In development');
    expect(statusName('complete')).toBe('Complete');
    // And nothing anywhere consults it: a complete project takes an edit.
    const { file, beatIds } = book();
    const done = setProjectDetails(file, { status: 'complete' });
    const after = updateBeat(done, beatIds[0]! as never, { title: 'Still writing' });
    expect(after.beats.find((one) => (one.id as string) === beatIds[0])!.title).toBe('Still writing');
  });
});

describe('the poster', () => {
  it('rides in the document, so the file opens anywhere', () => {
    const { file } = book();
    const made = setPoster(file, { name: 'key-art.png', data: DOT, width: 600, height: 900 });

    expect(made.file.project.posterAssetId).toBe(made.asset.id);
    expect(posterOf(made.file)!.data).toBe(DOT);
    expect(made.file.assets).toHaveLength(1);
  });

  it('forgetting the poster keeps the picture', () => {
    const { file } = book();
    const made = setPoster(file, { name: 'key-art.png', data: DOT });
    const after = clearPoster(made.file);

    expect(after.project.posterAssetId).toBeNull();
    expect(posterOf(after)).toBeNull();
    // Two different acts: the picture is still in the document.
    expect(after.assets).toHaveLength(1);
  });

  it('reads as no poster when the picture has gone from the assets', () => {
    const { file } = book();
    const made = setPoster(file, { name: 'key-art.png', data: DOT });
    const gone = { ...made.file, assets: [] };
    expect(posterOf(gone)).toBeNull();
  });
});

describe('where you are', () => {
  it('is the beat most recently written in, not the first', () => {
    const { file, beatIds } = book(3);
    const after = updateBeat(file, beatIds[2]! as never, { title: 'The last one touched' });

    const where = whereYouAre(after)!;
    expect(where.beatTitle).toBe('The last one touched');
    expect(where.unitNumber).toBe(3);
    expect(where.says).toBe('Scene 3 · Scene 3');
  });

  it('names the unit for the format rather than saying "scene" on a book', () => {
    let file = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
    const unit = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Refraction' });
    const beat = addBeat(unit.file, { unitId: unit.unit.id, title: 'Snell’s law' });
    file = beat.file;

    // The starter unit is still there and came first, so ask for the one written in.
    const after = updateBeat(file, beat.beat.id, { title: 'Snell’s law' });
    const where = whereYouAre(after)!;
    expect(where.says).toContain('Section');
    expect(where.says).not.toContain('Scene ');
  });

  it('breaks a tie by story order rather than by whatever the array held first', () => {
    // Six chapters laid out in one go carry the same millisecond, and walking
    // the document's own array order there answers with an accident.
    const { file } = book(6);
    const stamped = { ...file, beats: file.beats.map((one) => ({ ...one, updatedAt: '2026-09-15T12:00:00.000Z' })) };
    const shuffled = { ...stamped, beats: [...stamped.beats].reverse() };

    expect(whereYouAre(stamped)!.unitNumber).toBe(6);
    // The same answer whichever way round the array happens to be.
    expect(whereYouAre(shuffled)!.unitNumber).toBe(6);
  });

  it('has no answer on a document nobody has written in, and says so by being null', () => {
    const empty = { ...createProjectFile({ title: 'Nothing', format: 'screenplay' }), beats: [] };
    expect(whereYouAre(empty)).toBeNull();
  });

  it('will not send a writer to a beat whose unit has gone', () => {
    const { file, beatIds } = book(2);
    const touched = updateBeat(file, beatIds[1]! as never, { title: 'Orphan' });
    // Cut the unit out from under it, as a delete that missed its beats would.
    const home = touched.beats.find((one) => (one.id as string) === beatIds[1])!;
    const orphaned = {
      ...touched,
      units: touched.units.filter((one) => (one.id as string) !== (home.unitId as string)),
    };

    const where = whereYouAre(orphaned);
    expect(where?.beatTitle).not.toBe('Orphan');
  });
});

describe('the home reading', () => {
  it('counts rather than stores, so cutting a chapter moves the figure', () => {
    const { file, beatIds } = book(4);
    const written = updateBeat(file, beatIds[0]! as never, { status: 'written' });

    const before = projectHome(written);
    expect(before.progress.subs).toBe(4);
    expect(before.progress.written).toBe(1);
    expect(before.progress.percent).toBe(25);

    const cut = { ...written, beats: written.beats.slice(0, 2) };
    // Nothing was run, and the reading has already changed.
    expect(projectHome(cut).progress.percent).toBe(50);
  });

  it('is honest about a project with nothing in it', () => {
    const empty = { ...createProjectFile({ title: 'Nothing', format: 'screenplay' }), beats: [] };
    const home = projectHome(empty);
    expect(home.progress.percent).toBe(0);
    expect(home.where).toBeNull();
  });

  it('carries the format’s own nouns, so no screen has to name a unit', () => {
    let file = createProjectFile({ title: 'A Book', format: 'instructional' });
    file = addUnit(file, { laneId: file.lanes[0]!.id, title: 'One' }).file;
    expect(projectHome(file).nouns.unit).toBe('Section');
    expect(projectHome(file).nouns.sub).toBe('Subsection');
  });

  it('gathers the fields, the poster and the unresolved counts in one reading', () => {
    const { file } = book();
    const told = setProjectDetails(file, { logline: 'A line.', genre: 'Thriller' });
    const made = setPoster(told, { name: 'art.png', data: DOT });

    const home = projectHome(made.file);
    expect(home.details.logline).toBe('A line.');
    expect(home.poster!.name).toBe('art.png');
    expect(home.unresolved.research).toBe(0);
    expect(home.unresolved.setups).toBe(0);
    expect(home.assets).toBe(1);
  });
});

describe('the one-sheet', () => {
  it('is assembled from the fields every time it is asked for', () => {
    const { file } = book();
    const told = setProjectDetails(file, { author: 'K. Shank', logline: 'A line.', genre: 'Thriller' });

    expect(oneSheet(told).logline).toBe('A line.');
    // Edit the field and the sheet has already changed: nothing was stored.
    const again = setProjectDetails(told, { logline: 'A better line.' });
    expect(oneSheet(again).logline).toBe('A better line.');
  });

  it('names the work and the genre, and drops whichever is missing', () => {
    const { file } = book();
    expect(oneSheet(file).standfirst).toBe('Script');

    const told = setProjectDetails(file, { genre: 'Thriller' });
    expect(oneSheet(told).standfirst).toBe('Script · Thriller');
  });

  it('names what is missing as a fact, and prints anyway', () => {
    const { file } = book();
    const gaps = oneSheetGaps(file);
    expect(gaps).toContain('logline');
    expect(gaps).toContain('synopsis');
    expect(gaps).toContain('poster');
    expect(describeGaps(file)).toContain('The sheet prints without them');

    // And the sheet is still a sheet.
    expect(oneSheet(file).title).toBe('The Brass Key');
  });

  it('says nothing at all once the writer has filled it in', () => {
    const { file } = book();
    const told = setProjectDetails(file, {
      author: 'K. Shank',
      logline: 'A line.',
      elevatorPitch: 'A pitch.',
      synopsis: 'A synopsis.',
      genre: 'Thriller',
    });
    const made = setPoster(told, { name: 'art.png', data: DOT });

    expect(oneSheetGaps(made.file)).toEqual([]);
    expect(describeGaps(made.file)).toBeNull();
  });

  it('reads the format’s nouns in its figures', () => {
    let file = createProjectFile({ title: 'A Book', format: 'instructional' });
    file = addUnit(file, { laneId: file.lanes[0]!.id, title: 'One' }).file;
    expect(oneSheet(file).figures).toContain('sections');
  });
});

describe('the one-sheet as a document', () => {
  it('escapes everything, so no field can carry markup', () => {
    const { file } = book();
    const told = setProjectDetails(file, {
      title: '<script>alert(1)</script>',
      logline: 'A & B <b>bold</b>',
    });

    const html = renderOneSheetHtml(told);
    // The point: it is in the page as text, and not as a tag.
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('A &amp; B &lt;b&gt;bold&lt;/b&gt;');
  });

  it('leaves out a field the writer has not filled in, rather than heading it', () => {
    const { file } = book();
    const told = setProjectDetails(file, { logline: 'A line.' });
    const html = renderOneSheetHtml(told);

    expect(html).toContain('A line.');
    // An empty heading looks like the software failed; the screen names the
    // gaps instead, where somebody can do something about them.
    expect(html).not.toContain('Synopsis');
    expect(html).not.toContain('The pitch');
  });

  it('drops the art on request, and says so in the markup', () => {
    const { file } = book();
    const made = setPoster(file, { name: 'art.png', data: DOT });
    const sheet = oneSheet(made.file);

    expect(renderOneSheetBody(sheet, true)).toContain('one-art');
    // Email: the poster does not travel.
    const forEmail = renderOneSheetBody(sheet, false);
    expect(forEmail).not.toContain('one-art');
    expect(forEmail).toContain('no-art');
  });

  it('writes a plain-text sheet off the same reading, so the two cannot disagree', () => {
    const { file } = book();
    const told = setProjectDetails(file, { author: 'K. Shank', logline: 'A line.', synopsis: 'A synopsis.' });
    const text = oneSheetText(oneSheet(told));

    expect(text).toContain('The Brass Key');
    expect(text).toContain('by K. Shank');
    expect(text).toContain('SYNOPSIS');
    expect(text).not.toContain('<');
  });

  it('names the file after the project, without characters a filesystem refuses', () => {
    const { file } = book();
    const told = setProjectDetails(file, { title: 'A/B: the "sequel"' });
    expect(suggestedOneSheetFileName(told)).toBe('A-B- the -sequel- — one-sheet.pdf');
  });
});
