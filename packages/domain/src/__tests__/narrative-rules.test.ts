import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import { addChoice, addElement, addResource, addState, findChoice, updateChoice } from '../narrative.js';
import {
  addCondition,
  addEffect,
  addSubGroup,
  groupAt,
  moveEffect,
  newCondition,
  newEffect,
  removeCondition,
  removeEffect,
  removeSubGroup,
  sayEffect,
  sayEffects,
  sayElementRule,
  sayGroup,
  sayRule,
  sayRuleLine,
  setJoin,
  targetKindOf,
  updateCondition,
  updateEffect,
} from '../narrative-rules.js';
import { emptyConditions } from '../entities/narrative.js';
import { applyEffects, initialState, meetsGroup } from '../narrative-eval.js';
import type { Condition, ConditionGroup } from '../entities/narrative.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 5 (addendum 18 §15.2, §15.3).
 *
 * Two claims to hold down. **The sentence is written out of the rule**, so it
 * cannot describe something the evaluator will not run — which is tested by
 * building a rule with the builder's own functions and then handing it
 * straight to stage 2. And **the builder edits what the evaluator reads**:
 * there is no third form in between.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const asks = (subjectId: string, op: Condition['op'], value: string): Condition => ({
  subject: 'state',
  subjectId,
  op,
  value,
});

describe('a rule read back as a sentence', () => {
  it('says what one condition asks, in the designer’s own key', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number' });
    file = score.file;
    const group = addCondition(emptyConditions(), [], asks(score.state.id as string, 'at_least', '40'));
    expect(sayGroup(file, group)).toBe('trust_mara is at least 40');
  });

  it('joins with the word the join means', () => {
    let file = game();
    const a = addState(file, { key: 'has_key', kind: 'flag' });
    file = a.file;
    const b = addState(file, { key: 'alarm', kind: 'flag' });
    file = b.file;
    let group = addCondition(emptyConditions(), [], asks(a.state.id as string, 'is', 'true'));
    group = addCondition(group, [], asks(b.state.id as string, 'is', 'false'));

    expect(sayGroup(file, group)).toBe('has_key is true AND alarm is false');
    expect(sayGroup(file, setJoin(group, [], 'any'))).toBe('has_key is true OR alarm is false');
    expect(sayGroup(file, setJoin(group, [], 'none'))).toBe('NOT (has_key is true OR alarm is false)');
  });

  it('puts a nested group in brackets, and leaves an empty one out', () => {
    let file = game();
    const a = addState(file, { key: 'has_key', kind: 'flag' });
    file = a.file;
    const b = addState(file, { key: 'alarm', kind: 'flag' });
    file = b.file;

    let group = addCondition(emptyConditions(), [], asks(a.state.id as string, 'is', 'true'));
    group = addSubGroup(group, []);
    // An empty nested group says nothing rather than drawing empty brackets.
    expect(sayGroup(file, group)).toBe('has_key is true');

    group = addCondition(group, [0], asks(b.state.id as string, 'is', 'true'));
    group = addCondition(group, [0], asks(b.state.id as string, 'is', 'false'));
    expect(sayGroup(file, group)).toBe('has_key is true AND (alarm is true OR alarm is false)');
  });

  it('is empty where nothing is asked, so the caller says what that means', () => {
    expect(sayGroup(game(), emptyConditions())).toBe('');
  });
});

describe('an effect read back', () => {
  it('uses the designer’s verbs rather than the machine’s', () => {
    let file = game();
    const state = addState(file, { key: 'alarm', kind: 'flag' });
    file = state.file;
    const rounds = addResource(file, { name: 'Rifle rounds', kind: 'ammunition' });
    file = rounds.file;
    const node = addElement(file, { name: 'The tunnel' });
    file = node.file;

    const say = (effect: Parameters<typeof sayEffect>[1]) => sayEffect(file, effect);
    const at = (kind: Parameters<typeof newEffect>[1], targetId: string, value: string) => ({
      kind,
      targetId,
      value,
      timing: 'immediate' as const,
      note: '',
    });

    expect(say(at('set', state.state.id as string, 'true'))).toBe('set alarm to true');
    expect(say(at('add', state.state.id as string, '5'))).toBe('add 5 to alarm');
    expect(say(at('grant', rounds.resource.id as string, '30'))).toBe('give 30 Rifle rounds');
    expect(say(at('consume', rounds.resource.id as string, '3'))).toBe('take 3 Rifle rounds');
    expect(say(at('block', node.element.id as string, ''))).toBe('block The tunnel');
  });

  it('says the order out loud, because the order is the rule', () => {
    let file = game();
    const key = addResource(file, { name: 'Keycard', kind: 'key_item' });
    file = key.file;
    const effects = [
      newEffect(file, 'grant')!,
      { ...newEffect(file, 'consume')!, value: '1' },
    ];
    expect(sayEffects(file, effects)).toBe('give 1 Keycard, then take 1 Keycard');
  });
});

describe('§15.3’s three lines', () => {
  it('reads WHEN, DO and GO TO off one choice', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const here = addElement(file, { name: 'The desk' });
    file = here.file;
    const there = addElement(file, { name: 'The safe room' });
    file = there.file;

    const made = addChoice(file, { elementId: here.element.id, name: 'Go through', toElementId: there.element.id });
    file = updateChoice(made.file, made.choice.id, {
      conditions: addCondition(emptyConditions(), [], asks(flag.state.id as string, 'is', 'true')),
      effects: [{ kind: 'set', targetId: flag.state.id as string, value: 'false', timing: 'immediate', note: '' }],
    });

    const choice = findChoice(file, made.choice.id)!;
    expect(sayRule(file, choice)).toEqual({
      when: 'has_key is true',
      then: 'set has_key to false',
      goTo: 'The safe room',
    });
    expect(sayRuleLine(file, choice)).toBe('WHEN has_key is true → DO set has_key to false → GO TO The safe room');
  });

  /** §2: a choice that changes the world and leaves the player where they were. */
  it('says *stay here* rather than leaving the line off', () => {
    let file = game();
    const node = addElement(file, { name: 'The desk' });
    file = node.file;
    const made = addChoice(file, { elementId: node.element.id, name: 'Look around' });
    expect(sayRuleLine(made.file, made.choice)).toBe('WHEN always → stay here');
  });

  it('gives a node two lines rather than three, having no GO TO', () => {
    const made = addElement(game(), { name: 'The bridge' });
    expect(sayElementRule(made.file, made.element)).toEqual({
      when: 'anybody who gets here may be here',
      onArrival: '',
    });
  });
});

describe('editing a group', () => {
  it('starts a condition off aimed at something real', () => {
    expect(newCondition(game())).toBeNull();
    const made = addState(game(), { key: 'alarm' });
    expect(newCondition(made.file)?.subjectId).toBe(made.state.id as string);
  });

  it('changes one condition and leaves its siblings alone', () => {
    let file = game();
    const a = addState(file, { key: 'has_key', kind: 'flag' });
    file = a.file;
    let group = addCondition(emptyConditions(), [], asks(a.state.id as string, 'is', 'true'));
    group = addCondition(group, [], asks(a.state.id as string, 'is', 'false'));
    group = updateCondition(group, [], 1, { op: 'is_not' });
    expect(group.conditions.map((one) => one.op)).toEqual(['is', 'is_not']);
  });

  it('reaches a nested group by its path, and ignores one that has gone', () => {
    let group = addSubGroup(emptyConditions(), []);
    group = setJoin(group, [0], 'none');
    expect(groupAt(group, [0])?.join).toBe('none');
    expect(groupAt(group, [3])).toBeNull();
    // A stale path changes nothing rather than throwing.
    expect(setJoin(group, [3], 'any')).toEqual(group);
  });

  /** A group inside an ALL is *any of these* nine times in ten. */
  it('opens a nested group joined the other way', () => {
    const group = addSubGroup(emptyConditions(), []);
    expect(group.groups[0]!.join).toBe('any');
    expect(addSubGroup(group, [0]).groups[0]!.groups[0]!.join).toBe('all');
  });

  it('removes a condition and a nested group', () => {
    let file = game();
    const a = addState(file, { key: 'alarm', kind: 'flag' });
    file = a.file;
    let group = addCondition(emptyConditions(), [], asks(a.state.id as string, 'is', 'true'));
    group = addSubGroup(group, []);
    expect(removeCondition(group, [], 0).conditions).toHaveLength(0);
    expect(removeSubGroup(group, [], 0).groups).toHaveLength(0);
  });
});

describe('editing the effects', () => {
  it('starts one off aimed at the right kind of thing', () => {
    let file = game();
    expect(newEffect(file, 'set')).toBeNull();
    const state = addState(file, { key: 'alarm' });
    file = state.file;
    expect(newEffect(file, 'set')?.targetId).toBe(state.state.id as string);
    // Nothing to give yet, so nothing is offered rather than an effect aimed
    // at nothing.
    expect(newEffect(file, 'grant')).toBeNull();
    expect(targetKindOf('grant')).toBe('resource');
    expect(targetKindOf('hide')).toBe('element');
  });

  /** An effect aimed at the wrong list is worse than one aimed at nothing. */
  it('clears the target when the kind changes what a target is', () => {
    let file = game();
    const state = addState(file, { key: 'alarm' });
    file = state.file;
    const effects = addEffect([], newEffect(file, 'set')!);
    expect(updateEffect(effects, 0, { kind: 'grant' })[0]!.targetId).toBe('');
    // Set to add keeps it: both name a state.
    expect(updateEffect(effects, 0, { kind: 'add' })[0]!.targetId).toBe(state.state.id as string);
  });

  it('moves one up and down, and refuses to fall off either end', () => {
    let file = game();
    const state = addState(file, { key: 'alarm' });
    file = state.file;
    const effects = [
      { ...newEffect(file, 'set')!, value: 'one' },
      { ...newEffect(file, 'set')!, value: 'two' },
    ];
    expect(moveEffect(effects, 1, -1).map((one) => one.value)).toEqual(['two', 'one']);
    expect(moveEffect(effects, 0, -1).map((one) => one.value)).toEqual(['one', 'two']);
    expect(moveEffect(effects, 1, 1).map((one) => one.value)).toEqual(['one', 'two']);
  });

  it('removes one', () => {
    let file = game();
    const state = addState(file, { key: 'alarm' });
    file = state.file;
    expect(removeEffect([newEffect(file, 'set')!], 0)).toEqual([]);
  });
});

describe('what the builder builds', () => {
  /**
   * The claim of the stage: there is no third form between the builder and
   * the evaluator, so a rule assembled here is one stage 2 runs. If this ever
   * needed a conversion step, the module would have grown the compile stage
   * §9 says the field's tools have.
   */
  it('hands stage 2 a rule it runs without translation', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '50' });
    file = score.file;
    const keycard = addResource(file, { name: 'Keycard', kind: 'key_item', initial: 1 });
    file = keycard.file;

    const built = addCondition(emptyConditions(), [], asks(score.state.id as string, 'at_least', '40'));
    expect(sayGroup(file, built)).toBe('trust_mara is at least 40');
    expect(meetsGroup(file, initialState(file), built).ok).toBe(true);

    const effects = addEffect([], { ...newEffect(file, 'add')!, value: '5' });
    const after = applyEffects(file, initialState(file), effects);
    expect(after.state.states[score.state.id as string]).toBe('55');
    expect(sayEffects(file, effects)).toBe('add 5 to trust_mara');
  });

  it('holds no rule text anywhere — the rule is the structure', () => {
    const made = addChoice(addElement(game(), { name: 'A' }).file, {
      elementId: addElement(game(), { name: 'A' }).element.id,
      name: 'B',
    });
    expect(made.choice).not.toHaveProperty('script');
    expect(made.choice).not.toHaveProperty('expression');
    expect(made.choice.conditions).toEqual(emptyConditions());
  });
});
