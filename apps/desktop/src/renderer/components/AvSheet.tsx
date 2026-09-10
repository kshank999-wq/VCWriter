import { avSheet, formatRt, type AvRow, type BeatId, type ProjectFile } from '@vcwriter/domain';

/**
 * The AV sheet (addendum 05 §2).
 *
 * A commercial as the business actually writes one: what is heard on the
 * left, what is seen on the right, in numbered rows, with a frame beside each
 * and a running time against it. In a short-form project this **is** the
 * document — it stands where the Script stands in a screenplay.
 *
 * Nothing here is typed into the sheet's own store, because the sheet has
 * none. A segment is a scene, a row is a beat, the numbering is the story
 * order counted, and the masthead is the title page's — a title typed in two
 * places is a title that disagrees with itself.
 *
 * This is the read-only half (§8 stage 1): the document laid out, with the
 * times and the counts adding up. Writing in it is the next stage.
 */

interface AvSheetProps {
  file: ProjectFile;
  /** Opening a row opens its beat, in the same writing screen as everything else. */
  onOpenRow?(beatId: BeatId): void;
}

export function AvSheet({ file, onOpenRow }: AvSheetProps) {
  const sheet = avSheet(file);
  const rows = sheet.segments.reduce((total, segment) => total + segment.rows.length, 0);

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

      {rows === 0 ? (
        <p className="muted empty-state av-empty">
          Nothing on the board yet. A scene is a segment and a beat is a row — write one and it appears here,
          and on the timeline, because they are the same thing.
        </p>
      ) : (
        sheet.segments.map((segment) => (
          <section key={segment.unitId as string} className="av-segment">
            <header className="av-segment-head">
              <h2>{segment.name || `Segment ${segment.position}`}</h2>
              {segment.line ? <p className="av-segment-line">{segment.line}</p> : null}
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
                </tr>
              </thead>
              <tbody>
                {segment.rows.map((row) => (
                  <Row key={row.beatId as string} row={row} {...(onOpenRow ? { onOpen: onOpenRow } : {})} />
                ))}
              </tbody>
              </table>
            </div>

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
        ))
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

function Row({ row, onOpen }: { row: AvRow; onOpen?(beatId: BeatId): void }) {
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
        <Lines text={row.audio} />
        {/* The words are a check on the time and never a source for it (§4). */}
        {row.fits === false ? (
          <p className="av-tight" title="More words than the time allows, at two and a half a second">
            More words than {formatRt(row.seconds)} holds
          </p>
        ) : null}
      </td>

      <td className="av-visual">
        <Lines text={row.visual} />
      </td>

      <td className="av-image">
        {/* The plate an image goes on. Dropping one there is stage 3. */}
        <div className="av-plate" aria-label={`Frame for row ${row.number}`} />
      </td>

      <td className="av-num av-duration">{formatRt(row.seconds)}</td>
    </tr>
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
