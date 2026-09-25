import { describe, expect, it } from 'vitest';
import { createProjectFile, parseProjectFile, serializeProjectFile } from '../project-file.js';
import type { ProjectFile } from '../project-file.js';
import { addBeat, addCharacter, addUnit, updateBeat } from '../mutations.js';
import { addLocation } from '../locations.js';
import { addElement, addChoice, addResource, addState, removeState, setGameSetup, updateChoice, updateElement } from '../narrative.js';
import { addObjective } from '../narrative-objectives.js';
import { narrativeFindings } from '../narrative-check.js';
import { bibleEntries } from '../game-bible.js';
import {
  addBehaviour,
  beatVisuals,
  narrativeLayer,
  sceneBoard,
  sceneLayersOf,
  systemicLayer,
  updateBehaviour,
  updatePresentation,
} from '../narrative-scene.js';
import { newId } from '../ids.js';
import type { ManuscriptElementId } from '../ids.js';

/**
 * Addendum 25 §5: a game scene's four layers — two stored, two read — and a
 * board of cards that stores nothing.
 */

const line = (type: 'scene_heading' | 'character' | 'dialogue' | 'action', text: string) => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId: null,
  attributes: {},
});

/** The Vault Door: Mara speaks, the lever is here, the key is needed and used. */
const vault = () => {
  let file: ProjectFile = createProjectFile({ title: 'The Sunken Vault', format: 'game' });
  file = setGameSetup(file, { playerRole: 'The Explorer' });
  const scene = addUnit(file, { trackId: file.tracks[0]!.id, title: 'The Vault Door' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The Door' });
  file = updateBeat(beat.file, beat.beat.id, {
    visual: 'Water streams from the door seam',
    manuscript: {
      elements: [
        line('scene_heading', 'INT. VAULT CHAMBER - NIGHT'),
        line('character', 'MARA'),
        line('dialogue', 'Water’s holding it shut.'),
      ],
    },
  });
  // A character is returned as the file with her in it; she is found by name.
  file = addCharacter(file, { name: 'Mara' });
  const mara = { character: file.characters.find((one) => one.name === 'Mara')! };
  file = addLocation(file, { name: 'Vault Chamber' }).file;
  const key = addResource(file, { name: 'Vault Key', kind: 'key_item' });
  file = key.file;
  const door = addElement(file, { name: 'The Door', boundBeatId: beat.beat.id });
  file = updateElement(door.file, door.element.id, {
    conditions: { join: 'all', conditions: [{ subject: 'resource', subjectId: key.resource.id, op: 'at_least', value: '1' }], groups: [] },
  });
  const beyond = addElement(file, { name: 'The Vault Opens' });
  file = beyond.file;
  const turn = addChoice(file, { elementId: door.element.id, text: 'Turn the key', toElementId: beyond.element.id });
  file = updateChoice(turn.file, turn.choice.id, {
    effects: [{ kind: 'consume', targetId: key.resource.id, value: '1', timing: 'immediate', note: '' }],
  });
  file = addObjective(file, { name: 'Open the vault door', unitId: scene.unit.id }).file;
  return { file, unitId: scene.unit.id, mara: mara.character, key: key.resource };
};

describe('layer 1, read', () => {
  it('reads the cast off the cues, the place off the heading, and the gate off the node', () => {
    const { file, unitId } = vault();
    const layer = narrativeLayer(file, unitId)!;
    expect(layer.position).toBe(2);
    expect(layer.cast.map((one) => one.name)).toEqual(['Mara']);
    expect(layer.place?.name).toBe('VAULT CHAMBER');
    expect(layer.prerequisites).toEqual(['Vault Key is at least 1']);
  });
});

describe('layer 2, stored', () => {
  it('keeps what a character does, and when, with a real condition', () => {
    let { file, unitId, mara } = vault();
    const trust = addState(file, { key: 'mara_trust', kind: 'number' });
    file = trust.file;
    const made = addBehaviour(file, unitId, { characterId: mara.id, kind: 'Lead' });
    file = updateBehaviour(made.file, unitId, made.behaviour.id, {
      note: 'Moves ahead to find the lever',
      conditions: { join: 'all', conditions: [{ subject: 'state', subjectId: trust.state.id, op: 'at_least', value: '1' }], groups: [] },
    });
    const [kept] = sceneLayersOf(file, unitId).behaviours;
    expect([kept!.kind, kept!.note]).toEqual(['Lead', 'Moves ahead to find the lever']);

    // A behaviour asking about a state is a read: the state is used, and the
    // checks do not call it unread.
    expect(bibleEntries(file, 'states')[0]!.used).toBe(true);
    expect(narrativeFindings(file).some((one) => one.says.startsWith('mara_trust is set but nothing'))).toBe(false);

    // Deleting the state takes it out of the behaviour, as out of every rule.
    file = removeState(file, trust.state.id);
    expect(sceneLayersOf(file, unitId).behaviours[0]!.conditions.conditions).toEqual([]);
  });

  it('stores nothing for a scene nobody has described', () => {
    const { file, unitId } = vault();
    expect(file.sceneLayers).toEqual([]);
    expect(sceneLayersOf(file, unitId).behaviours).toEqual([]);
  });
});

describe('layer 3, read', () => {
  it('says the rules and the objectives in the rule builder’s words', () => {
    const { file, unitId } = vault();
    const layer = systemicLayer(file, unitId);
    expect(layer.choices).toEqual([{ text: 'Turn the key', says: 'WHEN always → DO take 1 Vault Key → GO TO The Vault Opens' }]);
    expect(layer.objectives.map((one) => one.says)).toEqual(['Open the vault door — done on arrival']);
    expect(layer.completion).toBe('Open the vault door');
  });
});

describe('layer 4, stored beside the beat’s own', () => {
  it('keeps presentation on the scene and reads each beat’s visual', () => {
    const { file: start, unitId } = vault();
    const file = updatePresentation(start, unitId, { music: 'Low strings as the door opens', camera: 'Door framed centre' });
    expect(sceneLayersOf(file, unitId).presentation).toMatchObject({ music: 'Low strings as the door opens', camera: 'Door framed centre', ambience: '' });
    expect(beatVisuals(file, unitId)).toEqual([{ beat: 'The Door', visual: 'Water streams from the door seam' }]);
    // One record for the scene, however many times it is written.
    const again = updatePresentation(file, unitId, { ambience: 'Dripping' });
    expect(again.sceneLayers).toHaveLength(1);
  });

  it('survives a save and a load', () => {
    const { file: start, unitId, mara } = vault();
    let file = updatePresentation(start, unitId, { music: 'Low strings' });
    file = addBehaviour(file, unitId, { characterId: mara.id, kind: 'Follow' }).file;
    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(reopened.sceneLayers).toEqual(file.sceneLayers);
  });
});

describe('the board', () => {
  it('lays the scene out as cards, every one of them read', () => {
    const { file, unitId } = vault();
    expect(sceneBoard(file, unitId).map((one) => [one.kind, one.name, one.says])).toEqual([
      ['player', 'The Explorer', 'plays the scene'],
      ['character', 'Mara', 'speaks'],
      ['place', 'VAULT CHAMBER', 'where it happens'],
      ['resource', 'Vault Key', 'needed here · used here'],
      ['objective', 'Open the vault door', 'the scene needs it'],
      ['exit', 'Turn the key', 'to The Vault Opens'],
    ]);
  });

  it('shows a character who does something here without speaking', () => {
    const { file: start, unitId } = vault();
    const withGuard = addCharacter(start, { name: 'The Warden' });
    const guard = withGuard.characters.find((one) => one.name === 'The Warden')!;
    const file = addBehaviour(withGuard, unitId, { characterId: guard.id, kind: 'Patrol' }).file;
    expect(sceneBoard(file, unitId).find((one) => one.name === 'The Warden')?.says).toBe('does not speak · 1 behaviour');
  });
});
