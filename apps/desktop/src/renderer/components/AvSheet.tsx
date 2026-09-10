import { useRef, useState } from 'react';
import {
  addRow,
  addUnit,
  avSheet,
  clearRowFrame,
  formatRt,
  moveRow,
  parseRt,
  removeBeat,
  setRowAudio,
  setRowFrame,
  setRowSeconds,
  setRowVisual,
  toggleSpoken,
  updateUnit,
  type AvRow,
  type BeatId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { frameFrom, pictureFrom } from '../frames';

/**
 * The AV sheet (addendum 05 §2), and the place the work happens (§8 stage 2).
 *
 * A commercial as the business actually writes one: what is heard on the
 * left, what is seen on the right, in numbered rows, with a frame beside each
 * and a running time against it. In a short-form project this **is** the
 * document — it stands where the Script stands in a screenplay.
 *
 * Nothing here is typed into the sheet's own store, because the sheet has
 * none. A segment is a scene, a row is a beat, the numbering is the story
 * order counted, and the masthead is the title page's — a title typed in two
 * places is a title that disagrees with itself. Which is also why a row added
 * or moved here is added or moved on the timeline: there is nothing to keep
 * in step, because there is only one of it.
 */

interface AvSheetProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Opening a row opens its beat, in the same writing screen as everything else. */
  onOpenRow?(beatId: BeatId): void;
  /** Read-only where the sheet is being looked at rather than written in. */
  readOnly?: boolean;
}

export function AvSheet({ file, onUpdate, onOpenRow, readOnly = false }: AvSheetProps) {
  const sheet = avSheet(file);
  const rows = sheet.segments.reduce((total, segment) => total + segment.rows.length, 0);

  const addSegment = () =>
    onUpdate((current) => {
      const lane = current.lanes[0];
      if (!lane) return current;
      const made = addUnit(current, { laneId: lane.id, title: '' });
      return addRow(made.file, { unitId: made.unit.id }).file;
    });

  return (
    <div className="av-sheet">
      <header className="av-masthead">
        <h1>
          <span className="av-version">{sheet.version}</span>
          {sheet.title}
        </h1>
        <p className="muted">
          Total RT {formatRt(sheet.seconds)} • Total Words: {sheet.words}
        </p>
      </header>

      {rows === 0 && sheet.segments.length === 0 ? (
        <p className="muted empty-state av-empty">
          Nothing on the board yet. A segment is a scene and a row is a beat — start one and it appears here,
          and on the timeline, because they are the same thing.
        </p>
      ) : null}

      {sheet.segments.map((segment) => (
        <section key={segment.unitId as string} className="av-segment">
          <header className="av-segment-head">
            {/* It says Segment, and the name is written beside the number
                rather than in place of it (addendum 05 §3a). */}
            <h2 className="av-segment-heading">
              <span className="av-segment-no">Segment {segment.position}</span>
              {readOnly ? (
                segment.name ? <span className="av-segment-named">— {segment.name}</span> : null
              ) : (
                <>
                  <span className="av-segment-dash" aria-hidden="true">
                    —
                  </span>
                  <input
                    className="av-segment-name"
                    aria-label={`Name of segment ${segment.position}`}
                    placeholder="name it"
                    value={segment.name}
                    onChange={(event) =>
                      onUpdate((current) => updateUnit(current, segment.unitId, { title: event.target.value }))
                    }
                  />
                </>
              )}
            </h2>
            {readOnly ? (
              segment.line ? <p className="av-segment-line">{segment.line}</p> : null
            ) : (
              <input
                className="av-segment-line"
                aria-label={`What segment ${segment.position} is for`}
                placeholder="What this segment is for"
                value={segment.line}
                onChange={(event) =>
                  onUpdate((current) => updateUnit(current, segment.unitId, { summary: event.target.value }))
                }
              />
            )}
          </header>

          <div className="av-scroll">
            <table className="av-table">
              <thead>
                <tr>
                  <th scope="col" className="av-num">
                    Row
                  </th>
                  <th scope="col">Audio</th>
                  <th scope="col">Visual</th>
                  <th scope="col" className="av-image-head">
                    Image
                  </th>
                  <th scope="col" className="av-num">
                    Duration
                  </th>
                  {readOnly ? null : <th scope="col" className="av-tools-head" aria-label="Move or remove" />}
                </tr>
              </thead>
              <tbody>
                {segment.rows.map((row) => (
                  <Row
                    key={row.beatId as string}
                    row={row}
                    readOnly={readOnly}
                    onUpdate={onUpdate}
                    {...(onOpenRow ? { onOpen: onOpenRow } : {})}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {readOnly ? null : (
            <button
              type="button"
              className="ghost small av-add-row"
              onClick={() => onUpdate((current) => addRow(current, { unitId: segment.unitId }).file)}
            >
              + Row
            </button>
          )}

          {/* A commercial is sold in segments and cut in segments, so the
              foot of one says where it lands and where the whole stands. */}
          <footer className="av-segment-foot">
            <div className="av-foot-name">
              <span className="muted small">End of segment {segment.position}</span>
              <strong>{segment.name || `Segment ${segment.position}`}</strong>
            </div>
            <dl className="av-figures">
              <Figure label="Segment RT" value={formatRt(segment.seconds)} />
              <Figure label="Segment words" value={String(segment.words)} />
              <Figure label="Total RT" value={formatRt(segment.totalSeconds)} />
              <Figure label="Total words" value={String(segment.totalWords)} />
            </dl>
          </footer>
        </section>
      ))}

      {readOnly ? null : (
        <button type="button" className="ghost av-add-segment" onClick={addSegment}>
          + Segment
        </button>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="av-figure">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

interface RowProps {
  row: AvRow;
  readOnly: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onOpen?(beatId: BeatId): void;
}

function Row({ row, readOnly, onUpdate, onOpen }: RowProps) {
  /**
   * What is in the duration box while it is being typed in.
   *
   * A time is held as text until it is left, so `1:` on the way to `1:02` is
   * not read as a minute and then argued with. Null means the box is showing
   * what the row actually says.
   */
  const [typing, setTyping] = useState<string | null>(null);

  const commit = (text: string) => {
    const seconds = parseRt(text);
    setTyping(null);
    // Not a time at all: the row keeps the one it had.
    if (seconds === null) return;
    onUpdate((current) => setRowSeconds(current, row.beatId, seconds));
  };

  return (
    <tr className="av-row">
      <th scope="row" className="av-num">
        {onOpen ? (
          <button type="button" className="link av-row-number" onClick={() => onOpen(row.beatId)} title="Open the row">
            {row.number}
          </button>
        ) : (
          <span className="av-row-number">{row.number}</span>
        )}
        <span className="muted small under">
          {row.words} {row.words === 1 ? 'word' : 'words'}
        </span>
        <span className="muted small under">{formatRt(row.seconds)} RT</span>
      </th>

      <td className="av-audio">
        {readOnly ? (
          <Lines text={row.audio} />
        ) : (
          <Grow
            label={`What is heard in row ${row.number}`}
            placeholder="what is heard"
            value={row.audio}
            onChange={(text) => onUpdate((current) => setRowAudio(current, row.beatId, text))}
            spokenKey
          />
        )}
        {/* The words are a check on the time and never a source for it (§4). */}
        {row.fits === false ? (
          <p className="av-tight" title="More words than the time allows, at two and a half a second">
            More words than {formatRt(row.seconds)} holds
          </p>
        ) : null}
      </td>

      <td className="av-visual">
        {readOnly ? (
          <Lines text={row.visual} />
        ) : (
          <Grow
            label={`What is seen in row ${row.number}`}
            placeholder="what is seen"
            value={row.visual}
            onChange={(text) => onUpdate((current) => setRowVisual(current, row.beatId, text))}
          />
        )}
      </td>

      <td className="av-image">
        <Plate row={row} readOnly={readOnly} onUpdate={onUpdate} />
      </td>

      <td className="av-num av-duration">
        {readOnly ? (
          formatRt(row.seconds)
        ) : (
          <input
            className="av-time"
            aria-label={`How long row ${row.number} runs`}
            value={typing ?? formatRt(row.seconds)}
            onChange={(event) => setTyping(event.target.value)}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') setTyping(null);
            }}
          />
        )}
      </td>

      {readOnly ? null : (
        <td className="av-tools">
          <button
            type="button"
            className="ghost small"
            aria-label={`Move row ${row.number} up`}
            onClick={() => onUpdate((current) => moveRow(current, row.beatId, -1))}
          >
            ↑
          </button>
          <button
            type="button"
            className="ghost small"
            aria-label={`Move row ${row.number} down`}
            onClick={() => onUpdate((current) => moveRow(current, row.beatId, 1))}
          >
            ↓
          </button>
          <button
            type="button"
            className="ghost small"
            aria-label={`Remove row ${row.number}`}
            onClick={() => onUpdate((current) => removeBeat(current, row.beatId))}
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
}

/**
 * The plate a storyboard frame goes on (addendum 05 §3c).
 *
 * Drop a picture on it, or click it and choose one. The frame is scaled on
 * the way in and kept in the document, so the board travels; and because a
 * row is as deep as its tallest column, **the audio beside a frame spaces out
 * to line up with it**. That alignment is not a feature bolted on — it is
 * what the layout is.
 */
function Plate({
  row,
  readOnly,
  onUpdate,
}: {
  row: AvRow;
  readOnly: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const take = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const frame = await frameFrom(file);
      onUpdate((current) => setRowFrame(current, row.beatId, frame).file);
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    return row.frame ? (
      <img className="av-frame" src={row.frame.data} alt={`Frame for row ${row.number}`} />
    ) : (
      <div className="av-plate" aria-label={`Frame for row ${row.number}`} />
    );
  }

  return (
    <div className="av-plate-holder">
      <button
        type="button"
        className={`av-plate${over ? ' over' : ''}${row.frame ? ' filled' : ''}`}
        aria-label={row.frame ? `Replace the frame for row ${row.number}` : `Add a frame to row ${row.number}`}
        title="Drop a picture here, or click to choose one"
        onClick={() => picker.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          void take(pictureFrom(event.dataTransfer.files));
        }}
      >
        {row.frame ? (
          <img src={row.frame.data} alt="" />
        ) : (
          <span className="muted small">{busy ? 'Adding…' : 'Drop a frame'}</span>
        )}
      </button>

      {row.frame ? (
        <button
          type="button"
          className="ghost small av-frame-off"
          aria-label={`Remove the frame from row ${row.number}`}
          onClick={() => onUpdate((current) => clearRowFrame(current, row.beatId))}
        >
          ×
        </button>
      ) : null}

      <input
        ref={picker}
        type="file"
        accept="image/*"
        hidden
        aria-label={`Choose a frame for row ${row.number}`}
        onChange={(event) => {
          void take(event.target.files?.[0] ?? null);
          event.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * A box that is as tall as what is in it.
 *
 * An AV column is plain lines and the row is as deep as its longest column,
 * so a box with a scrollbar in it would hide the very thing the layout is
 * for. The text under it does the sizing, exactly as a manuscript line does.
 */
function Grow({
  label,
  placeholder,
  value,
  onChange,
  spokenKey = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange(text: string): void;
  /** Tab marks the line as spoken, which only the audio column has (§3b). */
  spokenKey?: boolean;
}) {
  /**
   * Tab puts the line you are on in quotation marks, and Tab again takes them
   * off — narration and dialogue are different things in a commercial, and
   * this is how a board says which is which. It does not move focus, for the
   * same reason Tab does not in the beat window.
   */
  const speak = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!spokenKey || event.key !== 'Tab' || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    const box = event.currentTarget;
    const lines = box.value.split('\n');
    const upTo = box.value.slice(0, box.selectionStart).split('\n').length - 1;
    const was = lines[upTo] ?? '';
    lines[upTo] = toggleSpoken(was);
    onChange(lines.join('\n'));

    // Leave the caret inside the quotation marks it just put there.
    const before = lines.slice(0, upTo).reduce((total, line) => total + line.length + 1, 0);
    const at = before + Math.max(0, (lines[upTo] ?? '').length - (was.trim().startsWith('"') ? 0 : 1));
    requestAnimationFrame(() => box.setSelectionRange(at, at));
  };

  return (
    <div className="av-grow">
      <div className="av-grow-ink" aria-hidden="true">
        {value.length === 0 ? placeholder : value}
      </div>
      <textarea
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onKeyDown={speak}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/** Plain lines, one under another: what an AV column is made of. */
function Lines({ text }: { text: string }) {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return <span className="muted">—</span>;
  return (
    <>
      {lines.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </>
  );
}
