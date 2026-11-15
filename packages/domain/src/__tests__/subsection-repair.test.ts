import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addItem,
  addUnit,
  alignScriptToOutline,
  beatsForUnit,
  createOutline,
  createProjectFile,
  findOutline,
  passagesOf,
  promoteAll,
  trackBeatsForUnit,
  unitsInStoryOrder,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * A subsection row bound to a section box of its own, as Ken's book had
 * 2.2.4 (from Ken, 15 November): it becomes a subsection of its section, and
 * the rows under it its passages.
 */
describe('a subsection that went onto the track as a section', () => {
  it('is made a subsection of its section, with its passages under it', () => {
    let file: ProjectFile = createProjectFile({ title: 'Villains', format: 'instructional' });
    const made = createOutline(file, { name: 'Outline' });
    file = made.file;
    const id = made.outline.id;
    const rows: Record<string, OutlineItemId> = {};
    const add = (key: string, kind: string, title: string, parent?: string) => {
      const r = addItem(file, id, { kind, title, ...(parent ? { parentId: rows[parent]! } : {}) });
      file = r.file;
      rows[key] = r.itemId!;
    };
    add('s', 'scene', 'The truth');
    add('b1', 'beat', 'Only the top', 's');
    file = promoteAll(file, id).file;

    // 2.2.4 as it was: a Section-kind row at subsection depth, bound to a box of its own.
    add('odd', 'scene', 'Publishers', 's');
    const track = file.tracks[0]!;
    const box = addUnit(file, { trackId: track.id, title: 'Publishers' });
    file = box.file;
    const written = addBeat(file, { unitId: box.unit.id, title: 'Publishers' });
    file = written.file;
    const bind = (key: string, patch: object) => {
      file = {
        ...file,
        outlines: file.outlines!.map((o) => ({ ...o, items: o.items.map((item) => (item.id === rows[key] ? { ...item, ...patch } : item)) })),
      };
    };
    bind('odd', { boundUnitId: box.unit.id });
    // Its child, already a beat in the section.
    add('p1', 'beat', 'The big boys', 'odd');
    const truth = unitsInStoryOrder(file).find((unit) => unit.title === 'The truth')!;
    const passage = addBeat(file, { unitId: truth.id, title: 'The big boys' });
    file = passage.file;
    bind('p1', { boundBeatId: passage.beat.id });

    const fixed = alignScriptToOutline(file);
    expect(unitsInStoryOrder(fixed).map((unit) => unit.title)).not.toContain('Publishers');
    expect(trackBeatsForUnit(fixed, truth.id).map((beat) => beat.title)).toEqual(['Only the top', 'Publishers']);
    const row = findOutline(fixed, id)!.items.find((item) => item.id === rows['odd'])!;
    expect(row.boundUnitId).toBeNull();
    const sub = fixed.beats.find((beat) => beat.id === row.boundBeatId)!;
    expect(passagesOf(fixed, sub.id).map((beat) => beat.title)).toEqual(['The big boys']);
    // The box's own writing is the subsection now, kept rather than lost.
    expect(sub.id).toBe(written.beat.id);
    expect(beatsForUnit(fixed, truth.id).some((beat) => beat.id === written.beat.id)).toBe(true);
  });
});
