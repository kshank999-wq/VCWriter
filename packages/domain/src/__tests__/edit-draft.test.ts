import { describe, expect, it } from 'vitest';
import { addBeat, addUnit, createProjectFile, editDraft, startRevision, updateBeat } from '../index.js';

/** Writing into a kept draft beside the working one. */
describe('editing a compared draft', () => {
  const setUp = () => {
    const empty = createProjectFile({ title: 'Drafts', format: 'screenplay' });
    const scene = addUnit({ ...empty, units: [], beats: [] }, { trackId: empty.tracks[0]!.id, title: 'INT. ROOM - DAY' });
    const made = addBeat(scene.file, { unitId: scene.unit.id, title: 'One' });
    const line = (text: string) => ({ id: 'e1', type: 'action', text, characterId: null, attributes: {} });
    const first = updateBeat(made.file, made.beat.id, { manuscript: { elements: [line('Draft one.')] } } as never);
    // Draft one is kept; the working text becomes a fresh copy to rewrite.
    const kept = startRevision(first, made.beat.id, 'Draft 2', { from: 'copy' });
    const working = updateBeat(kept, made.beat.id, { manuscript: { elements: [line('Draft two.')] } } as never);
    const beat = working.beats.find((one) => one.id === made.beat.id)!;
    return { file: working, beatId: made.beat.id, draftId: beat.revisions[0]!.id, line };
  };

  it('writes the change into the draft and leaves the working text alone', () => {
    const { file, beatId, draftId, line } = setUp();
    const next = editDraft(file, beatId, draftId, (lent) =>
      updateBeat(lent, beatId, { manuscript: { elements: [line('Draft one, revised.')] } } as never),
    );
    const beat = next.beats.find((one) => one.id === beatId)!;
    expect(beat.manuscript.elements[0]!.text).toBe('Draft two.');
    expect(beat.revisions[0]!.manuscript.elements[0]!.text).toBe('Draft one, revised.');
  });

  it('changes nothing for a draft that is not there', () => {
    const { file, beatId } = setUp();
    expect(editDraft(file, beatId, 'missing' as never, (lent) => lent)).toBe(file);
  });
});
