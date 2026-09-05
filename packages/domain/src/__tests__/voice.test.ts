import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addCharacter, assignCharacterVoice, updateBeat } from '../mutations.js';
import {
  accentFor,
  describeVoice,
  estimatedSpokenSeconds,
  playbackPlan,
  sortVoices,
  suggestVoiceAssignments,
  toAssignment,
} from '../voice.js';
import { newId } from '../ids.js';
import type { ManuscriptElement, ManuscriptElementType } from '../entities/manuscript.js';
import type { CharacterId, ManuscriptElementId } from '../ids.js';
import type { ProjectFile } from '../project-file.js';

const element = (
  type: ManuscriptElementType,
  text: string,
  characterId: CharacterId | null = null,
): ManuscriptElement => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId,
  attributes: {},
});

const catalogue = [
  describeVoice({ id: 'v1', name: 'Daniel', lang: 'en-GB' }),
  describeVoice({ id: 'v2', name: 'Samantha', lang: 'en-US' }),
  describeVoice({ id: 'v3', name: 'Microsoft Hazel Desktop', lang: 'en-GB' }),
  describeVoice({ id: 'v4', name: 'Unlabelled Voice 7', lang: 'en-US' }),
];

describe('describing system voices', () => {
  it('reads known voices from the table, including inside a longer name', () => {
    expect(describeVoice({ id: 'v1', name: 'Daniel', lang: 'en-GB' })).toMatchObject({
      gender: 'male',
      age: 'older',
      accent: 'British',
    });
    expect(describeVoice({ id: 'v3', name: 'Microsoft Hazel Desktop', lang: 'en-GB' })).toMatchObject({
      gender: 'female',
      accent: 'British',
    });
  });

  it('takes the gender from the name when a provider spells it out', () => {
    expect(describeVoice({ id: 'g1', name: 'Google UK English Female', lang: 'en-GB' }).gender).toBe('female');
  });

  it('says unknown rather than guessing', () => {
    const described = describeVoice({ id: 'v4', name: 'Unlabelled Voice 7', lang: 'en-US' });
    expect(described.gender).toBe('unknown');
    expect(described.age).toBe('unknown');
    expect(described.accent).toBe('American');
  });

  it('maps the accents §10 names', () => {
    expect(accentFor('en-GB')).toBe('British');
    expect(accentFor('en-AU')).toBe('Australian');
    expect(accentFor('fr-FR')).toBeNull();
  });

  it('puts described voices ahead of anonymous ones in a picker', () => {
    expect(sortVoices(catalogue).at(-1)?.name).toBe('Unlabelled Voice 7');
  });
});

describe('assigning voices to a cast', () => {
  const cast = (): ProjectFile => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addCharacter(file, { name: 'Marisol' });
    file = addCharacter(file, { name: 'The Keeper' });
    return file;
  };

  it('gives every unvoiced character a distinct voice', () => {
    const file = cast();
    const suggestions = suggestVoiceAssignments(file, catalogue);

    expect(Object.keys(suggestions)).toHaveLength(2);
    const ids = Object.values(suggestions).map((assignment) => assignment.voiceId);
    expect(new Set(ids).size).toBe(2);
  });

  it('leaves a character who already has a voice alone, and does not reuse it', () => {
    let file = cast();
    file = assignCharacterVoice(file, file.characters[0]!.id, toAssignment(catalogue[0]!));

    const suggestions = suggestVoiceAssignments(file, catalogue);

    expect(suggestions[file.characters[0]!.id]).toBeUndefined();
    expect(Object.values(suggestions)[0]?.voiceId).not.toBe('v1');
  });

  it('stores the provider and voice id, never a vendor-specific blob', () => {
    const assignment = toAssignment(catalogue[0]!);
    expect(assignment).toMatchObject({ providerId: 'system', voiceId: 'v1', displayName: 'Daniel' });
  });
});

describe('playback', () => {
  const scene = (): ProjectFile => {
    let file = createProjectFile({ title: 'Lighthouse', format: 'screenplay' });
    file = addCharacter(file, { name: 'Marisol' });
    const marisol = file.characters[0]!.id;
    file = assignCharacterVoice(file, marisol, toAssignment(catalogue[1]!));
    file = addCharacter(file, { name: 'The Keeper' });

    return updateBeat(file, file.beats[0]!.id, {
      manuscript: {
        elements: [
          element('scene_heading', 'INT. LIGHTHOUSE - NIGHT'),
          element('action', 'Rain hammers the glass.'),
          element('character', 'MARISOL', marisol),
          element('dialogue', 'You should not have come back.'),
          element('character', 'THE KEEPER', file.characters[1]!.id),
          element('dialogue', 'And yet.'),
        ],
      },
    });
  };

  it('resolves each line to the voice that should speak it', () => {
    const plan = playbackPlan(scene());
    const dialogue = plan.steps.filter((step) => step.kind === 'dialogue');

    expect(dialogue).toHaveLength(2);
    expect(dialogue[0]?.speaker).toBe('Marisol');
    expect(dialogue[0]?.voice?.voiceId).toBe('v2');
  });

  it('names the characters still without a voice rather than silently narrating them', () => {
    const plan = playbackPlan(scene());
    expect(plan.unassigned).toEqual(['The Keeper']);
  });

  it('speaks action and headings as narration', () => {
    const plan = playbackPlan(scene());
    const narration = plan.steps.filter((step) => step.kind === 'narration');
    expect(narration.map((step) => step.text)).toEqual([
      'INT. LIGHTHOUSE - NIGHT',
      'Rain hammers the glass.',
    ]);
  });

  it('estimates how long a scene takes to read aloud', () => {
    const plan = playbackPlan(scene());
    expect(estimatedSpokenSeconds(plan)).toBeGreaterThan(0);
    expect(estimatedSpokenSeconds(plan, 1)).toBeGreaterThan(estimatedSpokenSeconds(plan, 300));
  });
});
