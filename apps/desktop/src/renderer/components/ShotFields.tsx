import {
  CAMERA_MOVES,
  SHOT_TYPES,
  addRow,
  avSheet,
  findUnit,
  formatRt,
  setRowAudio,
  setRowDialogue,
  setRowHead,
  setRowShot,
  setRowTail,
  setRowVisual,
  updateUnit,
  type AvRow,
  type BeatId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { ShotPicker } from './ShotPicker';
import { useModal } from '../use-modal';

/**
 * **A shot, as a shot** — short form only (from Ken, 15 November: *these
 * aren't scenes, these are shots. So it would be scene one, shot one, which
 * is 1.1… it should give you the framing, the camera move, and a
 * description… It doesn't need to say main plot or setups and payoffs*).
 *
 * The same fields as the shot's row on the sheet, in the same words: shot
 * type, camera move, description, what is heard, and its times. Used by the
 * segment pop-up, the shot pop-up and the Inspector, so a short-form project
 * never meets the screenplay's scene heading — whose *INT. … DAY* fields
 * wrote into the first shot's audio, which is what the audio is.
 */

type Update = (mutate: (current: ProjectFile) => ProjectFile) => void;

export const shotRow = (file: ProjectFile, beatId: BeatId): AvRow | undefined =>
  avSheet(file)
    .segments.flatMap((segment) => segment.rows)
    .find((row) => row.beatId === beatId);

const Seconds = ({ label, value, onSet }: { label: string; value: number; onSet(seconds: number): void }) => (
  <label className="field shot-time">
    {label}
    <input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(event) => onSet(Math.max(0, Math.round(Number(event.target.value) || 0)))}
    />
  </label>
);

export function ShotFields({ row, onUpdate, showNumber = true }: { row: AvRow; onUpdate: Update; showNumber?: boolean }) {
  const id = row.beatId;
  return (
    <div className="shot-fields" data-shot={id as string}>
      {showNumber ? <h4 className="shot-fields-number">Shot {row.number}</h4> : null}
      <div className="shot-fields-pair">
        <label className="field">
          Shot type
          <ShotPicker
            label={`Shot type of shot ${row.number}`}
            placeholder="Cowboy shot, Close-up…"
            value={row.shotType}
            list={SHOT_TYPES}
            onChange={(shotType) => onUpdate((current) => setRowShot(current, id, { shotType }))}
          />
        </label>
        <label className="field">
          Camera move
          <ShotPicker
            label={`Camera move of shot ${row.number}`}
            placeholder="Static, Push in…"
            value={row.cameraMove}
            list={CAMERA_MOVES}
            onChange={(cameraMove) => onUpdate((current) => setRowShot(current, id, { cameraMove }))}
          />
        </label>
      </div>
      <label className="field">
        Description
        <textarea
          rows={3}
          aria-label={`Description of shot ${row.number}`}
          placeholder="What is seen"
          value={row.visual}
          onChange={(event) => onUpdate((current) => setRowVisual(current, id, event.target.value))}
        />
      </label>
      <label className="field">
        Audio
        <textarea
          rows={3}
          aria-label={`Audio of shot ${row.number}`}
          placeholder="What is heard"
          value={row.audioTyped}
          onChange={(event) => onUpdate((current) => setRowAudio(current, id, event.target.value))}
        />
      </label>
      <div className="shot-fields-times">
        <Seconds label="Header (s)" value={row.head} onSet={(seconds) => onUpdate((current) => setRowHead(current, id, seconds))} />
        <Seconds
          label={row.estimated ? 'Dialogue (s, est.)' : 'Dialogue (s)'}
          value={row.dialogue}
          onSet={(seconds) => onUpdate((current) => setRowDialogue(current, id, seconds))}
        />
        <Seconds label="Tail (s)" value={row.tail} onSet={(seconds) => onUpdate((current) => setRowTail(current, id, seconds))} />
        <span className="muted small shot-fields-rt">Runs {formatRt(row.seconds)}</span>
      </div>
    </div>
  );
}

/** Double-clicking a shot on the timeline, in short form: the shot, not the screenplay writing screen. */
export function ShotDialog({
  file,
  beatId,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  beatId: BeatId | null;
  onClose(): void;
  onUpdate: Update;
}) {
  const row = beatId ? shotRow(file, beatId) : undefined;
  const dialog = useModal(Boolean(row));
  return (
    <dialog ref={dialog} className="track-dialog shot-dialog" aria-label="Shot" onClose={onClose}>
      {row ? (
        <>
          <header className="shot-dialog-head">
            <h3>Shot {row.number}</h3>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <ShotFields row={row} onUpdate={onUpdate} showNumber={false} />
        </>
      ) : null}
    </dialog>
  );
}

/**
 * Double-clicking a segment on the timeline, in short form: its name and
 * what it is for, and every shot in it — 1.1, 1.2 — with their framing, move,
 * description and audio. No slugline, no track, no setups and payoffs.
 */
export function SegmentDialog({
  file,
  unitId,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  unitId: StructuralUnitId | null;
  onClose(): void;
  onUpdate: Update;
}) {
  const unit = unitId ? findUnit(file, unitId) : undefined;
  const segment = unit ? avSheet(file).segments.find((one) => one.unitId === unit.id) : undefined;
  const dialog = useModal(Boolean(unit));
  return (
    <dialog ref={dialog} className="track-dialog shot-dialog segment-dialog" aria-label="Segment" onClose={onClose}>
      {unit ? (
        <>
          <header className="shot-dialog-head">
            <h3>Segment {segment?.position ?? ''}</h3>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="shot-dialog-body">
            <label className="field">
              Name
              <input
                value={unit.title}
                placeholder="Name of the segment"
                onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { title: event.target.value }))}
              />
            </label>
            <label className="field">
              What it is for
              <textarea
                rows={2}
                value={unit.summary}
                onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { summary: event.target.value }))}
              />
            </label>
            {(segment?.rows ?? []).map((row) => (
              <ShotFields key={row.beatId as string} row={row} onUpdate={onUpdate} />
            ))}
            <button
              type="button"
              className="ghost"
              onClick={() => onUpdate((current) => addRow(current, { unitId: unit.id }).file)}
            >
              + Shot
            </button>
            {segment ? (
              <p className="muted small">
                Segment runs {formatRt(segment.seconds)} · {segment.words} words
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
