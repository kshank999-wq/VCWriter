import { useState } from 'react';
import { avSheet, formatRt, type AvRow, type ProjectFile } from '@vcwriter/domain';

/**
 * What a board looks like on paper (addendum 05 §8).
 *
 * Two documents come out of a short-form project and this shows either: **the
 * sheet**, which is what is on screen — audio, visual, frame and duration, in
 * rows, with each segment closing on its own figures — and **the board**, the
 * frames on their own with their lines under them, for a wall.
 *
 * It draws the same structure the printed document does, off the same
 * `avSheet`, under the same class names. That is the pattern the Script's
 * preview already follows: one source of arithmetic, two renderings of it. A
 * preview that disagreed with the print would be worse than none, and the way
 * to stop it disagreeing is to give it nothing of its own to decide.
 */

interface SheetPreviewProps {
  file: ProjectFile;
  onPageSetup?(): void;
  onExportPdf(kind: 'script' | 'board'): void;
  onPrint(kind: 'script' | 'board'): void;
  busy: boolean;
  message: string | null;
}

type Which = 'sheet' | 'board';

export function SheetPreview({ file, onPageSetup, onExportPdf, onPrint, busy, message }: SheetPreviewProps) {
  const [which, setWhich] = useState<Which>('sheet');
  const sheet = avSheet(file);
  const shots = sheet.segments.reduce((total, segment) => total + segment.rows.length, 0);

  return (
    <div className="preview sheet-preview-screen">
      <div className="panel-header">
        <h2>{which === 'sheet' ? 'The sheet' : 'The board'}</h2>
        <div className="editor-controls">
          <div className="tab-switch" role="tablist" aria-label="Which document">
            <button
              type="button"
              role="tab"
              aria-selected={which === 'sheet'}
              className={which === 'sheet' ? 'tool active' : 'tool'}
              onClick={() => setWhich('sheet')}
            >
              Sheet
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={which === 'board'}
              className={which === 'board' ? 'tool active' : 'tool'}
              onClick={() => setWhich('board')}
            >
              Board
            </button>
          </div>
          {onPageSetup ? (
            <button type="button" className="ghost" onClick={onPageSetup}>
              Page setup…
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => onPrint(which === 'board' ? 'board' : 'script')}>
            Print…
          </button>
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => onExportPdf(which === 'board' ? 'board' : 'script')}
          >
            {busy ? 'Working…' : 'Export PDF…'}
          </button>
        </div>
      </div>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}

      <div className="preview-scroll">
        <article className="sheet-doc">
          <header className="sheet-masthead">
            <h1>
              <span className="sheet-version">{sheet.version}</span>
              {sheet.title}
            </h1>
            <p className="sheet-totals">
              Total RT <strong className={sheet.over ? 'sheet-over' : undefined}>{formatRt(sheet.seconds)}</strong> ·
              Total Words: {sheet.words}
              {sheet.limit > 0 ? ` · Time constraint: ${formatRt(sheet.limit)}` : ''}
              {sheet.over ? ` · over by ${formatRt(sheet.seconds - sheet.limit)}` : ''}
            </p>
          </header>

          {shots === 0 ? <p className="sheet-none">Nothing on the board yet.</p> : null}

          {which === 'sheet'
            ? sheet.segments.map((segment) => (
                <section key={segment.unitId as string} className="sheet-segment">
                  <header className="sheet-segment-head">
                    <h2>
                      Segment {segment.position}
                      {segment.name ? ` — ${segment.name}` : ''}
                    </h2>
                    {segment.line ? <p className="sheet-segment-line">{segment.line}</p> : null}
                  </header>

                  <table className="sheet-table">
                    <thead>
                      <tr>
                        <th className="sheet-no">Shot</th>
                        <th>Audio</th>
                        <th>Visual</th>
                        <th className="sheet-image">Image</th>
                        <th className="sheet-duration">Duration</th>
                        <th className="sheet-words">Words +/−</th>
                      </tr>
                    </thead>
                    <tbody>
                      {segment.rows.map((row) => (
                        <tr key={row.beatId as string} className="sheet-row">
                          <td className="sheet-no">{row.number}</td>
                          <td className="sheet-audio">
                            <Lines text={row.audio} />
                          </td>
                          <td className="sheet-visual">
                            <Lines text={row.visual} />
                          </td>
                          <td className="sheet-image">
                            <Plate row={row} />
                          </td>
                          <td className="sheet-duration">
                            <Time name="Header" value={formatRt(row.head)} />
                            <Time name="Dialogue" value={formatRt(row.dialogue)} estimated={row.estimated} />
                            <Time name="Tail" value={formatRt(row.tail)} />
                            <Time name="Video" value={row.video > 0 ? formatRt(row.video) : '—'} />
                          </td>
                          <td className="sheet-words">
                            <div className="sheet-time" />
                            <div className="sheet-time">
                              {row.words} {row.words === 1 ? 'word' : 'words'}
                            </div>
                            <div className="sheet-time" />
                            <div className="sheet-time">
                              {row.video > row.head + row.dialogue + row.tail ? 'holds' : ''}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <footer className="sheet-segment-foot">
                    <div className="sheet-foot-name">
                      <span>End of segment {segment.position}</span>
                      <strong>{segment.name || `Segment ${segment.position}`}</strong>
                    </div>
                    <dl className="sheet-figures">
                      <Figure label="Segment RT" value={formatRt(segment.seconds)} />
                      <Figure label="Segment words" value={String(segment.words)} />
                      <Figure label="Total RT" value={formatRt(segment.totalSeconds)} />
                      <Figure label="Total words" value={String(segment.totalWords)} />
                    </dl>
                  </footer>
                </section>
              ))
            : (
                <div className="board-grid">
                  {sheet.segments.map((segment) => (
                    <div key={segment.unitId as string} className="board-run">
                      <h2 className="board-segment">
                        Segment {segment.position}
                        {segment.name ? ` — ${segment.name}` : ''} · {formatRt(segment.seconds)}
                      </h2>
                      {segment.rows.map((row) => (
                        <div key={row.beatId as string} className="board-panel">
                          <Plate row={row} />
                          <div className="board-caption">
                            <span className="board-shot">{row.number}</span>
                            <span className="board-rt">{formatRt(row.seconds)}</span>
                          </div>
                          <div className="board-said">
                            <Lines text={row.audio} blank="" />
                          </div>
                          <div className="board-seen">
                            <Lines text={row.visual} blank="" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
        </article>
      </div>
    </div>
  );
}

/**
 * What goes in the Image column.
 *
 * A picture is the picture. A **clip** cannot be: there is no frame to pull
 * out of it without decoding video, and a board that printed a black
 * rectangle where the footage goes would be lying about what is there. So it
 * says what it is, and how long it runs.
 */
function Plate({ row }: { row: AvRow }) {
  if (!row.frame) return <div className="sheet-plate empty" />;
  if (row.moving) {
    return (
      <div className="sheet-plate clip">
        <span className="sheet-clip-name">{row.frame.name || 'Clip'}</span>
        <span className="sheet-clip-rt">{formatRt(row.video)}</span>
      </div>
    );
  }
  return <img className="sheet-frame" src={row.frame.data} alt="" />;
}

function Time({ name, value, estimated = false }: { name: string; value: string; estimated?: boolean }) {
  return (
    <div className={`sheet-time${estimated ? ' estimated' : ''}`}>
      <span className="sheet-time-name">{name}</span>
      <span>{value}</span>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="sheet-figure">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Lines({ text, blank = '—' }: { text: string; blank?: string }) {
  const rows = text.split('\n').filter((line) => line.trim().length > 0);
  if (rows.length === 0) return blank ? <p className="sheet-none">{blank}</p> : null;
  return (
    <>
      {rows.map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </>
  );
}
