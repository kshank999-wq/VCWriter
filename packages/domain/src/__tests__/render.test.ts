import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addCharacter, assignCharacterVoice, updateBeat } from '../mutations.js';
import { renderBeat, renderProject, speechSegmentsForUnit } from '../render.js';
import { newId } from '../ids.js';
import type { ManuscriptElementId } from '../ids.js';
import type { ManuscriptSegment } from '../entities/manuscript.js';

const scene = (characterId: string | null): ManuscriptSegment => ({
  elements: [
    { id: newId<ManuscriptElementId>(), type: 'scene_heading', text: 'int. lighthouse - night', characterId: null, attributes: {} },
    { id: newId<ManuscriptElementId>(), type: 'action', text: 'Rain hammers the glass.', characterId: null, attributes: {} },
    { id: newId<ManuscriptElementId>(), type: 'character', text: 'Marisol', characterId: characterId as never, attributes: {} },
    { id: newId<ManuscriptElementId>(), type: 'dialogue', text: 'You should not have come back.', characterId: null, attributes: {} },
  ],
});

describe('manuscript rendering', () => {
  it('never emits the internal beat title as manuscript text', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    const beatId = file.beats[0]!.id;
    file = updateBeat(file, beatId, { title: 'She confronts him', manuscript: scene(null) });

    const manuscript = renderProject(file);
    expect(manuscript).toContain('INT. LIGHTHOUSE - NIGHT');
    expect(manuscript).not.toContain('She confronts him');
  });

  it('includes the beat title only when explicitly requested', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    const beatId = file.beats[0]!.id;
    file = updateBeat(file, beatId, { title: 'She confronts him', manuscript: scene(null) });

    const reference = renderBeat(file.beats[0]!, { includeBeatTitles: true });
    expect(reference).toContain('[She confronts him]');
  });

  it('uppercases screenplay headings and indents dialogue', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = updateBeat(file, file.beats[0]!.id, { manuscript: scene(null) });
    const lines = renderProject(file).split('\n');
    expect(lines.some((line) => line.startsWith('INT. LIGHTHOUSE'))).toBe(true);
    expect(lines.some((line) => line.startsWith('          You should not have come back.'))).toBe(true);
  });

  it('assigns each character its persistent voice for read-back', () => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addCharacter(file, { name: 'Marisol' });
    const characterId = file.characters[0]!.id;
    file = assignCharacterVoice(file, characterId, {
      providerId: 'stub',
      voiceId: 'younger-female-1',
      displayName: 'Younger female',
      accent: 'British',
      rate: 1,
      pitch: 0,
    });
    file = updateBeat(file, file.beats[0]!.id, { manuscript: scene(characterId) });

    const segments = speechSegmentsForUnit(file, file.units[0]!.id);
    const dialogue = segments.filter((segment) => segment.kind === 'dialogue');
    expect(dialogue).toHaveLength(1);
    expect(dialogue[0]?.characterId).toBe(characterId);
    expect(dialogue[0]?.voice?.voiceId).toBe('younger-female-1');
    expect(segments.filter((segment) => segment.kind === 'narration')).toHaveLength(2);
  });
});
