import { useEffect, useMemo, useRef, useState } from 'react';
import { PopOutButton } from './PopOutButton';
import { ConditionGroupEditor, ContributorList, EffectList, RuleSentence } from './RuleBuilder';
import { NarrativeWorldPanel } from './NarrativeWorldPanel';
import { NarrativePlayPanel } from './NarrativePlayPanel';
import { NarrativeEndingsPanel } from './NarrativeEndingsPanel';
import {
  addChoice,
  addElement,
  choicesFor,
  describeGraph,
  describeNode,
  findElement,
  findingsAt,
  narrativeMap,
  sayRuleLine,
  removeChoice,
  removeElement,
  updateChoice,
  updateElement,
  findRun,
  isEnding,
  replayRun,
  wouldBeEntry,
  type ConditionGroup,
  type Effect,
  type GraphLink,
  type GraphNode,
  type NarrativeElementId,
  type NarrativeKind,
  type ProjectFile,
  type SimulationRunId,
} from '@vcwriter/domain';

/**
 * The narrative canvas (addendum 18 stage 4 — §1, §9).
 *
 * It wears the Story Sculptor's chrome and **not its layout**, which is the
 * whole of §1: a Sculptor node keeps an x and a y because arranging the board
 * is the work, and here where a node sits is a fact about the graph. So there
 * is nothing to drag on this screen, deliberately, and the line under the bar
 * says so rather than leaving somebody hunting for the handle.
 *
 * Every mark on it is a reading: the columns are how many choices from a start,
 * the top row is the spine in the script's order, the badge is stage 3's
 * findings, and the ring is a node nothing reaches. Nothing here is stored.
 */

const COLUMN = 240;
const ROW = 132;
const CARD_W = 188;
const CARD_H = 72;
const MARGIN = 36;

const KIND_WORDS: Record<NarrativeKind, string> = {
  scene: 'Scene',
  encounter: 'Encounter',
  conversation: 'Conversation',
  cinematic: 'Cinematic',
  mission: 'Mission',
  hub: 'Hub',
  state_change: 'State change',
  ending: 'Ending',
};

const KINDS = Object.keys(KIND_WORDS) as NarrativeKind[];

/**
 * Cut a line to what the card holds.
 *
 * SVG text neither wraps nor clips, so a long name would run out across the
 * canvas and over whatever is beside it. The whole of it is in the tooltip and
 * in the panel, so nothing is lost by cutting it here.
 */
const clip = (text: string, most: number): string =>
  text.length > most ? `${text.slice(0, most - 1).trimEnd()}…` : text;

const xOf = (node: GraphNode): number => MARGIN + node.column * COLUMN;
const yOf = (node: GraphNode): number => MARGIN + node.row * ROW;

/**
 * A line from one card to the next.
 *
 * Out of the right edge and into the left, except where it goes back — a hub's
 * return leaves and arrives underneath, so it cannot be mistaken for a step
 * forward at a glance.
 */
const curveBetween = (from: GraphNode, to: GraphNode, back: boolean): string => {
  const x1 = xOf(from) + (back ? CARD_W / 2 : CARD_W);
  const y1 = yOf(from) + (back ? CARD_H : CARD_H / 2);
  const x2 = back ? xOf(to) + CARD_W / 2 : xOf(to);
  const y2 = back ? yOf(to) + CARD_H : yOf(to) + CARD_H / 2;
  if (back) {
    const dip = Math.max(y1, y2) + 46;
    return `M ${x1} ${y1} C ${x1} ${dip}, ${x2} ${dip}, ${x2} ${y2}`;
  }
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
};

interface NarrativeMapWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  /**
   * A change, as a function of what is current rather than of what this
   * component last rendered. The document is shared across windows over the
   * link, so computing from a captured `file` would throw away whatever the
   * other monitor did a moment ago.
   */
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPopOut?(): void;
  /** True in a window of its own, where there is nothing to close back to. */
  standalone?: boolean;
}

export function NarrativeMapWindow({
  file,
  open,
  onClose,
  onUpdate,
  onPopOut,
  standalone = false,
}: NarrativeMapWindowProps) {
  const [selectedId, setSelectedId] = useState<NarrativeElementId | null>(null);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<NarrativeKind | ''>('');
  const [focusOn, setFocusOn] = useState(false);
  const [within, setWithin] = useState(1);
  const [showStranded, setShowStranded] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [joining, setJoining] = useState<NarrativeElementId | null>(null);
  const [worldOpen, setWorldOpen] = useState(false);
  /** §9's overlay: which state or resource the board is lighting. */
  const [overlay, setOverlay] = useState<string | null>(null);
  const [playOpen, setPlayOpen] = useState(false);
  const [endingsOpen, setEndingsOpen] = useState(false);
  /** The path being walked, so §9's *path preview* is drawn on the board. */
  const [walkingId, setWalkingId] = useState<SimulationRunId | null>(null);
  /** Which choice has its rule open. One at a time: three WHENs is a wall. */
  const [openRule, setOpenRule] = useState<string | null>(null);

  const map = useMemo(
    () =>
      narrativeMap(file, {
        search,
        kinds: kind === '' ? undefined : [kind],
        focusId: focusOn ? selectedId : null,
        within,
        includeStranded: showStranded,
        touching: overlay,
      }),
    [file, search, kind, focusOn, selectedId, within, showStranded, overlay],
  );

  /**
   * Keep the selected card in view.
   *
   * Found by driving the real thing: a node added to a graph wider than the
   * window is placed in the column its reachability puts it in, which is off
   * the right-hand edge — so a designer pressed *+ Node*, typed a name, and
   * watched nothing appear. The layout is not theirs to arrange, so bringing
   * the picture to them is the only honest answer.
   */
  const stage = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!selectedId) return;
    const card = stage.current?.querySelector('.narrmap-card.is-selected');
    // jsdom has no scrolling, and a screen without it is not a broken screen.
    if (card && typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [selectedId, map]);

  // Where the player is standing and which connections they came along. A
  // reading of the run like every other reading here, so stepping back on the
  // panel un-draws the last line with nothing told to do it.
  const walking = walkingId ? findRun(file, walkingId) : null;
  const walked = walking ? replayRun(file, walking) : null;
  const here = walked?.at?.id ?? null;
  const along = new Set((walking?.steps ?? []).map((one) => one as string));

  const selected = selectedId ? findElement(file, selectedId) : null;
  const rows = selectedId ? choicesFor(file, selectedId) : [];
  const notes = selectedId ? findingsAt(file, selectedId) : [];

  if (!open) return null;

  const width = MARGIN * 2 + Math.max(1, map.columns) * COLUMN;
  const height = MARGIN * 2 + Math.max(1, map.rows) * ROW;
  const placed = new Map(map.nodes.map((one) => [one.element.id as string, one]));

  const add = (): void => {
    // The id is made inside the mutation, so it is caught on the way past
    // rather than by running the mutation twice — which would make two nodes
    // and select the one that was thrown away.
    let made: NarrativeElementId | null = null;
    onUpdate((current) => {
      const next = addElement(current, { name: '' });
      made = next.element.id;
      return next.file;
    });
    if (made) setSelectedId(made);
  };

  const join = (to: NarrativeElementId): void => {
    if (!joining) return;
    onUpdate((current) => addChoice(current, { elementId: joining, name: '', toElementId: to }).file);
    setJoining(null);
  };

  return (
    <div className="narrmap" role="dialog" aria-label="Narrative map">
      <header className="sculptor-bar">
        <h2>Narrative map</h2>
        <span className="muted small">{describeGraph(file, map)}</span>

        <span className="toolbar-spacer" />

        <button type="button" className="tool" onClick={add} title="Add a node to the graph">
          + Node
        </button>
        <button
          type="button"
          className={worldOpen ? 'tool on' : 'tool'}
          aria-pressed={worldOpen}
          title="The states and resources every rule asks about"
          onClick={() => setWorldOpen(!worldOpen)}
        >
          ⚙ States &amp; resources
        </button>
        <button
          type="button"
          className={playOpen ? 'tool on' : 'tool'}
          aria-pressed={playOpen}
          title="Walk the game as a player, and keep the path"
          onClick={() => setPlayOpen(!playOpen)}
        >
          ▶ Play it
        </button>
        <button
          type="button"
          className={endingsOpen ? 'tool on' : 'tool'}
          aria-pressed={endingsOpen}
          title="What decides each ending, side by side"
          onClick={() => setEndingsOpen(!endingsOpen)}
        >
          ⌁ Endings
        </button>
        <label className="sculpt-view">
          <span className="muted small">Zoom</span>
          <input
            type="range"
            min={50}
            max={140}
            step={10}
            value={Math.round(zoom * 100)}
            aria-label="Canvas zoom"
            onChange={(event) => setZoom(Number(event.target.value) / 100)}
          />
        </label>
        {onPopOut ? <PopOutButton onPopOut={onPopOut} what="the narrative map" /> : null}
        {standalone ? null : (
          <button type="button" className="ghost" onClick={onClose} aria-label="Close the narrative map">
            ✕
          </button>
        )}
      </header>

      <div className="sculpt-views">
        <label className="sculpt-view">
          <span className="muted small">Kind</span>
          <select value={kind} aria-label="Only one kind of node" onChange={(event) => setKind(event.target.value as NarrativeKind | '')}>
            <option value="">Every kind</option>
            {KINDS.map((one) => (
              <option key={one} value={one}>
                {KIND_WORDS[one]}
              </option>
            ))}
          </select>
        </label>

        <label className="sculpt-view sculpt-search">
          <span className="muted small">Find</span>
          <input
            value={search}
            placeholder="a name or a note"
            aria-label="Find a node by its name or note"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="sculpt-view">
          <input
            type="checkbox"
            checked={focusOn}
            disabled={!selectedId}
            onChange={(event) => setFocusOn(event.target.checked)}
          />
          <span className="muted small">Just this one and what it touches</span>
        </label>
        {focusOn ? (
          <label className="sculpt-view">
            <span className="muted small">Out to</span>
            <select value={within} aria-label="How far from the selected node" onChange={(event) => setWithin(Number(event.target.value))}>
              <option value={1}>1 step</option>
              <option value={2}>2 steps</option>
              <option value={3}>3 steps</option>
            </select>
          </label>
        ) : null}

        <label className="sculpt-view">
          <input type="checkbox" checked={showStranded} onChange={(event) => setShowStranded(event.target.checked)} />
          <span className="muted small" title="A node nothing leads to is drawn rather than hidden">
            Show what nothing reaches
          </span>
        </label>

        {/* Said out loud, because somebody will look for the handle. */}
        <span className="muted small narrmap-note">
          The layout is read from the graph — draw a connection and a node moves by itself.
        </span>
      </div>

      <div className="narrmap-body">
        {/* The world opens beside the board rather than over it: a designer
            naming a state is in the middle of writing the rule that needs it,
            and a dialog would hide the rule. */}
        {worldOpen ? (
          <NarrativeWorldPanel
            file={file}
            onUpdate={onUpdate}
            onClose={() => setWorldOpen(false)}
            overlayOn={overlay}
            onOverlay={setOverlay}
          />
        ) : null}

        {playOpen ? (
          <NarrativePlayPanel
            file={file}
            onUpdate={onUpdate}
            onClose={() => setPlayOpen(false)}
            onGoTo={setSelectedId}
            onWalking={setWalkingId}
          />
        ) : null}

        {endingsOpen ? (
          <NarrativeEndingsPanel file={file} onClose={() => setEndingsOpen(false)} onGoTo={setSelectedId} />
        ) : null}

        <div className="narrmap-stage" ref={stage}>
          {map.nodes.length === 0 ? (
            <p className="muted empty-state">{describeGraph(file, map)}</p>
          ) : (
            <svg
              className="narrmap-canvas"
              width={width * zoom}
              height={height * zoom}
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label="The narrative graph"
            >
              <defs>
                <marker id="narr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M 0 0 L 10 5 L 0 10 z" className="narrmap-arrowhead" />
                </marker>
              </defs>

              {map.links.map((link) => (
                <LinkLine
                  key={link.choice.id as string}
                  link={link}
                  placed={placed}
                  walked={along.has(link.choice.id as string)}
                />
              ))}

              {map.nodes.map((node) => (
                <NodeCard
                  key={node.element.id as string}
                  node={node}
                  here={node.element.id === here}
                  selected={node.element.id === selectedId}
                  joining={joining !== null && joining !== node.element.id}
                  onPick={() => (joining ? join(node.element.id) : setSelectedId(node.element.id))}
                />
              ))}
            </svg>
          )}
        </div>

        <aside className="narrmap-side" aria-label="The selected node">
          {selected ? (
            <>
              <input
                className="narrmap-name"
                value={selected.name}
                placeholder="Untitled node"
                aria-label="The node's name"
                onChange={(event) => onUpdate((current) => updateElement(current, selected.id, { name: event.target.value }))}
              />
              <label className="sculpt-view">
                <span className="muted small">Kind</span>
                <select
                  value={selected.kind}
                  aria-label="What kind of node this is"
                  onChange={(event) => onUpdate((current) => updateElement(current, selected.id, { kind: event.target.value as NarrativeKind }))}
                >
                  {KINDS.map((one) => (
                    <option key={one} value={one}>
                      {KIND_WORDS[one]}
                    </option>
                  ))}
                </select>
              </label>
              <textarea
                className="narrmap-note-field"
                value={selected.note}
                placeholder="What happens here"
                aria-label="The node's note"
                onChange={(event) => onUpdate((current) => updateElement(current, selected.id, { note: event.target.value }))}
              />

              <div className="narrmap-flags">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.entry}
                    onChange={(event) => onUpdate((current) => updateElement(current, selected.id, { entry: event.target.checked }))}
                  />
                  <span>The player can start here</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.endsHere}
                    onChange={(event) => onUpdate((current) => updateElement(current, selected.id, { endsHere: event.target.checked }))}
                  />
                  <span title="A path that stops here is meant to stop here">Stopping here is meant</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.mandatory}
                    onChange={(event) => onUpdate((current) => updateElement(current, selected.id, { mandatory: event.target.checked }))}
                  />
                  <span title="The story does not work without it">On the spine, and mandatory</span>
                </label>
              </div>

              {/* The node's own rule: what must be true to be here, and what
                  arriving changes. There is no GO TO, because it *is* the
                  destination. */}
              <h3>Being here</h3>
              <ConditionGroupEditor
                file={file}
                group={selected.conditions}
                onChange={(next: ConditionGroup) =>
                  onUpdate((current) => updateElement(current, selected.id, { conditions: next }))
                }
              />
              <RuleSentence file={file} group={selected.conditions} empty="Anybody who gets here may be here." />

              <h3>On arrival</h3>
              <EffectList
                file={file}
                effects={selected.effects}
                onChange={(next: Effect[]) =>
                  onUpdate((current) => updateElement(current, selected.id, { effects: next }))
                }
              />

              {/* §11, and only where the node is an ending: a threshold and
                  what counts towards it. Absent rather than greyed elsewhere —
                  a scene has no ending to weigh. */}
              {isEnding(selected) ? (
                <>
                  <h3>What earns it</h3>
                  <ContributorList
                    file={file}
                    contributors={selected.contributors}
                    onChange={(next) =>
                      onUpdate((current) => updateElement(current, selected.id, { contributors: next }))
                    }
                  />
                  {selected.contributors.length > 0 ? (
                    <label className="rule-row">
                      <span className="muted small">Needs a score of</span>
                      <input
                        type="number"
                        value={selected.threshold}
                        aria-label="The score this ending needs"
                        onChange={(event) =>
                          onUpdate((current) =>
                            updateElement(current, selected.id, { threshold: Number(event.target.value) || 0 }),
                          )
                        }
                      />
                    </label>
                  ) : null}
                </>
              ) : null}

              <h3>Choices</h3>
              {rows.length === 0 ? <p className="muted small">Nothing is offered here yet.</p> : null}
              <ul className="narrmap-choices">
                {rows.map((row) => {
                  const id = row.choice.id as string;
                  const open = openRule === id;
                  return (
                    <li key={id}>
                      <div className="rule-row">
                        <input
                          value={row.choice.name}
                          placeholder="What the player does"
                          aria-label="What the choice is called"
                          onChange={(event) =>
                            onUpdate((current) => updateChoice(current, row.choice.id, { name: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="ghost small"
                          aria-expanded={open}
                          aria-label={`The rule for ${row.choice.name || 'this choice'}`}
                          onClick={() => setOpenRule(open ? null : id)}
                        >
                          {open ? '▴' : '▾'}
                        </button>
                        <button
                          type="button"
                          className="ghost small"
                          aria-label={`Remove ${row.choice.name || 'the choice'}`}
                          onClick={() => onUpdate((current) => removeChoice(current, row.choice.id))}
                        >
                          ✕
                        </button>
                      </div>

                      {/* §15.3's three lines, said back off the rule itself —
                          so a screen of choices can be read without opening
                          each one. */}
                      <p className="rule-said">{sayRuleLine(file, row.choice)}</p>

                      {open ? (
                        <div className="rule-open">
                          <h4>WHEN</h4>
                          <ConditionGroupEditor
                            file={file}
                            group={row.choice.conditions}
                            onChange={(next: ConditionGroup) =>
                              onUpdate((current) => updateChoice(current, row.choice.id, { conditions: next }))
                            }
                          />
                          <h4>DO</h4>
                          <EffectList
                            file={file}
                            effects={row.choice.effects}
                            onChange={(next: Effect[]) =>
                              onUpdate((current) => updateChoice(current, row.choice.id, { effects: next }))
                            }
                          />
                          <h4>GO TO</h4>
                          <select
                            value={(row.choice.toElementId as string) ?? ''}
                            aria-label="Where this choice leads"
                            onChange={(event) =>
                              onUpdate((current) =>
                                updateChoice(current, row.choice.id, {
                                  toElementId: (event.target.value || null) as never,
                                }),
                              )
                            }
                          >
                            <option value="">stay here</option>
                            {map.nodes.map((node) => (
                              <option key={node.element.id as string} value={node.element.id as string}>
                                {node.name || 'Untitled'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="narrmap-actions">
                <button
                  type="button"
                  className="tool"
                  onClick={() => onUpdate((current) => addChoice(current, { elementId: selected.id, name: '' }).file)}
                >
                  + Choice
                </button>
                <button
                  type="button"
                  className={joining ? 'tool on' : 'tool'}
                  aria-pressed={joining !== null}
                  title="Draw a connection: press this, then the node it leads to"
                  onClick={() => setJoining(joining ? null : selected.id)}
                >
                  {joining ? 'Pick where it goes…' : '⇢ Connect to…'}
                </button>
              </div>

              {/* Stage 3, on the node it is about: a finding a designer can
                  only find in a list elsewhere is one they do not find. */}
              {notes.length > 0 ? (
                <>
                  <h3>What the checks say</h3>
                  <ul className="narrmap-findings">
                    {notes.map((one, index) => (
                      <li key={`${one.check}-${index}`}>{one.says}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              <button
                type="button"
                className="ghost small narrmap-remove"
                onClick={() => {
                  onUpdate((current) => removeElement(current, selected.id));
                  setSelectedId(null);
                }}
              >
                Remove this node
              </button>
            </>
          ) : (
            <p className="muted small">
              {wouldBeEntry(file)
                ? 'Nothing here yet. The first node you add is where the player starts.'
                : 'Pick a node to see what is offered there.'}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function LinkLine({
  link,
  placed,
  walked,
}: {
  link: GraphLink;
  placed: Map<string, GraphNode>;
  walked: boolean;
}) {
  const from = placed.get(link.from as string);
  const to = placed.get(link.to as string);
  if (!from || !to) return null;
  const classes = ['narrmap-link'];
  if (walked) classes.push('walked');
  if (link.spine) classes.push('on-spine');
  if (link.back) classes.push('back');
  if (link.gated) classes.push('gated');
  return (
    <path
      className={classes.join(' ')}
      d={curveBetween(from, to, link.back)}
      markerEnd="url(#narr-arrow)"
      aria-hidden="true"
    />
  );
}

function NodeCard({
  node,
  selected,
  here,
  joining,
  onPick,
}: {
  node: GraphNode;
  selected: boolean;
  /** Where the player is standing right now, while a path is being walked. */
  here: boolean;
  joining: boolean;
  onPick(): void;
}) {
  const classes = ['narrmap-card'];
  if (selected) classes.push('is-selected');
  if (here) classes.push('is-here');
  if (node.onSpine) classes.push('on-spine');
  if (node.stranded) classes.push('stranded');
  if (node.kind === 'ending' || node.element.endsHere) classes.push('ends');
  // An overlay dims; it never hides (addendum 18 §9).
  if (node.dim) classes.push('dim');
  if (joining) classes.push('joinable');

  return (
    <g className={classes.join(' ')} transform={`translate(${xOf(node)} ${yOf(node)})`} onClick={onPick}>
      <rect width={CARD_W} height={CARD_H} rx={3} className="narrmap-card-body" />
      {node.element.entry ? <rect width={4} height={CARD_H} className="narrmap-entry" /> : null}
      <text x={12} y={24} className="narrmap-card-name">
        {clip(node.name || 'Untitled', 24)}
      </text>
      <text x={12} y={42} className="narrmap-card-kind">
        {KIND_WORDS[node.kind]}
      </text>
      <text x={12} y={60} className="narrmap-card-reads">
        {clip(describeNode(node), 32)}
      </text>
      {node.findings > 0 ? (
        <>
          <circle cx={CARD_W - 16} cy={16} r={9} className="narrmap-badge" />
          <text x={CARD_W - 16} y={20} textAnchor="middle" className="narrmap-badge-count">
            {node.findings}
          </text>
        </>
      ) : null}
      <title>{`${node.name || 'Untitled'} — ${describeNode(node)}`}</title>
    </g>
  );
}
