import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResearchShelf, type ShelfCarry } from './ResearchShelf';
import {
  COLUMN_WIDTH,
  addBlock,
  addChild,
  addColumn,
  addColumnField,
  addResearchRow,
  canCarryToBoard,
  carryRowToBoard,
  bindKindOf,
  bindNode,
  bindableBeats,
  bindableUnits,
  blocksOf,
  boardLayout,
  boardsOf,
  boundOf,
  columnOf,
  columnsOf,
  createBoard,
  fieldsOf,
  findBoard,
  findNode,
  flipLink,
  followCanvas,
  isBound,
  linkNodes,
  linksOf,
  outlinesOf,
  linksTouching,
  moveNode,
  outOfStep,
  realiseNode,
  removeColumn,
  removeColumnField,
  relabelLink,
  removeNode,
  renameColumn,
  renameColumnField,
  setNodeField,
  standingFor,
  unbindNode,
  unlinkNodes,
  updateNode,
  type BeatId,
  type Board,
  type LaidNode,
  type ProjectFile,
  type SculptorColumn,
  type SculptorNode,
  type SculptorNodeId,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * The Story Sculptor's canvas (addendum 03), stages 1–7.
 *
 * **Story time runs down; detail runs right.** A new board is two nodes,
 * Beginning and End, and everything else is put in by the writer — there is
 * no template, and a board with one block between the ends is a valid board
 * (§11).
 *
 * Nothing here decides where anything goes: `boardLayout` measures the whole
 * diagram from §4's one rule, and this draws what it is given at the current
 * zoom. **Canvas units in the model, pixels in the view** (§4, §14.2), which
 * is the one piece of the first draft that survived it.
 */

interface SculptorWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/** Pixels to a canvas unit at 100%. A row is this tall; a column four across. */
const UNIT = 46;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2;

/**
 * The curve for one of the writer's own connections, and where its label goes.
 *
 * Two shapes, and which one is drawn says something:
 *
 * - **Forwards**, into a later column, is the flow of detail: it leaves the
 *   right edge and arrives at the left, like every other line on the canvas.
 * - **Backwards, or within one column**, leaves the right edge and comes back
 *   to the right edge, bowing out into the air to the right of both. Squeezing
 *   it through the gap between two columns — which is merely where the ends
 *   happen to be — draws a kink in the one place the canvas is busiest.
 *
 * The label sits at the curve's midpoint, which for a cubic is
 * `(P0 + 3·P1 + 3·P2 + P3) / 8` — a point actually on the line, rather than
 * halfway between the ends, which on a bend is nowhere near it.
 */
const linkCurve = (
  from: LaidNode,
  to: LaidNode,
  zoom: number,
): { d: string; midX: number; midY: number } => {
  const px = (units: number) => units * UNIT * zoom;
  const midOf = (laid: LaidNode) => px(laid.y + laid.headHeight / 2);

  const forwards = to.column > from.column;
  const y0 = midOf(from);
  const y1 = midOf(to);
  const x0 = px(from.x + COLUMN_WIDTH);
  const x1 = forwards ? px(to.x) : px(to.x + COLUMN_WIDTH);

  // Forwards, the curve is shaped by the gap it crosses, exactly as the
  // structural wires are — a control point thrown further out than the span is
  // wide draws a hook rather than a curve. Backwards, there is no span to
  // shape it, so the bow is its own: wide enough to read, and wider the
  // further apart the ends are, so a line down the length of the board does
  // not flatten against it.
  const flow = Math.max((x1 - x0) / 2, px(0.5));
  const bow = px(COLUMN_WIDTH * 0.55) + Math.abs(y1 - y0) * 0.22;
  const cx0 = forwards ? x0 + flow : x0 + bow;
  const cx1 = forwards ? x1 - flow : x1 + bow;

  return {
    d: `M ${x0} ${y0} C ${cx0} ${y0}, ${cx1} ${y1}, ${x1} ${y1}`,
    midX: (x0 + 3 * cx0 + 3 * cx1 + x1) / 8,
    midY: (y0 + 3 * y0 + 3 * y1 + y1) / 8,
  };
};

/** As much of an observation as will sit on a line without crossing the board. */
const shortened = (label: string): string => (label.length > 30 ? `${label.slice(0, 29)}\u2026` : label);

/**
 * Push a label clear of one already drawn near it.
 *
 * Two links between nearby cards put their midpoints in nearly the same place,
 * and two sentences on top of each other are worse than one of them. Each is
 * moved down past whatever it collides with, in the order the lines were
 * drawn, so the picture stays readable without moving the lines themselves.
 */
const LABEL_ROW = 14;
const spreadLabels = (points: { x: number; y: number }[]): number[] => {
  const placed: { x: number; y: number }[] = [];
  return points.map((point) => {
    let y = point.y;
    for (let pass = 0; pass < placed.length; pass += 1) {
      const clash = placed.find(
        (other) => Math.abs(other.x - point.x) < 120 && Math.abs(other.y - y) < LABEL_ROW,
      );
      if (!clash) break;
      y = clash.y + LABEL_ROW;
    }
    placed.push({ x: point.x, y });
    return y;
  });
};

export function SculptorWindow({ file, open, onClose, onUpdate }: SculptorWindowProps) {
  const boards = boardsOf(file);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 24 });
  const [selected, setSelected] = useState<SculptorNodeId | null>(null);
  /** The node a connection is being drawn from, while one is (§7). */
  const [linking, setLinking] = useState<SculptorNodeId | null>(null);
  /**
   * What is being carried off the shelf, in a ref as well as in state.
   *
   * `dataTransfer.getData` is empty during `dragover` by design, so the
   * handler that has to say whether a card is a legal place to put something
   * reads it from here.
   */
  const carrying = useRef<ShelfCarry | null>(null);
  const [carryingAny, setCarryingAny] = useState(false);
  const [overNode, setOverNode] = useState<SculptorNodeId | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  // Escape gets out of drawing a connection, which is what Escape is for.
  useEffect(() => {
    if (linking === null) return undefined;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLinking(null);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [linking]);

  const board: Board | null = useMemo(() => {
    if (boards.length === 0) return null;
    const chosen = boardId ? boards.find((candidate) => (candidate.id as string) === boardId) : undefined;
    return chosen ?? boards[0] ?? null;
  }, [boards, boardId]);

  // A project with no board gets one the first time the Sculptor is opened:
  // the work starts at Beginning and End, so they have to be there to type in.
  useEffect(() => {
    if (open && boards.length === 0) onUpdate((current) => createBoard(current).file);
  }, [open, boards.length, onUpdate]);

  const layout = useMemo(() => (board ? boardLayout(board) : null), [board]);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Only the canvas itself pans; a node keeps its own clicks.
    if ((event.target as HTMLElement).closest('.sculpt-node')) return;
    dragging.current = { x: event.clientX - 0, y: event.clientY - 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const from = dragging.current;
    if (!from) return;
    setPan((current) => ({ x: current.x + (event.clientX - from.x), y: current.y + (event.clientY - from.y) }));
    dragging.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  if (!open) return null;

  const write = (mutate: (current: ProjectFile, id: Board['id']) => ProjectFile) => {
    if (!board) return;
    onUpdate((current) => mutate(current, board.id));
  };

  const chosen = board && selected ? board.nodes.find((node) => node.id === selected) ?? null : null;
  const column = board && chosen ? columnOf(board, chosen) : null;

  // Each of the writer's own connections, measured once: a link whose ends
  // are both inside one fold has nothing to say while it is folded, because
  // the card standing in for them would be pointing at itself.
  const drawnLinks =
    board && layout
      ? linksOf(board).flatMap((link) => {
          const from = standingFor(board, layout, link.fromId);
          const to = standingFor(board, layout, link.toId);
          if (!from || !to || from.node.id === to.node.id) return [];
          return [
            {
              link,
              fromTitle: from.node.title.trim() || 'Untitled',
              toTitle: to.node.title.trim() || 'Untitled',
              ...linkCurve(from, to, zoom),
            },
          ];
        })
      : [];
  const labelRows = spreadLabels(drawnLinks.map((drawn) => ({ x: drawn.midX, y: drawn.midY })));

  return (
    <div className="sculptor" role="dialog" aria-label="Story Sculptor">
      <header className="sculptor-bar">
        <h2>Story Sculptor</h2>
        {board ? <span className="muted small">{board.name}</span> : null}

        <span className="toolbar-spacer" />

        {board ? (
          <>
            <button
              type="button"
              className="tool"
              title="A block between the ends: the inciting incident, a plot point, whatever you call it"
              onClick={() =>
                write((current, id) => {
                  const live = findBoard(current, id);
                  const after = live
                    ? blocksOf(live).filter((node) => node.end === null).at(-1)?.id ?? null
                    : null;
                  return addBlock(current, id, { afterNodeId: after }).file;
                })
              }
            >
              + Block
            </button>
            <button
              type="button"
              className="tool"
              disabled={!chosen}
              title={
                chosen
                  ? 'Hang a node off the selected one, in the column to its right'
                  : 'Choose a node to hang this off'
              }
              onClick={() => {
                if (!chosen) return;
                write((current, id) => addChild(current, id, chosen.id).file);
              }}
            >
              + Under it
            </button>
            <button
              type="button"
              className="tool"
              title="A column to the right: character arcs, reveals, questions to answer — whatever the next level of detail is"
              onClick={() => write((current, id) => addColumn(current, id).file)}
            >
              + Column
            </button>
            {/* The writer's own connection (§7): say where it starts, then
                click where it goes. Armed rather than dragged, because the
                canvas's own drag is the pan. */}
            <button
              type="button"
              className={linking ? 'tool active' : 'tool'}
              disabled={!chosen && !linking}
              aria-pressed={linking !== null}
              title={
                linking
                  ? 'Now click the node it connects to, or press this again to stop'
                  : chosen
                    ? 'Connect this node to another: this setup pays off here, this scene is why she does that'
                    : 'Choose the node the connection starts at'
              }
              onClick={() => setLinking(linking ? null : chosen?.id ?? null)}
            >
              {linking ? 'Connecting…' : 'Connect'}
            </button>
            <label className="zoom">
              <span className="muted">Zoom</span>
              <input
                type="range"
                min={MIN_ZOOM * 100}
                max={MAX_ZOOM * 100}
                step={5}
                value={Math.round(zoom * 100)}
                aria-label="Canvas zoom"
                onChange={(event) => setZoom(Number(event.target.value) / 100)}
              />
            </label>
            {boards.length > 1 ? (
              <select
                aria-label="Which board"
                value={board.id as string}
                onChange={(event) => setBoardId(event.target.value)}
              >
                {boards.map((candidate) => (
                  <option key={candidate.id as string} value={candidate.id as string}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}

        <button type="button" className="ghost" onClick={onClose} aria-label="Close the Story Sculptor">
          ×
        </button>
      </header>

      <div className="sculptor-body">
        {/* The shelf the Outliner has, for the same reason (addendum 06 §3),
            and with the outline on it to drag across from (§2). */}
        <ResearchShelf
          file={file}
          from="board"
          reveal={null}
          onCarry={(held) => {
            carrying.current = held;
            setCarryingAny(held !== null);
            if (held === null) setOverNode(null);
          }}
        />

        <div
          className={carryingAny ? 'sculpt-canvas carrying' : 'sculpt-canvas'}
          // The grid is a texture, so it zooms with what it is behind.
          style={{ backgroundSize: `${UNIT * zoom}px ${UNIT * zoom}px` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {board && layout ? (
            <div
              className="sculpt-sheet"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px)`,
                width: `${layout.width * UNIT * zoom}px`,
                height: `${layout.height * UNIT * zoom + 40}px`,
              }}
            >
              {/* The columns, named, above what they hold. */}
              {layout.columns.map((column) => (
                <div
                  key={column.column.id as string}
                  className="sculpt-column"
                  style={{ left: `${column.x * UNIT * zoom}px`, width: `${column.width * UNIT * zoom}px` }}
                >
                  <input
                    className="sculpt-column-name"
                    aria-label={`Name of column ${column.index + 1}`}
                    placeholder="name it"
                    value={column.column.name}
                    onChange={(event) =>
                      write((current, id) => renameColumn(current, id, column.column.id, event.target.value))
                    }
                  />
                  {/* Only the last, and never one of the three every board
                      has: a column from the middle would orphan the one to
                      its right (§3). */}
                  {column.index === layout.columns.length - 1 && column.index > 2 ? (
                    <button
                      type="button"
                      className="ghost small sculpt-column-off"
                      aria-label={`Remove the ${column.column.name || 'last'} column`}
                      title="Remove this column, and everything in it"
                      onClick={() => write((current, id) => removeColumn(current, id, column.column.id))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}

              {/* The connectors: parent into the stack of its children, and
                  each structure node to the next (§7). Drawn under the nodes
                  so a card always wins. */}
              <svg
                className="sculpt-wires"
                width={layout.width * UNIT * zoom}
                height={layout.height * UNIT * zoom}
              >
                {layout.nodes.map((laid) => {
                  const parent = laid.node.parentId
                    ? layout.nodes.find((candidate) => candidate.node.id === laid.node.parentId)
                    : null;
                  if (!parent) return null;
                  // One arrow into the stack, not one per child (§3): every
                  // child draws from the parent's own card.
                  const fromX = (parent.x + COLUMN_WIDTH) * UNIT * zoom;
                  const fromY = (parent.y + parent.headHeight / 2) * UNIT * zoom;
                  const toX = laid.x * UNIT * zoom;
                  const toY = (laid.y + laid.headHeight / 2) * UNIT * zoom;
                  const bend = (toX - fromX) / 2;
                  return (
                    <path
                      key={laid.node.id as string}
                      className="sculpt-wire"
                      d={`M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`}
                    />
                  );
                })}
                {/* The chain down the structure column. */}
                {layout.nodes
                  .filter((laid) => laid.column === 0)
                  .sort((a, b) => a.y - b.y)
                  .map((laid, index, chain) => {
                    const next = chain[index + 1];
                    if (!next) return null;
                    const x = (laid.x + COLUMN_WIDTH / 2) * UNIT * zoom;
                    return (
                      <line
                        key={`chain-${laid.node.id as string}`}
                        className="sculpt-chain"
                        x1={x}
                        y1={(laid.y + laid.headHeight) * UNIT * zoom}
                        x2={x}
                        y2={next.y * UNIT * zoom}
                      />
                    );
                  })}
              </svg>

              {layout.nodes.map((laid) => (
                <Node
                  key={laid.node.id as string}
                  laid={laid}
                  zoom={zoom}
                  selected={selected === laid.node.id}
                  linking={linking !== null}
                  linkingFrom={linking === laid.node.id}
                  onSelect={() => {
                    if (linking !== null && linking !== laid.node.id) {
                      write((current, id) => linkNodes(current, id, linking, laid.node.id).file);
                      setLinking(null);
                      setSelected(linking);
                      return;
                    }
                    setSelected(laid.node.id);
                  }}
                  onTitle={(title) => write((current, id) => updateNode(current, id, laid.node.id, { title }))}
                  onFold={() =>
                    write((current, id) =>
                      updateNode(current, id, laid.node.id, { collapsed: !laid.node.collapsed }),
                    )
                  }
                  onMove={(direction) => write((current, id) => moveNode(current, id, laid.node.id, direction))}
                  onRemove={() => {
                    setSelected(null);
                    write((current, id) => removeNode(current, id, laid.node.id));
                  }}
                  onUnbind={() => write((current, id) => unbindNode(current, id, laid.node.id))}
                  onAddChild={() => write((current, id) => addChild(current, id, laid.node.id).file)}
                  landing={overNode === laid.node.id}
                  onCarryOver={() => {
                    const held = carrying.current;
                    if (!held || !board) return null;
                    // A card off the outline needs a column to its right to
                    // land in; research can go anywhere.
                    if (held.kind === 'row' && !canCarryToBoard(file, board.id, laid.node.id)) return null;
                    if (held.kind === 'node') return null;
                    setOverNode(laid.node.id);
                    return 'copy';
                  }}
                  onCarryLeave={() => setOverNode((current) => (current === laid.node.id ? null : current))}
                  onCarryDrop={() => {
                    const held = carrying.current;
                    setOverNode(null);
                    setCarryingAny(false);
                    carrying.current = null;
                    if (!held) return;
                    if (held.kind === 'research') {
                      // The board has nowhere to hold a reference, so research
                      // arrives as a node with the item's name on it (§2).
                      const item = file.researchItems.find((candidate) => candidate.id === held.id);
                      if (item) {
                        write((current, id) => addChild(current, id, laid.node.id, { title: item.title }).file);
                      }
                      return;
                    }
                    if (held.kind === 'row') {
                      const outline = outlinesOf(file)[0];
                      if (!outline) return;
                      write((current, id) => carryRowToBoard(current, outline.id, held.id, id, laid.node.id).file);
                    }
                  }}
                />
              ))}

              {/* The writer's own connections (§7), drawn **over** the cards
                  rather than under them: a structural wire says where a thing
                  belongs and can hide behind it, but an observation is the
                  point of having drawn it, and has to be clickable. */}
              <svg
                className="sculpt-links"
                width={layout.width * UNIT * zoom}
                height={layout.height * UNIT * zoom}
              >
<defs>
                  {/* Two of them, because a marker cannot inherit the colour of
                      the line that used it: the lit one is the link an end of
                      which is the selected card. */}
                  {(['sculpt-arrow', 'sculpt-arrow-lit'] as const).map((name) => (
                    <marker
                      key={name}
                      id={name}
                      className={name}
                      viewBox="0 0 8 8"
                      refX="7"
                      refY="4"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" />
                    </marker>
                  ))}
                </defs>
                {drawnLinks.map((drawn, index) => (
                  <g
                    key={drawn.link.id as string}
                    className={
                      selected === drawn.link.fromId || selected === drawn.link.toId
                        ? 'sculpt-link lit'
                        : 'sculpt-link'
                    }
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelected(drawn.link.fromId);
                    }}
                  >
                    <title>
                      {drawn.link.label || `${drawn.fromTitle} → ${drawn.toTitle}`}
                    </title>
                    <path
                      className="sculpt-link-line"
                      d={drawn.d}
                      markerEnd={
                        selected === drawn.link.fromId || selected === drawn.link.toId
                          ? 'url(#sculpt-arrow-lit)'
                          : 'url(#sculpt-arrow)'
                      }
                    />
                    {drawn.link.label ? (
                      <text className="sculpt-link-label" x={drawn.midX} y={labelRows[index]}>
                        {shortened(drawn.link.label)}
                      </text>
                    ) : null}
                  </g>
                ))}
              </svg>
            </div>
          ) : (
            <p className="muted empty-state">Starting a board…</p>
          )}
        </div>

        {/* The detail panel (§9): the node's own, beside the canvas, without
            losing the map. Its note lives here rather than on the card,
            because a node is a title and a note and nothing is asked up front. */}
        <aside className="sculpt-detail">
          {chosen ? (
            <>
              <h3>{chosen.end ? (chosen.end === 'beginning' ? 'Beginning' : 'End') : 'Node'}</h3>
              <label className="field">
                <span>Title</span>
                <input
                  aria-label="The node's title"
                  value={chosen.title}
                  onChange={(event) =>
                    write((current, id) => updateNode(current, id, chosen.id, { title: event.target.value }))
                  }
                />
              </label>
              <label className="field">
                <span>Note</span>
                <textarea
                  aria-label="The node's note"
                  rows={8}
                  value={chosen.note}
                  onChange={(event) =>
                    write((current, id) => updateNode(current, id, chosen.id, { note: event.target.value }))
                  }
                />
              </label>
              {/* Everything beyond a title and a note belongs to the column
                  rather than to the node (§5), so a writer who wants a
                  before-and-after on their arcs has it on every one of them
                  and a writer who does not is never shown the boxes. */}
              <ColumnFields
                column={column}
                node={chosen}
                onSet={(fieldId, value) =>
                  write((current, id) => setNodeField(current, id, chosen.id, fieldId, value))
                }
                onAdd={() => {
                  if (column) write((current, id) => addColumnField(current, id, column.id).file);
                }}
                onRename={(fieldId, name) => {
                  if (column) write((current, id) => renameColumnField(current, id, column.id, fieldId, name));
                }}
                onRemove={(fieldId) => {
                  if (column) write((current, id) => removeColumnField(current, id, column.id, fieldId));
                }}
              />

              {/* §6: a node is an idea until the writer binds it. This is
                  where they say so, and where the board says which it is. */}
              {/* What it is connected to (§9), and the words on each line. */}
              <Connections board={board as Board} node={chosen} onGo={setSelected} onWrite={write} />

              <Binding file={file} board={board as Board} node={chosen} onWrite={write} />
            </>
          ) : (
            <p className="muted small">
              Choose a node to write its note. Beginning and End are nodes like any other — say what the story
              begins and ends as, in general terms, and put the big blocks between them.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * What this node is connected to, and what the writer noticed (§7, §9).
 *
 * **A connector is never what holds two things together**, so everything here
 * is safe: the words can be rewritten, the arrow turned round, and the line
 * removed, and none of it moves a card or touches the script. The only thing
 * losing a line loses is the observation.
 */
function Connections({
  board,
  node,
  onGo,
  onWrite,
}: {
  board: Board;
  node: SculptorNode;
  onGo(nodeId: SculptorNodeId): void;
  onWrite(mutate: (current: ProjectFile, id: Board['id']) => ProjectFile): void;
}) {
  const links = linksTouching(board, node.id);
  if (links.length === 0) return null;

  return (
    <section className="sculpt-links-panel">
      <h4>Connected to</h4>
      {links.map((link) => {
        const outward = link.fromId === node.id;
        const other = findNode(board, outward ? link.toId : link.fromId);
        return (
          <div key={link.id as string} className="sculpt-link-row">
            <div className="sculpt-link-head">
              {/* Which way the arrow points, said rather than drawn: this one
                  goes out to that card, or comes in from it. */}
              <span className="sculpt-link-way" aria-hidden="true">
                {outward ? '→' : '←'}
              </span>
              <button
                type="button"
                className="ghost small sculpt-link-other"
                title="Go to it"
                onClick={() => other && onGo(other.id)}
              >
                {other?.title.trim() || 'Untitled'}
              </button>
              <button
                type="button"
                className="ghost small"
                aria-label={`Turn the connection to ${other?.title.trim() || 'it'} round`}
                title="The other way round, keeping the words"
                onClick={() => onWrite((current, id) => flipLink(current, id, link.id))}
              >
                ⇄
              </button>
              <button
                type="button"
                className="ghost small"
                aria-label={`Remove the connection to ${other?.title.trim() || 'it'}`}
                title="Remove the line. Nothing else changes"
                onClick={() => onWrite((current, id) => unlinkNodes(current, id, link.id))}
              >
                ×
              </button>
            </div>
            <input
              aria-label={`What you noticed about ${other?.title.trim() || 'it'}`}
              placeholder="what you noticed"
              value={link.label}
              onChange={(event) => onWrite((current, id) => relabelLink(current, id, link.id, event.target.value))}
            />
          </div>
        );
      })}
    </section>
  );
}

/**
 * An idea, or a scene (§6).
 *
 * **A node is an idea until the writer says otherwise**, so this is a
 * statement of fact and one control, never a form. An idea offers two ways to
 * stop being one — take a scene that already exists, or make a new one — and
 * a scene that is real says which it is and offers to let go.
 *
 * Where the canvas and the script have fallen out of step it says so in a
 * sentence and offers to fix it. It never fixes it on its own: §11 is that the
 * board never reorders the script behind the writer's back.
 */
function Binding({
  file,
  board,
  node,
  onWrite,
}: {
  file: ProjectFile;
  board: Board;
  node: SculptorNode;
  onWrite(mutate: (current: ProjectFile, id: Board['id']) => ProjectFile): void;
}) {
  const kind = bindKindOf(node);
  const bound = boundOf(file, node);
  const step = useMemo(() => (isBound(node) ? outOfStep(file, board, node.id) : null), [file, board, node]);

  if (kind === null) {
    return (
      <p className="muted small sculpt-binding">
        An idea. A block is the shape of the story rather than a scene in it, so there is nothing in the script for
        it to be.
      </p>
    );
  }

  const what = kind === 'unit' ? 'scene' : 'beat';

  if (bound) {
    // Named the way the rest of the workspace names a scene: its sequence
    // label where it has one, its title, and "Untitled" rather than a blank.
    const name =
      bound.kind === 'unit'
        ? `${bound.unit.sequenceLabel || ''} ${bound.unit.title || 'Untitled'}`.trim()
        : bound.beat.title.trim() || 'Untitled';
    return (
      <section className="sculpt-binding bound">
        <p className="small">
          <span className="sculpt-real">●</span> This <strong>is</strong> the {what} <em>{name}</em>, in the script.
          Rename it here or there and it is renamed in both.
        </p>
        {step ? (
          <p className="small sculpt-step">
            On the canvas it comes {step.canvasFirst ? 'before' : 'after'} {step.otherTitle}; in the script it comes{' '}
            {step.canvasFirst ? 'after' : 'before'}.{' '}
            <button
              type="button"
              className="ghost small"
              onClick={() => onWrite((current, id) => followCanvas(current, id, node.id))}
            >
              Move the {what} to match
            </button>
          </p>
        ) : null}
        <button
          type="button"
          className="ghost small"
          onClick={() => onWrite((current, id) => unbindNode(current, id, node.id))}
        >
          Unbind
        </button>
      </section>
    );
  }

  const parent = node.parentId ? findNode(board, node.parentId) : null;
  const canMake = kind === 'unit' || (parent?.boundUnitId ?? null) !== null;
  const candidates: Array<{ id: string; label: string }> =
    kind === 'unit'
      ? bindableUnits(file, node.id).map((unit) => ({
          id: unit.id as string,
          label: `${unit.sequenceLabel || unit.kind} ${unit.title || 'Untitled'}`.trim(),
        }))
      : bindableBeats(file, board, node.id).map((beat) => ({
          id: beat.id as string,
          label: beat.title || 'Untitled beat',
        }));

  return (
    <section className="sculpt-binding">
      <p className="muted small">An idea. It lives only on the canvas.</p>

      {canMake ? (
        <button
          type="button"
          className="ghost small"
          title={`Put this in the script as a ${what}, and bind the two`}
          onClick={() => onWrite((current, id) => realiseNode(current, id, node.id).file)}
        >
          Make it a {what}
        </button>
      ) : (
        <p className="muted small">
          A beat lives inside a scene, so this one can be real as soon as the scene above it is.
        </p>
      )}

      {candidates.length > 0 ? (
        <label className="field">
          <span>or it already exists</span>
          <select
            aria-label={`Bind this node to a ${what}`}
            value=""
            onChange={(event) => {
              const chosen = event.target.value;
              if (!chosen) return;
              onWrite((current, id) =>
                bindNode(
                  current,
                  id,
                  node.id,
                  kind === 'unit'
                    ? { unitId: chosen as unknown as StructuralUnitId }
                    : { beatId: chosen as unknown as BeatId },
                ),
              );
            }}
          >
            <option value="">Choose the {what} it is…</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}

/**
 * What a column asks of everything in it (§5), and the node's answers.
 *
 * The questions are the column's and the answers are the node's, so adding
 * one here adds it to every node in that column — which is the point: a
 * writer defines the level of detail once, not once per card.
 */
function ColumnFields({
  column,
  node,
  onSet,
  onAdd,
  onRename,
  onRemove,
}: {
  column: SculptorColumn | null;
  node: { fields: Record<string, string> };
  onSet(fieldId: Parameters<typeof setNodeField>[3], value: string): void;
  onAdd(): void;
  onRename(fieldId: Parameters<typeof setNodeField>[3], name: string): void;
  onRemove(fieldId: Parameters<typeof setNodeField>[3]): void;
}) {
  if (!column) return null;
  const fields = fieldsOf(column);

  return (
    <section className="sculpt-fields">
      <h4>
        {column.name || 'This column'} asks
        <button type="button" className="ghost small" title="A question this column asks of everything in it" onClick={onAdd}>
          + Question
        </button>
      </h4>

      {fields.length === 0 ? (
        <p className="muted small">
          Nothing yet — a node is a title and a note. Ask this column something and every node in it is asked it.
        </p>
      ) : null}

      {fields.map((field) => (
        <div key={field.id as string} className="sculpt-field">
          <div className="sculpt-field-head">
            <input
              className="sculpt-field-name"
              aria-label={`What this column asks: ${field.name || 'unnamed'}`}
              placeholder="the question"
              value={field.name}
              onChange={(event) => onRename(field.id, event.target.value)}
            />
            <button
              type="button"
              className="ghost small"
              aria-label={`Stop asking ${field.name || 'this'}`}
              title="Stop asking this, on every node in the column"
              onClick={() => onRemove(field.id)}
            >
              ×
            </button>
          </div>
          {field.kind === 'text' ? (
            <textarea
              aria-label={`${field.name || 'Answer'} for this node`}
              rows={3}
              value={node.fields[field.id as string] ?? ''}
              onChange={(event) => onSet(field.id, event.target.value)}
            />
          ) : (
            <input
              aria-label={`${field.name || 'Answer'} for this node`}
              value={node.fields[field.id as string] ?? ''}
              onChange={(event) => onSet(field.id, event.target.value)}
            />
          )}
        </div>
      ))}
    </section>
  );
}

function Node({
  laid,
  zoom,
  selected,
  linking,
  linkingFrom,
  onSelect,
  onTitle,
  onFold,
  onMove,
  onRemove,
  onUnbind,
  onAddChild,
  landing,
  onCarryOver,
  onCarryLeave,
  onCarryDrop,
}: {
  laid: LaidNode;
  zoom: number;
  selected: boolean;
  /** A connection is being drawn: every card is a place it could land (§7). */
  linking: boolean;
  linkingFrom: boolean;
  onSelect(): void;
  onTitle(title: string): void;
  onFold(): void;
  onMove(direction: -1 | 1): void;
  onRemove(): void;
  onUnbind(): void;
  onAddChild(): void;
  /** Something off the shelf is over this card. */
  landing: boolean;
  /** Answers how it would land, or null where it cannot (§2). */
  onCarryOver(): 'copy' | null;
  onCarryLeave(): void;
  onCarryDrop(): void;
}) {
  const { node } = laid;
  const end = node.end !== null;
  const bound = isBound(node);
  // §11: deleting a bound node offers to unbind rather than to delete the
  // scene. The writing is never what a × on a card is allowed to cost.
  const [asking, setAsking] = useState(false);
  return (
    <div
      className={[
        'sculpt-node',
        end ? 'end' : '',
        selected ? 'selected' : '',
        node.collapsed ? 'folded' : '',
        bound ? 'bound' : 'idea',
        asking ? 'asking' : '',
        linking && !linkingFrom ? 'landable' : '',
        linkingFrom ? 'linking-from' : '',
        landing ? 'landing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: `${laid.x * UNIT * zoom}px`,
        top: `${laid.y * UNIT * zoom}px`,
        width: `${laid.width * UNIT * zoom}px`,
        height: `${laid.headHeight * UNIT * zoom}px`,
      }}
      onPointerDown={onSelect}
      onDragOver={(event) => {
        const effect = onCarryOver();
        if (!effect) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = effect;
      }}
      onDragLeave={onCarryLeave}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCarryDrop();
      }}
    >
      {/* The badge §6 asks for, on every node: a glance says how much of the
          canvas is real. A filled mark is in the script; an idea has none. */}
      {bound ? (
        <span className="sculpt-real" title="This is a scene in the script" aria-label="In the script">
          ●
        </span>
      ) : null}

      <input
        className="sculpt-title"
        aria-label={end ? `What the story ${node.end === 'beginning' ? 'begins' : 'ends'} as` : 'What this is'}
        placeholder={end ? (node.end === 'beginning' ? 'It begins…' : 'It ends…') : 'name it'}
        value={node.title}
        onChange={(event) => onTitle(event.target.value)}
      />

      {asking ? (
        <span className="sculpt-sure" role="alertdialog" aria-label={`Remove ${node.title || 'this node'}?`}>
          <span className="muted small">This is a scene in the script. Taking the card off leaves the scene there.</span>
          <span className="sculpt-sure-row">
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setAsking(false);
                onUnbind();
              }}
            >
              Unbind it
            </button>
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                setAsking(false);
                onRemove();
              }}
            >
              Remove the card
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep it
            </button>
          </span>
        </span>
      ) : null}

      <div className="sculpt-tools">
        {laid.childCount > 0 ? (
          <button
            type="button"
            className="ghost small"
            aria-label={node.collapsed ? `Unfold ${node.title || 'this node'}` : `Fold ${node.title || 'this node'}`}
            title={node.collapsed ? `${laid.childCount} folded away` : 'Fold what hangs off it'}
            onClick={onFold}
          >
            {node.collapsed ? `▸ ${laid.childCount}` : '▾'}
          </button>
        ) : null}
        <button type="button" className="ghost small" aria-label={`Add under ${node.title || 'this node'}`} onClick={onAddChild}>
          +
        </button>
        {end ? null : (
          <>
            <button type="button" className="ghost small" aria-label={`Move ${node.title || 'this node'} up`} onClick={() => onMove(-1)}>
              ↑
            </button>
            <button type="button" className="ghost small" aria-label={`Move ${node.title || 'this node'} down`} onClick={() => onMove(1)}>
              ↓
            </button>
            <button
              type="button"
              className="ghost small"
              aria-label={`Remove ${node.title || 'this node'}`}
              onClick={() => (bound ? setAsking(true) : onRemove())}
            >
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
