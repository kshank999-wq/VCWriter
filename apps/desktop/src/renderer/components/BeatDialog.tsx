import { useState } from 'react';
import {
  countWords,
  findBeat,
  findLane,
  findUnit,
  LANE_COLOURS,
  promisesIn,
  ref,
  removeRevision,
  speakersIn,
  startRevision,
  switchRevision,
  updateBeat,
  type Beat,
  type BeatId,
  type BeatRevisionId,
  type ProjectFile,
} from '@vcwriter/domain';
import { RelatedPanel } from './RelatedPanel';
import { BEAT_STATUSES } from './status';
import { useModal } from '../use-modal';

interface BeatDialogProps {
  file: ProjectFile;
  beatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/** The palette the swatches offer; any colour can be picked beside them. */
const BEAT_COLOURS: readonly string[] = LANE_COLOURS;

const NEW_REVISION = '__new__';
const WORKING = '__working__';

/**
 * The beat pop-up (addendum 02 §4), opened with a double-click on a beat.
 * The beat's name sits top centre with no heading under it — a beat has no
 * slugline of its own. Beside the name, **Revision**: the working revision
 * and every kept one in a list, with "New revision…" at the end. Choosing a
 * kept revision puts its text in the Script and keeps the working text in
 * its place; a new one starts as a copy of the working text. Swatches give
 * the beat a colour for the timeline and the threads. The left column is
 * what the beat contains, and the links panel is the same one the
 * inspector shows.
 */
export function BeatDialog({ file, beatId, onClose, onUpdate }: BeatDialogProps) {
  const beat = beatId ? findBeat(file, beatId) : undefined;
  const dialog = useModal(Boolean(beat));
  return (
    <dialog ref={dialog} className="lane-dialog beat-dialog" aria-label="Beat" onClose={onClose}>
      {beat ? <BeatDialogBody file={file} beat={beat} onClose={onClose} onUpdate={onUpdate} /> : null}
    </dialog>
  );
}

function BeatDialogBody({
  file,
  beat,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  beat: Beat;
  onClose(): void;
  onUpdate: BeatDialogProps['onUpdate'];
}) {
  const unit = findUnit(file, beat.unitId);
  const lane = unit ? findLane(file, unit.laneId) : undefined;
  const cast = speakersIn(beat);
  const promises = promisesIn(file, { beatId: beat.id });
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const chooseRevision = (value: string) => {
    if (value === NEW_REVISION) {
      setName(`Draft ${beat.revisions.length + 2}`);
      setNaming(true);
      return;
    }
    if (value === WORKING) return;
    onUpdate((current) => switchRevision(current, beat.id, value as BeatRevisionId));
  };

  const beginRevision = () => {
    onUpdate((current) => startRevision(current, beat.id, name));
    setNaming(false);
    setName('');
  };

  return (
    <>
      <header style={{ borderLeftColor: beat.color ?? lane?.color }}>
        <span className="scene-dialog-label muted">
          {unit ? unit.sequenceLabel || unit.title || unit.kind : 'Beat'}
        </span>
        <input
          className="bar-title beat scene-dialog-name"
          aria-label="Beat name"
          placeholder="What happens in this beat"
          value={beat.title}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
        />
        <label className="revision-picker">
          <span className="muted">Revision</span>
          <select aria-label="Revision" value={WORKING} onChange={(event) => chooseRevision(event.target.value)}>
            <option value={WORKING}>{beat.revisionName} (current)</option>
            {beat.revisions.map((revision) => (
              <option key={revision.id} value={revision.id}>
                {revision.name}
              </option>
            ))}
            <option value={NEW_REVISION}>New revision…</option>
          </select>
        </label>
        <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {naming ? (
        <form
          className="revision-naming"
          onSubmit={(event) => {
            event.preventDefault();
            beginRevision();
          }}
        >
          <span className="muted">Name the new revision. It starts as a copy of {beat.revisionName}.</span>
          <input aria-label="New revision name" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          <button type="submit">Start</button>
          <button type="button" className="ghost" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      <div className="scene-dialog-body">
        <aside className="scene-dialog-side" aria-label="In this beat">
          <h4>Characters</h4>
          {cast.length > 0 ? (
            <ul>
              {cast.map((who) => (
                <li key={who}>{who}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No one speaks yet.</p>
          )}
          <h4>Setups &amp; payoffs</h4>
          {promises.length > 0 ? (
            <ul>
              {promises.map((promise, index) => (
                <li key={`${promise.record.id}-${promise.role}-${index}`}>
                  <span className={`promise-role ${promise.role}`}>{promise.role}</span> {promise.record.title}
                  {promise.point?.description ? <span className="muted"> · {promise.point.description}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing set up or paid off here.</p>
          )}
          {beat.revisions.length > 0 ? (
            <>
              <h4>Kept revisions</h4>
              <ul className="revision-list">
                {beat.revisions.map((revision) => (
                  <li key={revision.id}>
                    <button
                      type="button"
                      className="link"
                      title="Make this the working revision"
                      onClick={() => onUpdate((current) => switchRevision(current, beat.id, revision.id))}
                    >
                      {revision.name}
                    </button>
                    <span className="muted"> · {countWords(revision.manuscript)} words</span>
                    <button
                      type="button"
                      className="ghost danger"
                      aria-label={`Remove revision ${revision.name}`}
                      title="Remove this revision"
                      onClick={() => onUpdate((current) => removeRevision(current, beat.id, revision.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>

        <div className="scene-dialog-main">
          <div className="field-row">
            <label className="field">
              Status
              <select
                value={beat.status}
                onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { status: event.target.value as Beat['status'] }))}
              >
                {BEAT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              Colour
              <div className="swatches" role="radiogroup" aria-label="Beat colour">
                <button
                  type="button"
                  role="radio"
                  aria-checked={beat.color === null}
                  aria-label="No colour"
                  className={beat.color === null ? 'swatch none checked' : 'swatch none'}
                  onClick={() => onUpdate((current) => updateBeat(current, beat.id, { color: null }))}
                />
                {BEAT_COLOURS.map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    role="radio"
                    aria-checked={beat.color === colour}
                    aria-label={`Colour ${colour}`}
                    className={beat.color === colour ? 'swatch checked' : 'swatch'}
                    style={{ background: colour }}
                    onClick={() => onUpdate((current) => updateBeat(current, beat.id, { color: colour }))}
                  />
                ))}
                <input
                  type="color"
                  className="swatch"
                  aria-label="Any colour"
                  value={beat.color ?? lane?.color ?? '#c9a45c'}
                  onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { color: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <label className="field">
            Summary
            <textarea
              rows={4}
              placeholder="What this beat does for the story"
              value={beat.summary}
              onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { summary: event.target.value }))}
            />
          </label>
          <RelatedPanel file={file} target={ref('beat', beat.id)} onUpdate={onUpdate} />
          <p className="muted">
            {countWords(beat.manuscript)} words in {beat.revisionName}
            {beat.revisions.length > 0 ? ` · ${beat.revisions.length} kept` : ''}. The text itself is in the Script; switching the
            revision changes what is there. Changes are kept as you type.
          </p>
        </div>
      </div>
    </>
  );
}
