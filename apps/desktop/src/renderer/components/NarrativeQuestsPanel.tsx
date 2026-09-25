import {
  addQuest,
  questSteps,
  questsOf,
  removeQuest,
  sayObjective,
  unitsInStoryOrder,
  unplacedObjectives,
  updateQuest,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * Quests (addendum 25 §3): objectives strung together in order.
 *
 * A quest stores its name and nothing else. Its steps are the objectives that
 * name it, and which of them are done is read off a player's state in the
 * simulator — so this panel lists and names, and never marks anything done.
 * Objectives themselves are written on the scene they belong to, in the panel
 * beside the map, because that is where a designer is when they think of one.
 */
export function NarrativeQuestsPanel({
  file,
  onUpdate,
  onClose,
  onGoToScene,
}: {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** Open the scene an objective sits under. */
  onGoToScene?(unitId: StructuralUnitId): void;
}) {
  const quests = questsOf(file);
  const sceneOf = new Map(unitsInStoryOrder(file).map((unit, index) => [unit.id as string, { unit, index }]));
  const loose = unplacedObjectives(file);

  const sceneWords = (unitId: StructuralUnitId | null): string => {
    const at = unitId ? sceneOf.get(unitId as string) : undefined;
    return at ? `scene ${at.index + 1}${at.unit.title.trim() ? ` · ${at.unit.title.trim()}` : ''}` : 'no scene';
  };

  return (
    <aside className="narrmap-endings narrmap-quests" aria-label="Quests">
      <header>
        <h3>Quests</h3>
        <button type="button" className="ghost small" aria-label="Close the quests" onClick={onClose}>
          ✕
        </button>
      </header>
      <p className="muted small">
        {quests.length === 0
          ? 'A quest strings objectives together. Add one, then give objectives on the lane a quest.'
          : `${quests.length} quest${quests.length === 1 ? '' : 's'}.`}
      </p>

      <ul className="narrmap-quest-list">
        {quests.map((quest) => {
          const steps = questSteps(file, quest.id);
          return (
            <li key={quest.id as string}>
              <div className="rule-row">
                <input
                  value={quest.name}
                  placeholder="Untitled quest"
                  aria-label="The quest's name"
                  onChange={(event) => onUpdate((current) => updateQuest(current, quest.id, { name: event.target.value }))}
                />
                <button
                  type="button"
                  className="ghost small"
                  title="Remove the quest. Its objectives stay, in no quest."
                  aria-label={`Remove ${quest.name || 'the quest'}`}
                  onClick={() => onUpdate((current) => removeQuest(current, quest.id))}
                >
                  ✕
                </button>
              </div>
              {steps.length === 0 ? (
                <p className="muted small">No objectives yet. Pick this quest on an objective and it appears here.</p>
              ) : (
                <ol className="narrmap-quest-steps">
                  {steps.map((step) => (
                    <li key={step.id as string}>
                      <span>
                        <button
                          type="button"
                          className="link"
                          disabled={!step.unitId || !sceneOf.has(step.unitId as string)}
                          onClick={() => step.unitId && onGoToScene?.(step.unitId)}
                        >
                          {sayObjective(file, step)}
                        </button>
                        <span className="muted small"> — {sceneWords(step.unitId)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>

      <button type="button" className="tool" onClick={() => onUpdate((current) => addQuest(current, { name: '' }).file)}>
        + Quest
      </button>

      {loose.length > 0 ? (
        <>
          <h4>Not under a scene</h4>
          <ul className="narrmap-quest-steps">
            {loose.map((one) => (
              <li key={one.id as string} className="muted small">
                {sayObjective(file, one)}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  );
}
