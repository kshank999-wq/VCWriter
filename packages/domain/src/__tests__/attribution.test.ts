import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addUnit,
  attributionsOf,
  authorOf,
  beatsBy,
  contributionTally,
  contributorsIn,
  createProjectFile,
  isSigned,
  knownRecords,
  newId,
  originNow,
  projectFileSchema,
  renderPrintDocumentHtml,
  ROOM_COLOURS,
  seatSchema,
  signNewWork,
  stampFor,
  updateBeat,
  type ProjectFile,
  type Seat,
} from '../index.js';

/**
 * Whose words these are (addendum 07 §6).
 *
 * Two rules carry the file and both are easy to get wrong later. **Read
 * through, never copy across**: a record names a person and nothing else, so a
 * writer who changes their colour has changed every page they wrote. And **the
 * master is clean while a contribution is signed** — not "never print
 * attribution", which is the mistake the first draft of §5 made.
 */

const AT = '2026-09-11T00:00:00.000Z';

const seat = (over: Partial<Seat> = {}): Seat =>
  seatSchema.parse({
    id: over.id ?? 'seat-1',
    roomId: 'room-1',
    email: 'jo@example.test',
    invitedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...over,
  });

const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder', title: 'Staff Writer', colour: ROOM_COLOURS[1] });
const MARA = seat({ id: 's2', userId: 'mara', displayName: 'Mara Okonjo', colour: ROOM_COLOURS[2] });

/** A project with one scene by Jo and two beats, one each — and words on the page. */
const written = (): ProjectFile => {
  const empty = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  // The seed scene a new project comes with is nobody's work; it would sign
  // itself over to whoever opened the room first.
  const file: ProjectFile = { ...empty, units: [], beats: [] };
  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. WAREHOUSE - NIGHT' });
  const first = addBeat(scene.file, { unitId: scene.unit.id, title: 'Mara enters' });
  const second = addBeat(first.file, { unitId: scene.unit.id, title: 'She finds the case' });
  // Something for the paginator to set: a stamp is a fact about a page, and a
  // document with no manuscript has none.
  const typed = updateBeat(second.file, first.beat.id, {
    manuscript: {
      elements: [
        {
          id: newId(),
          type: 'scene_heading',
          text: 'INT. WAREHOUSE - NIGHT',
          characterId: null,
          attributes: {},
        },
        {
          id: newId(),
          type: 'action',
          text: 'Mara steps through the roller door.',
          characterId: null,
          attributes: {},
        },
      ],
    },
  });

  return projectFileSchema.parse({
    ...typed,
    units: typed.units.map((unit) =>
      unit.id === scene.unit.id ? { ...unit, origin: originNow('jo', AT) } : unit,
    ),
    beats: typed.beats.map((beat) =>
      beat.id === first.beat.id
        ? { ...beat, origin: originNow('jo', AT) }
        : beat.id === second.beat.id
          ? { ...beat, origin: originNow('mara', AT) }
          : beat,
    ),
  });
};

describe('reading a colour through the seat', () => {
  it('resolves a record’s author from the room rather than from the record', () => {
    const byAuthor = attributionsOf([JO, MARA]);
    const who = authorOf(originNow('jo', AT), byAuthor);
    expect(who?.name).toBe('Jo Calder');
    expect(who?.initials).toBe('JC');
    expect(who?.colour).toBe(ROOM_COLOURS[1]);
    expect(who?.title).toBe('Staff Writer');
  });

  it('follows a colour the showrunner changed, without touching the work', () => {
    const recoloured = attributionsOf([{ ...JO, colour: '#123456' }, MARA]);
    expect(authorOf(originNow('jo', AT), recoloured)?.colour).toBe('#123456');
  });

  it('ignores a seat nobody has taken up, which has no person behind it', () => {
    const pending = seat({ id: 's3', userId: null, email: 'new@example.test' });
    expect(attributionsOf([pending]).size).toBe(0);
  });

  it('says nothing at all for work written outside a room', () => {
    expect(authorOf(null, attributionsOf([JO]))).toBeNull();
    expect(authorOf(undefined, attributionsOf([JO]))).toBeNull();
  });

  it('says nothing rather than a grey badge for an author this room does not know', () => {
    expect(authorOf(originNow('somebody-else', AT), attributionsOf([JO]))).toBeNull();
  });
});

describe('the stamp', () => {
  it('carries the initials, the colour and the name', () => {
    const stamp = stampFor(authorOf(originNow('jo', AT), attributionsOf([JO])));
    expect(stamp).toEqual({ initials: 'JC', colour: ROOM_COLOURS[1], name: 'Jo Calder' });
  });

  it('is nothing where there is nobody, or nothing to print', () => {
    expect(stampFor(null)).toBeNull();
    const nameless = attributionsOf([seat({ id: 's4', userId: 'x', displayName: '—', email: '@x.test' })]);
    expect(stampFor(authorOf(originNow('x', AT), nameless))).toBeNull();
  });

  it('falls back to a colour rather than printing nothing in none', () => {
    const colourless = attributionsOf([{ ...JO, colour: '' }]);
    expect(stampFor(authorOf(originNow('jo', AT), colourless))?.colour).toBe('#666666');
  });
});

describe('the master is clean and a contribution is signed', () => {
  it('signs a writer’s own version', () => {
    expect(isSigned({ showing: 'contribution' })).toBe(true);
  });

  it('never signs the master, whatever else is asked for', () => {
    expect(isSigned({ showing: 'master' })).toBe(false);
    expect(isSigned({ showing: 'master', cleanReading: false })).toBe(false);
  });

  it('takes the stamp off a contribution in clean reading', () => {
    expect(isSigned({ showing: 'contribution', cleanReading: true })).toBe(false);
  });
});

describe('the stamp on the page', () => {
  const stamp = { initials: 'JC', colour: '#1d4ed8', name: 'Jo Calder' };

  it('appears on every page, in the writer’s colour', () => {
    const html = renderPrintDocumentHtml(written(), { stamp, includeTitlePage: false });
    const pages = html.split('<section class="page').length - 1;
    expect(pages).toBeGreaterThan(0);
    expect(html.split('<div class="page-stamp"').length - 1).toBe(pages);
    expect(html).toContain('#1d4ed8');
  });

  it('spells the name out on the first page and the initials after', () => {
    const html = renderPrintDocumentHtml(written(), { stamp, includeTitlePage: false });
    expect(html).toContain('Jo Calder');
    expect(html).toContain('JC');
  });

  it('leaves the page bare when nobody signed it — the master’s case', () => {
    const html = renderPrintDocumentHtml(written(), { includeTitlePage: false });
    // The rule is always in the stylesheet; the element is what is optional.
    expect(html).not.toContain('<div class="page-stamp"');
  });

  it('does not take the page number’s corner', () => {
    const html = renderPrintDocumentHtml(written(), { stamp, includeTitlePage: false });
    // Top right stays the number's; top left is the stamp's.
    expect(html).toContain('.page-number { position: absolute; top: 0.5in; right: 1in; }');
    expect(html).toContain('.page-stamp { position: absolute; top: 0.5in; left: 1.5in;');
  });
});

describe('who is in the script', () => {
  it('lists only the contributors who have actually written something', () => {
    const sam = seat({ id: 's9', userId: 'sam', displayName: 'Sam Reed', colour: ROOM_COLOURS[4] });
    const names = contributorsIn(written(), attributionsOf([JO, MARA, sam])).map((who) => who.name);
    expect(names).toEqual(['Jo Calder', 'Mara Okonjo']);
  });

  it('marks a contributor’s beats rather than hiding everyone else’s', () => {
    const file = written();
    const mine = beatsBy(file, 'mara');
    expect(mine.size).toBe(1);
    // The rest are still there to be drawn around the marked one.
    expect(file.beats.length).toBeGreaterThan(mine.size);
  });

  it('marks nothing when nobody is chosen', () => {
    expect(beatsBy(written(), null).size).toBe(0);
  });

  it('counts what each of them originated, the busiest first', () => {
    const tally = contributionTally(written());
    expect(tally[0]).toEqual({ authorId: 'jo', scenes: 1, beats: 1 });
    expect(tally[1]).toEqual({ authorId: 'mara', scenes: 0, beats: 1 });
  });
});

describe('signing what a writer made', () => {
  it('signs the scene they added and leaves what was already there alone', () => {
    const opened = written();
    const known = knownRecords(opened);
    const made = addUnit(opened, { laneId: opened.lanes[0]!.id, title: 'INT. CAR - DAY' });
    const signed = signNewWork(made.file, { authorId: 'mara', known, at: AT });

    expect(signed.units.find((unit) => unit.id === made.unit.id)?.origin).toEqual({
      authorId: 'mara',
      at: AT,
      // Ordinary writing, said out loud: `assisted` is a fact about *how* a
      // record was made (§14), and false is the answer for nearly everything.
      assisted: false,
    });
    // Jo's scene was in the document when the branch opened; it stays Jo's.
    const theirs = signed.units.find((unit) => unit.id !== made.unit.id);
    expect(theirs?.origin?.authorId).toBe('jo');
  });

  it('never re-attributes work that is already signed', () => {
    const opened = written();
    // Nothing known at all: the only thing stopping a re-signing here is that
    // an origin, once set, is somebody else's fact.
    const signed = signNewWork(opened, { authorId: 'mara', known: new Set(), at: AT });
    expect(signed.beats.map((beat) => beat.origin?.authorId ?? null)).toEqual(['jo', 'mara']);
  });

  it('hands back the same document when there is nothing to sign', () => {
    const opened = written();
    expect(signNewWork(opened, { authorId: 'jo', known: knownRecords(opened), at: AT })).toBe(opened);
  });

  it('signs a beat as well as a scene', () => {
    const opened = written();
    const known = knownRecords(opened);
    const made = addBeat(opened, { unitId: opened.units[0]!.id, title: 'The case is empty' });
    const signed = signNewWork(made.file, { authorId: 'mara', known, at: AT });
    expect(signed.beats.find((beat) => beat.id === made.beat.id)?.origin?.authorId).toBe('mara');
  });
});
