import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addCharacter,
  addUnit,
  characterMap,
  charactersInScenes,
  createProjectFile,
  describeRange,
  isWholeScript,
  relate,
  scenesForRange,
  togetherInScript,
  unitsInRange,
  updateBeat,
  type CharacterId,
  type ProjectFile,
} from '../index.js';

/**
 * The scene-range filter on the character map (addendum 08 §12, §11's first
 * leftover).
 *
 * A stretch of the story is its own question — *who is in act two, and how do
 * they connect there* — and the claim worth holding is what a range is allowed
 * to touch: **it narrows what the script says and never what a writer said.**
 * A relationship has no scene number, so deciding when one began would be
 * inventing the answer.
 */

const cue = (name: string) => ({
  id: crypto.randomUUID(),
  type: 'character' as const,
  text: name,
  characterId: null,
  attributes: {},
});

/**
 * Four scenes written on top of the one a new project starts with. MARA and
 * DEAKINS talk in the first two of them; MARA and ROURKE in the last two; SAL
 * is in the last one only.
 *
 * `at` turns *my first scene* into the position a range means, because a new
 * project already has a scene and hard-coding 1 would be testing that rather
 * than the range.
 */
const script = () => {
  let file: ProjectFile = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  const ids: Record<string, CharacterId> = {};
  for (const name of ['MARA', 'DEAKINS', 'ROURKE', 'SAL']) {
    file = addCharacter(file, { name });
    ids[name] = file.characters[file.characters.length - 1]!.id;
  }

  const laneId = file.lanes[0]!.id;
  const write = (title: string, who: string[]) => {
    const scene = addUnit(file, { laneId, title });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: { elements: who.map((name) => cue(name)) },
    });
  };

  const before = scenesForRange(file).length;
  write('INT. DINER - NIGHT', ['MARA', 'DEAKINS']);
  write('INT. CAR - NIGHT', ['MARA', 'DEAKINS']);
  write('EXT. LOT - DAY', ['MARA', 'ROURKE']);
  write('INT. OFFICE - DAY', ['MARA', 'ROURKE', 'SAL']);

  /** The position of my nth scene, counting from one. */
  const at = (nth: number) => before + nth;
  return { file, ids, at, scenes: scenesForRange(file).length };
};

const named = (file: ProjectFile, map: ReturnType<typeof characterMap>) =>
  map.nodes.map((node) => node.name).sort();

describe('what a range is', () => {
  it('numbers the scenes as a writer counts them, from one', () => {
    const { file, at } = script();
    const scenes = scenesForRange(file);
    expect(scenes[0]!.position).toBe(1);
    expect(scenes.map((scene) => scene.position)).toEqual(scenes.map((_, index) => index + 1));
    expect(scenes[at(1) - 1]!.title).toBe('INT. DINER - NIGHT');
  });

  it('is inclusive at both ends', () => {
    // *Twelve to thirty* means both of them.
    const { file, at } = script();
    expect(unitsInRange(file, { from: at(1), to: at(2) })!.size).toBe(2);
  });

  it('reads a backwards range forwards rather than refusing it', () => {
    // A writer who picks 4 and then 2 has said which stretch they mean, and
    // *nothing matches that* would be being right at their expense.
    const { file, at } = script();
    expect(unitsInRange(file, { from: at(3), to: at(1) })).toEqual(
      unitsInRange(file, { from: at(1), to: at(3) }),
    );
  });

  it('knows when a range is the whole script, and so not worth applying', () => {
    const { file, scenes } = script();
    expect(isWholeScript(file, null)).toBe(true);
    expect(isWholeScript(file, { from: 1, to: scenes })).toBe(true);
    expect(isWholeScript(file, { from: 2, to: scenes })).toBe(false);
  });

  it('says what it is showing, so a filtered map admits it is filtered', () => {
    const { file } = script();
    expect(describeRange(file, { from: 2, to: 3 })).toBe('Scenes 2 to 3');
    expect(describeRange(file, { from: 3, to: 3 })).toBe('Scene 3 alone');
    expect(describeRange(file, null)).toBe('The whole script');
    expect(describeRange(file, { from: 3, to: 2 })).toBe('Scenes 2 to 3');
  });
});

describe('who is in a stretch', () => {
  it('counts somebody as in it because they speak there', () => {
    // The same rule as the lane filter, and as everything else in the module.
    const { file, ids, at } = script();
    expect(charactersInScenes(file, { from: at(1), to: at(2) })).toEqual([
      ids['MARA']!,
      ids['DEAKINS']!,
    ]);
  });

  it('leaves out somebody who is not in it', () => {
    const { file, ids, at } = script();
    expect(charactersInScenes(file, { from: at(1), to: at(2) })).not.toContain(ids['ROURKE']!);
  });

  it('returns them in cast order rather than the order they happen to speak', () => {
    const { file, ids, at } = script();
    expect(charactersInScenes(file, { from: at(3), to: at(4) })).toEqual([
      ids['MARA']!,
      ids['ROURKE']!,
      ids['SAL']!,
    ]);
  });
});

describe('what the script says inside a stretch', () => {
  it('counts only the scenes in the range', () => {
    const { file, ids, at } = script();
    const whole = togetherInScript(file);
    const early = togetherInScript(file, { from: at(1), to: at(2) });

    const pair = (rows: typeof whole, one: CharacterId, two: CharacterId) =>
      rows.find(
        (row) =>
          (row.a === one && row.b === two) || (row.a === two && row.b === one),
      );

    expect(pair(whole, ids['MARA']!, ids['DEAKINS']!)!.scenes).toBe(2);
    expect(pair(early, ids['MARA']!, ids['DEAKINS']!)!.scenes).toBe(2);
    expect(pair(early, ids['MARA']!, ids['ROURKE']!)).toBeUndefined();
  });

  it('thins a line that only partly falls inside the range', () => {
    const { file, ids, at } = script();
    const late = togetherInScript(file, { from: at(4), to: at(4) });
    const found = late.find(
      (row) =>
        (row.a === ids['MARA']! && row.b === ids['ROURKE']!) ||
        (row.a === ids['ROURKE']! && row.b === ids['MARA']!),
    );
    expect(found!.scenes).toBe(1);
  });
});

describe('the map through a range', () => {
  it('draws only the people who are in it', () => {
    const { file, at } = script();
    expect(named(file, characterMap({ file }))).toEqual(['DEAKINS', 'MARA', 'ROURKE', 'SAL']);
    expect(named(file, characterMap({ file, range: { from: at(1), to: at(2) } }))).toEqual([
      'DEAKINS',
      'MARA',
    ]);
  });

  it('keeps a named relationship between two people who are both in it', () => {
    // A relationship has no scene number. Two people in the stretch keep their
    // line whether or not the stretch is where it was formed — the alternative
    // is the map inventing a date the record does not carry.
    const { file, ids, at } = script();
    const joined = relate(file, {
      fromCharacterId: ids['MARA']!,
      toCharacterId: ids['DEAKINS']!,
      kind: 'rival',
    });

    const map = characterMap({ file: joined.file, range: { from: at(1), to: at(2) } });
    expect(map.edges).toHaveLength(1);
    // Counted across both directions rather than asserted on `forward`: which
    // side of an edge a reading lands on depends on which of two random ids
    // sorts first, and a test that depends on that passes four times in five.
    const edge = map.edges[0]!;
    expect(edge.forward.length + edge.back.length).toBe(1);
  });

  it('drops a relationship whose other end is not in the stretch', () => {
    // Not because the relationship stopped being true — because the person is
    // not on this map, and a line to nowhere is not a reading of anything.
    const { file, ids, at } = script();
    const joined = relate(file, {
      fromCharacterId: ids['MARA']!,
      toCharacterId: ids['ROURKE']!,
      kind: 'rival',
    });

    const map = characterMap({ file: joined.file, range: { from: at(1), to: at(2) } });
    expect(
      map.edges.some((edge) => edge.a === ids['ROURKE']! || edge.b === ids['ROURKE']!),
    ).toBe(false);
    // The line the script itself draws in that stretch is still there, which is
    // how you can tell the map was narrowed rather than emptied.
    expect(map.edges).toHaveLength(1);
    expect(map.edges[0]!.together!.scenes).toBe(2);
  });

  it('is ignored where it covers the whole script anyway', () => {
    const { file, scenes } = script();
    expect(characterMap({ file, range: { from: 1, to: scenes } })).toEqual(characterMap({ file }));
  });

  it('takes both filters at once, and wants the people who pass both', () => {
    // *In this lane* and *in this stretch* are different questions, and a
    // writer asking both means the intersection.
    const { file, ids, at } = script();
    const map = characterMap({
      file,
      among: [ids['MARA']!, ids['ROURKE']!],
      range: { from: at(1), to: at(2) },
    });
    expect(map.nodes.map((node) => node.name)).toEqual(['MARA']);
  });
});
