import { describe, expect, it } from 'vitest';
import {
  EXTENSIONS,
  createProjectFile,
  draftText,
  draftsOf,
  hasExtension,
  onEnter,
  onTab,
  startRevision,
  switchRevision,
  updateBeat,
  withExtension,
  type ProjectFile,
} from '../index.js';

/**
 * Drafts of a beat, and the two keys a scene is written with
 * (addendum 02 §19).
 */

const written = (file: ProjectFile, text: string): ProjectFile =>
  updateBeat(file, file.beats[0]!.id, {
    manuscript: {
      elements: [{ id: `e-${text}` as never, type: 'action', text, characterId: null, attributes: {} }],
    },
  });

const project = () => {
  const file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  return { file: written(file, 'She climbs the stair.'), beatId: file.beats[0]!.id };
};

describe('a draft of a beat', () => {
  it('clears the beat and keeps the last one whole under its name', () => {
    const { file, beatId } = project();
    const next = startRevision(file, beatId, 'Draft 2');
    const beat = next.beats[0]!;

    // A new draft is a new attempt at the scene, not an edit of the last one.
    expect(beat.manuscript.elements).toEqual([]);
    expect(beat.revisionName).toBe('Draft 2');
    expect(beat.revisions).toHaveLength(1);
    expect(beat.revisions[0]?.name).toBe('Draft 1');
    expect(beat.revisions[0]?.manuscript.elements[0]?.text).toBe('She climbs the stair.');
  });

  it('can start from a copy instead, for a pass that is a revision', () => {
    const { file, beatId } = project();
    const beat = startRevision(file, beatId, 'Draft 2', { from: 'copy' }).beats[0]!;
    expect(beat.manuscript.elements[0]?.text).toBe('She climbs the stair.');
  });

  it('names the next draft itself when nothing is typed', () => {
    const { file, beatId } = project();
    const once = startRevision(file, beatId, '');
    expect(once.beats[0]?.revisionName).toBe('Draft 2');
    expect(startRevision(once, beatId, '').beats[0]?.revisionName).toBe('Draft 3');
  });

  it('lists every draft with the working one last, and hands back any of them', () => {
    const { file, beatId } = project();
    let next = startRevision(file, beatId, 'Draft 2');
    next = written(next, 'She does not climb.');

    const drafts = draftsOf(next.beats[0]!);
    expect(drafts.map((draft) => [draft.name, draft.working])).toEqual([
      ['Draft 1', false],
      ['Draft 2', true],
    ]);
    expect(drafts.map((draft) => draft.words)).toEqual([4, 4]);

    // Either can be read without becoming the one being written.
    const first = drafts[0]!;
    expect(draftText(next.beats[0]!, first.id)?.elements[0]?.text).toBe('She climbs the stair.');
    expect(draftText(next.beats[0]!, 'working')?.elements[0]?.text).toBe('She does not climb.');
    expect(draftText(next.beats[0]!, 'nope')).toBeNull();
  });

  it('toggles back and forth without losing either', () => {
    const { file, beatId } = project();
    let next = startRevision(file, beatId, 'Draft 2');
    next = written(next, 'She does not climb.');

    const first = next.beats[0]!.revisions[0]!;
    const back = switchRevision(next, beatId, first.id);
    expect(back.beats[0]?.manuscript.elements[0]?.text).toBe('She climbs the stair.');
    expect(back.beats[0]?.revisionName).toBe('Draft 1');
    // And the one just left is still there, under its own name.
    expect(back.beats[0]?.revisions.map((revision) => revision.name)).toEqual(['Draft 2']);
    expect(back.beats[0]?.revisions[0]?.manuscript.elements[0]?.text).toBe('She does not climb.');
  });
});

describe('writing a scene with two keys', () => {
  it('starts on action, and Tab makes it a character cue', () => {
    expect(onTab('screenplay', 'action')).toEqual({ type: 'character', newLine: false });
  });

  it('asks which voice it is beside a name, and moves on the Tab after that', () => {
    expect(onTab('screenplay', 'character')).toEqual({ type: 'character', newLine: false, extensions: true });
    expect(onTab('screenplay', 'character', { extensionOffered: true })).toEqual({
      type: 'parenthetical',
      newLine: false,
    });
    // An empty cue has no name to qualify, so it walks straight past.
    expect(onTab('screenplay', 'character', { empty: true })).toEqual({ type: 'parenthetical', newLine: false });
  });

  it('goes from a cue to dialogue on Return, and from dialogue to a parenthetical on Tab', () => {
    expect(onEnter('screenplay', 'character', false)).toEqual({ type: 'dialogue', newLine: true });
    expect(onTab('screenplay', 'dialogue')).toEqual({ type: 'parenthetical', newLine: false });
    // …and out of the parenthetical back into the speech it qualifies.
    expect(onEnter('screenplay', 'parenthetical', false)).toEqual({ type: 'dialogue', newLine: true });
    expect(onEnter('screenplay', 'parenthetical', true)).toEqual({ type: 'dialogue', newLine: false });
  });

  it('walks back the way it came on Shift+Tab', () => {
    expect(onTab('screenplay', 'character', { direction: -1 })).toEqual({ type: 'action', newLine: false });
  });
});

describe('what a cue can be marked with', () => {
  it('carries the set the industry recognises, each saying what it means', () => {
    const marks = EXTENSIONS.map((extension) => extension.mark);
    for (const mark of ['(V.O.)', '(O.S.)', '(O.C.)', "(CONT'D)", '(FILTERED)', '(P.A.)', '(SUBTITLED)']) {
      expect(marks).toContain(mark);
    }
    expect(EXTENSIONS.every((extension) => extension.what.length > 0)).toBe(true);
  });

  it('puts one on a cue, and swaps it rather than stacking it', () => {
    expect(withExtension('MAEVE', '(V.O.)')).toBe('MAEVE (V.O.)');
    expect(withExtension('MAEVE (V.O.)', '(O.S.)')).toBe('MAEVE (O.S.)');
    // Choosing nothing takes it off again.
    expect(withExtension('MAEVE (O.S.)', '')).toBe('MAEVE');
  });

  it('knows when a cue already carries one', () => {
    expect(hasExtension('MAEVE (V.O.)')).toBe(true);
    expect(hasExtension('MAEVE')).toBe(false);
  });
});
