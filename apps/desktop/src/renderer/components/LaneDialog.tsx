import { findLane, laneKindSchema, updateLane, type LaneId, type ProjectFile } from '@vcwriter/domain';
import { useModal } from '../use-modal';

interface LaneDialogProps {
  file: ProjectFile;
  laneId: LaneId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * The plot pop-up (addendum 02 §4): clicking a lane's track header opens
 * the plot itself — its summary and its arc — over the workspace, to think
 * in; closing it returns to the lanes with nothing else changed. The fields
 * write through `updateLane` as they are typed, so there is no Save.
 */
export function LaneDialog({ file, laneId, onClose, onUpdate }: LaneDialogProps) {
  const lane = laneId ? findLane(file, laneId) : undefined;
  const dialog = useModal(Boolean(lane));

  return (
    <dialog ref={dialog} className="lane-dialog" aria-label="Plot" onClose={onClose}>
      {lane ? (
        <>
          <header style={{ borderLeftColor: lane.color }}>
            <div className="lane-dialog-title">
              <input
                className="bar-title"
                aria-label="Plot name"
                value={lane.name}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { name: event.target.value || 'Lane' }))}
              />
              <select
                aria-label="Plot kind"
                value={lane.kind}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { kind: event.target.value as typeof lane.kind }))}
              >
                {laneKindSchema.options.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <input
                type="color"
                className="swatch"
                aria-label="Plot colour"
                value={lane.color}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { color: event.target.value }))}
              />
            </div>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="lane-dialog-body">
            <label className="field">
              Summary
              <textarea
                rows={4}
                placeholder="What this thread of the story is about"
                value={lane.description}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { description: event.target.value }))}
              />
            </label>
            <label className="field">
              Arc
              <textarea
                rows={10}
                placeholder="How it develops: where it starts, what turns it, where it ends"
                value={lane.arc}
                onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { arc: event.target.value }))}
              />
            </label>
            <p className="muted">
              {file.units.filter((unit) => unit.laneId === lane.id).length} scenes in this plot. Changes are kept as you type.
            </p>
          </div>
        </>
      ) : null}
    </dialog>
  );
}
