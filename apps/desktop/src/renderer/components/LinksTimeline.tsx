import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  MAP_TRACKS,
  addThread,
  describeMap,
  describeThread,
  dependOn,
  dependenciesIn,
  describeThreads,
  isolatable,
  momentsOf,
  nodeOn,
  removeMoment,
  describeDeleting,
  removeThread,
  noteMoment,
  storyMap,
  threadsInOrder,
  undepend,
  updateThread,
  type BeatId,
  type MapTrackId,
  type ProjectFile,
  type StoryThreadId,
  type ThreadRelationship,
  type TimelineNode,
  type TimelineRow,
  nounsFor,
} from '@vcwriter/domain';

/**
 * The Links timeline (addendum 15, from Ken's Research Links spec).
 *
 * §18 asks for a story wiring diagram: the scene structure across the top and
 * the story's structural systems beneath it, with connectors showing how each
 * element travels. That is what this draws, and it draws every track the same
 * way because `storyMap` hands it nodes and edges and nothing else — it cannot
 * tell a setup from a motif, which is the whole of §21.
 *
 * **Nothing on it is draggable** (§13), because nothing about a node's position
 * is stored: it is where its scene is. Move the scene and the node has moved.
 *
 * Three widths rather than §15's four named zooms: the two middle ones ("act"
 * and "scene range") are the same act — narrowing what is drawn — and the
 * **Scenes … to …** pair does it properly, as it does on the character map.
 * What changes with the width is how much room a scene has, and at the narrow
 * width several moments in one scene collapse into a count, which is §15's
 * density rule.
 */
interface LinksTimelineProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Double-clicking a node goes to its beat in the script (§10). */
  onGoToBeat?(beatId: BeatId): void;
}

/**
 * Three widths rather than §15's four.
 *
 * **Whole story means the whole story fits**, so its column is not a number
 * here: it is whatever the window leaves once the row heads have theirs. A
 * fixed small column drew a 154-pixel board in a 1200-pixel pane and called it
 * the project view. The other two are fixed and overflow, which is what makes
 * them wider.
 */
const WIDTHS = [
  { id: 'project', label: 'Whole story', column: null },
  { id: 'act', label: 'Wider', column: 54 },
  { id: 'scene', label: 'Scene by scene', column: 116 },
] as const;
type WidthId = (typeof WIDTHS)[number]['id'];

const ROW_HEIGHT = 26;
/** The row-head column, in pixels. The scene ruler is indented by exactly this. */
const HEAD = 170;
/** Narrower than this and a scene box holds nothing legible. */
const MIN_COLUMN = 14;

export function LinksTimeline({ file, onUpdate, onGoToBeat }: LinksTimelineProps) {
  const nouns = nounsFor(file.project.format);
  const [shown, setShown] = useState<readonly MapTrackId[]>(MAP_TRACKS);
  const [only, setOnly] = useState<{ trackId: MapTrackId; sourceId: string } | null>(null);
  const [width, setWidth] = useState<WidthId>('project');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [newThread, setNewThread] = useState('');
  /**
   * How much room the board has. Measured rather than assumed, because *whole
   * story* is a promise about the window and nothing else can keep it.
   */
  const [room, setRoom] = useState(900);
  const scroller = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setRoom(node.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(([entry]) => entry && setRoom(entry.contentRect.width));
    watch.observe(node);
  }, []);

  const total = useMemo(() => storyMap(file).scenes.length, [file]);
  const range = useMemo(() => {
    const low = Number.parseInt(from, 10);
    const high = Number.parseInt(to, 10);
    if (!Number.isFinite(low) && !Number.isFinite(high)) return null;
    const one = Number.isFinite(low) ? low : 1;
    const two = Number.isFinite(high) ? high : total;
    // A range covering everything is no range, so a filtered map cannot look
    // unfiltered — the same rule the character map's range holds.
    if (Math.min(one, two) <= 1 && Math.max(one, two) >= total) return null;
    return { from: one, to: two };
  }, [from, to, total]);

  const map = useMemo(
    () => storyMap(file, { tracks: shown, only: only ? [only] : [], range }),
    [file, shown, only, range],
  );
  const choices = useMemo(() => isolatable(file), [file]);
  const found = selected ? nodeOn(map, selected) : null;

  const asked = WIDTHS.find((one) => one.id === width)!.column;
  const column =
    asked ?? Math.max(MIN_COLUMN, Math.floor((room - HEAD) / Math.max(1, map.scenes.length)));
  const trackWidth = map.scenes.length * column;
  /** Centre of a scene's column, which is where a node sits. */
  const centreOf = (index: number) => index * column + column / 2;

  const toggleTrack = (trackId: MapTrackId) =>
    setShown((current) =>
      current.includes(trackId) ? current.filter((one) => one !== trackId) : [...MAP_TRACKS.filter((one) => current.includes(one) || one === trackId)],
    );

  return (
    <div className="links-timeline">
      <div className="links-bar">
        <span className="muted small">{describeMap(map)}</span>

        {/* §14: a track at a time, and a way back. */}
        <div className="links-tracks" role="group" aria-label="Tracks">
          {MAP_TRACKS.map((trackId) => (
            <button
              key={trackId}
              type="button"
              className={shown.includes(trackId) ? 'links-toggle on' : 'links-toggle'}
              aria-pressed={shown.includes(trackId)}
              onClick={() => toggleTrack(trackId)}
            >
              {trackId === 'links'
                ? 'Links'
                : trackId === 'setups'
                  ? 'Setups & Payoffs'
                  : trackId === 'thematics'
                    ? 'Themes & Motifs'
                    : 'Character Arcs'}
            </button>
          ))}
        </div>

        <label className="field inline">
          <span>Just</span>
          <select
            aria-label="Isolate"
            value={only ? `${only.trackId}:${only.sourceId}` : ''}
            onChange={(event) => {
              const value = event.target.value;
              if (value === '') return setOnly(null);
              const at = value.indexOf(':');
              setOnly({ trackId: value.slice(0, at) as MapTrackId, sourceId: value.slice(at + 1) });
            }}
          >
            <option value="">Everything</option>
            {choices.map((choice) => (
              <option key={`${choice.trackId}:${choice.sourceId}`} value={`${choice.trackId}:${choice.sourceId}`}>
                {choice.title}
              </option>
            ))}
          </select>
        </label>

        <label className="field inline">
          <span>{nouns.unitPlural}</span>
          <input
            aria-label={`From ${nouns.unit.toLowerCase()}`}
            inputMode="numeric"
            placeholder="1"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <span>to</span>
          <input
            aria-label={`To ${nouns.unit.toLowerCase()}`}
            inputMode="numeric"
            placeholder={String(total)}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>

        <div className="links-widths" role="group" aria-label="Width">
          {WIDTHS.map((one) => (
            <button
              key={one.id}
              type="button"
              className={width === one.id ? 'links-toggle on' : 'links-toggle'}
              aria-pressed={width === one.id}
              onClick={() => setWidth(one.id)}
            >
              {one.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="ghost small"
          onClick={() => {
            setShown(MAP_TRACKS);
            setOnly(null);
            setFrom('');
            setTo('');
            setSelected(null);
          }}
        >
          Clear filters
        </button>
      </div>

      <div className="links-scroll" ref={scroller}>
        {/* One grid for the ruler and every track, so a node is under its scene
            by construction rather than by two widths agreeing. §2 asks that all
            tracks stay horizontally synchronised to the scene timeline; two
            separately-sized rows is how that promise gets broken. */}
        <div className="links-board" style={{ gridTemplateColumns: `${HEAD}px ${trackWidth}px` }}>
          <div className="links-ruler-spacer" />
          {/* §2: the scene timeline, in script order, from the script's own
              units — this module keeps no order of its own. */}
          <div className="links-scenes">
            {map.scenes.map((scene) => (
              <button
                key={scene.unitId}
                type="button"
                className="links-scene"
                style={{ width: column }}
                title={`${scene.number} — ${scene.heading}`}
              >
                <span className="links-scene-number">{scene.number}</span>
                {column > 40 ? <span className="links-scene-heading">{scene.heading}</span> : null}
              </button>
            ))}
          </div>

          {map.tracks.map((track) => (
            <Fragment key={track.id}>
              <h4 className="links-track-title">{track.title}</h4>
              {track.rows.length === 0 ? (
                <p className="muted small links-empty">Nothing in this track yet.</p>
              ) : (
                // Each row is `display: contents`, so its head and its track
                // are cells of the board's own two columns.
                track.rows.map((row) => (
                  <TrackRow
                    key={`${row.trackId}:${row.sourceId}`}
                    row={row}
                    column={column}
                    width={trackWidth}
                    centreOf={centreOf}
                    selected={selected}
                    onSelect={setSelected}
                    onGoToBeat={onGoToBeat}
                    onIsolate={() => setOnly({ trackId: row.trackId, sourceId: row.sourceId })}
                  />
                ))
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="links-under">
        <section className="links-threads">
          <div className="panel-header">
            <h3>Links</h3>
            <span className="muted small">{describeThreads(file)}</span>
          </div>
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newThread.trim();
              if (name.length === 0) return;
              onUpdate((current) => addThread(current, { name }).file);
              setNewThread('');
            }}
          >
            <input
              aria-label="New link"
              placeholder="The key"
              value={newThread}
              onChange={(event) => setNewThread(event.target.value)}
            />
            <button type="submit">Add</button>
          </form>
          <p className="muted small">
            A moment is marked from the writing: right-click a line and choose{' '}
            <em>Add to Research ▸ Links</em>.
          </p>

          <ul className="links-thread-list">
            {threadsInOrder(file).map((thread) => (
              <ThreadRow
                key={thread.id}
                file={file}
                threadId={thread.id}
                onUpdate={onUpdate}
                onGoToBeat={onGoToBeat}
              />
            ))}
          </ul>
        </section>

        {/* §9: what the selected node belongs to, and what it is. */}
        <aside className="links-inspector">
          <h3>Selected</h3>
          {found ? (
            <>
              <p className="links-inspector-title">{found.row.title}</p>
              <p className="muted small">
                {found.row.trackId === 'links' ? 'Link' : found.row.trackId === 'setups' ? 'Setup & payoff' : found.row.trackId === 'thematics' ? found.row.sourceKind : 'Character arc'}
                {found.row.detail ? ` · ${found.row.detail}` : ''}
              </p>
              <p className="links-inspector-label">{found.node.label}</p>
              <p className="muted small">Scene {found.node.index + 1}</p>
              {found.node.beatId && onGoToBeat ? (
                <button type="button" className="ghost small" onClick={() => onGoToBeat(found.node.beatId as BeatId)}>
                  Go to it
                </button>
              ) : null}
            </>
          ) : (
            <p className="muted empty">Click a moment on the timeline.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

/** One row of one track: its nodes at their scenes, and the lines between them. */
function TrackRow({
  row,
  column,
  width,
  centreOf,
  selected,
  onSelect,
  onGoToBeat,
  onIsolate,
}: {
  row: TimelineRow;
  column: number;
  width: number;
  centreOf(index: number): number;
  selected: string | null;
  onSelect(nodeId: string | null): void;
  onGoToBeat?(beatId: BeatId): void;
  onIsolate(): void;
}) {
  // §15's density: at a narrow column several moments in one scene are one
  // mark with a count, because two glyphs in eleven pixels is a smudge.
  const dense = column < 30;
  const piles = new Map<number, TimelineNode[]>();
  for (const node of row.nodes) {
    const list = piles.get(node.index) ?? [];
    list.push(node);
    piles.set(node.index, list);
  }
  const drawn = dense
    ? [...piles.entries()].map(([index, nodes]) => ({ index, nodes }))
    : row.nodes.map((node) => ({ index: node.index, nodes: [node] }));

  const mid = ROW_HEIGHT / 2;
  const lit = (nodeId: string) => selected === nodeId;
  const hot = row.nodes.some((node) => lit(node.id));

  return (
    <div className={hot ? 'links-row lit' : 'links-row'}>
      <button type="button" className="links-row-head" onClick={onIsolate} title={`${row.title} — just this`}>
        {row.warn ? <span className="links-warn" aria-hidden="true" /> : null}
        <span className="links-row-name">{row.title}</span>
        {row.detail ? <span className="muted small">{row.detail}</span> : null}
      </button>

      <svg
        className="links-row-track"
        width={width}
        height={ROW_HEIGHT}
        viewBox={`0 0 ${width} ${ROW_HEIGHT}`}
        role="list"
        aria-label={row.title}
      >
        <defs>
          <marker id={`arrow-${row.sourceId}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" className="links-arrow-head" />
          </marker>
        </defs>

        {row.edges.map((edge) => {
          const one = row.nodes.find((node) => node.id === edge.from);
          const two = row.nodes.find((node) => node.id === edge.to);
          if (!one || !two) return null;
          const start = centreOf(one.index);
          const end = centreOf(two.index);
          // A dependency stops short of the node it points at, or the arrow
          // — the only thing that says the edge has a direction — is drawn
          // underneath the mark and the claim becomes invisible.
          const back = edge.relationship === 'dependency' ? Math.sign(end - start) * 9 : 0;
          return (
            <line
              key={edge.id}
              className={edge.relationship === 'dependency' ? 'links-edge dependency' : 'links-edge sequence'}
              x1={start}
              y1={mid}
              x2={end - back}
              y2={mid}
              markerEnd={edge.relationship === 'dependency' ? `url(#arrow-${row.sourceId})` : undefined}
            />
          );
        })}

        {drawn.map((pile) => {
          const node = pile.nodes[0] as TimelineNode;
          const many = pile.nodes.length > 1;
          const x = centreOf(pile.index);
          const classes = [
            'links-node',
            node.shape,
            node.warn ? 'warn' : '',
            pile.nodes.some((one) => lit(one.id)) ? 'on' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <g
              key={node.id}
              role="listitem"
              className={classes}
              onClick={() => onSelect(node.id)}
              onDoubleClick={() => node.beatId && onGoToBeat?.(node.beatId)}
            >
              <title>{many ? `${pile.nodes.length} moments — ${node.label}` : node.label}</title>
              {node.shape === 'diamond' ? (
                <rect x={x - 4} y={mid - 4} width={8} height={8} transform={`rotate(45 ${x} ${mid})`} />
              ) : node.shape === 'square' ? (
                <rect x={x - 4} y={mid - 4} width={8} height={8} />
              ) : (
                <circle cx={x} cy={mid} r={4} />
              )}
              {many ? (
                <text x={x} y={mid - 7} textAnchor="middle" className="links-pile-count">
                  {pile.nodes.length}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * One link, opened: its name, what its connectors mean, its moments, and — for
 * a dependency link — the pairs the writer has drawn.
 *
 * The moments are listed rather than dragged, for the reason the timeline gives
 * (§13): the order is the script's. What a writer does here is say what each
 * moment *is*, and take one out.
 */
function ThreadRow({
  file,
  threadId,
  onUpdate,
  onGoToBeat,
}: {
  file: ProjectFile;
  threadId: StoryThreadId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToBeat?(beatId: BeatId): void;
}) {
  const thread = (file.threads ?? []).find((one) => one.id === threadId);
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [dependent, setDependent] = useState('');
  const [required, setRequired] = useState('');
  if (!thread) return null;

  const moments = momentsOf(file, threadId);
  const declared = dependenciesIn(file, threadId);
  const nameOf = (nodeId: string) => {
    const moment = moments.find((one) => (one.node.id as string) === nodeId);
    if (!moment) return 'a moment';
    return moment.node.note || moment.text || moment.where;
  };

  return (
    <li className="links-thread">
      {/* The × is on the row (addendum 24 §5d), not at the foot of the body a
          fold away — and it asks in the graveyard's own words, which the old
          sentence here could no longer say truthfully: the moments are
          **kept** now, so that restoring gives the thread back whole. */}
      <div className="links-thread-row">
        <button
          type="button"
          className="links-thread-head"
          aria-expanded={open}
          onClick={() => setOpen((was) => !was)}
        >
          <span className="fold-mark">{open ? '▾' : '▸'}</span>
          <span className="links-thread-name">{thread.name || 'Untitled link'}</span>
          <span className="muted small">{describeThread(file, thread)}</span>
        </button>
        <button
          type="button"
          className="ghost small danger item-x"
          aria-label={`Delete ${thread.name || 'Untitled link'}`}
          title={`Delete ${thread.name || 'Untitled link'}`}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      </div>
      {asking ? (
        <div className="row-ask">
          <span className="muted small">{describeDeleting(file, { kind: 'thread', id: threadId as string })}</span>
          <span className="row-ask-buttons">
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onUpdate((current) => removeThread(current, threadId));
                setAsking(false);
              }}
            >
              Delete
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </span>
        </div>
      ) : null}

      {open ? (
        <div className="links-thread-body">
          <label className="field">
            <span>Name</span>
            <input
              aria-label="Link name"
              value={thread.name}
              onChange={(event) => onUpdate((current) => updateThread(current, threadId, { name: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>What it is</span>
            <textarea
              aria-label="Link description"
              rows={2}
              value={thread.description}
              onChange={(event) =>
                onUpdate((current) => updateThread(current, threadId, { description: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Connectors mean</span>
            <select
              aria-label="Relationship type"
              value={thread.relationship}
              onChange={(event) =>
                onUpdate((current) =>
                  updateThread(current, threadId, { relationship: event.target.value as ThreadRelationship }),
                )
              }
            >
              <option value="sequence">Sequence — the order it unfolds</option>
              <option value="dependency">Dependency — what relies on what</option>
            </select>
          </label>

          <h5>Moments ({moments.length})</h5>
          <ul className="links-moments">
            {moments.map((moment) => (
              <li key={moment.node.id} className={moment.resolved ? undefined : 'gone'}>
                <span className="links-moment-where">{moment.where}</span>
                <input
                  aria-label={`What this moment is: ${moment.where}`}
                  placeholder="What this moment is"
                  value={moment.node.note}
                  onChange={(event) =>
                    onUpdate((current) => noteMoment(current, moment.node.id as string, event.target.value))
                  }
                />
                {moment.resolved && onGoToBeat ? (
                  <button type="button" className="ghost small" onClick={() => onGoToBeat(moment.node.beatId)}>
                    Go to it
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost small danger"
                  onClick={() => onUpdate((current) => removeMoment(current, moment.node.id as string))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          {/* §12: *Depends on*. Only offered on a dependency link, because on a
              sequence link the connectors already say the order and an arrow
              would be a second, different claim about the same pair. */}
          {thread.relationship === 'dependency' ? (
            <div className="links-depends">
              <h5>Dependencies</h5>
              <ul>
                {declared.map((pair) => (
                  <li key={`${pair.dependent}:${pair.required}`}>
                    <span>
                      {nameOf(pair.dependent)} <em>depends on</em> {nameOf(pair.required)}
                    </span>
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={() => onUpdate((current) => undepend(current, pair.dependent, pair.required))}
                    >
                      Undo
                    </button>
                  </li>
                ))}
              </ul>
              <div className="links-depends-form">
                <select aria-label="Dependent moment" value={dependent} onChange={(event) => setDependent(event.target.value)}>
                  <option value="">Which moment…</option>
                  {moments.map((moment) => (
                    <option key={moment.node.id} value={moment.node.id as string}>
                      {nameOf(moment.node.id as string)}
                    </option>
                  ))}
                </select>
                <span className="muted small">depends on</span>
                <select aria-label="Required moment" value={required} onChange={(event) => setRequired(event.target.value)}>
                  <option value="">Which moment…</option>
                  {moments.map((moment) => (
                    <option key={moment.node.id} value={moment.node.id as string}>
                      {nameOf(moment.node.id as string)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ghost small"
                  disabled={dependent === '' || required === '' || dependent === required}
                  onClick={() => {
                    onUpdate((current) => dependOn(current, dependent, required));
                    setDependent('');
                    setRequired('');
                  }}
                >
                  Draw it
                </button>
              </div>
            </div>
          ) : null}

        </div>
      ) : null}
    </li>
  );
}
