// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addBeat, addUnit, createProjectFile, ROOM_COLOURS, type ProjectFile } from '@vcwriter/domain';
import { createCloudBridge, roomFromLocation, versionFromLocation } from '../cloud-bridge';

/**
 * The bridge over a room, where the writer's name gets put on their work
 * (addendum 07 §6).
 *
 * The rule with a sharp edge: **what was in the draft when it opened is not
 * this writer's**. A branch taken from the master carries somebody else's
 * scenes, and a bridge that signed everything it could see would hand one
 * writer the credit for the room's whole script.
 */

const ROOM = '11111111-2222-3333-4444-555555555555';
const BRANCH = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VERSION = 'bbbbbbbb-cccc-dddd-eeee-ffffffffffff';

const opened = (): ProjectFile => {
  const empty = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const bare: ProjectFile = { ...empty, units: [], beats: [] };
  const scene = addUnit(bare, { laneId: bare.lanes[0]!.id, title: 'INT. WAREHOUSE - NIGHT' });
  return addBeat(scene.file, { unitId: scene.unit.id, title: 'Mara enters' }).file;
};

const answering = (master: ProjectFile) => {
  const saved: unknown[] = [];
  const fetcher = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    if (url.endsWith('/identity')) {
      return {
        ok: true,
        json: async () => ({
          roomId: ROOM,
          roomName: 'Blackout',
          role: 'writer',
          you: {
            id: 's1',
            roomId: ROOM,
            userId: 'jo',
            email: 'jo@example.test',
            displayName: 'Jo Calder',
            colour: ROOM_COLOURS[1],
            state: 'active',
            invitedAt: '2026-09-01T00:00:00.000Z',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
          },
          seats: [],
          showing: 'contribution',
        }),
      };
    }
    if (url.includes('/versions/')) {
      return {
        ok: true,
        json: async () => ({
          version: {
            id: VERSION,
            roomId: ROOM,
            branchId: BRANCH,
            authorId: 'mara',
            kind: 'snapshot',
            label: 'Docks rewrite',
            contentHash: 'h7',
            createdAt: '2026-09-10T10:00:00.000Z',
          },
          file: master,
          author: {
            id: 's2',
            roomId: ROOM,
            userId: 'mara',
            email: '',
            displayName: 'Mara Okonjo',
            colour: ROOM_COLOURS[3],
            state: 'active',
            invitedAt: '2026-09-01T00:00:00.000Z',
            createdAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-01T00:00:00.000Z',
          },
          title: 'Mara Okonjo — Docks rewrite',
        }),
      };
    }
    if (init?.method === 'PUT') {
      saved.push(JSON.parse(init.body ?? '{}'));
      return { ok: true, json: async () => ({ contentHash: 'h1', written: true }) };
    }
    return {
      ok: true,
      json: async () => ({ branch: { id: BRANCH, name: 'Jo’s draft' }, file: master, contentHash: 'h0' }),
    };
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetcher;
  return { saved };
};

afterEach(() => vi.restoreAllMocks());

describe('the bridge over a room', () => {
  it('takes the room out of the address, and refuses anything that is not one', () => {
    expect(roomFromLocation(`?room=${ROOM}`)).toBe(ROOM);
    expect(roomFromLocation('?room=nonsense')).toBeNull();
    expect(roomFromLocation('')).toBeNull();
  });

  it('signs what this writer adds and leaves the master’s scenes alone', async () => {
    const master = opened();
    answering(master);
    const bridge = createCloudBridge(ROOM);

    const open = await bridge.openProject();
    expect(open.ok).toBe(true);
    const file = open.data!.file as ProjectFile;

    const made = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. CAR - DAY' });
    const signed = bridge.signWork!(made.file);

    expect(signed.units.find((unit) => unit.id === made.unit.id)?.origin?.authorId).toBe('jo');
    // The scene that came from the master is nobody's here.
    expect(signed.units.find((unit) => unit.id !== made.unit.id)?.origin).toBeNull();
  });

  it('never sends an unsigned addition to the room, even if nothing asked it to sign', async () => {
    const master = opened();
    const { saved } = answering(master);
    const bridge = createCloudBridge(ROOM);

    const open = await bridge.openProject();
    const file = open.data!.file as ProjectFile;
    const made = addBeat(file, { unitId: file.units[0]!.id, title: 'The case is empty' });

    await bridge.saveProject({ path: BRANCH, file: made.file, previousHash: 'h0' });

    const sent = (saved[0] as { file: ProjectFile }).file;
    expect(sent.beats.find((beat) => beat.id === made.beat.id)?.origin?.authorId).toBe('jo');
  });

  it('hands back the room’s seats for the colours to be read through', async () => {
    answering(opened());
    const bridge = createCloudBridge(ROOM);

    const identity = await bridge.roomIdentity!();
    expect(identity.ok).toBe(true);
    expect(identity.data?.you?.userId).toBe('jo');
    expect(identity.data?.showing).toBe('contribution');
  });
});

describe('a window opened on a recorded version (§13, stage 5)', () => {
  it('takes the version out of the address, and refuses anything that is not one', () => {
    expect(versionFromLocation(`?room=${ROOM}&version=${VERSION}`)).toBe(VERSION);
    expect(versionFromLocation(`?room=${ROOM}`)).toBeNull();
    expect(versionFromLocation('?version=latest')).toBeNull();
  });

  it('wears the author’s seat rather than the reader’s', async () => {
    answering(opened());
    const bridge = createCloudBridge(ROOM, VERSION);

    const open = await bridge.openProject();
    expect(open.ok).toBe(true);

    const identity = await bridge.roomIdentity!();
    expect(identity.data?.you?.userId).toBe('jo');
    expect(identity.data?.author?.userId).toBe('mara');
    expect(identity.data?.readOnly).toBe(true);
    expect(identity.data?.label).toBe('Mara Okonjo — Docks rewrite');
  });

  it('refuses to save, rather than letting autosave find out a minute later', async () => {
    const { saved } = answering(opened());
    const bridge = createCloudBridge(ROOM, VERSION);
    const open = await bridge.openProject();

    const result = await bridge.saveProject({ path: VERSION, file: open.data!.file, previousHash: 'h7' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('cannot be changed');
    expect(saved).toEqual([]);
  });

  it('signs nothing: nobody is writing here', async () => {
    answering(opened());
    const bridge = createCloudBridge(ROOM, VERSION);
    const open = await bridge.openProject();
    const file = open.data!.file as ProjectFile;

    const made = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. CAR - DAY' });
    expect(bridge.signWork!(made.file)).toBe(made.file);
  });
});
