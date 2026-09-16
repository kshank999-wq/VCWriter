import {
  describeCell,
  describeMatrix,
  endingsOf,
  isScored,
  outcomeMatrix,
  unreachableEndings,
  type NarrativeElementId,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The outcome matrix (addendum 18 stage 8 — §11).
 *
 * **Read off the rules and never typed.** A row is a state or a resource some
 * ending mentions, so an ending that stops asking about the keycard loses its
 * cell with nothing run, and a row nothing mentions is absent rather than
 * empty.
 *
 * Requirements and weights share a cell and stay distinguishable, which is
 * §11's own sentence: reading down a column you have to be able to tell *this
 * is impossible without it* from *this counts for twenty*.
 */
export function NarrativeEndingsPanel({
  file,
  onClose,
  onGoTo,
}: {
  file: ProjectFile;
  onClose(): void;
  onGoTo?(elementId: NarrativeElementId): void;
}) {
  const matrix = outcomeMatrix(file);
  const impossible = unreachableEndings(file);

  return (
    <aside className="narrmap-endings" aria-label="Endings">
      <header>
        <h3>Endings</h3>
        <button type="button" className="ghost small" aria-label="Close the endings" onClick={onClose}>
          ✕
        </button>
      </header>
      <p className="muted small">{describeMatrix(matrix)}</p>

      {matrix.endings.length === 0 ? null : (
        <table className="ending-matrix">
          <thead>
            <tr>
              <th scope="col">What decides it</th>
              {matrix.endings.map((ending) => (
                <th key={ending.id as string} scope="col">
                  <button type="button" className="link" onClick={() => onGoTo?.(ending.id)}>
                    {ending.name || 'an unnamed ending'}
                  </button>
                  {/* Read, never declared: weights make it scored. And a
                      score of nothing is earned by anything, which is said
                      rather than quietly defaulted to a number nobody chose. */}
                  <span className="muted small">
                    {!isScored(ending)
                      ? ' either way'
                      : ending.threshold > 0
                        ? ` needs ${ending.threshold}`
                        : ' scored, but anything earns it'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.subjectId}>
                <th scope="row">{row.subject}</th>
                {row.cells.map((cell, index) => (
                  <td key={index} className={cell.requires ? 'requires' : cell.contributes ? 'weighs' : ''}>
                    {describeCell(file, cell) || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {matrix.endings.length > 0 && matrix.rows.length === 0 ? (
        <p className="muted small">Nothing decides between them yet — every one of them is simply reached.</p>
      ) : null}

      {/* Stage 3 finds an ending nothing *reaches*; this is the one nothing can
          *satisfy*, which is arithmetic rather than opinion. */}
      {impossible.length > 0 ? (
        <>
          <h4>Cannot be earned</h4>
          <ul className="ending-impossible">
            {impossible.map((one) => (
              <li key={one.ending.id as string}>{one.says}</li>
            ))}
          </ul>
        </>
      ) : null}

      {endingsOf(file).length === 0 ? (
        <p className="muted small">Mark a node as an ending, or set its kind to Ending, and it appears here.</p>
      ) : null}
    </aside>
  );
}
