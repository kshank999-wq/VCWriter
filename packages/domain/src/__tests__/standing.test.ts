import { describe, expect, it } from 'vitest';
import {
  STANDING_WORDS,
  createProjectFile,
  describeExport,
  exportFileName,
  hasWorkToFetch,
  hasWorkToSend,
  moorTo,
  projectFromRow,
  projectToRow,
  standingOfProject,
  whatToDo,
  type Mooring,
  type RoomExport,
  type RoomMaster,
} from '../index.js';

/**
 * Where a local project stands against a room's master (addendum 07 §14,
 * stage 11).
 *
 * The claim worth proving over and over: **nothing here ever proposes an
 * overwrite.** Work that goes up becomes a contribution and work that comes
 * down is a master the room agreed on; there is no third move where one side
 * wins for being newer, because that is the decision §3.3 says a room must
 * never make automatically.
 */

const AT = '2026-09-12T00:00:00.000Z';
const ROOM = 'room-1';

const moored = (over: Partial<Mooring> = {}): Mooring =>
  moorTo({ roomId: ROOM, versionId: 'v1', contentHash: 'h1', at: AT, ...over });

const master = (over: Partial<RoomMaster> = {}): RoomMaster => ({
  versionId: 'v1',
  contentHash: 'h1',
  label: 'Room Pass',
  ...over,
});

const standing = (input: { mooring: Mooring | null; localHash: string; master: RoomMaster }) =>
  standingOfProject({ ...input, roomId: ROOM });

describe('the four words, and the fifth', () => {
  it('is current when the file is the master, byte for byte', () => {
    expect(standing({ mooring: moored(), localHash: 'h1', master: master() })).toBe('current');
  });

  it('is ahead when the room has not moved and this copy has', () => {
    expect(standing({ mooring: moored(), localHash: 'h2', master: master() })).toBe('ahead');
  });

  it('is behind when the room has moved and this copy has not', () => {
    expect(
      standing({ mooring: moored(), localHash: 'h1', master: master({ versionId: 'v2', contentHash: 'h9' }) }),
    ).toBe('behind');
  });

  it('is diverged when both have moved', () => {
    expect(
      standing({ mooring: moored(), localHash: 'h2', master: master({ versionId: 'v2', contentHash: 'h9' }) }),
    ).toBe('diverged');
  });

  it('is unmoored for a file that has never been in this room', () => {
    // §14 names four words; this is the honest fifth. Calling it *diverged*
    // would be a lie about a project that has simply never met the room.
    expect(standing({ mooring: null, localHash: 'h2', master: master() })).toBe('unmoored');
    expect(STANDING_WORDS.unmoored).toBe('Not in the room');
  });

  it('is unmoored for a file moored to a different room', () => {
    expect(standing({ mooring: moored({ roomId: 'elsewhere' }), localHash: 'h1', master: master() })).toBe(
      'unmoored',
    );
  });

  it('calls it current when the room has agreed on nothing and this copy is untouched', () => {
    const nothing = master({ versionId: null, contentHash: '', label: '' });
    expect(standing({ mooring: moored(), localHash: 'h1', master: nothing })).toBe('current');
    expect(standing({ mooring: moored(), localHash: 'h2', master: nothing })).toBe('ahead');
  });

  it('calls it current when the hashes match however the two got there', () => {
    // Moored to an older version, but the content happens to be the master's:
    // there is nothing to send and nothing to fetch, whatever the ancestry.
    expect(
      standing({ mooring: moored({ versionId: 'v0' }), localHash: 'h9', master: master({ versionId: 'v2', contentHash: 'h9' }) }),
    ).toBe('current');
  });
});

describe('what the writer is told to do about it', () => {
  it('never proposes an overwrite, in any state', () => {
    for (const one of ['unmoored', 'current', 'ahead', 'behind', 'diverged'] as const) {
      const said = whatToDo(one, master()).toLowerCase();
      // The word may appear — twice it does, and both times to deny it — so
      // what is asserted is that it is never *offered*: wherever it is said,
      // it is said as something that does not happen.
      if (said.includes('overwrite')) {
        expect(said).toMatch(/(never|by itself)[^.]*overwrit|overwrit[^.]*(never|by itself)/);
      }
      expect(said).not.toContain('replace');
    }
  });

  it('says work sent up becomes a contribution, not the master', () => {
    expect(whatToDo('ahead', master())).toContain('contribution');
    expect(whatToDo('ahead', master())).toContain('never overwrites');
  });

  it('says both survive when the two have diverged', () => {
    const said = whatToDo('diverged', master());
    expect(said).toContain('both survive');
    expect(said).toContain('showrunner decides');
  });

  it('names the draft the room agreed on, where it has one', () => {
    expect(whatToDo('behind', master({ label: 'Network Notes' }))).toContain('Network Notes');
    expect(whatToDo('behind', master({ label: '' }))).toContain('a newer draft');
  });

  it('knows which way there is work to move', () => {
    expect(hasWorkToSend('ahead')).toBe(true);
    expect(hasWorkToSend('unmoored')).toBe(true);
    expect(hasWorkToSend('behind')).toBe(false);
    expect(hasWorkToSend('current')).toBe(false);

    expect(hasWorkToFetch('behind')).toBe(true);
    expect(hasWorkToFetch('diverged')).toBe(true);
    expect(hasWorkToFetch('ahead')).toBe(false);
  });
});

describe('the mooring rides with the document', () => {
  it('is on the project, so two copies of one file agree about their ancestry', () => {
    const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    expect(file.project.mooring).toBe(null);

    const stamped = { ...file, project: { ...file.project, mooring: moored() } };
    expect(stamped.project.mooring?.versionId).toBe('v1');
  });

  it('survives the trip to the database and back', () => {
    // The point of putting it on the document rather than in a device setting:
    // it syncs. A mooring that did not round-trip would make every second
    // machine think it had never been in the room.
    const file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
    const stamped = { ...file, project: { ...file.project, mooring: moored() } };

    const row = projectToRow(stamped);
    expect(row['mooring']).toEqual(moored());

    const back = projectFromRow(row);
    expect(back.mooring).toEqual(moored());
    expect(projectFromRow({ ...row, mooring: null }).mooring).toBe(null);
  });
});

describe('taking a room out', () => {
  const bundle: RoomExport = {
    exportedAt: AT,
    room: { id: ROOM },
    seats: [{}, {}],
    branches: [{}],
    versions: [{}, {}, {}],
    submissions: [{}],
    assignments: [],
    comments: [{}, {}],
    master: { versionId: 'v2', document: {} },
  };

  it('says what is in it, and leaves out what is not there', () => {
    expect(describeExport(bundle)).toBe('2 seats, 3 versions, 1 submission, 2 comments');
    expect(describeExport({ ...bundle, seats: [], versions: [], submissions: [], comments: [] })).toBe(
      'an empty room',
    );
  });

  it('names the file after the room and the day', () => {
    // The em dash goes with the rest of the punctuation and the two spaces it
    // leaves behind collapse to one hyphen, which is the right answer.
    expect(exportFileName('Blackout — Room', AT)).toBe('blackout-room-2026-09-12.vcroom.json');
    expect(exportFileName('  ', AT)).toBe('room-2026-09-12.vcroom.json');
  });
});
