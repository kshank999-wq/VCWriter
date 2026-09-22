import { describe, expect, it } from 'vitest';
import {
  destroyThread,
  addBeat,
  addMoment,
  addThread,
  addUnit,
  captureToThread,
  createProjectFile,
  dependOn,
  dependenciesIn,
  describeThread,
  describeThreads,
  fromRows,
  momentsOf,
  moveUnit,
  removeMoment,
  storyMap,
  threadsInOrder,
  toRows,
  unitsInStoryOrder,
  updateBeat,
  updateThread,
  type ManuscriptElementId,
  type ProjectFile,
  type StoryThreadId,
} from '../index.js';

/**
 * Narrative threads and the story map (addendum 15).
 *
 * Three claims. **Only the thread is stored** — a moment is a usage link and a
 * dependency is a story link, both of which already existed. **Position is a
 * reading**, so moving a scene moves every node with nothing run. And
 * **nothing infers a cause**: a dependency thread draws only the arrows the
 * writer drew.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as ManuscriptElementId,
  type: 'action' as const,
  text,
  characterId: null,
  attributes: {},
});

/**
 * A script of `scenes` scenes, each with one beat and one line.
 *
 * `createProjectFile` starts with a scene of its own, so `offset` is where the
 * ones this made begin — the tests index through `sceneAt` rather than
 * counting, so a starter scene cannot quietly shift an expectation.
 */
const script = (scenes: number) => {
  let file: ProjectFile = createProjectFile({ title: 'The Key', format: 'screenplay' });
  const trackId = file.tracks[0]!.id;
  const offset = unitsInStoryOrder(file).length;
  for (let at = 0; at < scenes; at += 1) {
    const scene = addUnit(file, { trackId, title: `Scene ${at + 1}` });
    const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'a beat' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para(`Line ${at + 1}.`)] } });
  }
  return { file, offset, total: offset + scenes };
};

/** The beat of the nth scene this fixture made. */
const beatAt = (file: ProjectFile, sceneIndex: number, offset = 1) => {
  const unitId = unitsInStoryOrder(file)[sceneIndex + offset]!.id;
  return file.beats.find((one) => one.unitId === unitId)!;
};

describe('a thread', () => {
  it('is the only thing stored: its moments are usage links', () => {
    const { file } = script(3);
    const made = addThread(file, { name: 'The key' });
    let current = made.file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 0).id }).file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 2).id }).file;

    expect(current.threads).toHaveLength(1);
    // No node table: the moments are usage links, with the module's owner kind.
    expect(current.usageLinks.filter((one) => one.ownerKind === 'thread')).toHaveLength(2);
  });

  it('reads its moments in story order, whatever order they were marked in', () => {
    const { file, offset } = script(3);
    const made = addThread(file, { name: 'The key' });
    let current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 2).id }).file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 0).id }).file;

    expect(momentsOf(current, made.thread.id).map((one) => one.unitIndex)).toEqual([offset, offset + 2]);
  });

  it('follows a scene that moves, with nothing stored to update', () => {
    const { file, offset, total } = script(3);
    const made = addThread(file, { name: 'The key' });
    const beat = beatAt(made.file, 0);
    const current = addMoment(made.file, made.thread.id, { beatId: beat.id }).file;
    expect(momentsOf(current, made.thread.id)[0]!.unitIndex).toBe(offset);

    // The writer drags that scene to the end. §13: the node repositions itself,
    // because nothing ever held its position.
    const moved = moveUnit(current, {
      unitId: beat.unitId,
      toTrackId: current.tracks[0]!.id,
      index: total - 1,
    });
    expect(momentsOf(moved, made.thread.id)[0]!.unitIndex).toBe(total - 1);
  });

  it('keeps a moment whose writing was cut, struck through rather than dropped', () => {
    const { file } = script(2);
    const made = addThread(file, { name: 'The key' });
    const current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 0).id }).file;

    const withoutBeat = { ...current, beats: current.beats.filter((one) => one.id !== beatAt(current, 0).id) };
    const moments = momentsOf(withoutBeat, made.thread.id);
    expect(moments).toHaveLength(1);
    expect(moments[0]!.resolved).toBe(false);
    expect(moments[0]!.where).toBe('The writing it was on has gone');
  });

  it('says a thread of one is thin, and does not refuse it', () => {
    const { file } = script(2);
    const made = addThread(file, { name: 'The key' });
    const current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 0).id }).file;

    expect(describeThread(current, current.threads[0]!)).toMatch(/One moment\. A thread wants two\./);
    expect(threadsInOrder(current)).toHaveLength(1);
  });

  it('takes its moments and its dependencies with it when it goes', () => {
    const { file } = script(3);
    const made = addThread(file, { name: 'The key', relationship: 'dependency' });
    let current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 0).id }).file;
    const first = current.usageLinks[0]!.id as string;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 2).id }).file;
    const second = current.usageLinks[1]!.id as string;
    current = dependOn(current, second, first);
    expect(current.links).toHaveLength(1);

    const after = destroyThread(current, made.thread.id);
    expect(after.threads).toHaveLength(0);
    expect(after.usageLinks.filter((one) => one.ownerKind === 'thread')).toHaveLength(0);
    expect(after.links).toHaveLength(0);
  });
});

describe('dependency', () => {
  const built = () => {
    const { file } = script(3);
    const made = addThread(file, { name: 'The gun', relationship: 'dependency' });
    let current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 0).id }).file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 1).id }).file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 2).id }).file;
    const nodes = current.usageLinks.filter((one) => one.ownerKind === 'thread').map((one) => one.id as string);
    return { file: current, threadId: made.thread.id as StoryThreadId, nodes };
  };

  it('draws nothing until the writer says what relies on what', () => {
    const { file, threadId } = built();
    const row = storyMap(file).tracks.find((track) => track.id === 'links')!.rows[0]!;
    // Chronology is not causality (§5.2).
    expect(row.edges).toHaveLength(0);
    expect(describeThread(file, file.threads[0]!)).toMatch(/the order alone is not a cause/);
  });

  it('draws the arrow the writer drew, from what came first', () => {
    const { file, threadId, nodes } = built();
    const current = dependOn(file, nodes[2]!, nodes[0]!);

    expect(dependenciesIn(current, threadId)).toEqual([{ dependent: nodes[2], required: nodes[0] }]);
    const row = storyMap(current).tracks.find((track) => track.id === 'links')!.rows[0]!;
    expect(row.edges).toHaveLength(1);
    // The arrow travels the way the story does.
    expect(row.edges[0]).toMatchObject({ from: nodes[0], to: nodes[2], relationship: 'dependency' });
  });

  it('drops a dependency whose moment has been taken out of the thread', () => {
    const { file, threadId, nodes } = built();
    let current = dependOn(file, nodes[2]!, nodes[0]!);
    current = removeMoment(current, nodes[0]!);

    expect(dependenciesIn(current, threadId)).toEqual([]);
    expect(current.links).toHaveLength(0);
  });

  it('joins a sequence thread in script order, and stores none of it', () => {
    const { file } = script(3);
    const made = addThread(file, { name: 'The key' });
    let current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 2).id }).file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 0).id }).file;

    const row = storyMap(current).tracks.find((track) => track.id === 'links')!.rows[0]!;
    expect(row.edges).toHaveLength(1);
    expect(row.edges[0]!.relationship).toBe('sequence');
    // Nothing about the order is in the document.
    expect(current.links).toHaveLength(0);
  });
});

describe('from the writing', () => {
  it('makes the thread, marks the moment and keeps the note in one act', () => {
    const { file } = script(2);
    const beat = beatAt(file, 0);
    const made = captureToThread(file, {
      beatId: beat.id,
      name: 'The key',
      note: 'She pockets it without looking',
    });

    expect(made.thread!.name).toBe('The key');
    expect(made.node!.note).toBe('She pockets it without looking');
    expect(momentsOf(made.file, made.thread!.id)).toHaveLength(1);
  });

  it('adds to a thread that already exists rather than making a second', () => {
    const { file } = script(2);
    const first = captureToThread(file, { beatId: beatAt(file, 0).id, name: 'The key' });
    const second = captureToThread(first.file, {
      beatId: beatAt(first.file, 1).id,
      threadId: first.thread!.id,
    });

    expect(second.file.threads).toHaveLength(1);
    expect(momentsOf(second.file, first.thread!.id)).toHaveLength(2);
  });

  it('keeps nothing at all when the moment cannot be marked', () => {
    const { file } = script(1);
    const made = captureToThread(file, {
      beatId: 'not-a-beat' as never,
      name: 'The key',
    });
    // No half-made thread left in the beat the writer is looking at.
    expect(made.file).toBe(file);
    expect(made.thread).toBeNull();
    expect(made.file.threads ?? []).toHaveLength(0);
  });
});

describe('the map', () => {
  it('draws a scene per unit, numbered from one', () => {
    const { file, total } = script(3);
    const map = storyMap(file);
    expect(map.scenes).toHaveLength(total);
    expect(map.scenes.map((scene) => scene.number)).toEqual(
      Array.from({ length: total }, (_one, at) => at + 1),
    );
  });

  it('shows only the tracks asked for', () => {
    const { file } = script(2);
    const map = storyMap(file, { tracks: ['links', 'setups'] });
    expect(map.tracks.map((track) => track.id)).toEqual(['links', 'setups']);
  });

  it('isolates one row and says how many it put away', () => {
    const { file } = script(3);
    let current = addThread(file, { name: 'The key' }).file;
    const key = current.threads[0]!.id;
    current = addMoment(current, key, { beatId: beatAt(current, 0).id }).file;
    current = addMoment(current, key, { beatId: beatAt(current, 2).id }).file;

    const second = addThread(current, { name: 'The letter' });
    current = addMoment(second.file, second.thread.id, { beatId: beatAt(second.file, 1).id }).file;

    const all = storyMap(current);
    expect(all.tracks.find((track) => track.id === 'links')!.rows).toHaveLength(2);

    const one = storyMap(current, { only: [{ trackId: 'links', sourceId: key as string }] });
    expect(one.tracks.find((track) => track.id === 'links')!.rows.map((row) => row.title)).toEqual(['The key']);
    expect(one.hidden).toBeGreaterThan(0);
  });

  it('narrows to a scene range without changing what exists', () => {
    const { file, total } = script(5);
    let current = addThread(file, { name: 'Early' }).file;
    const early = current.threads[0]!.id;
    current = addMoment(current, early, { beatId: beatAt(current, 0).id }).file;

    const late = addThread(current, { name: 'Late' });
    current = addMoment(late.file, late.thread.id, { beatId: beatAt(late.file, 4).id }).file;

    // The last two scenes, as a writer numbers them.
    const narrowed = storyMap(current, { range: { from: total - 1, to: total } });
    expect(narrowed.tracks.find((track) => track.id === 'links')!.rows.map((row) => row.title)).toEqual(['Late']);
    // A range narrows what is drawn and never what exists.
    expect(narrowed.scenes).toHaveLength(total);
    expect(current.threads).toHaveLength(2);
  });
});

describe('the round trip', () => {
  it('keeps a thread, its moments and its dependency through sync', () => {
    const { file } = script(3);
    const made = addThread(file, { name: 'The key', description: 'It opens the door', relationship: 'dependency' });
    let current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 0).id, note: 'Found' }).file;
    current = addMoment(current, made.thread.id, { beatId: beatAt(current, 2).id }).file;
    const nodes = current.usageLinks.filter((one) => one.ownerKind === 'thread').map((one) => one.id as string);
    current = dependOn(current, nodes[1]!, nodes[0]!);

    const back = fromRows(toRows(current));
    expect(back.threads[0]!.name).toBe('The key');
    expect(back.threads[0]!.relationship).toBe('dependency');
    expect(momentsOf(back, back.threads[0]!.id)).toHaveLength(2);
    expect(momentsOf(back, back.threads[0]!.id)[0]!.node.note).toBe('Found');
    expect(dependenciesIn(back, back.threads[0]!.id)).toHaveLength(1);
  });
});

describe('the line', () => {
  it('counts the threads and the thin ones', () => {
    const { file } = script(3);
    let current = addThread(file, { name: 'The key' }).file;
    const key = current.threads[0]!.id;
    current = addMoment(current, key, { beatId: beatAt(current, 0).id }).file;
    expect(describeThreads(current)).toMatch(/1 with fewer than two moments/);

    current = addMoment(current, key, { beatId: beatAt(current, 2).id }).file;
    expect(describeThreads(current)).toBe('1 thread.');
  });

  it('renames a thread everywhere by renaming it once', () => {
    const { file } = script(2);
    const made = addThread(file, { name: 'The key' });
    let current = addMoment(made.file, made.thread.id, { beatId: beatAt(made.file, 0).id }).file;
    current = updateThread(current, made.thread.id, { name: 'The brass key' });

    const row = storyMap(current).tracks.find((track) => track.id === 'links')!.rows[0]!;
    expect(row.title).toBe('The brass key');
    // The node's label carries it too, because nothing copied the name out.
    expect(row.nodes[0]!.label).toMatch(/^The brass key/);
  });
});

describe('the other tracks', () => {
  it('reads the same shape from setups, themes and arcs', () => {
    const { file } = script(2);
    // Every track is present and normalized even when empty — the engine does
    // not know what a setup is, so it cannot fail to ask for one.
    const map = storyMap(file);
    expect(map.tracks.map((track) => track.title)).toEqual([
      'Links',
      'Setups & Payoffs',
      'Themes & Motifs',
      'Character Arcs',
    ]);
    for (const track of map.tracks) {
      for (const row of track.rows) {
        expect(Array.isArray(row.nodes)).toBe(true);
        expect(Array.isArray(row.edges)).toBe(true);
      }
    }
  });
});

// Keeps the import honest: a moment can be pinned to a paragraph, not only a beat.
describe('a moment on a paragraph', () => {
  it('is lost when that paragraph is, and not before', () => {
    const { file } = script(1);
    const beat = beatAt(file, 0);
    const elementId = beat.manuscript.elements[0]!.id;

    const made = addThread(file, { name: 'The key' });
    const current = addMoment(made.file, made.thread.id, { beatId: beat.id, elementId }).file;
    expect(momentsOf(current, made.thread.id)[0]!.resolved).toBe(true);

    const cut = {
      ...current,
      beats: current.beats.map((one) =>
        one.id === beat.id
          ? { ...one, manuscript: { elements: one.manuscript.elements.filter((el) => el.id !== elementId) } }
          : one,
      ),
    } as ProjectFile;
    expect(momentsOf(cut, made.thread.id)[0]!.resolved).toBe(false);
  });
});
