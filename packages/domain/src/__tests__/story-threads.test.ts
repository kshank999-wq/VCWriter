import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addBeat, addCharacter, addUnit, updateBeat, updateLane } from '../mutations.js';
import { CHARACTER_COLOURS, speakersIn, threadLayout } from '../story-threads.js';
import { toRows, fromRows } from '../sync-mapping.js';
import type { ManuscriptElement } from '../entities/manuscript.js';

const cue = (name: string): ManuscriptElement => ({
  id: crypto.randomUUID() as never,
  type: 'character',
  text: name,
  characterId: null,
  attributes: {},
});
const line = (text: string): ManuscriptElement => ({
  id: crypto.randomUUID() as never,
  type: 'dialogue',
  text,
  characterId: null,
  attributes: {},
});

describe('who speaks in a beat', () => {
  it('reads the character cues, folding extensions and case', () => {
    const file = createProjectFile({ title: 'T', format: 'screenplay' });
    const beat = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [cue('Celeste'), line('Go.'), cue("CELESTE (CONT'D)"), line('Now.'), cue('MIKE (V.O.)'), line('Fine.')] },
    }).beats[0]!;
    expect(speakersIn(beat)).toEqual(['CELESTE', 'MIKE']);
  });
});

describe('thread layout', () => {
  it('threads each character through the scenes they speak in, coloured in order of first line', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const first = file.units[0]!;
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [cue('MIKE'), line('Hi.')] } });
    const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Two' });
    file = second.file;
    const b2 = addBeat(file, { unitId: second.unit.id, title: 'They meet' });
    file = updateBeat(b2.file, b2.beat.id, { manuscript: { elements: [cue('CELESTE'), line('Hello.'), cue('MIKE'), line('Hey.')] } });
    const b3 = addBeat(file, { unitId: second.unit.id, title: 'Alone' });
    file = updateBeat(b3.file, b3.beat.id, { manuscript: { elements: [cue('CELESTE'), line('Well.')] } });
    // A character the writer created who has not spoken yet.
    file = addCharacter(file, { name: 'Pastor' });

    const layout = threadLayout(file);
    expect(layout.characters.map((c) => c.name)).toEqual(['MIKE', 'CELESTE']);
    expect(layout.characters[0]!.color).toBe(CHARACTER_COLOURS[0]);
    expect(layout.characters[1]!.color).toBe(CHARACTER_COLOURS[1]);
    expect(layout.colours.get('PASTOR')).toBe(CHARACTER_COLOURS[2]);

    const mike = layout.characters[0]!;
    expect(mike.appearances.map((a) => a.index)).toEqual([0, 1]);
    const celeste = layout.characters[1]!;
    expect(celeste.appearances).toEqual([{ index: 1, beatIds: [b2.beat.id, b3.beat.id] }]);
    expect(layout.speakers.get(b2.beat.id)).toEqual(['CELESTE', 'MIKE']);
    expect(layout.spans.map((span) => span.unit.id)).toEqual([first.id, second.unit.id]);
  });
});

describe('lane arc', () => {
  it('is kept and synced', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    file = updateLane(file, file.lanes[0]!.id, { description: 'A man and his faith.', arc: 'Certainty to doubt to a harder faith.' });
    expect(fromRows(toRows(file)).lanes[0]?.arc).toBe('Certainty to doubt to a harder faith.');
  });
});
