import { useEffect, useRef, useState } from 'react';
import {
  addRow,
  addUnit,
  avSheet,
  boardPlayback,
  clearRowFrame,
  dropRow,
  dropRowInSegment,
  formatRt,
  parseRt,
  removeBeat,
  setRowAudio,
  setRowFrame,
  setRowDialogue,
  setMaxSeconds,
  setRowHead,
  setRowTail,
  setRowVisual,
  toggleSpoken,
  updateUnit,
  type AvRow,
  type BeatId,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { frameFrom, mediaFrom } from '../frames';
import { useBoardPlayer } from '../use-board-player';

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
  /**
   * Where the playhead is while the board plays, so the timeline under the
   * sheet moves with it (§5). Null when nothing is playing.
   */
  onPlayhead?(seconds: number | null): void;
}

export function AvSheet({ file, onUpdate, onOpenRow, readOnly = false, onPlayhead }: AvSheetProps) {
  const sheet = avSheet(file);
  const rows = sheet.segments.reduce((total, segment) => total + segment.rows.length, 0);

  /** The board, laid end to end, and the clock that walks it (§5). */
  const board = boardPlayback(file);
  const player = useBoardPlayer(board);

  /** The shot being dragged, so the one under it can show it will take it. */
  const [lifting, setLifting] = useState<BeatId | null>(null);
  const [over, setOver] = useState<string | null>(null);

  // One playhead, seen twice: the sheet plays it and the timeline draws it.
  useEffect(() => {
    onPlayhead?.(player.playing ? player.elapsed : null);
  }, [player.playing, player.elapsed, onPlayhead]);

  /**
   * A new segment, numbered where it falls and waiting to be named — the
   * caret lands in its title, because a segment nobody named is a segment
   * nobody can find (§3a).
   */
  const addSegment = () => {
    const at = sheet.segments.length + 1;
    onUpdate((current) => {
      const lane = current.lanes[0];
      if (!lane) return current;
      const made = addUnit(current, { laneId: lane.id, title: '' });
      return addRow(made.file, { unitId: made.unit.id }).file;
    });
    requestAnimationFrame(() => {
      const box = document.querySelector<HTMLInputElement>(`[aria-label="Name of segment ${at}"]`);
      box?.focus();
    });
  };

  return (
    <div className="av-sheet">
      <header className="av-masthead">
        {/* The title is the project's, given when the project was started —
            not typed again here, where it could disagree with itself (§2). */}
        <h1>
          <span className="av-version">{sheet.version}</span>
          {sheet.title}
        </h1>
        <p className="muted av-totals">
          Total RT{' '}
          <strong className={sheet.over ? 'av-over' : undefined}>{formatRt(sheet.seconds)}</strong> • Total
          Words: {sheet.words}
        </p>

        {/* The slot it has to fit. A thirty is thirty (§4a). */}
        <div className="av-limit">
          <span className="muted small">Time constraint</span>
          {readOnly ? (
            <span>{sheet.limit > 0 ? formatRt(sheet.limit) : 'none'}</span>
          ) : (
            <Time
              label="The time this has to fit"
              name=""
              seconds={sheet.limit}
              readOnly={false}
              onSet={(seconds) => onUpdate((current) => setMaxSeconds(current, seconds))}
            />
          )}
          {sheet.over ? (
            <span className="av-over-note" role="status">
              Over by {formatRt(sheet.seconds - sheet.limit)}
            </span>
          ) : null}

          {/* Play the board: the frames advance at their own durations and
              the audio is read in the voices already assigned (§5). */}
          <div className="av-transport">
            {player.playing ? (
              <button type="button" className="ghost small" onClick={player.stop}>
                ■ Stop
              </button>
            ) : (
              <button
                type="button"
                className="ghost small"
                disabled={board.shots.length === 0}
                title={
                  player.supported
                    ? 'Play the board: the frames advance and the audio is read aloud'
                    : 'This build has no speech synthesis, so the board plays silently'
                }
                onClick={() => player.play(0)}
              >
                ▶ Play
              </button>
            )}
            {player.playing ? (
              <span className="av-elapsed" role="status">
                {formatRt(player.elapsed)}
                {player.shot ? <span className="muted"> · shot {player.shot.number}</span> : null}
              </span>
            ) : null}
          </div>
        </div>

        {/* What is on screen at the playhead. The board playing, seen. */}
        {player.playing && player.shot ? (
          <div className="av-monitor" aria-label="What is on screen now">
            {player.shot.frame ? (
              player.shot.moving ? (
                <video src={player.shot.frame.data} autoPlay muted playsInline />
              ) : (
                <img src={player.shot.frame.data} alt="" />
              )
            ) : (
              <span className="muted small">No frame on shot {player.shot.number}</span>
            )}
            <p className="av-monitor-line">
              {player.shot.lines.map((line) => line.text).join(' ') || <span className="muted">—</span>}
            </p>
          </div>
        ) : null}
      </header>

      {rows === 0 && sheet.segments.length === 0 ? (
        <p className="muted empty-state av-empty">
          Nothing on the board yet. A segment is a scene and a shot is a beat — start one and it appears here,
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
                    Shot
                  </th>
                  <th scope="col">Audio</th>
                  <th scope="col">Visual</th>
                  <th scope="col" className="av-image-head">
                    Image
                  </th>
                  <th scope="col" className="av-num">
                    Duration
                  </th>
                  <th scope="col" className="av-num" title="What the line's words come to, and what you did about it">
                    Words +/−
                  </th>
                  {readOnly ? null : <th scope="col" className="av-tools-head" aria-label="Close the shot" />}
                </tr>
              </thead>
              <tbody
                onDragOver={(event) => {
                  if (lifting) event.preventDefault();
                }}
                onDrop={() => {
                  // Dropped on the segment rather than on one of its shots:
                  // the end of it, which is what the space under the last
                  // shot means.
                  if (lifting) onUpdate((current) => dropRowInSegment(current, lifting, segment.unitId));
                  setLifting(null);
                  setOver(null);
                }}
              >
                {segment.rows.map((row) => (
                  <Row
                    key={row.beatId as string}
                    row={row}
                    readOnly={readOnly}
                    onUpdate={onUpdate}
                    lifting={lifting}
                    over={over}
                    onLift={setLifting}
                    onOver={setOver}
                    playing={player.playing && player.shot?.beatId === row.beatId}
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
              + Shot
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

          {/* A board is written a segment at a time, so the next one starts
              from where the last one ended rather than from the bottom. */}
          {readOnly ? null : (
            <button type="button" className="ghost small av-add-segment-here" onClick={addSegment}>
              + Segment
            </button>
          )}
        </section>
      ))}

      {readOnly || sheet.segments.length > 0 ? null : (
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
  /** Which shot is in the air, and which one it is over (§3d). */
  lifting?: BeatId | null;
  over?: string | null;
  onLift?(beatId: BeatId | null): void;
  onOver?(beatId: string | null): void;
  /** Whether the playhead is on this shot, so the sheet shows the read (§5). */
  playing?: boolean;
}

function Row({
  row,
  readOnly,
  onUpdate,
  onOpen,
  lifting = null,
  over = null,
  onLift,
  onOver,
  playing = false,
}: RowProps) {
  /**
   * Closing a shot is asked about before it is done. It is the one control
   * here that loses work, and a board is written next to a delete button all
   * day (§3d).
   */
  const [closing, setClosing] = useState(false);

  const lifted = lifting === row.beatId;
  const target = lifting !== null && !lifted && over === (row.beatId as string);

  return (
    <tr
      className={`av-row${lifted ? ' lifted' : ''}${target ? ' av-drop' : ''}${playing ? ' av-playing' : ''}`}
      onDragOver={(event) => {
        if (lifting === null || lifted) return;
        event.preventDefault();
        onOver?.(row.beatId as string);
      }}
      onDragLeave={() => {
        if (target) onOver?.(null);
      }}
      onDrop={(event) => {
        if (lifting === null || lifted) return;
        event.preventDefault();
        event.stopPropagation();
        const moved = lifting;
        onUpdate((current) => dropRow(current, moved, row.beatId));
        onLift?.(null);
        onOver?.(null);
      }}
    >
      <th
        scope="row"
        className="av-num"
        // The shot number is the grip: a board is rearranged by picking a
        // shot up and putting it where you want it (§3d).
        draggable={!readOnly}
        onDragStart={(event) => {
          if (readOnly) return;
          onLift?.(row.beatId);
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', row.number);
        }}
        onDragEnd={() => {
          onLift?.(null);
          onOver?.(null);
        }}
        title={readOnly ? undefined : 'Drag to move this shot'}
      >
        {onOpen ? (
          <button type="button" className="link av-row-number" onClick={() => onOpen(row.beatId)} title="Open the row">
            {row.number}
          </button>
        ) : (
          <span className="av-row-number">{row.number}</span>
        )}
        {readOnly ? null : (
          <span className="av-grip" aria-hidden="true">
            ⠿
          </span>
        )}
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

      {/* A shot is rarely only its line: something happens, then somebody
          speaks, then something happens (addendum 05 §4). */}
      <td className="av-num av-duration">
        <Time
          label={`Action before the line in shot ${row.number}`}
          name="Header"
          seconds={row.head}
          readOnly={readOnly}
          onSet={(seconds) => onUpdate((current) => setRowHead(current, row.beatId, seconds))}
        />
        <Time
          label={`How long the line in shot ${row.number} takes`}
          name="Dialogue"
          seconds={row.dialogue}
          estimated={row.estimated}
          readOnly={readOnly}
          onSet={(seconds) => onUpdate((current) => setRowDialogue(current, row.beatId, seconds))}
        />
        <Time
          label={`Action after the line in shot ${row.number}`}
          name="Tail"
          seconds={row.tail}
          readOnly={readOnly}
          onSet={(seconds) => onUpdate((current) => setRowTail(current, row.beatId, seconds))}
        />
        {/* The clip's own length, which is the one time here nobody types:
            a clip's length is a fact about the clip (§4b). With no clip on
            the plate the line is still drawn, and says nothing. */}
        <span className="av-time-line av-video-line">
          <span className="av-time-name muted">Video</span>
          {row.video > 0 ? (
            <span className="av-time-read" title="The clip's own length, read from the file">
              {formatRt(row.video)}
            </span>
          ) : (
            <span className="muted">—</span>
          )}
        </span>
      </td>

      {/* Four lines, on the same four lines as the times beside them, so the
          two columns read as the one thing they are. */}
      <td className="av-num av-words">
        <span className="av-time-line muted">—</span>
        <span className="av-time-line">
          {row.words} {row.words === 1 ? 'word' : 'words'}
        </span>
        <span className="av-time-line muted">—</span>
        <span className="av-time-line muted">
          {/* Where the picture outlasts the sound, the shot runs to the
              picture — said quietly, in the shot, and changing nothing. */}
          {row.video > 0 && row.video > row.head + row.dialogue + row.tail ? (
            <span className="av-holds" title="The clip runs longer than the sound, so the shot runs to the clip">
              holds
            </span>
          ) : (
            '—'
          )}
        </span>
      </td>

      {readOnly ? null : (
        <td className="av-tools">
          {/* Closing a shot sits above the line, on its own, in a box — and
              asks first, because it is the one control that loses work. */}
          {closing ? (
            <span className="av-sure" role="alertdialog" aria-label={`Close shot ${row.number}?`}>
              <span className="small">Close shot {row.number}?</span>
              <button
                type="button"
                className="small danger"
                onClick={() => onUpdate((current) => removeBeat(current, row.beatId))}
              >
                Close it
              </button>
              <button type="button" className="ghost small" onClick={() => setClosing(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="av-close"
              aria-label={`Close shot ${row.number}`}
              title={`Close shot ${row.number}`}
              onClick={() => setClosing(true)}
            >
              ×
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * One of a shot's three times (addendum 05 §4).
 *
 * The header and the tail are the writer's outright. The dialogue's is the
 * one figure in the sheet that is estimated — how long a read takes really is
 * what the words determine — and typing over it makes it theirs. Clearing the
 * box hands it back to the words.
 */
function Time({
  label,
  name,
  seconds,
  estimated = false,
  readOnly,
  onSet,
}: {
  label: string;
  name: string;
  seconds: number;
  estimated?: boolean;
  readOnly: boolean;
  onSet(seconds: number): void;
}) {
  /**
   * What is in the box while it is being typed in, so `1:` on the way to
   * `1:02` is not read as a minute and then argued with.
   */
  const [typing, setTyping] = useState<string | null>(null);

  const commit = (text: string) => {
    const value = parseRt(text);
    setTyping(null);
    // Not a time at all: the shot keeps the one it had.
    if (value === null) return;
    onSet(value);
  };

  return (
    <span className={`av-time-line${estimated ? ' estimated' : ''}`}>
      <span className="av-time-name muted">{name}</span>
      {readOnly ? (
        <span>{formatRt(seconds)}</span>
      ) : (
        <input
          className="av-time"
          aria-label={label}
          title={estimated ? 'As long as the words take. Type over it to say otherwise.' : undefined}
          value={typing ?? formatRt(seconds)}
          onChange={(event) => setTyping(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setTyping(null);
          }}
        />
      )}
    </span>
  );
}

/**
 * The plate a storyboard frame goes on (addendum 05 §3c, §4b).
 *
 * Drop a picture **or a clip** on it, or click it and choose one. A still is
 * scaled on the way in and kept in the document, so the board travels; and
 * because a row is as deep as its tallest column, **the audio beside a frame
 * spaces out to line up with it**. That alignment is not a feature bolted on —
 * it is what the layout is.
 *
 * A clip goes in as it came, because a browser cannot re-encode video, and it
 * brings its own length with it: the Video line under Tail is read from the
 * file rather than typed (§4b).
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
  /** A clip too big to travel says so here, rather than failing silently. */
  const [refused, setRefused] = useState<string | null>(null);

  const take = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setRefused(null);
    try {
      const frame = await frameFrom(file);
      onUpdate((current) => setRowFrame(current, row.beatId, frame).file);
    } catch (error) {
      setRefused(error instanceof Error ? error.message : 'That file could not be added');
    } finally {
      setBusy(false);
    }
  };

  if (readOnly) {
    if (!row.frame) return <div className="av-plate" aria-label={`Frame for row ${row.number}`} />;
    return row.moving ? (
      <video className="av-frame" src={row.frame.data} controls aria-label={`Clip for row ${row.number}`} />
    ) : (
      <img className="av-frame" src={row.frame.data} alt={`Frame for row ${row.number}`} />
    );
  }

  return (
    <div className="av-plate-holder">
      <button
        type="button"
        className={`av-plate${over ? ' over' : ''}${row.frame ? ' filled' : ''}`}
        aria-label={row.frame ? `Replace the frame for row ${row.number}` : `Add a frame to row ${row.number}`}
        title="Drop a picture or a clip here, or click to choose one"
        onClick={() => picker.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOver(false);
          void take(mediaFrom(event.dataTransfer.files));
        }}
      >
        {row.frame ? (
          row.moving ? (
            // Muted and unplayed: the plate is the board, not the monitor.
            <video src={row.frame.data} muted playsInline preload="metadata" />
          ) : (
            <img src={row.frame.data} alt="" />
          )
        ) : (
          <span className="muted small">{busy ? 'Adding…' : 'Drop a frame or a clip'}</span>
        )}
        {row.moving ? (
          <span className="av-clip-mark" aria-hidden="true">
            ▶
          </span>
        ) : null}
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

      {refused ? (
        <p className="av-refused" role="alert">
          {refused}
        </p>
      ) : null}

      <input
        ref={picker}
        type="file"
        accept="image/*,video/*"
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
