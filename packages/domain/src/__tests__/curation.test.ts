import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addUnit,
  applyTray,
  awaitingCuration,
  canCurate,
  createProjectFile,
  curatableFrom,
  describeMasterMerge,
  mergeRefusalText,
  newId,
  seatSchema,
  sequenceOf,
  submissionSchema,
  submissionsBehind,
  trayItemSchema,
  updateBeat,
  type Beat,
  type ProjectFile,
  type Seat,
  type StructuralUnit,
  type TrayItem,
  type TrayPiece,
} from '../index.js';

/**
 * The Curation Tray and the master merge (addendum 07 §12, stage 9).
 *
 * The two claims worth proving over and over, because they are the module's
 * whole reason for existing:
 *
 * **The merge never rewrites what it drew from.** The contribution handed in is
 * the same object afterwards, and so is the master it started from.
 *
 * **Attribution survives.** A scene assembled from two writers' beats has two
 * authors and says so, without anybody writing that down.
 */

const AT = '2026-09-12T00:00:00.000Z';

const seat = (over: Partial<Seat>): Seat =>
  seatSchema.parse({ id: 's', roomId: 'r', email: '', invitedAt: AT, createdAt: AT, updatedAt: AT, ...over });

const JO = seat({ id: 's1', userId: 'jo', displayName: 'Jo Calder' });
const MARA = seat({ id: 's2', userId: 'mara', displayName: 'Mara Oyelaran' });

const item = (over: Partial<TrayItem>): TrayItem =>
  trayItemSchema.parse({
    id: 't1',
    roomId: 'r',
    versionId: 'v1',
    authorId: 'jo',
    kind: 'scene',
    recordId: 'x',
    orderKey: 'a0',
    createdAt: AT,
    ...over,
  });

/** A master with one scene and one beat in it, both Mara's. */
const makeMaster = (): { file: ProjectFile; unit: StructuralUnit; beat: Beat } => {
  let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };
  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. WAREHOUSE - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'Mara enters' });
  const signed: ProjectFile = {
    ...beat.file,
    units: beat.file.units.map((one) => ({ ...one, origin: { authorId: 'mara', at: AT } })),
    beats: beat.file.beats.map((one) => ({ ...one, origin: { authorId: 'mara', at: AT } })),
  };
  return { file: signed, unit: signed.units[0]!, beat: signed.beats[0]! };
};

/** Jo's pass on the same scene: the same ids, her words, her signature. */
const josPass = (master: ProjectFile): TrayPiece => {
  const unit = { ...master.units[0]!, title: 'INT. WAREHOUSE - NIGHT (COLDER)', origin: { authorId: 'jo', at: AT } };
  const beat: Beat = {
    ...master.beats[0]!,
    title: 'Mara enters, and says nothing',
    origin: { authorId: 'jo', at: AT },
    manuscript: {
      elements: [
        { id: newId(), type: 'action', text: 'The roller door screams up.', characterId: null, attributes: {} },
      ],
    },
  };
  return {
    item: item({ kind: 'scene', recordId: unit.id as string, label: unit.title, how: 'replace' }),
    unit,
    beats: [beat],
  };
};

describe('who assembles a master', () => {
  it('is the showrunner’s, and the editor who reads every contribution cannot', () => {
    expect(canCurate('owner')).toBe(true);
    expect(canCurate('editor')).toBe(false);
    expect(canCurate('writer')).toBe(false);
    expect(canCurate(null)).toBe(false);
  });
});

describe('what a contribution offers', () => {
  it('lists its scenes and beats in story order, with whose they are', () => {
    const { file } = makeMaster();
    const offered = curatableFrom(file);
    expect(offered.map((one) => one.kind)).toEqual(['scene', 'beat']);
    expect(offered.every((one) => one.authorId === 'mara')).toBe(true);
  });

  it('counts the words, so an empty beat can be told from a written one', () => {
    const { file, beat } = makeMaster();
    const written = updateBeat(file, beat.id, {
      manuscript: {
        elements: [
          { id: newId(), type: 'action', text: 'The roller door screams up.', characterId: null, attributes: {} },
        ],
      },
    });
    expect(curatableFrom(written).find((one) => one.kind === 'beat')!.words).toBe(5);
  });
});

describe('the merge never rewrites what it drew from', () => {
  it('leaves the master it started from exactly as it was', () => {
    const { file } = makeMaster();
    const before = JSON.stringify(file);
    const merged = applyTray(file, [josPass(file)], { at: AT });
    if ('reason' in merged) throw new Error('it refused');
    expect(JSON.stringify(file)).toBe(before);
  });

  it('leaves the contribution it took exactly as it was', () => {
    const { file } = makeMaster();
    const piece = josPass(file);
    const before = JSON.stringify(piece);
    applyTray(file, [piece], { at: AT });
    expect(JSON.stringify(piece)).toBe(before);
  });
});

describe('taking a scene', () => {
  it('in place of what is there keeps the master’s id, and takes the words', () => {
    const { file, unit } = makeMaster();
    const merged = applyTray(file, [josPass(file)], { at: AT });
    if ('reason' in merged) throw new Error('it refused');

    expect(merged.file.units).toHaveLength(1);
    expect(merged.file.units[0]!.id).toBe(unit.id);
    expect(merged.file.units[0]!.title).toBe('INT. WAREHOUSE - NIGHT (COLDER)');
    expect(merged.file.units[0]!.origin?.authorId).toBe('jo');
    expect(merged.file.beats).toHaveLength(1);
    expect(merged.file.beats[0]!.title).toBe('Mara enters, and says nothing');
  });

  it('alongside it keeps both, with an id of its own — §12’s alternate scenes', () => {
    const { file, unit } = makeMaster();
    const piece = josPass(file);
    const merged = applyTray(file, [{ ...piece, item: { ...piece.item, how: 'add' } }], { at: AT });
    if ('reason' in merged) throw new Error('it refused');

    expect(merged.file.units).toHaveLength(2);
    expect(merged.file.units[0]!.id).toBe(unit.id);
    expect(merged.file.units[1]!.id).not.toBe(unit.id);
    // And its beats are copies too, or editing one would edit the other.
    expect(new Set(merged.file.beats.map((one) => one.id as string)).size).toBe(2);
  });

  it('falls back to alongside when the master does not have that scene at all', () => {
    const { file } = makeMaster();
    const piece = josPass(file);
    const stranger: TrayPiece = {
      ...piece,
      unit: { ...piece.unit!, id: newId() },
      beats: [{ ...piece.beats[0]!, id: newId() }],
    };
    const merged = applyTray(file, [stranger], { at: AT });
    if ('reason' in merged) throw new Error('it refused');
    expect(merged.file.units).toHaveLength(2);
  });
});

describe('taking a beat', () => {
  it('joins the scene it sat in, and the scene now has two authors', () => {
    const { file, unit, beat } = makeMaster();
    const jos: Beat = { ...beat, id: newId(), title: 'The door', origin: { authorId: 'jo', at: AT } };
    const merged = applyTray(
      file,
      [{ item: item({ kind: 'beat', recordId: jos.id as string, label: 'The door', how: 'add' }), unit: null, beats: [jos] }],
      { at: AT },
    );
    if ('reason' in merged) throw new Error('it refused');

    expect(merged.file.beats).toHaveLength(2);
    // The claim §12 makes and the reason this is worth a test: a merged scene
    // has more than one author and says so.
    const row = sequenceOf(merged.file, merged.record).find((one) => one.id === (unit.id as string))!;
    expect([...row.authorIds].sort()).toEqual(['jo', 'mara']);
  });

  it('refuses a beat with no scene to go into, and says what to do', () => {
    const { file, beat } = makeMaster();
    const orphan: Beat = { ...beat, id: newId(), unitId: newId(), title: 'Nowhere' };
    const refused = applyTray(
      file,
      [{ item: item({ kind: 'beat', recordId: orphan.id as string, label: 'Nowhere', how: 'add' }), unit: null, beats: [orphan] }],
      { at: AT },
    );
    expect('reason' in refused && refused.reason).toBe('no_such_scene');
    expect(mergeRefusalText({ reason: 'no_such_scene', label: 'Nowhere' })).toContain('which scene it joins');
  });

  it('goes where the showrunner said, when they said', () => {
    const { file, unit, beat } = makeMaster();
    const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'EXT. DOCKS' });
    const jos: Beat = { ...beat, id: newId(), title: 'The door' };
    const merged = applyTray(
      second.file,
      [
        {
          item: item({
            kind: 'beat',
            recordId: jos.id as string,
            label: 'The door',
            how: 'add',
            intoUnitId: second.unit.id as string,
          }),
          unit: null,
          beats: [jos],
        },
      ],
      { at: AT },
    );
    if ('reason' in merged) throw new Error('it refused');
    const landed = merged.file.beats.find((one) => one.title === 'The door')!;
    expect(landed.unitId).toBe(second.unit.id);
    expect(landed.unitId).not.toBe(unit.id);
  });
});

describe('the merge record', () => {
  it('names every source, and what it became in the master', () => {
    const { file, unit } = makeMaster();
    const merged = applyTray(file, [josPass(file)], { at: AT });
    if ('reason' in merged) throw new Error('it refused');

    expect(merged.record.sources).toHaveLength(1);
    expect(merged.record.sources[0]!.versionId).toBe('v1');
    expect(merged.record.sources[0]!.authorId).toBe('jo');
    expect(merged.record.sources[0]!.becameId).toBe(unit.id as string);
  });

  it('says what it did, in the words a version label wants', () => {
    const record = {
      at: AT,
      sources: [
        { submissionId: 'sub1', versionId: 'v1', authorId: 'jo', kind: 'scene' as const, recordId: 'x', label: 'A', how: 'add' as const, becameId: 'n1' },
        { submissionId: 'sub2', versionId: 'v2', authorId: 'mara', kind: 'beat' as const, recordId: 'y', label: 'B', how: 'add' as const, becameId: 'n2' },
      ],
    };
    expect(describeMasterMerge(record, [JO, MARA])).toBe('2 pieces from Jo Calder, Mara Oyelaran');
    expect(submissionsBehind(record)).toEqual(['sub1', 'sub2']);
  });

  it('refuses an empty tray rather than making a master that changed nothing', () => {
    const { file } = makeMaster();
    const refused = applyTray(file, []);
    expect('reason' in refused && refused.reason).toBe('nothing_in_tray');
  });
});

describe('the preview', () => {
  it('marks what the merge added and what it changed', () => {
    const { file, unit } = makeMaster();
    const piece = josPass(file);
    const merged = applyTray(file, [{ ...piece, item: { ...piece.item, how: 'add' } }], { at: AT });
    if ('reason' in merged) throw new Error('it refused');

    const rows = sequenceOf(merged.file, merged.record);
    expect(rows.find((one) => one.id === (unit.id as string))!.change).toBe(null);
    expect(rows.find((one) => one.id !== (unit.id as string))!.change).toBe('added');
  });

  it('says nothing changed where nothing did', () => {
    const { file } = makeMaster();
    expect(sequenceOf(file).every((row) => row.change === null)).toBe(true);
  });
});

describe('what is still waiting to be curated', () => {
  const sent = (over: Record<string, unknown> = {}) =>
    submissionSchema.parse({
      id: 'sub1', roomId: 'r', versionId: 'v1', authorId: 'jo', kind: 'script',
      createdAt: AT, updatedAt: AT, ...over,
    });

  it('is script work that is neither in the tray nor already decided against', () => {
    const list = [
      sent({ id: 'a' }),
      sent({ id: 'b', kind: 'research' }),
      sent({ id: 'c', state: 'rejected' }),
      sent({ id: 'd', state: 'incorporated' }),
      sent({ id: 'e' }),
    ];
    const tray = [item({ submissionId: 'e' })];
    expect(awaitingCuration(list, tray).map((one) => one.id)).toEqual(['a']);
  });

  it('offers submitted work as well as approved, so looking comes before deciding', () => {
    expect(awaitingCuration([sent({ state: 'submitted' })], []).length).toBe(1);
    expect(awaitingCuration([sent({ state: 'approved' })], []).length).toBe(1);
  });
});
