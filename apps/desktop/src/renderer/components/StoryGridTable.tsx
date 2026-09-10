import { useState } from 'react';
import {
  COMMANDMENTS,
  COMMANDMENT_ASKS,
  COMMANDMENT_NAMES,
  GRID_SHOW_NAMES,
  actCommandments,
  setSceneCommandment,
  setSceneGrid,
  storyGridRows,
  viewGridRows,
  type GridRow,
  type GridView,
  type ProjectFile,
  type SceneGrid,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { ValueGraph } from './ValueGraph';

/**
 * The grid itself (addendum 04 §5).
 *
 * One row per scene, in reading order, read **down** the columns rather than
 * across a card. That is the whole difference from the Final Editor: a card
 * tells you about a scene, a grid tells you about the story.
 *
 * **Empty cells are the finding.** A run of scenes with no value shift, a
 * scene with no crisis, three in a row turning the same way — these are
 * visible because the shape is dense and regular, not because a rule fired.
 * Nothing here grades anything, and nothing fills itself in.
 *
 * Filtering and sorting are the analysis: show me the scenes that do not
 * turn, show me everything in this act, show me the negative ones.
 */

/** The polarity, drawn so a column of it can be read at a glance (§5). */
const SHIFTS: { value: SceneGrid['polarity']; mark: string; name: string }[] = [
  { value: '', mark: '·', name: 'Not said' },
  { value: 'up', mark: '+', name: 'Up' },
  { value: 'down', mark: '−', name: 'Down' },
  { value: 'mixed', mark: '±', name: 'Both ways' },
  { value: 'flat', mark: '=', name: 'Does not move' },
];

interface StoryGridTableProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToUnit?(unitId: StructuralUnitId): void;
}

export function StoryGridTable({ file, onUpdate, onGoToUnit }: StoryGridTableProps) {
  const [view, setView] = useState<GridView>({ show: '', act: '', sort: 'order' });

  const all = storyGridRows(file);
  const acts = actCommandments(file);
  const rows = viewGridRows(all, view);

  const set = (unitId: StructuralUnitId, patch: Partial<SceneGrid>) =>
    onUpdate((current) => setSceneGrid(current, unitId, patch));

  return (
    <section className="grid-table-section">
      {/* The polarity column, plotted, before the column itself (§6): the
          shape of the story first, then the fifty rows it is made of. */}
      <ValueGraph rows={all} {...(onGoToUnit ? { onGoToUnit } : {})} />

      <h3>
        The grid
        <span className="muted small grid-count">
          {rows.length === all.length
            ? `${all.length} ${all.length === 1 ? 'scene' : 'scenes'}`
            : `${rows.length} of ${all.length}`}
        </span>
      </h3>
      <p className="muted small commandments-note">
        Every scene, down the page. What is at stake, which way it moves, and the five questions again — read
        down a column rather than across a row, and the gaps are what you came to see.
      </p>

      <div className="grid-controls">
        <label className="toggle">
          Show
          <select
            aria-label="Which scenes to show"
            value={view.show}
            onChange={(event) => setView({ ...view, show: event.target.value as GridView['show'] })}
          >
            {(Object.keys(GRID_SHOW_NAMES) as GridView['show'][]).map((show) => (
              <option key={show} value={show}>
                {GRID_SHOW_NAMES[show]}
              </option>
            ))}
          </select>
        </label>

        {acts.length > 0 ? (
          <label className="toggle">
            In
            <select
              aria-label="Which act"
              value={view.act}
              onChange={(event) => setView({ ...view, act: event.target.value })}
            >
              <option value="">The whole story</option>
              {acts.map((act) => (
                <option key={act.markerId as string} value={act.label}>
                  {act.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="toggle">
          Order
          <select
            aria-label="What order"
            value={view.sort}
            onChange={(event) => setView({ ...view, sort: event.target.value as GridView['sort'] })}
          >
            <option value="order">Reading order</option>
            <option value="longest">Longest first</option>
            <option value="shortest">Shortest first</option>
          </select>
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="muted small">
          {all.length === 0 ? 'No scenes yet.' : 'Nothing matches that — which is an answer of its own.'}
        </p>
      ) : (
        <div className="grid-table-scroll">
          <table className="grid-table">
            <thead>
              <tr>
                <th scope="col" className="grid-num">
                  #
                </th>
                <th scope="col">Scene</th>
                <th scope="col" className="grid-num">
                  Length
                </th>
                <th scope="col">Story event</th>
                <th scope="col">At stake</th>
                <th scope="col" className="grid-num" title="Which way the value moves">
                  Shift
                </th>
                {COMMANDMENTS.map((which) => (
                  <th key={which} scope="col" title={COMMANDMENT_ASKS[which]}>
                    {COMMANDMENT_NAMES[which]}
                  </th>
                ))}
                <th scope="col">POV</th>
                <th scope="col">Who, where, when</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row
                  key={row.unitId as string}
                  row={row}
                  onSet={(patch) => set(row.unitId, patch)}
                  onSetCommandment={(which, text) =>
                    onUpdate((current) => setSceneCommandment(current, row.unitId, which, text))
                  }
                  {...(onGoToUnit ? { onGo: () => onGoToUnit(row.unitId) } : {})}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({
  row,
  onSet,
  onSetCommandment,
  onGo,
}: {
  row: GridRow;
  onSet(patch: Partial<SceneGrid>): void;
  onSetCommandment(which: (typeof COMMANDMENTS)[number], text: string): void;
  onGo?(): void;
}) {
  const where = [row.characters.join(', '), row.setting, row.time].filter((part) => part.length > 0).join(' · ');
  return (
    <tr className={row.polarity === 'flat' ? 'grid-row flat' : 'grid-row'}>
      <td className="grid-num muted">{row.position}</td>
      <th scope="row">
        {onGo ? (
          <button type="button" className="link" onClick={onGo} title="Go to it">
            {row.label}
          </button>
        ) : (
          row.label
        )}
        {row.act ? <span className="muted small under">{row.act}</span> : null}
      </th>
      <td className="grid-num muted small">
        {row.pages} {row.pages === 1 ? 'p' : 'pp'}
        <span className="under">{row.words} w</span>
      </td>
      <td>
        <input
          aria-label={`What happens in ${row.label}`}
          // The read's own words, offered rather than written: a suggestion
          // the writer can ignore, and never mistaken for their answer.
          placeholder={row.suggestedEvent || 'what happens'}
          value={row.event}
          onChange={(event) => onSet({ event: event.target.value })}
        />
      </td>
      <td>
        <input
          aria-label={`What is at stake in ${row.label}`}
          placeholder="trust / betrayal"
          value={row.value}
          onChange={(event) => onSet({ value: event.target.value })}
        />
      </td>
      <td className="grid-num">
        <select
          className="grid-shift"
          aria-label={`Which way ${row.label} moves`}
          value={row.polarity}
          onChange={(event) => onSet({ polarity: event.target.value as SceneGrid['polarity'] })}
        >
          {SHIFTS.map((shift) => (
            <option key={shift.value} value={shift.value} title={shift.name}>
              {shift.mark}
            </option>
          ))}
        </select>
      </td>
      {COMMANDMENTS.map((which) => {
        const found = row.suggested[which];
        return (
          <td key={which}>
            <input
              aria-label={`${COMMANDMENT_NAMES[which]}, ${row.label}`}
              // What the read found, offered rather than written — the same
              // way the event column offers its suggestion. A scene that has
              // been read and has none of this one says so, because an empty
              // cell that is *known* empty is the useful kind (addendum 04 §4).
              placeholder={found || (row.read ? 'none found' : COMMANDMENT_ASKS[which])}
              title={found ? `The read found: ${found}` : undefined}
              className={found && row.commandments[which].length === 0 ? 'grid-offered' : undefined}
              value={row.commandments[which]}
              onChange={(event) => onSetCommandment(which, event.target.value)}
            />
          </td>
        );
      })}
      <td>
        <input
          aria-label={`Whose eyes ${row.label} is seen through`}
          value={row.pov}
          onChange={(event) => onSet({ pov: event.target.value })}
        />
      </td>
      <td className="muted small">{where || <span className="muted">—</span>}</td>
    </tr>
  );
}
