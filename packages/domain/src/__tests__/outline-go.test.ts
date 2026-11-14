import { describe, expect, it } from 'vitest';
import {
  addItem,
  beatsForUnit,
  createOutline,
  createProjectFile,
  findOutline,
  outlineRowForBeat,
  promoteRow,
  writingBeatForRow,
  type Outline,
} from '../index.js';

/** Go between the Outliner and the writing screen. */
const made = () => {
  const start = createOutline(createProjectFile({ title: 'Blackout', format: 'screenplay' }));
  const id = start.outline.id;
  const chapter = addItem(start.file, id, { kind: 'note', title: 'Act one' });
  const scene = addItem(chapter.file, id, { kind: 'scene', title: 'Warehouse' });
  const enters = addItem(scene.file, id, { parentId: scene.itemId, kind: 'beat', title: 'Mara enters.' });
  const finds = addItem(enters.file, id, { parentId: scene.itemId, kind: 'beat', title: 'She finds the case.' });
  const idea = addItem(finds.file, id, { parentId: finds.itemId, kind: 'idea', title: 'Movement upstairs.' });
  const plan = addItem(idea.file, id, { kind: 'note', title: 'Loose plan' });
  const sent = promoteRow(plan.file, id, scene.itemId);
  const file = sent.file;
  // The scene, once on the track, filed under a plan row (as a writer's act
  // heading would be), to show Go looking down from a row with no binding.
  const promoted = findOutline(file, id) as Outline;
  const outline = {
    ...promoted,
    items: promoted.items.map((item) => (item.id === scene.itemId ? { ...item, parentId: chapter.itemId } : item)),
  } as Outline;
  const [first, second] = beatsForUnit(file, sent.unitId!);
  return { file, outline, chapter, scene, enters, finds, idea, plan, first: first!, second: second! };
};

describe('writingBeatForRow', () => {
  it('goes to a beat’s own screen, a scene’s first beat, and a chapter’s first beat under it', () => {
    const { file, outline, chapter, scene, finds, first, second } = made();
    expect(writingBeatForRow(file, outline, finds.itemId)?.id).toBe(second.id);
    expect(writingBeatForRow(file, outline, scene.itemId)?.id).toBe(first.id);
    expect(writingBeatForRow(file, outline, chapter.itemId)?.id).toBe(first.id);
  });

  it('takes a row beneath a beat to that beat, and has nowhere for a loose plan', () => {
    const { file, outline, idea, plan, second } = made();
    expect(writingBeatForRow(file, outline, idea.itemId)?.id).toBe(second.id);
    expect(writingBeatForRow(file, outline, plan.itemId)).toBeNull();
  });
});

describe('outlineRowForBeat', () => {
  it('finds the row that is the beat', () => {
    const { file, outline, finds, second } = made();
    expect(outlineRowForBeat(file, second.id)).toEqual({ outlineId: outline.id, itemId: finds.itemId });
  });
});
