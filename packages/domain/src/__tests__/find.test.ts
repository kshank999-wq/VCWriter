import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addUnit,
  createProjectFile,
  findInManuscript,
  replaceAll,
  replaceMatches,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * Find and replace (addendum 02 §13). The parts worth pinning are the ones a
 * writer would only notice after the damage: that matches come back in
 * reading order, that replace-all does not shift the offsets out from under
 * itself, and that a replacement leaves everything about an element except
 * its text exactly as it was.
 */

const script = (): ProjectFile => {
  let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
  const laneId = file.lanes[0]!.id;

  const write = (beatId: string, lines: string[]) => {
    file = updateBeat(file, beatId as never, {
      manuscript: {
        elements: lines.map((text, index) => ({
          id: `${beatId}-${index}` as never,
          type: 'action' as const,
          text,
          characterId: null,
          attributes: { kept: true },
        })),
      },
    });
  };

  write(file.beats[0]!.id as string, ['The lamp turns. The lamp answers.', 'Rain on the glass.']);
  const second = addUnit(file, { laneId, title: 'Second' });
  file = addBeat(second.file, { unitId: second.unit.id }).file;
  write(file.beats[file.beats.length - 1]!.id as string, ['A lamp, unlit.', 'LAMPLIGHT on the sill.']);
  return file;
};

describe('finding', () => {
  it('finds every occurrence, in the order they are read in', () => {
    const file = script();
    const matches = findInManuscript(file, 'lamp');
    // Two in the first line, one in the third, one inside LAMPLIGHT.
    expect(matches.map((match) => match.text)).toEqual(['lamp', 'lamp', 'lamp', 'LAMP']);
    expect(matches[0]?.start).toBe(4);
    expect(matches[1]?.start).toBeGreaterThan(matches[0]!.start);
    // The last two are in the second scene, which reads after the first.
    expect(matches[2]?.beatId).not.toBe(matches[0]?.beatId);
  });

  it('is blind to case unless asked, and can be held to whole words', () => {
    const file = script();
    expect(findInManuscript(file, 'LAMP')).toHaveLength(4);
    expect(findInManuscript(file, 'LAMP', { matchCase: true })).toHaveLength(1);
    // "lamp" inside LAMPLIGHT is not a word of its own.
    expect(findInManuscript(file, 'lamp', { wholeWord: true })).toHaveLength(3);
  });

  it('finds nothing for an empty search, rather than everything', () => {
    expect(findInManuscript(script(), '')).toEqual([]);
  });

  it('carries enough of the line either side to tell two matches apart', () => {
    const matches = findInManuscript(script(), 'lamp');
    expect(matches[0]?.before).toBe('The ');
    expect(matches[0]?.after).toBe(' turns. The lamp answers.');
  });

  it('can be held to particular beats', () => {
    const file = script();
    const first = file.beats[0]!.id;
    expect(findInManuscript(file, 'lamp', { beatIds: [first] })).toHaveLength(2);
  });
});

describe('replacing', () => {
  it('replaces every occurrence without the earlier ones moving the later ones', () => {
    const file = script();
    const { file: next, replaced } = replaceAll(file, 'lamp', 'beacon');
    expect(replaced).toBe(4);

    const lines = next.beats.flatMap((beat) => beat.manuscript.elements.map((element) => element.text));
    expect(lines[0]).toBe('The beacon turns. The beacon answers.');
    expect(lines[2]).toBe('A beacon, unlit.');
    expect(lines[3]).toBe('beaconLIGHT on the sill.');
  });

  it('handles a replacement longer and shorter than what it replaces', () => {
    const file = script();
    expect(replaceAll(file, 'lamp', 'x').file.beats[0]?.manuscript.elements[0]?.text).toBe('The x turns. The x answers.');
    expect(replaceAll(file, 'lamp', 'lighthouse lamp').file.beats[0]?.manuscript.elements[0]?.text).toBe(
      'The lighthouse lamp turns. The lighthouse lamp answers.',
    );
  });

  it('replaces just the one it is given, leaving its neighbours alone', () => {
    const file = script();
    const matches = findInManuscript(file, 'lamp');
    const next = replaceMatches(file, [matches[1] as never], 'beacon');
    expect(next.beats[0]?.manuscript.elements[0]?.text).toBe('The lamp turns. The beacon answers.');
  });

  it('leaves everything about an element except its text exactly as it was', () => {
    const file = script();
    const before = file.beats[0]!.manuscript.elements[0]!;
    const after = replaceAll(file, 'lamp', 'beacon').file.beats[0]!.manuscript.elements[0]!;
    expect(after.id).toBe(before.id);
    expect(after.type).toBe(before.type);
    expect(after.attributes).toEqual(before.attributes);
    // …and a beat with no match in it is the very same object.
    const untouched = replaceAll(file, 'Rain', 'Sleet').file;
    expect(untouched.beats[1]).toBe(file.beats[1]);
  });

  it('does nothing at all when there is nothing to replace', () => {
    const file = script();
    expect(replaceAll(file, 'zebra', 'x').file).toBe(file);
    expect(replaceMatches(file, [], 'x')).toBe(file);
  });
});
