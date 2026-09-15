import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  addChoice,
  addElement,
  addResource,
  addState,
  findChoice,
  removeChoice,
  updateChoice,
  updateElement,
} from '../narrative.js';
import {
  applyEffects,
  beginRun,
  choose,
  depths,
  evaluate,
  initialState,
  meets,
  meetsGroup,
  reachable,
  sayCondition,
  unreachable,
} from '../narrative-eval.js';
import { emptyConditions } from '../entities/narrative.js';
import type { Choice, Condition, ConditionGroup, Effect } from '../entities/narrative.js';
import type { NarrativeElementId } from '../ids.js';
import type { ProjectFile } from '../project-file.js';

/**
 * Interactive Narrative, stage 2 (addendum 18 §4, §5).
 *
 * The tests worth having are the ones that hold the stage's decisions down:
 * there is **one** evaluation and three readers of it, a refusal changes
 * nothing, and reachability is a **reading** — cut the choice that led
 * somewhere and that somewhere is unreachable with nothing run.
 */

const game = (): ProjectFile => createProjectFile({ title: 'The Reactor', format: 'game' });

const all = (...conditions: Condition[]): ConditionGroup => ({ join: 'all', conditions, groups: [] });

const effect = (one: Partial<Effect> & Pick<Effect, 'kind' | 'targetId'>): Effect => ({
  value: '',
  timing: 'immediate',
  note: '',
  ...one,
});

/**
 * A choice with its rules on it.
 *
 * `addChoice` makes the record and `updateChoice` fills it, which is the
 * module's shape everywhere; this is the two of them in one line so a test
 * about evaluation is not three quarters bookkeeping.
 */
const choiceOn = (
  file: ProjectFile,
  input: { elementId: NarrativeElementId; name?: string; toElementId?: NarrativeElementId | null },
  patch: Partial<Choice> = {},
): { file: ProjectFile; choice: Choice } => {
  const made = addChoice(file, input);
  const next = updateChoice(made.file, made.choice.id, patch);
  return { file: next, choice: findChoice(next, made.choice.id)! };
};

describe('an empty rule', () => {
  it('is satisfied, so a node nobody has written a rule about is walkable', () => {
    const made = addElement(game(), { name: 'The corridor' });
    const standing = evaluate(made.file, initialState(made.file), made.element.id);
    expect(standing?.available).toBe(true);
    expect(standing?.blockedBy).toEqual([]);
    expect(meetsGroup(made.file, initialState(made.file), emptyConditions()).ok).toBe(true);
  });
});

describe('a flag nobody has set', () => {
  /**
   * The normalisation that makes `is false` mean what a designer means. Raw,
   * the initial is an empty string, and `'' === 'false'` is not true.
   */
  it('reads false rather than empty', () => {
    let file = game();
    const flag = addState(file, { key: 'guard_spared', kind: 'flag' });
    file = flag.file;
    const state = initialState(file);
    const asks = (op: Condition['op'], value: string): Condition => ({
      subject: 'state',
      subjectId: flag.state.id as string,
      op,
      value,
    });
    expect(meets(file, state, asks('is', 'false'))).toBe(true);
    expect(meets(file, state, asks('is', 'true'))).toBe(false);
    expect(meets(file, state, asks('is_not', 'true'))).toBe(true);
  });

  it('reads zero where it is a number', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number' });
    file = score.file;
    const condition: Condition = { subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '1' };
    expect(meets(file, initialState(file), condition)).toBe(false);
    expect(meets(file, initialState(file), { ...condition, op: 'at_most', value: '0' })).toBe(true);
  });
});

describe('why something is not offered', () => {
  it('says it in the designer’s own words', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '10' });
    file = score.file;
    const condition: Condition = { subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '40' };
    expect(sayCondition(file, condition)).toBe('trust_mara is at least 40');
  });

  it('names what failed under ALL, and what passed under NONE', () => {
    let file = game();
    const flag = addState(file, { key: 'alarm', kind: 'flag', initial: 'true' });
    file = flag.file;
    const condition: Condition = { subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' };

    // ALL: it passes, so nothing is named.
    expect(meetsGroup(file, initialState(file), all(condition)).failing).toEqual([]);

    // NONE: it passes, which is exactly why the group fails — and naming the
    // conditions that *failed* would name nothing at all.
    const none = meetsGroup(file, initialState(file), { join: 'none', conditions: [condition], groups: [] });
    expect(none.ok).toBe(false);
    expect(none.failing.map((one) => one.says)).toEqual(['alarm is true']);
  });

  it('reaches into a nested group', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const group: ConditionGroup = {
      join: 'all',
      conditions: [],
      groups: [all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' })],
    };
    const result = meetsGroup(file, initialState(file), group);
    expect(result.ok).toBe(false);
    expect(result.failing.map((one) => one.says)).toEqual(['has_key is true']);
  });
});

describe('a choice the player cannot pay for', () => {
  /**
   * A `consume` with nothing to consume is a **reason the choice is not
   * offered** rather than a thing that happens and takes the count negative.
   */
  it('is not offered, and the sentence says what is short', () => {
    let file = game();
    const bullets = addResource(file, { name: 'Rifle rounds', kind: 'ammunition', initial: 1 });
    file = bullets.file;
    const node = addElement(file, { name: 'The gantry' });
    file = node.file;
    const made = choiceOn(
      file,
      { elementId: node.element.id, name: 'Shoot the lock' },
      { effects: [effect({ kind: 'consume', targetId: bullets.resource.id as string, value: '3' })] },
    );
    file = made.file;

    const offered = evaluate(file, initialState(file), node.element.id)!.choices[0]!;
    expect(offered.available).toBe(false);
    expect(offered.blockedBy[0]!.says).toBe('not enough Rifle rounds — 3 needed, 1 held');
  });

  it('is offered once the player has enough, and the count comes down', () => {
    let file = game();
    const bullets = addResource(file, { name: 'Rifle rounds', kind: 'ammunition', initial: 5 });
    file = bullets.file;
    const node = addElement(file, { name: 'The gantry' });
    file = node.file;
    const made = choiceOn(
      file,
      { elementId: node.element.id, name: 'Shoot the lock' },
      { effects: [effect({ kind: 'consume', targetId: bullets.resource.id as string, value: '3' })] },
    );
    file = made.file;

    const move = choose(file, initialState(file), node.element.id, made.choice.id);
    expect(move.refused).toEqual([]);
    expect(move.state.resources[bullets.resource.id as string]).toBe(2);
    // Nowhere to go, so the player is where they were — §2's whole point.
    expect(move.at).toBe(node.element.id);
  });
});

describe('a refused choice', () => {
  /** Availability is read first, and nothing is applied until the answer is yes. */
  it('changes nothing at all', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const gold = addResource(file, { name: 'Credits', kind: 'currency', initial: 10 });
    file = gold.file;
    const node = addElement(file, { name: 'The vault' });
    file = node.file;
    const made = choiceOn(
      file,
      { elementId: node.element.id, name: 'Open it' },
      {
        conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
        effects: [effect({ kind: 'consume', targetId: gold.resource.id as string, value: '4' })],
      },
    );
    file = made.file;

    const before = initialState(file);
    const move = choose(file, before, node.element.id, made.choice.id);
    expect(move.refused.map((one) => one.says)).toEqual(['has_key is true']);
    expect(move.log).toEqual([]);
    expect(move.state).toEqual(before);
  });

  it('refuses a choice that is not offered here at all', () => {
    let file = game();
    const here = addElement(file, { name: 'The bridge' });
    file = here.file;
    const elsewhere = addElement(file, { name: 'The hold' });
    file = elsewhere.file;
    const made = addChoice(file, { elementId: elsewhere.element.id, name: 'Climb down' });
    file = made.file;

    const move = choose(file, initialState(file), here.element.id, made.choice.id);
    expect(move.refused[0]!.says).toBe('that choice is not offered here');
  });
});

describe('arriving somewhere', () => {
  /**
   * A choice that grants the key its own destination requires is ordinary, so
   * the destination is read against the state the effects leave behind.
   */
  it('lets a choice grant the key its own destination needs', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const here = addElement(file, { name: 'The desk' });
    file = here.file;
    const locked = addElement(file, { name: 'The safe room' });
    file = locked.file;
    file = updateElement(file, locked.element.id, {
      conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
    });
    const made = choiceOn(
      file,
      { elementId: here.element.id, name: 'Take the key and go through', toElementId: locked.element.id },
      { effects: [effect({ kind: 'set', targetId: flag.state.id as string, value: 'true' })] },
    );
    file = made.file;

    const move = choose(file, initialState(file), here.element.id, made.choice.id);
    expect(move.refused).toEqual([]);
    expect(move.at).toBe(locked.element.id);
  });

  /** Hiding it would make a choice vanish for a reason nobody can see. */
  it('refuses rather than hides a choice whose destination is shut', () => {
    let file = game();
    const flag = addState(file, { key: 'has_key', kind: 'flag' });
    file = flag.file;
    const here = addElement(file, { name: 'The desk' });
    file = here.file;
    const locked = addElement(file, { name: 'The safe room' });
    file = locked.file;
    file = updateElement(file, locked.element.id, {
      conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }),
    });
    const made = addChoice(file, { elementId: here.element.id, name: 'Go through', toElementId: locked.element.id });
    file = made.file;

    // Still listed, and still available where it stands: what is shut is the
    // room, and the player is told so rather than shown one fewer door.
    const standing = evaluate(file, initialState(file), here.element.id)!;
    expect(standing.choices).toHaveLength(1);
    expect(standing.choices[0]!.available).toBe(true);

    const move = choose(file, initialState(file), here.element.id, made.choice.id);
    expect(move.at).toBe(here.element.id);
    expect(move.refused.map((one) => one.says)).toEqual(['has_key is true']);
  });

  it('runs the node’s own effects on arrival', () => {
    let file = game();
    const alarm = addState(file, { key: 'alarm', kind: 'flag' });
    file = alarm.file;
    const here = addElement(file, { name: 'The vent' });
    file = here.file;
    const there = addElement(file, { name: 'The server floor' });
    file = there.file;
    file = updateElement(file, there.element.id, {
      effects: [effect({ kind: 'set', targetId: alarm.state.id as string, value: 'true' })],
    });
    const made = addChoice(file, { elementId: here.element.id, name: 'Drop down', toElementId: there.element.id });
    file = made.file;

    const move = choose(file, initialState(file), here.element.id, made.choice.id);
    expect(move.state.states[alarm.state.id as string]).toBe('true');
    expect(move.log.map((one) => one.says)).toEqual(['alarm = true']);
  });

  it('begins a run at the entry point, with its effects run', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
    file = score.file;
    const start = addElement(file, { name: 'Cold open' });
    file = updateElement(start.file, start.element.id, {
      effects: [effect({ kind: 'add', targetId: score.state.id as string, value: '5' })],
    });

    const begun = beginRun(file)!;
    expect(begun.at).toBe(start.element.id);
    expect(begun.state.states[score.state.id as string]).toBe('5');
    expect(begun.log[0]!.says).toBe('trust_mara 0 → 5');
    expect(beginRun(game())).toBeNull();
  });
});

describe('a blocked node', () => {
  /** Absent means open: a designer who has written no rules can walk their game. */
  it('is open until something blocks it, and open again when something unlocks it', () => {
    let file = game();
    const here = addElement(file, { name: 'The hub' });
    file = here.file;
    const tunnel = addElement(file, { name: 'The tunnel' });
    file = tunnel.file;
    const shut = choiceOn(
      file,
      { elementId: here.element.id, name: 'Seal the tunnel' },
      { effects: [effect({ kind: 'block', targetId: tunnel.element.id as string })] },
    );
    file = shut.file;

    const open = initialState(file);
    expect(evaluate(file, open, tunnel.element.id)!.available).toBe(true);

    const after = choose(file, open, here.element.id, shut.choice.id);
    const closed = evaluate(file, after.state, tunnel.element.id)!;
    expect(closed.available).toBe(false);
    expect(closed.blockedBy.map((one) => one.says)).toEqual(['The tunnel has been blocked']);
  });
});

describe('a resource', () => {
  it('never goes below zero, and never above a capacity somebody set', () => {
    let file = game();
    const health = addResource(file, { name: 'Health', kind: 'consumable', initial: 8, capacity: 10 });
    file = health.file;
    const id = health.resource.id as string;

    const topped = applyEffects(file, initialState(file), [effect({ kind: 'grant', targetId: id, value: '5' })]);
    expect(topped.state.resources[id]).toBe(10);

    const drained = applyEffects(file, topped.state, [effect({ kind: 'consume', targetId: id, value: '99' })]);
    expect(drained.state.resources[id]).toBe(0);
  });

  it('has no ceiling where the capacity is zero', () => {
    let file = game();
    const gold = addResource(file, { name: 'Credits', kind: 'currency', initial: 0 });
    file = gold.file;
    const id = gold.resource.id as string;
    const rich = applyEffects(file, initialState(file), [effect({ kind: 'grant', targetId: id, value: '9000' })]);
    expect(rich.state.resources[id]).toBe(9000);
  });
});

describe('reachability is a reading', () => {
  /**
   * §4 of the addendum, and the fifth time this project has made a fact about
   * the work a reading rather than a column. Nothing is run here: the choice is
   * cut and the next question gets the new answer.
   */
  it('turns a node unreachable the moment the only choice that led there is cut', () => {
    let file = game();
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const tunnel = addElement(file, { name: 'The tunnel' });
    file = tunnel.file;
    const made = addChoice(file, { elementId: start.element.id, toElementId: tunnel.element.id, name: 'Take it' });
    file = made.file;

    expect(unreachable(file)).toHaveLength(0);

    file = removeChoice(file, made.choice.id);

    expect(unreachable(file).map((one) => one.name)).toEqual(['The tunnel']);
    expect(reachable(file).has(tunnel.element.id as string)).toBe(false);
  });

  /**
   * **Structural on purpose.** *Could the player ever get here* and *can this
   * condition ever be satisfied* are two questions; the second is §12's own
   * check. A validator that called a hard-but-possible gate unreachable would
   * cry wolf, and one that cries wolf gets switched off.
   */
  it('does not call a node behind a hard gate unreachable', () => {
    let file = game();
    const score = addState(file, { key: 'trust_mara', kind: 'number', initial: '0' });
    file = score.file;
    const start = addElement(file, { name: 'Cold open' });
    file = start.file;
    const ending = addElement(file, { name: 'She stays' });
    file = ending.file;
    file = updateElement(file, ending.element.id, {
      conditions: all({ subject: 'state', subjectId: score.state.id as string, op: 'at_least', value: '90' }),
    });
    file = addChoice(file, { elementId: start.element.id, toElementId: ending.element.id, name: 'Ask her' }).file;

    expect(unreachable(file)).toHaveLength(0);
    // It is shut *right now*, which is the other question, answered elsewhere.
    expect(evaluate(file, initialState(file), ending.element.id)!.available).toBe(false);
  });

  it('follows a loop without walking it twice', () => {
    let file = game();
    const hub = addElement(file, { name: 'The hub' });
    file = hub.file;
    const room = addElement(file, { name: 'The lab' });
    file = room.file;
    file = addChoice(file, { elementId: hub.element.id, toElementId: room.element.id }).file;
    file = addChoice(file, { elementId: room.element.id, toElementId: hub.element.id }).file;

    expect(reachable(file).size).toBe(2);
    expect(depths(file).get(room.element.id as string)).toBe(1);
  });

  it('reaches nothing at all where no node is an entry', () => {
    let file = game();
    const made = addElement(file, { name: 'Cold open' });
    file = updateElement(made.file, made.element.id, { entry: false });
    // True, and one of §12's findings rather than something to paper over with
    // a guess at which node came first.
    expect(reachable(file).size).toBe(0);
    expect(unreachable(file)).toHaveLength(1);
  });

  it('ranks a converging node by its shortest way in', () => {
    let file = game();
    const start = addElement(file, { name: 'Start' });
    file = start.file;
    const long = addElement(file, { name: 'The long way' });
    file = long.file;
    const bridge = addElement(file, { name: 'The bridge' });
    file = bridge.file;

    file = addChoice(file, { elementId: start.element.id, toElementId: long.element.id }).file;
    file = addChoice(file, { elementId: long.element.id, toElementId: bridge.element.id }).file;
    const direct = addChoice(file, { elementId: start.element.id, name: 'Straight on' });
    file = updateChoice(direct.file, direct.choice.id, { toElementId: bridge.element.id });

    const ranked = depths(file);
    expect(ranked.get(start.element.id as string)).toBe(0);
    expect(ranked.get(bridge.element.id as string)).toBe(1);
  });
});

describe('one evaluation, three readers', () => {
  /**
   * The precedent is `applyTray`: the preview and the commit run the same pure
   * function, so the picture and the result cannot disagree. Here the simulator
   * (`choose`) and the reading (`evaluate`) must give the same answer about the
   * same choice, or a designer is looking at a lie.
   */
  it('refuses exactly what it draws as unavailable', () => {
    let file = game();
    const flag = addState(file, { key: 'has_badge', kind: 'flag' });
    file = flag.file;
    const node = addElement(file, { name: 'The checkpoint' });
    file = node.file;
    const made = choiceOn(
      file,
      { elementId: node.element.id, name: 'Walk through' },
      { conditions: all({ subject: 'state', subjectId: flag.state.id as string, op: 'is', value: 'true' }) },
    );
    file = made.file;

    const state = initialState(file);
    const drawn = evaluate(file, state, node.element.id)!.choices[0]!;
    const taken = choose(file, state, node.element.id, made.choice.id);
    expect(drawn.available).toBe(false);
    expect(taken.refused).toEqual(drawn.blockedBy);
  });

  it('says nothing about a node that has gone', () => {
    const made = addElement(game(), { name: 'Cold open' });
    const gone = addElement(made.file, { name: 'The tunnel' });
    expect(evaluate(made.file, initialState(made.file), gone.element.id)).toBeNull();
  });
});
