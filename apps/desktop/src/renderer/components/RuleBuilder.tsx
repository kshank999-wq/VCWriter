import {
  EFFECT_NAMES,
  JOIN_NAMES,
  OP_NAMES,
  addCondition,
  addEffect,
  addSubGroup,
  elementsOf,
  moveEffect,
  newCondition,
  newEffect,
  removeCondition,
  removeEffect,
  removeSubGroup,
  resourcesOf,
  sayGroup,
  setJoin,
  statesOf,
  targetKindOf,
  updateCondition,
  updateEffect,
  valuesFor,
  type Condition,
  type ConditionGroup,
  type Effect,
  type EffectKind,
  type GroupPath,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * WHEN / DO / GO TO (addendum 18 stage 5 — §15.3).
 *
 * **There is no code box here and there never will be**, which is §9's *logic
 * without code* column. What the controls edit is the `ConditionGroup` and the
 * `Effect[]` that the evaluator, the map and the validator already read, so
 * there is no source text, no parser and no compile step — and no way to build
 * a rule the game will not run.
 *
 * The sentence under each part is the rule read back in English. It is not
 * decoration: a screen of dropdowns has to be assembled in the designer's head
 * before it means anything, and the line under it is the meaning.
 *
 * **It never says whether the rule is true.** That is the obvious feature and
 * it would be a lie — at authoring time there is no state, because the player
 * arrives with whatever the path they took gave them. What is true statically
 * is the validator's, and what is true *now* is the simulator's.
 */

const OPS = Object.keys(OP_NAMES) as Condition['op'][];
const JOINS = Object.keys(JOIN_NAMES) as ConditionGroup['join'][];
const EFFECT_KINDS = Object.keys(EFFECT_NAMES) as EffectKind[];

export function ConditionGroupEditor({
  file,
  group,
  path = [],
  onChange,
  onRemove,
}: {
  file: ProjectFile;
  /** The whole rule, always: every change is made against the root. */
  group: ConditionGroup;
  path?: GroupPath;
  onChange(next: ConditionGroup): void;
  /** Absent on the root, which cannot be taken away. */
  onRemove?(): void;
}) {
  const here = path.reduce<ConditionGroup | undefined>((found, step) => found?.groups[step], group);
  if (!here) return null;
  const canAdd = newCondition(file) !== null;

  return (
    <div className={path.length === 0 ? 'rule-group' : 'rule-group is-nested'}>
      <div className="rule-group-bar">
        <select
          value={here.join}
          aria-label="How these are joined"
          onChange={(event) => onChange(setJoin(group, path, event.target.value as ConditionGroup['join']))}
        >
          {JOINS.map((one) => (
            <option key={one} value={one}>
              {JOIN_NAMES[one]}
            </option>
          ))}
        </select>
        <span className="toolbar-spacer" />
        {canAdd ? (
          <button
            type="button"
            className="ghost small"
            onClick={() => onChange(addCondition(group, path, newCondition(file)!))}
          >
            + Condition
          </button>
        ) : null}
        <button type="button" className="ghost small" onClick={() => onChange(addSubGroup(group, path))}>
          + Group
        </button>
        {onRemove ? (
          <button type="button" className="ghost small" aria-label="Remove this group" onClick={onRemove}>
            ✕
          </button>
        ) : null}
      </div>

      {here.conditions.length === 0 && here.groups.length === 0 ? (
        <p className="muted small">
          {canAdd
            ? 'Nothing asked, so this is open to everybody.'
            : 'Nothing to ask about yet — define a state or a resource first.'}
        </p>
      ) : null}

      <ul className="rule-conditions">
        {here.conditions.map((condition, index) => (
          <li key={index}>
            <ConditionRow
              file={file}
              condition={condition}
              onChange={(patch) => onChange(updateCondition(group, path, index, patch))}
              onRemove={() => onChange(removeCondition(group, path, index))}
            />
          </li>
        ))}
      </ul>

      {here.groups.map((_, index) => (
        <ConditionGroupEditor
          key={index}
          file={file}
          group={group}
          path={[...path, index]}
          onChange={onChange}
          onRemove={() => onChange(removeSubGroup(group, path, index))}
        />
      ))}
    </div>
  );
}

function ConditionRow({
  file,
  condition,
  onChange,
  onRemove,
}: {
  file: ProjectFile;
  condition: Condition;
  onChange(patch: Partial<Condition>): void;
  onRemove(): void;
}) {
  const subjects =
    condition.subject === 'state'
      ? statesOf(file).map((one) => ({ id: one.id as string, name: one.key || 'an unnamed state' }))
      : resourcesOf(file).map((one) => ({ id: one.id as string, name: one.name || 'an unnamed resource' }));
  const values = valuesFor(file, condition);

  return (
    <div className="rule-row">
      <select
        value={condition.subject}
        aria-label="A state or a resource"
        onChange={(event) => {
          const subject = event.target.value as Condition['subject'];
          // The list it names changes, so the subject goes with it rather than
          // pointing at something of the other kind.
          const first =
            subject === 'state' ? statesOf(file)[0]?.id : resourcesOf(file)[0]?.id;
          onChange({ subject, subjectId: (first as string) ?? '' });
        }}
      >
        <option value="state">State</option>
        <option value="resource">Resource</option>
      </select>

      <select
        value={condition.subjectId}
        aria-label="Which one"
        onChange={(event) => onChange({ subjectId: event.target.value })}
      >
        {subjects.length === 0 ? <option value="">nothing defined</option> : null}
        {subjects.map((one) => (
          <option key={one.id} value={one.id}>
            {one.name}
          </option>
        ))}
      </select>

      <select
        value={condition.op}
        aria-label="The test"
        onChange={(event) => onChange({ op: event.target.value as Condition['op'] })}
      >
        {OPS.map((one) => (
          <option key={one} value={one}>
            {OP_NAMES[one]}
          </option>
        ))}
      </select>

      {values ? (
        <select
          value={condition.value}
          aria-label="The value"
          onChange={(event) => onChange({ value: event.target.value })}
        >
          <option value="">—</option>
          {values.map((one) => (
            <option key={one} value={one}>
              {one}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={condition.value}
          placeholder="value"
          aria-label="The value"
          onChange={(event) => onChange({ value: event.target.value })}
        />
      )}

      <button type="button" className="ghost small" aria-label="Remove this condition" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

export function EffectList({
  file,
  effects,
  onChange,
}: {
  file: ProjectFile;
  effects: readonly Effect[];
  onChange(next: Effect[]): void;
}) {
  return (
    <div className="rule-effects">
      {effects.length === 0 ? <p className="muted small">Nothing changes.</p> : null}
      <ol>
        {effects.map((effect, index) => (
          <li key={index}>
            <EffectRow
              file={file}
              effect={effect}
              onChange={(patch) => onChange(updateEffect(effects, index, patch))}
              onMove={(by) => onChange(moveEffect(effects, index, by))}
              onRemove={() => onChange(removeEffect(effects, index))}
            />
          </li>
        ))}
      </ol>
      <select
        value=""
        aria-label="Add an effect"
        onChange={(event) => {
          const made = newEffect(file, event.target.value as EffectKind);
          if (made) onChange(addEffect(effects, made));
        }}
      >
        <option value="">+ Effect…</option>
        {EFFECT_KINDS.map((one) => (
          <option key={one} value={one} disabled={newEffect(file, one) === null}>
            {EFFECT_NAMES[one]}
          </option>
        ))}
      </select>
    </div>
  );
}

function EffectRow({
  file,
  effect,
  onChange,
  onMove,
  onRemove,
}: {
  file: ProjectFile;
  effect: Effect;
  onChange(patch: Partial<Effect>): void;
  onMove(by: -1 | 1): void;
  onRemove(): void;
}) {
  const kind = targetKindOf(effect.kind);
  const targets =
    kind === 'state'
      ? statesOf(file).map((one) => ({ id: one.id as string, name: one.key || 'an unnamed state' }))
      : kind === 'resource'
        ? resourcesOf(file).map((one) => ({ id: one.id as string, name: one.name || 'an unnamed resource' }))
        : elementsOf(file).map((one) => ({ id: one.id as string, name: one.name || 'an unnamed node' }));
  // Nothing to set on an unlock: the verb is the whole of it.
  const wantsValue = kind !== 'element';

  return (
    <div className="rule-row">
      <select
        value={effect.kind}
        aria-label="What it does"
        onChange={(event) => onChange({ kind: event.target.value as EffectKind })}
      >
        {EFFECT_KINDS.map((one) => (
          <option key={one} value={one}>
            {EFFECT_NAMES[one]}
          </option>
        ))}
      </select>

      <select
        value={effect.targetId}
        aria-label="To what"
        onChange={(event) => onChange({ targetId: event.target.value })}
      >
        <option value="">choose…</option>
        {targets.map((one) => (
          <option key={one.id} value={one.id}>
            {one.name}
          </option>
        ))}
      </select>

      {wantsValue ? (
        <input
          value={effect.value}
          placeholder="value"
          aria-label="The value"
          onChange={(event) => onChange({ value: event.target.value })}
        />
      ) : null}

      {/* The order is the rule: stage 2 applies them one after another, so
          *give a key* then *take a key* is not the other way round. */}
      <button type="button" className="ghost small" aria-label="Move this earlier" onClick={() => onMove(-1)}>
        ↑
      </button>
      <button type="button" className="ghost small" aria-label="Move this later" onClick={() => onMove(1)}>
        ↓
      </button>
      <button type="button" className="ghost small" aria-label="Remove this effect" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

/** The rule read back in English, under the controls that built it. */
export function RuleSentence({ file, group, empty }: { file: ProjectFile; group: ConditionGroup; empty: string }) {
  const said = sayGroup(file, group);
  return <p className="rule-said">{said.length > 0 ? said : empty}</p>;
}
