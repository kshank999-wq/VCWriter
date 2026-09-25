import {
  addResource,
  addState,
  describeEconomy,
  describeProgression,
  progressionTiers,
  resourceEconomy,
  removeResource,
  removeState,
  resourcesOf,
  statesOf,
  updateResource,
  updateState,
  type ProjectFile,
  type ResourceDefinitionId,
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

export const STATE_KINDS: StateKind[] = ['flag', 'number', 'enum', 'text'];

export const STATE_WORDS: Record<StateKind, string> = {
  flag: 'Flag — true or false',
  number: 'Number — a score or a count',
  enum: 'One of a list',
  text: 'Text',
};

export const RESOURCE_KINDS: ResourceKind[] = [
  'weapon',
  'ammunition',
  'consumable',
  'currency',
  'key_item',
  'ability',
  'upgrade',
  'collectible',
];

export const RESOURCE_WORDS: Record<ResourceKind, string> = {
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
  overlayOn,
  onOverlay,
}: {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** Which subject the map is lighting, if any (§9). */
  overlayOn?: string | null;
  onOverlay?(subjectId: string | null): void;
}) {
  const states = statesOf(file);
  const resources = resourcesOf(file);
  const tiers = progressionTiers(file);

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
      <p className="muted small">{describeProgression(file)}</p>
      {/* Grouped by §7's tier, which is the one ordering the graph cannot
          give — and the heading is absent where nothing is ranked, because a
          single *Unranked* over the whole list says nothing. */}
      {progressionTiers(file).map((row) => (
      <div key={row.tier}>
      {tiers.length > 1 ? (
        <p className="world-tier-head muted small">{row.tier === 0 ? 'Unranked' : `Tier ${row.tier}`}</p>
      ) : null}
      <ul className="world-list">
        {row.resources.map((resource) => (
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

            {/* §7's three fields that no reading can work out, and nothing
                else: everything the spec asks for about where a resource is
                acquired, spent or needed is read from the graph below. */}
            <div className="rule-row">
              <label className="world-tier">
                <span className="muted small">Tier</span>
                <input
                  type="number"
                  min={0}
                  value={resource.tier}
                  aria-label={`Progression tier for ${resource.name || 'this resource'}`}
                  onChange={(event) =>
                    onUpdate((current) =>
                      updateResource(current, resource.id, { tier: Math.max(0, Number(event.target.value) || 0) }),
                    )
                  }
                />
              </label>
              <input
                value={resource.scarcityTarget}
                placeholder="about 30 by the reactor"
                aria-label={`Scarcity target for ${resource.name || 'this resource'}`}
                onChange={(event) =>
                  onUpdate((current) => updateResource(current, resource.id, { scarcityTarget: event.target.value }))
                }
              />
              <select
                value={(resource.upgradeOf as string) ?? ''}
                aria-label={`What ${resource.name || 'this resource'} replaces`}
                onChange={(event) =>
                  onUpdate((current) =>
                    updateResource(current, resource.id, {
                      upgradeOf: (event.target.value || null) as ResourceDefinitionId | null,
                    }),
                  )
                }
              >
                <option value="">replaces nothing</option>
                {resources
                  .filter((one) => one.id !== resource.id)
                  .map((one) => (
                    <option key={one.id as string} value={one.id as string}>
                      replaces {one.name || 'an unnamed resource'}
                    </option>
                  ))}
              </select>
            </div>

            <Economy file={file} resourceId={resource.id} overlayOn={overlayOn} onOverlay={onOverlay} />
          </li>
        ))}
      </ul>
      </div>
      ))}
      <button type="button" className="tool" onClick={() => onUpdate((current) => addResource(current).file)}>
        + Resource
      </button>
    </aside>
  );
}

/**
 * Where a resource comes from, where it goes, and what needs it (§7, §8).
 *
 * **Read every time and stored nowhere**: move the choice that grants the
 * keycard and its acquisition point moves with it. It is the answer to the
 * question a designer could not ask before — *I have written "needs a keycard"
 * in four places; is there anywhere that gives one?*
 */
export function Economy({
  file,
  resourceId,
  overlayOn,
  onOverlay,
}: {
  file: ProjectFile;
  resourceId: ResourceDefinitionId;
  overlayOn?: string | null;
  onOverlay?(subjectId: string | null): void;
}) {
  const economy = resourceEconomy(file, resourceId);
  if (!economy) return null;
  const lit = overlayOn === (resourceId as string);

  const where = (rows: { element: { name: string }; choice: { name: string } | null; amount?: string }[]) =>
    rows
      .map((one) => `${one.choice?.name || one.element.name || 'an unnamed node'}${one.amount ? ` (${one.amount})` : ''}`)
      .join(', ');

  return (
    <div className="world-economy">
      <p className="muted small">{describeEconomy(economy)}</p>
      {economy.sources.length > 0 ? <p className="small">From: {where(economy.sources)}</p> : null}
      {economy.sinks.length > 0 ? <p className="small">Spent at: {where(economy.sinks)}</p> : null}
      {economy.gates.length > 0 ? (
        <p className="small">Needed by: {economy.gates.map((one) => one.element.name || 'an unnamed node').join(', ')}</p>
      ) : null}
      {onOverlay ? (
        <button
          type="button"
          className={lit ? 'ghost small on' : 'ghost small'}
          aria-pressed={lit}
          onClick={() => onOverlay(lit ? null : (resourceId as string))}
        >
          {lit ? 'Stop lighting it on the map' : 'Light it on the map'}
        </button>
      ) : null}
    </div>
  );
}
