import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addChoice, addElement, addResource, addState, removeResource, updateChoice } from '../narrative.js';
import { addObjective, addQuest, updateObjective } from '../narrative-objectives.js';
import { bibleCounts, bibleEntries, describeEntry } from '../game-bible.js';

/**
 * Addendum 25 §4.1: on a game, Research is the Game Bible, and its game
 * section's *used* is read off the rules, never stored.
 */

const game = () => createProjectFile({ title: 'The Sunken Vault', format: 'game' });

describe('the Game Bible', () => {
  it('calls a resource used once a rule reads or changes it', () => {
    let file = game();
    const lantern = addResource(file, { name: 'Old Lantern', kind: 'key_item' });
    file = lantern.file;
    const rope = addResource(file, { name: 'Rope', kind: 'consumable' });
    file = rope.file;
    expect(bibleEntries(file, 'resources').map((one) => [one.name, one.used])).toEqual([
      ['Old Lantern', false],
      ['Rope', false],
    ]);

    const a = addElement(file, { name: 'The Cave Mouth' });
    const c = addChoice(a.file, { elementId: a.element.id, text: 'Take the lantern' });
    file = updateChoice(c.file, c.choice.id, {
      effects: [{ kind: 'grant', targetId: lantern.resource.id, value: '1', timing: 'immediate', note: '' }],
    });
    const [first, second] = bibleEntries(file, 'resources');
    expect([first!.used, first!.uses, second!.used]).toEqual([true, 1, false]);
    expect(describeEntry('resources', first!)).toBe('Key item · 1 rule');
    expect(describeEntry('resources', second!)).toBe('Consumable · not yet used');
    expect(bibleCounts(file).resources).toEqual({ total: 2, unused: 1 });
  });

  it('counts an objective asking about a state as using it', () => {
    const made = addState(game(), { key: 'found_map', kind: 'flag' });
    let file = made.file;
    expect(bibleEntries(file, 'states')[0]!.used).toBe(false);
    const objective = addObjective(file, { name: 'Find the map' });
    file = updateObjective(objective.file, objective.objective.id, {
      complete: { join: 'all', conditions: [{ subject: 'state', subjectId: made.state.id, op: 'is', value: 'true' }], groups: [] },
    });
    expect(bibleEntries(file, 'states')[0]).toMatchObject({ name: 'found_map', kind: 'Flag', used: true, uses: 1 });
  });

  it('calls a quest used once it has a step', () => {
    const quest = addQuest(game(), { name: 'The Lost Expedition' });
    let file = quest.file;
    expect(describeEntry('quests', bibleEntries(file, 'quests')[0]!)).toBe('No steps yet');
    file = addObjective(file, { name: 'Find the key', questId: quest.quest.id }).file;
    file = addObjective(file, { name: 'Open the vault', questId: quest.quest.id }).file;
    expect(describeEntry('quests', bibleEntries(file, 'quests')[0]!)).toBe('2 steps');
    expect(bibleCounts(file).quests).toEqual({ total: 1, unused: 0 });
  });

  it('goes back to not yet used when the only rule is taken away', () => {
    let file = game();
    const key = addResource(file, { name: 'Vault Key' });
    const other = addResource(key.file, { name: 'Coin' });
    file = other.file;
    const a = addElement(file, { name: 'The Door' });
    const c = addChoice(a.file, { elementId: a.element.id, text: 'Pay the toll' });
    file = updateChoice(c.file, c.choice.id, {
      conditions: { join: 'all', conditions: [{ subject: 'resource', subjectId: key.resource.id, op: 'at_least', value: '1' }], groups: [] },
    });
    expect(bibleEntries(file, 'resources')[0]!.used).toBe(true);
    file = removeResource(file, key.resource.id);
    expect(bibleEntries(file, 'resources').map((one) => one.name)).toEqual(['Coin']);
  });
});
