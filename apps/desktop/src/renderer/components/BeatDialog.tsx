import { useState } from 'react';
import {
  countWords,
  findBeat,
  findLane,
  findUnit,
  startRevision,
  switchRevision,
  updateBeat,
  type Beat,
  type BeatId,
  type BeatRevisionId,
  type ProjectFile,
} from '@vcwriter/domain';
import { BeatBody } from './BeatBody';
import { ManuscriptDataLists } from './ManuscriptDataLists';
import { useModal } from '../use-modal';

interface BeatDialogProps {
  file: ProjectFile;
  beatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Writing in a beat makes it the selection, so the rest of the app follows. */
  onSelect?(beatId: BeatId): void;
}

const NEW_REVISION = '__new__';
const WORKING = '__working__';

/**
 * The writing screen (addendum 02 §7).
 *
 * Double-clicking a beat opens it here, and this is where the writing is
 * done: one beat, the full window, the manuscript on paper at the real page
 * geometry, with the element flow a screenwriter expects — Return gives the
 * element that conventionally follows, Tab re-types it, cues and sluglines
 * complete from what the script already knows.
 *
 * There is no sidebar. The bar across the top carries the three things that
 * belong to the beat as a whole: its **name**, centred; the **version** it
 * is being written in; and whether it is **in the script**. Everything else
 * about the beat — colour, status, links, what it sets up — is the
 * inspector's business, and stays out of the way of the page.
 */
export function BeatDialog({ file, beatId, onClose, onUpdate, onSelect }: BeatDialogProps) {
  const beat = beatId ? findBeat(file, beatId) : undefined;
  const dialog = useModal(Boolean(beat));
  return (
    <dialog ref={dialog} className="writer-dialog" aria-label="Beat" onClose={onClose}>
      {beat ? <Writer file={file} beat={beat} onClose={onClose} onUpdate={onUpdate} onSelect={onSelect} /> : null}
    </dialog>
  );
}

function Writer({
  file,
  beat,
  onClose,
  onUpdate,
  onSelect,
}: {
  file: ProjectFile;
  beat: Beat;
  onClose(): void;
  onUpdate: BeatDialogProps['onUpdate'];
  onSelect: BeatDialogProps['onSelect'];
}) {
  const unit = findUnit(file, beat.unitId);
  const lane = unit ? findLane(file, unit.laneId) : undefined;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const chooseVersion = (value: string) => {
    if (value === NEW_REVISION) {
      setName(`Draft ${beat.revisions.length + 2}`);
      setNaming(true);
      return;
    }
    if (value === WORKING) return;
    onUpdate((current) => switchRevision(current, beat.id, value as BeatRevisionId));
  };

  return (
    <>
      <ManuscriptDataLists file={file} />

      <header className="writer-bar" style={{ borderLeftColor: beat.color ?? lane?.color }}>
        <span className="writer-caption muted">Beat name</span>
        <input
          className="writer-name"
          aria-label="Beat name"
          placeholder="Name this beat"
          value={beat.title}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
        />
        <div className="writer-tools">
          <label className="revision-picker">
            <span className="muted">Version</span>
            <select aria-label="Version" value={WORKING} onChange={(event) => chooseVersion(event.target.value)}>
              <option value={WORKING}>{beat.revisionName}</option>
              {beat.revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.name}
                </option>
              ))}
              <option value={NEW_REVISION}>New version…</option>
            </select>
          </label>
          <label className="check" title="Off: the beat keeps its text and leaves the script">
            <input
              type="checkbox"
              aria-label="In script"
              checked={beat.inScript}
              onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { inScript: event.target.checked }))}
            />
            <span>In script</span>
          </label>
          <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
      </header>

      {naming ? (
        <form
          className="revision-naming"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate((current) => startRevision(current, beat.id, name));
            setNaming(false);
            setName('');
          }}
        >
          <span className="muted">A new version starts as a copy of {beat.revisionName}.</span>
          <input aria-label="New version name" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          <button type="submit">Start</button>
          <button type="button" className="ghost" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      <div className="writer-body">
        <div className="writer-sheet">
          <BeatBody file={file} beat={beat} onUpdate={onUpdate} onActivate={() => onSelect?.(beat.id)} />
        </div>
      </div>

      <footer className="writer-status muted">
        <span>
          {unit ? `${unit.sequenceLabel || unit.kind} ${unit.title || ''}`.trim() : ''}
          {lane ? ` · ${lane.name}` : ''}
        </span>
        <span>
          {countWords(beat.manuscript)} words
          {beat.inScript ? '' : ' · not in the script'}
        </span>
        <span>Return for the next element · Tab to change its type</span>
      </footer>
    </>
  );
}
