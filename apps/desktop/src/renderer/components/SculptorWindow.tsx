import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  COLUMN_WIDTH,
  addBlock,
  addChild,
  addColumn,
  addColumnField,
  blocksOf,
  boardLayout,
  boardsOf,
  columnOf,
  columnsOf,
  createBoard,
  fieldsOf,
  findBoard,
  moveNode,
  removeColumn,
  removeColumnField,
  removeNode,
  renameColumn,
  renameColumnField,
  setNodeField,
  updateNode,
  type Board,
  type LaidNode,
  type ProjectFile,
  type SculptorColumn,
  type SculptorNodeId,
} from '@vcwriter/domain';

/**
 * The Story Sculptor's canvas (addendum 03), stages 1–4.
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

export function SculptorWindow({ file, open, onClose, onUpdate }: SculptorWindowProps) {
  const boards = boardsOf(file);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 24 });
  const [selected, setSelected] = useState<SculptorNodeId | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);

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
        <div
          className="sculpt-canvas"
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
                  onSelect={() => setSelected(laid.node.id)}
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
                  onAddChild={() => write((current, id) => addChild(current, id, laid.node.id).file)}
                />
              ))}
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

              <p className="muted small">
                {/* §6: a node is an idea until the writer binds it, and
                    binding is a later stage. The badge says which it is. */}
                {chosen.boundUnitId || chosen.boundBeatId ? 'In the script.' : 'An idea. It lives only on the canvas.'}
              </p>
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
          Nothing yet. A node is a title and a note; anything more — a scene’s POV, a character arc’s
          before-and-after — belongs to the column, so every node in it is asked the same thing.
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
  onSelect,
  onTitle,
  onFold,
  onMove,
  onRemove,
  onAddChild,
}: {
  laid: LaidNode;
  zoom: number;
  selected: boolean;
  onSelect(): void;
  onTitle(title: string): void;
  onFold(): void;
  onMove(direction: -1 | 1): void;
  onRemove(): void;
  onAddChild(): void;
}) {
  const { node } = laid;
  const end = node.end !== null;
  return (
    <div
      className={[
        'sculpt-node',
        end ? 'end' : '',
        selected ? 'selected' : '',
        node.collapsed ? 'folded' : '',
        node.boundUnitId || node.boundBeatId ? 'bound' : 'idea',
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
    >
      <input
        className="sculpt-title"
        aria-label={end ? `What the story ${node.end === 'beginning' ? 'begins' : 'ends'} as` : 'What this is'}
        placeholder={end ? (node.end === 'beginning' ? 'It begins…' : 'It ends…') : 'name it'}
        value={node.title}
        onChange={(event) => onTitle(event.target.value)}
      />

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
            <button type="button" className="ghost small" aria-label={`Remove ${node.title || 'this node'}`} onClick={onRemove}>
              ×
            </button>
          </>
        )}
      </div>
    </div>
  );
}
