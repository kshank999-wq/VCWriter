import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addUnit,
  characterMap,
  charactersInLane,
  createProjectFile,
  edgeLabel,
  relate,
  togetherInScript,
  updateBeat,
  type CharacterId,
  type ProjectFile,
} from '../index.js';

/**
 * The relationship mind map (addendum 08, stage 8 — §12).
 *
 * **Nothing about this is stored.** The layout is computed from the
 * relationships every time, so a new character appears without anybody dragging
 * one and a deleted relationship closes the gap by itself. The tests hold the
 * two claims that follow from that: the same project draws the same picture,
 * and one pair is always one line.
 */

const line = (type: 'action' | 'character', text: string) => ({
  id: crypto.randomUUID(),
  type,
  text,
  characterId: null,
  attributes: {},
});

const company = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const names = ['MARA', 'DEAKINS', 'ROURKE', 'SAL'];
  const ids: Record<string, CharacterId> = {};
  for (const name of names) {
    file = addCharacter(file, { name });
    ids[name] = file.characters[file.characters.length - 1]!.id;
  }
  return { file, ids };
};

describe('who is on it and where', () => {
  it('draws the same picture for the same project, every time', () => {
    // Laid out in name order round the circle, so nothing moves between one
    // opening and the next.
    const { file } = company();
    const once = characterMap({ file });
    const twice = characterMap({ file });

    expect(once.nodes.map((node) => node.name)).toEqual(['DEAKINS', 'MARA', 'ROURKE', 'SAL']);
    expect(once).toEqual(twice);
  });

  it('keeps everybody inside the picture', () => {
    const { file, ids } = company();
    const joined = relate(file, { fromCharacterId: ids['MARA']!, toCharacterId: ids['SAL']!, kind: 'rival' });
    for (const node of characterMap({ file: joined.file, focusId: ids['MARA']! , depth: 2 }).nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(1);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(1);
    }
  });

  it('shows somebody nothing joins to, because that is a fact about the story', () => {
    const { file, ids } = company();
    const joined = relate(file, { fromCharacterId: ids['MARA']!, toCharacterId: ids['SAL']!, kind: 'rival' });

    expect(characterMap({ file: joined.file }).nodes).toHaveLength(4);
    // Unless a big cast asks for quiet.
    expect(
      characterMap({ file: joined.file, includeUnconnected: false }).nodes.map((node) => node.name).sort(),
    ).toEqual(['MARA', 'SAL']);
  });
});

describe('one pair, one line', () => {
  it('carries both readings on a single edge', () => {
    // §3.1 promised this is how the map would show two people reading each
    // other differently: one line, a label at each end.
    const { file, ids } = company();
    const one = relate(file, {
      fromCharacterId: ids['MARA']!,
      toCharacterId: ids['DEAKINS']!,
      kind: 'friend',
    });
    const two = relate(one.file, {
      fromCharacterId: ids['DEAKINS']!,
      toCharacterId: ids['MARA']!,
      kind: 'dependency',
    });

    const map = characterMap({ file: two.file });
    expect(map.edges).toHaveLength(1);
    const edge = map.edges[0]!;
    expect(edge.forward).toHaveLength(1);
    expect(edge.back).toHaveLength(1);
    expect([edgeLabel(edge.forward), edgeLabel(edge.back)].sort()).toEqual(['Dependency', 'Friend']);
  });

  it('puts several readings of one pair on the same line', () => {
    const { file, ids } = company();
    const one = relate(file, { fromCharacterId: ids['MARA']!, toCharacterId: ids['SAL']!, kind: 'rival' });
    const two = relate(one.file, {
      fromCharacterId: ids['MARA']!,
      toCharacterId: ids['SAL']!,
      kind: 'family',
    });

    const map = characterMap({ file: two.file });
    expect(map.edges).toHaveLength(1);
    // Which end of the pair is `a` is decided by id order, so the readings are
    // asked for without assuming which way round they came out.
    const edge = map.edges[0]!;
    expect(edgeLabel(edge.forward.length > 0 ? edge.forward : edge.back)).toBe('Rival, Family');
  });

  it('drops a line whose kind is filtered out', () => {
    const { file, ids } = company();
    const one = relate(file, { fromCharacterId: ids['MARA']!, toCharacterId: ids['SAL']!, kind: 'rival' });
    const two = relate(one.file, {
      fromCharacterId: ids['ROURKE']!,
      toCharacterId: ids['SAL']!,
      kind: 'family',
    });

    const map = characterMap({ file: two.file, kinds: ['family'] });
    expect(map.edges).toHaveLength(1);
    const edge = map.edges[0]!;
    expect(edgeLabel(edge.forward.length > 0 ? edge.forward : edge.back)).toBe('Family');
  });
});

describe('focusing on one person and expanding outward', () => {
  it('puts them in the middle and their people around them', () => {
    const { file, ids } = company();
    const one = relate(file, { fromCharacterId: ids['MARA']!, toCharacterId: ids['SAL']!, kind: 'rival' });
    const two = relate(one.file, {
      fromCharacterId: ids['SAL']!,
      toCharacterId: ids['ROURKE']!,
      kind: 'family',
    });

    const near = characterMap({ file: two.file, focusId: ids['MARA']!, depth: 1 });
    expect(near.nodes.map((node) => node.name).sort()).toEqual(['MARA', 'SAL']);
    const middle = near.nodes.find((node) => node.name === 'MARA')!;
    expect(middle.ring).toBe(0);
    expect(middle.x).toBeCloseTo(0.5);
    expect(middle.y).toBeCloseTo(0.5);

    const far = characterMap({ file: two.file, focusId: ids['MARA']!, depth: 2 });
    expect(far.nodes.map((node) => node.name).sort()).toEqual(['MARA', 'ROURKE', 'SAL']);
    expect(far.nodes.find((node) => node.name === 'ROURKE')!.ring).toBe(2);
  });

  it('reaches somebody through a relationship pointing the other way', () => {
    // The graph is walked in both directions: being read by somebody connects
    // you to them just as much as reading them.
    const { file, ids } = company();
    const one = relate(file, {
      fromCharacterId: ids['SAL']!,
      toCharacterId: ids['MARA']!,
      kind: 'enemy',
    });
    const map = characterMap({ file: one.file, focusId: ids['MARA']!, depth: 1 });
    expect(map.nodes.map((node) => node.name).sort()).toEqual(['MARA', 'SAL']);
  });
});

describe('filtering by a plot lane', () => {
  it('counts somebody as in a lane because they speak there', () => {
    const { file, ids } = company();
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
    const written = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [line('character', 'MARA'), line('action', 'DEAKINS is named but silent.')] },
    });

    const inLane = charactersInLane(written, file.lanes[0]!.id);
    expect(inLane.map((id) => id as string)).toEqual([ids['MARA'] as string]);

    const map = characterMap({ file: written, among: inLane });
    expect(map.nodes.map((node) => node.name)).toEqual(['MARA']);
  });
});

/**
 * What the script says by itself (addendum 08, stage 12).
 *
 * The map used to open empty on a finished screenplay, because it drew only
 * what somebody had written down. The manuscript already knows who keeps
 * turning up together, and **that** is a reading like every other one in this
 * module: stored nowhere, so cutting the scene thins the line with nothing
 * running.
 *
 * The line it must not cross is naming what it found. Nine scenes together is
 * a fact; *rivals* is the writer's.
 */
describe('the lines the script draws', () => {
  /** A scene, with one beat per set of cues given. */
  const scened = (file: ProjectFile, title: string, beats: string[][]) => {
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title });
    let next = scene.file;
    for (const cues of beats) {
      const beat = addBeat(next, { unitId: scene.unit.id, title: 'A beat' });
      next = updateBeat(beat.file, beat.beat.id, {
        manuscript: { elements: cues.map((cue) => line('character', cue)) },
      });
    }
    return next;
  };

  it('counts the scenes two people speak in, and the beats inside them', () => {
    const { file, ids } = company();
    const written = scened(scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS'], ['MARA', 'DEAKINS']]), 'EXT. LOT - LATER', [
      ['MARA', 'DEAKINS'],
    ]);

    const pairs = togetherInScript(written);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.scenes).toBe(2);
    expect(pairs[0]!.beats).toBe(3);
    expect([pairs[0]!.a as string, pairs[0]!.b as string].sort()).toEqual(
      [ids['MARA'] as string, ids['DEAKINS'] as string].sort(),
    );
  });

  it('does not count somebody who is only named in the action, and that is deliberate', () => {
    // Finding them would mean matching names in prose, where a name is as often
    // somebody being talked about as somebody being there.
    const { file } = company();
    const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
    const written = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: [line('character', 'MARA'), line('action', 'DEAKINS watches from the booth.')] },
    });

    expect(togetherInScript(written)).toHaveLength(0);
  });

  it('draws a line for a pair nobody has written a relationship for', () => {
    const { file } = company();
    const written = scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS']]);
    const map = characterMap({ file: written });

    const edge = map.edges.find((one) => one.together !== null)!;
    expect(edge.together!.scenes).toBe(1);
    // And it says nothing about what the relationship is, because it cannot know.
    expect(edge.forward).toHaveLength(0);
    expect(edge.back).toHaveLength(0);
  });

  it('thins by itself when the writing goes, because nothing was stored', () => {
    const { file } = company();
    const written = scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS']]);
    expect(characterMap({ file: written }).edges).toHaveLength(1);

    const cut: ProjectFile = { ...written, beats: [] };
    expect(characterMap({ file: cut }).edges).toHaveLength(0);
  });

  it('keeps one line for a pair who are both written down and in scenes together', () => {
    const { file, ids } = company();
    const written = scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS']]);
    const joined = relate(written, {
      fromCharacterId: ids['MARA']!,
      toCharacterId: ids['DEAKINS']!,
      kind: 'rival',
    });

    const map = characterMap({ file: joined.file });
    expect(map.edges).toHaveLength(1);
    expect(map.edges[0]!.together!.scenes).toBe(1);
    expect(edgeLabel(map.edges[0]!.forward) + edgeLabel(map.edges[0]!.back)).toContain('Rival');
  });

  it('drops the script lines when a kind is asked for, since an unnamed line is not one', () => {
    const { file, ids } = company();
    const written = scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS'], ['ROURKE', 'SAL']]);
    const joined = relate(written, {
      fromCharacterId: ids['MARA']!,
      toCharacterId: ids['DEAKINS']!,
      kind: 'rival',
    });

    const map = characterMap({ file: joined.file, kinds: ['rival'] });
    expect(map.edges).toHaveLength(1);
    expect(map.edges[0]!.together).toBeNull();
  });

  it('can be turned off, for a script where every line is noise', () => {
    const { file } = company();
    const written = scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS']]);
    expect(characterMap({ file: written, fromScript: false }).edges).toHaveLength(0);
  });

  it('lets focus expand through a line the script drew', () => {
    // Otherwise focus is useless until somebody has written relationships down,
    // which is the state every real project starts in.
    const { file, ids } = company();
    const written = scened(file, 'INT. DINER - NIGHT', [['MARA', 'DEAKINS']]);
    const map = characterMap({ file: written, focusId: ids['MARA']!, depth: 1 });

    expect(map.nodes.map((node) => node.name).sort()).toEqual(['DEAKINS', 'MARA']);
  });
});
