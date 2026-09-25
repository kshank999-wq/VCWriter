import { useEffect, useMemo, useRef, useState } from 'react';
import { PopOutButton } from './PopOutButton';
import { ConditionGroupEditor, ContributorList, EffectList, RuleSentence } from './RuleBuilder';
import { NarrativeWorldPanel } from './NarrativeWorldPanel';
import { NarrativePlayPanel } from './NarrativePlayPanel';
import { NarrativeEndingsPanel } from './NarrativeEndingsPanel';
import { NarrativeQuestsPanel } from './NarrativeQuestsPanel';
import {
  addChoice,
  addElement,
  choicesFor,
  describeGraph,
  describeNode,
  dropIntoLane,
  dropOnConnection,
  laneSlots,
  addObjective,
  makeChoicesExclusive,
  living,
  newId,
  type DialogueLine,
  type Shot,
  type ShotId,
  objectivesIn,
  playerLane,
  questsOf,
  removeObjective,
  updateObjective,
  LANE_WORDS,
  type LaneScene,
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
  type LaneCard,
  type ChoiceId,
  type StructuralUnitId,
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
 * the central lane is the spine in the script's order with branches above and
 * below it (addendum 25 §4.3), the badge is stage 3's findings, and the ring is
 * a node nothing reaches. Nothing here is stored.
 *
 * The one thing that moves is a **card from the tray**, and it is not a
 * position: dropping *New scene* into the lane writes a scene into the story
 * order there, and dropping one on a connection splices a node into it. The
 * layout is then read from the new graph like any other.
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

/** How far the lane's band reaches past a card above and below. */
const LANE_PAD = 14;
/** The Player Lane's band: one row, under the spine's. */
const PLAYER_H = ROW - 12;
/** The most lines a scene shows on the lane before saying how many more. */
const PLAYER_LINES = 5;

const CARD_WORDS: Record<LaneCard, string> = { scene: 'New scene', beat: 'New beat' };
const CARD_TIPS: Record<LaneCard, string> = {
  scene: 'Drag into the lane to write a new scene into the story there, or onto a connection to put one in between',
  beat: 'Drag into the lane to add a beat to the scene on its left, or onto a connection to put one in between',
};
/** The drag's own type, so a file or text dragged in from outside is not a card. */
const DRAG_TYPE = 'application/x-vcwriter-lane-card';

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
  const [questsOpen, setQuestsOpen] = useState(false);
  /** Which objective has its *done when* rule open. One at a time, as choices. */
  const [openObjective, setOpenObjective] = useState<string | null>(null);
  /** The path being walked, so §9's *path preview* is drawn on the board. */
  const [walkingId, setWalkingId] = useState<SimulationRunId | null>(null);
  /** Which choice has its rule open. One at a time: three WHENs is a wall. */
  const [openRule, setOpenRule] = useState<string | null>(null);
  /**
   * A tray card on its way into the lane: being dragged, or tapped and waiting
   * for a place — the same drop by touch, or for anybody who would rather not
   * drag.
   */
  const [carrying, setCarrying] = useState<LaneCard | null>(null);

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

  useEffect(() => {
    if (!carrying) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCarrying(null);
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [carrying]);

  // Where the player is standing and which connections they came along. A
  // reading of the run like every other reading here, so stepping back on the
  // panel un-draws the last line with nothing told to do it.
  const walking = walkingId ? findRun(file, walkingId) : null;
  const walked = walking ? replayRun(file, walking) : null;
  const here = walked?.at?.id ?? null;
  const along = new Set((walking?.steps ?? []).map((one) => one as string));

  const selected = selectedId ? findElement(file, selectedId) : null;
  /** The scene the selected node's beat is in, for its Player Lane objectives. */
  const selectedUnitId = selected?.boundBeatId
    ? (file.beats.find((one) => one.id === selected.boundBeatId)?.unitId ?? null)
    : null;
  const lane = useMemo(() => playerLane(file), [file]);

  /**
   * Open a new objective's *done when* as soon as it exists. Read off the file
   * once it has arrived rather than caught from inside the mutation, because the
   * document is shared over the link and the mutation may run after this
   * handler has returned.
   */
  const wantsNewObjective = useRef(false);
  useEffect(() => {
    if (!wantsNewObjective.current || !selectedUnitId) return;
    const newest = objectivesIn(file, selectedUnitId).at(-1);
    if (!newest) return;
    wantsNewObjective.current = false;
    setOpenObjective(newest.id as string);
  }, [file, selectedUnitId]);
  const selectedLane = selectedUnitId ? lane.find((one) => one.unitId === selectedUnitId) ?? null : null;
  const rows = selectedId ? choicesFor(file, selectedId) : [];
  const notes = selectedId ? findingsAt(file, selectedId) : [];

  if (!open) return null;

  const width = MARGIN * 2 + Math.max(1, map.columns) * COLUMN + MARGIN;
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

  const drop = (target: { afterUnitId: StructuralUnitId | null } | { choiceId: ChoiceId }, card: LaneCard): void => {
    let made: NarrativeElementId | null = null;
    onUpdate((current) => {
      const next =
        'choiceId' in target
          ? dropOnConnection(current, { card, choiceId: target.choiceId })
          : dropIntoLane(current, { card, afterUnitId: target.afterUnitId });
      made = next.element.id;
      return next.file;
    });
    setCarrying(null);
    if (made) setSelectedId(made);
  };

  /** Where on the lane each slot sits: between spine cards, and at both ends. */
  const unitOfBeat = new Map(file.beats.map((one) => [one.id as string, one.unitId as string]));
  const spineCards = map.nodes.filter((one) => one.lane === 'spine').sort((a, b) => a.column - b.column);
  const laneY = MARGIN + map.laneRow * ROW + CARD_H / 2;
  const playerTop = laneY + CARD_H / 2 + LANE_PAD + 6;
  const slots = laneSlots(file);
  const slotBefore = (unitId: string): StructuralUnitId | null => {
    const at = slots.findIndex((one) => one.afterUnitId === unitId);
    return at > 0 ? (slots[at - 1]!.afterUnitId as StructuralUnitId | null) : null;
  };
  const laneTargets: { key: string; x: number; afterUnitId: StructuralUnitId | null; label: string }[] = [];
  if (spineCards.length === 0) {
    laneTargets.push({ key: 'start', x: MARGIN + CARD_W / 2, afterUnitId: slots.at(-1)?.afterUnitId ?? null, label: slots.length > 1 ? 'Add to the story' : 'Start the story' });
  } else {
    const unitOf = (node: GraphNode) => unitOfBeat.get(node.element.boundBeatId as string) ?? '';
    const first = spineCards[0]!;
    laneTargets.push({ key: 'start', x: xOf(first) - MARGIN / 2, afterUnitId: slotBefore(unitOf(first)), label: 'Before this scene' });
    spineCards.forEach((node, index) => {
      const next = spineCards[index + 1];
      const x = next ? (xOf(node) + CARD_W + xOf(next)) / 2 : xOf(node) + CARD_W + MARGIN / 2 + 6;
      const unit = unitOf(node);
      const label = slots.find((one) => one.afterUnitId === unit)?.label ?? 'Here';
      laneTargets.push({ key: `after-${node.element.id as string}`, x, afterUnitId: (unit || null) as StructuralUnitId | null, label });
    });
  }

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

        <div className="narrmap-tray" role="group" aria-label="Cards to drop into the lane">
          {(['scene', 'beat'] as const).map((card) => (
            <button
              key={card}
              type="button"
              draggable
              className={carrying === card ? 'tool narrmap-tray-card on' : 'tool narrmap-tray-card'}
              aria-pressed={carrying === card}
              title={CARD_TIPS[card]}
              onDragStart={(event) => {
                event.dataTransfer.setData(DRAG_TYPE, card);
                event.dataTransfer.effectAllowed = 'copy';
                setCarrying(card);
              }}
              onDragEnd={() => setCarrying(null)}
              onClick={() => setCarrying(carrying === card ? null : card)}
            >
              ＋ {CARD_WORDS[card]}
            </button>
          ))}
        </div>
        <button type="button" className="tool" onClick={add} title="Add a node to the graph that is not on the spine">
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
          className={questsOpen ? 'tool on' : 'tool'}
          aria-pressed={questsOpen}
          title="Quests: objectives strung together in order"
          onClick={() => setQuestsOpen(!questsOpen)}
        >
          ☰ Quests
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
          {carrying
            ? `Drop the ${CARD_WORDS[carrying].toLowerCase()} on a gold mark: in the lane, or on a connection. Esc to put it back.`
            : 'The layout is read from the graph — drop a scene into the lane, or draw a connection, and it takes its place.'}
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

        {questsOpen ? (
          <NarrativeQuestsPanel
            file={file}
            onUpdate={onUpdate}
            onClose={() => setQuestsOpen(false)}
            onGoToScene={(unitId) => {
              const scene = lane.find((one) => one.unitId === unitId);
              if (scene?.nodes[0]) setSelectedId(scene.nodes[0].id);
            }}
          />
        ) : null}

        {endingsOpen ? (
          <NarrativeEndingsPanel file={file} onClose={() => setEndingsOpen(false)} onGoTo={setSelectedId} />
        ) : null}

        <div className="narrmap-stage" ref={stage}>
          {map.nodes.length === 0 && !showLaneWhenEmpty(file, search, kind) ? (
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

              {/* The spine's lane, through the middle (addendum 25 §4.3). */}
              <g className="narrmap-lane" aria-hidden="true">
                <rect
                  x={0}
                  y={laneY - CARD_H / 2 - LANE_PAD}
                  width={width}
                  height={CARD_H + LANE_PAD * 2}
                  className="narrmap-lane-band"
                />
                <text x={MARGIN} y={laneY - CARD_H / 2 - 4} className="narrmap-lane-label">
                  Spine
                </text>
              </g>

              {/* The Player Lane, directly under the spine (addendum 25 §3):
                  what the player does in each scene, read off its objectives
                  and its nodes. Under the scene's first card on the spine. */}
              <g className="narrmap-player-lane">
                <rect
                  x={0}
                  y={playerTop}
                  width={width}
                  height={PLAYER_H}
                  className="narrmap-player-band"
                  aria-hidden="true"
                />
                <text x={MARGIN} y={playerTop + 12} className="narrmap-lane-label" aria-hidden="true">
                  Player lane
                </text>
                {lane.map((scene) => {
                  const card = scene.nodes.map((one) => placed.get(one.id as string)).find((one) => one?.lane === 'spine');
                  if (!card) return null;
                  return (
                    <PlayerLaneColumn
                      key={scene.unitId as string}
                      scene={scene}
                      x={xOf(card)}
                      y={playerTop + 28}
                      selected={scene.unitId === selectedUnitId}
                      onPick={() => setSelectedId(card.element.id)}
                    />
                  );
                })}
              </g>

              {map.links.map((link) => (
                <LinkLine
                  key={link.choice.id as string}
                  link={link}
                  placed={placed}
                  walked={along.has(link.choice.id as string)}
                />
              ))}

              {/* A mark on each connection a card can be spliced into. Not on
                  the spine's own line, where the lane's slot is the same drop
                  in the same place, and not on a line back, which dips under
                  the board and has no middle worth aiming at. */}
              {carrying
                ? map.links.filter((link) => !link.spine && !link.back).map((link) => {
                    const from = placed.get(link.from as string);
                    const to = placed.get(link.to as string);
                    if (!from || !to) return null;
                    return (
                      <DropMark
                        key={`on-${link.choice.id as string}`}
                        x={(xOf(from) + CARD_W + xOf(to)) / 2}
                        y={(yOf(from) + yOf(to)) / 2 + CARD_H / 2}
                        label={`Between ${from.name || 'Untitled'} and ${to.name || 'Untitled'}`}
                        onDrop={(card) => drop({ choiceId: link.choice.id }, card ?? carrying)}
                      />
                    );
                  })
                : null}

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

              {carrying
                ? laneTargets.map((one) => (
                    <DropMark
                      key={one.key}
                      x={one.x}
                      y={laneY}
                      label={one.label}
                      lane
                      onDrop={(card) => drop({ afterUnitId: one.afterUnitId }, card ?? carrying)}
                    />
                  ))
                : null}
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

              {/* The other side's lines, on a conversation or a cinematic that is
                  not bound to a beat (addendum 25 §6): a bound one keeps its
                  words in the script. Absent on every other kind. */}
              {(selected.kind === 'conversation' || selected.kind === 'cinematic') && !selected.boundBeatId ? (
                <LinesEditor
                  file={file}
                  lines={selected.lines}
                  onChange={(next) => onUpdate((current) => updateElement(current, selected.id, { lines: next }))}
                />
              ) : null}
              {selected.kind === 'cinematic' ? (
                <ShotsEditor
                  file={file}
                  shots={selected.shots}
                  skippable={selected.skippable}
                  onSkippable={(next) => onUpdate((current) => updateElement(current, selected.id, { skippable: next }))}
                  onChange={(next) => onUpdate((current) => updateElement(current, selected.id, { shots: next }))}
                />
              ) : null}

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

              {/* The Player Lane for this node's scene: its objectives, written
                  here, and what the rest of the lane reads off the rules. Absent
                  on a node that is not on the spine — the lane is the way
                  through, and a branch has no scene of its own. */}
              {selectedUnitId && selectedLane ? (
                <section className="narrmap-objectives" aria-label="The Player Lane for this scene">
                  <h3>Player lane · scene {selectedLane.position}</h3>
                  {objectivesIn(file, selectedUnitId).length === 0 ? (
                    <p className="muted small">What must the player do here? Add an objective.</p>
                  ) : null}
                  <ul className="narrmap-choices">
                    {objectivesIn(file, selectedUnitId).map((objective) => {
                      const id = objective.id as string;
                      const open = openObjective === id;
                      return (
                        <li key={id}>
                          <div className="rule-row">
                            <input
                              value={objective.name}
                              placeholder="What the player must do"
                              aria-label="The objective"
                              onChange={(event) =>
                                onUpdate((current) => updateObjective(current, objective.id, { name: event.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="ghost small"
                              aria-expanded={open}
                              aria-label={`What makes ${objective.name || 'this objective'} done`}
                              onClick={() => setOpenObjective(open ? null : id)}
                            >
                              {open ? '▴' : '▾'}
                            </button>
                            <button
                              type="button"
                              className="ghost small"
                              aria-label={`Remove ${objective.name || 'the objective'}`}
                              onClick={() => onUpdate((current) => removeObjective(current, objective.id))}
                            >
                              ✕
                            </button>
                          </div>
                          <RuleSentence file={file} group={objective.complete} empty="Done as soon as the player is here." />
                          {open ? (
                            <div className="rule-open">
                              <h4>DONE WHEN</h4>
                              <ConditionGroupEditor
                                file={file}
                                group={objective.complete}
                                onChange={(next: ConditionGroup) =>
                                  onUpdate((current) => updateObjective(current, objective.id, { complete: next }))
                                }
                              />
                              <label>
                                <input
                                  type="checkbox"
                                  checked={objective.mandatory}
                                  onChange={(event) =>
                                    onUpdate((current) =>
                                      updateObjective(current, objective.id, { mandatory: event.target.checked }),
                                    )
                                  }
                                />
                                <span className="small">The scene is not complete without it</span>
                              </label>
                              <label className="sculpt-view">
                                <span className="muted small">Quest</span>
                                <select
                                  value={(objective.questId as string) ?? ''}
                                  aria-label="The quest this objective is a step of"
                                  onChange={(event) =>
                                    onUpdate((current) =>
                                      updateObjective(current, objective.id, {
                                        questId: (event.target.value || null) as never,
                                      }),
                                    )
                                  }
                                >
                                  <option value="">No quest</option>
                                  {questsOf(file).map((quest) => (
                                    <option key={quest.id as string} value={quest.id as string}>
                                      {quest.name || 'Untitled quest'}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    className="tool"
                    onClick={() => {
                      wantsNewObjective.current = true;
                      onUpdate((current) => addObjective(current, { name: '', unitId: selectedUnitId }).file);
                    }}
                  >
                    + Objective
                  </button>
                  {selectedLane.items.some((one) => one.kind !== 'objective') ? (
                    <>
                      <h4>Read from the rules</h4>
                      <ul className="narrmap-lane-read">
                        {selectedLane.items
                          .filter((one) => one.kind !== 'objective')
                          .map((one, index) => (
                            <li key={`${one.kind}-${index}`}>
                              <span className="narrmap-lane-word">{LANE_WORDS[one.kind]}</span> {one.text}
                            </li>
                          ))}
                      </ul>
                    </>
                  ) : null}
                </section>
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
                          <div className="rule-row">
                            <label className="small">
                              <input
                                type="checkbox"
                                checked={row.choice.repeat === 'once'}
                                onChange={(event) =>
                                  onUpdate((current) =>
                                    updateChoice(current, row.choice.id, { repeat: event.target.checked ? 'once' : 'repeatable' }),
                                  )
                                }
                              />{' '}
                              Only once
                            </label>
                            <label className="small" title="For Game Studio: how long the player has. Nothing here counts it down.">
                              Timed{' '}
                              <input
                                type="number"
                                min={0}
                                value={row.choice.timedSeconds}
                                aria-label="Seconds to choose, or 0 for no limit"
                                onChange={(event) =>
                                  onUpdate((current) =>
                                    updateChoice(current, row.choice.id, {
                                      timedSeconds: Math.max(0, Math.trunc(Number(event.target.value) || 0)),
                                    }),
                                  )
                                }
                              />{' '}
                              s
                            </label>
                          </div>
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
                {rows.length >= 2 ? (
                  <button
                    type="button"
                    className="tool"
                    title="Taking any one of these closes the others, wherever they are offered: one state, and one rule on each choice, which you can open and change"
                    onClick={() => onUpdate((current) => makeChoicesExclusive(current, selected.id))}
                  >
                    Only one of these
                  </button>
                ) : null}
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

/**
 * Whether to draw the lane on a board with nothing on it yet: yes, so the
 * first scene has somewhere to be dropped — unless a search or a kind filter
 * is what emptied it, when *nothing matches* is the true thing to say.
 */
function showLaneWhenEmpty(file: ProjectFile, search: string, kind: NarrativeKind | ''): boolean {
  return search.trim() === '' && kind === '' && file.narrativeElements.length === 0;
}

/**
 * A place a tray card can land: a slot in the lane, or the middle of a
 * connection. Dragging onto it and tapping it do the same thing.
 */
function DropMark({
  x,
  y,
  label,
  lane = false,
  onDrop,
}: {
  x: number;
  y: number;
  label: string;
  lane?: boolean;
  onDrop(card: LaneCard | null): void;
}) {
  const [over, setOver] = useState(false);
  const classes = ['narrmap-drop'];
  if (lane) classes.push('in-lane');
  if (over) classes.push('over');
  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => onDrop(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onDrop(null);
        }
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const card = event.dataTransfer.getData(DRAG_TYPE);
        onDrop(card === 'scene' || card === 'beat' ? card : null);
      }}
    >
      <circle r={lane ? 13 : 10} className="narrmap-drop-ring" />
      <path d="M -5 0 H 5 M 0 -5 V 5" className="narrmap-drop-plus" />
      <title>{label}</title>
    </g>
  );
}

/**
 * One scene's lines on the Player Lane: objectives first, then what the rules
 * say the player decides, needs, gets, uses, learns and overcomes. Each line
 * is a reading; pressing the column opens the scene's node beside the map,
 * where objectives are written.
 */
function PlayerLaneColumn({
  scene,
  x,
  y,
  selected,
  onPick,
}: {
  scene: LaneScene;
  x: number;
  y: number;
  selected: boolean;
  onPick(): void;
}) {
  const shown = scene.items.slice(0, PLAYER_LINES);
  const more = scene.items.length - shown.length;
  const classes = ['narrmap-player-scene'];
  if (selected) classes.push('is-selected');
  const said = scene.items.map((one) => `${LANE_WORDS[one.kind]} ${one.text}`).join('; ');
  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={`Player lane, scene ${scene.position}: ${said || 'nothing yet'}`}
      onClick={onPick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onPick();
        }
      }}
    >
      <rect x={-6} y={-14} width={CARD_W + 12} height={PLAYER_H - 22} className="narrmap-player-hit" />
      {shown.length === 0 ? (
        <text className="narrmap-player-empty">Nothing asked of the player yet</text>
      ) : (
        shown.map((one, index) => (
          <text key={`${one.kind}-${index}`} y={index * 16} className={`narrmap-player-line kind-${one.kind}`}>
            <tspan className="narrmap-lane-word">{LANE_WORDS[one.kind]}</tspan>
            <tspan dx={6}>
              {clip(one.text, 26)}
              {one.kind === 'objective' && one.mandatory === false ? ' (optional)' : ''}
            </tspan>
          </text>
        ))
      )}
      {more > 0 ? (
        <text y={shown.length * 16} className="narrmap-player-empty">
          {`+ ${more} more`}
        </text>
      ) : null}
      <title>{said || 'Nothing asked of the player yet'}</title>
    </g>
  );
}

/** Lines of dialogue, speaker and direction and words, in order. */
function LinesEditor({
  file,
  lines,
  onChange,
  title = 'Lines',
}: {
  file: ProjectFile;
  lines: readonly DialogueLine[];
  onChange(next: DialogueLine[]): void;
  title?: string;
}) {
  const cast = file.characters.filter((one) => living(one) && !one.archived);
  const change = (index: number, patch: Partial<DialogueLine>) =>
    onChange(lines.map((one, at) => (at === index ? { ...one, ...patch } : one)));
  return (
    <section className="narrmap-lines" aria-label={title}>
      <h3>{title}</h3>
      {lines.map((line, index) => (
        <div key={index} className="narrmap-line">
          <div className="rule-row">
            <select
              value={(line.characterId as string) ?? ''}
              aria-label="Who says it"
              onChange={(event) => change(index, { characterId: (event.target.value || null) as never })}
            >
              <option value="">Somebody</option>
              {cast.map((person) => (
                <option key={person.id as string} value={person.id as string}>
                  {person.name}
                </option>
              ))}
            </select>
            <input
              value={line.direction}
              placeholder="barely a whisper"
              aria-label="How it is said"
              onChange={(event) => change(index, { direction: event.target.value })}
            />
            <button type="button" className="ghost small" aria-label="Remove this line" onClick={() => onChange(lines.filter((_, at) => at !== index))}>
              ✕
            </button>
          </div>
          <textarea value={line.text} placeholder="They were here. All this time." aria-label="The line" onChange={(event) => change(index, { text: event.target.value })} />
        </div>
      ))}
      <button type="button" className="tool" onClick={() => onChange([...lines, { characterId: null, text: '', direction: '' }])}>
        + Line
      </button>
    </section>
  );
}

/** A cinematic's shots: camera, action, audio, lines and a running time for Game Studio. */
function ShotsEditor({
  file,
  shots,
  skippable,
  onSkippable,
  onChange,
}: {
  file: ProjectFile;
  shots: readonly Shot[];
  skippable: boolean;
  onSkippable(next: boolean): void;
  onChange(next: Shot[]): void;
}) {
  const change = (index: number, patch: Partial<Shot>) => onChange(shots.map((one, at) => (at === index ? { ...one, ...patch } : one)));
  return (
    <section className="narrmap-lines" aria-label="Shots">
      <h3>Shots</h3>
      <label className="small">
        <input type="checkbox" checked={skippable} onChange={(event) => onSkippable(event.target.checked)} /> The player can skip it
      </label>
      {shots.map((shot, index) => (
        <div key={shot.id as string} className="narrmap-line">
          <div className="rule-row">
            <span className="muted small">Shot {index + 1}</span>
            <input
              type="number"
              min={0}
              value={shot.seconds}
              aria-label="Seconds"
              title="Running time, for Game Studio"
              onChange={(event) => change(index, { seconds: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })}
            />
            <span className="muted small">s</span>
            <button type="button" className="ghost small" aria-label={`Remove shot ${index + 1}`} onClick={() => onChange(shots.filter((_, at) => at !== index))}>
              ✕
            </button>
          </div>
          <input value={shot.camera} placeholder="Low wide on the door" aria-label="Camera" onChange={(event) => change(index, { camera: event.target.value })} />
          <input value={shot.action} placeholder="The door swings inward" aria-label="What happens" onChange={(event) => change(index, { action: event.target.value })} />
          <input value={shot.audio} placeholder="A deep stone rumble" aria-label="Sound" onChange={(event) => change(index, { audio: event.target.value })} />
          <LinesEditor file={file} lines={shot.lines} title={`Lines in shot ${index + 1}`} onChange={(next) => change(index, { lines: next })} />
        </div>
      ))}
      <button
        type="button"
        className="tool"
        onClick={() => onChange([...shots, { id: newId<ShotId>(), camera: '', action: '', lines: [], audio: '', seconds: 0 }])}
      >
        + Shot
      </button>
    </section>
  );
}
