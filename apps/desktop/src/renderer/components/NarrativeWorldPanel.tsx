import {
  addResource,
  addState,
  removeResource,
  removeState,
  resourcesOf,
  statesOf,
  updateResource,
  updateState,
  type ProjectFile,
  type ResourceKind,
  type StateKind,
} from '@vcwriter/domain';

/**
 * What the player carries (addendum 18 stage 5 — §6, §7).
 *
 * The rule builder was useless without it: every condition asks about a state
 * or a resource, and until this screen there was no way to define one. It is
 * inside the narrative map rather than in a dialog of its own because naming a
 * state is something a designer does *while* writing the rule that needs it.
 *
 * **A rename here reaches every rule**, and that is the module's §6 rather than
 * anything this screen does: a condition holds the id, so the key is only ever
 * the designer's handle. **Deleting takes the rules that mention it**, which the
 * button says out loud, because a condition about nothing cannot be evaluated
 * and cannot be repaired by guessing.
 */

const STATE_KINDS: StateKind[] = ['flag', 'number', 'enum', 'text'];

const STATE_WORDS: Record<StateKind, string> = {
  flag: 'Flag — true or false',
  number: 'Number — a score or a count',
  enum: 'One of a list',
  text: 'Text',
};

const RESOURCE_KINDS: ResourceKind[] = [
  'weapon',
  'ammunition',
  'consumable',
  'currency',
  'key_item',
  'ability',
  'upgrade',
  'collectible',
];

const RESOURCE_WORDS: Record<ResourceKind, string> = {
  weapon: 'Weapon',
  ammunition: 'Ammunition',
  consumable: 'Consumable',
  currency: 'Currency',
  key_item: 'Key item',
  ability: 'Ability',
  upgrade: 'Upgrade',
  collectible: 'Collectible',
};

export function NarrativeWorldPanel({
  file,
  onUpdate,
  onClose,
}: {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
}) {
  const states = statesOf(file);
  const resources = resourcesOf(file);

  return (
    <aside className="narrmap-world" aria-label="States and resources">
      <header>
        <h3>What the player carries</h3>
        <button type="button" className="ghost small" aria-label="Close states and resources" onClick={onClose}>
          ✕
        </button>
      </header>

      <h4>States</h4>
      <p className="muted small">
        Renaming one reaches every rule that reads it — a rule holds the state, not its name.
      </p>
      <ul className="world-list">
        {states.map((state) => (
          <li key={state.id as string}>
            <div className="rule-row">
              <input
                value={state.key}
                placeholder="trust_mara"
                aria-label="The state's name"
                onChange={(event) => onUpdate((current) => updateState(current, state.id, { key: event.target.value }))}
              />
              <select
                value={state.kind}
                aria-label="What kind of state"
                onChange={(event) =>
                  onUpdate((current) => updateState(current, state.id, { kind: event.target.value as StateKind }))
                }
              >
                {STATE_KINDS.map((one) => (
                  <option key={one} value={one}>
                    {STATE_WORDS[one]}
                  </option>
                ))}
              </select>
              <input
                value={state.initial}
                placeholder="starts as"
                aria-label="What it starts as"
                onChange={(event) =>
                  onUpdate((current) => updateState(current, state.id, { initial: event.target.value }))
                }
              />
              <button
                type="button"
                className="ghost small"
                title="Remove it, and every rule that mentions it"
                aria-label={`Remove ${state.key || 'this state'}`}
                onClick={() => onUpdate((current) => removeState(current, state.id))}
              >
                ✕
              </button>
            </div>
            {state.kind === 'enum' ? (
              <input
                className="world-choices"
                value={state.choices.join(', ')}
                placeholder="miners, company, nobody"
                aria-label="The values it may hold"
                onChange={(event) =>
                  onUpdate((current) =>
                    updateState(current, state.id, {
                      choices: event.target.value
                        .split(',')
                        .map((one) => one.trim())
                        .filter((one) => one.length > 0),
                    }),
                  )
                }
              />
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" className="tool" onClick={() => onUpdate((current) => addState(current).file)}>
        + State
      </button>

      <h4>Resources</h4>
      <p className="muted small">Anything the player has some of. A capacity of none means no ceiling.</p>
      <ul className="world-list">
        {resources.map((resource) => (
          <li key={resource.id as string}>
            <div className="rule-row">
              <input
                value={resource.name}
                placeholder="Keycard"
                aria-label="The resource's name"
                onChange={(event) =>
                  onUpdate((current) => updateResource(current, resource.id, { name: event.target.value }))
                }
              />
              <select
                value={resource.kind}
                aria-label="What kind of resource"
                onChange={(event) =>
                  onUpdate((current) =>
                    updateResource(current, resource.id, { kind: event.target.value as ResourceKind }),
                  )
                }
              >
                {RESOURCE_KINDS.map((one) => (
                  <option key={one} value={one}>
                    {RESOURCE_WORDS[one]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={resource.initial}
                aria-label="How many the player starts with"
                onChange={(event) =>
                  onUpdate((current) =>
                    updateResource(current, resource.id, { initial: Number(event.target.value) || 0 }),
                  )
                }
              />
              <button
                type="button"
                className="ghost small"
                title="Remove it, and every rule that mentions it"
                aria-label={`Remove ${resource.name || 'this resource'}`}
                onClick={() => onUpdate((current) => removeResource(current, resource.id))}
              >
                ✕
              </button>
            </div>
            {resource.kind === 'ammunition' ? (
              <select
                className="world-choices"
                value={resource.feeds[0] ?? ''}
                aria-label="Which weapon it feeds"
                onChange={(event) =>
                  onUpdate((current) =>
                    updateResource(current, resource.id, {
                      feeds: event.target.value ? [event.target.value as never] : [],
                    }),
                  )
                }
              >
                <option value="">feeds nothing yet</option>
                {resources
                  .filter((one) => one.kind === 'weapon')
                  .map((one) => (
                    <option key={one.id as string} value={one.id as string}>
                      feeds {one.name || 'an unnamed weapon'}
                    </option>
                  ))}
              </select>
            ) : null}
          </li>
        ))}
      </ul>
      <button type="button" className="tool" onClick={() => onUpdate((current) => addResource(current).file)}>
        + Resource
      </button>
    </aside>
  );
}
