import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scrollNudge, zoneFor, type OutlineZone } from '../drag';
import { ResearchShelf } from './ResearchShelf';
import {
  OUTLINE_KINDS,
  addItem,
  addResearchRow,
  bindRow,
  canPromote,
  createOutline,
  findOutline,
  findOutlineItem,
  foldAll,
  followOutline,
  indentItem,
  isPromoted,
  isUnder,
  moveItem,
  nudgeItem,
  outdentItem,
  outlineChildren,
  outlineRows,
  outlineTally,
  outlinesOf,
  promotableUnits,
  promoteKindOf,
  promoteRow,
  promotedOf,
  removeItem,
  rowOutOfStep,
  rowSource,
  rowTitle,
  unpromoteRow,
  updateItem,
  type Outline,
  type OutlineItem,
  type OutlineItemId,
  type OutlineRow,
  type ProjectFile,
  type ResearchItemId,
  type StructuralUnitId,
} from '@vcwriter/domain';

/**
 * The Outliner (addendum 06), stages 2–5: the outline on screen, moved about
 * by hand, the research shelf it is filled from, and the way into the script.
 *
 * **A traditional outline.** Indentation guides, disclosure arrows, and a
 * weight that falls away with depth — scene rows strongest, beats lighter,
 * supporting rows lighter still — so the hierarchy reads at a glance without
 * being read (§9).
 *
 * Nothing here decides the shape: `outlineRows` walks the tree and hands back
 * every visible row with its depth, and this draws what it is given. The rules
 * about what can go where live in the domain, where they can be tested.
 */

interface OutlinerWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/** How far one level of depth moves a row in. */
const STEP = 22;

/**
 * What each type is called, and the mark it carries.
 *
 * A compact mark rather than a word on the row itself: the title is what the
 * writer is reading, and *CHARACTER —* in front of every one of them is a
 * column of noise down the left of the outline (§9).
 */
const KINDS: Record<string, { name: string; mark: string }> = {
  scene: { name: 'Scene', mark: '▣' },
  beat: { name: 'Beat', mark: '◈' },
  note: { name: 'Note', mark: '✎' },
  idea: { name: 'Idea', mark: '✦' },
  character: { name: 'Character', mark: '☺' },
  setting: { name: 'Setting', mark: '⌂' },
  prop: { name: 'Prop', mark: '❖' },
};

const nameOf = (kind: string): string => KINDS[kind]?.name ?? kind.replace(/_/g, ' ');

/** "An idea", "a note" — the right article for a type the writer may have named. */
const article = (name: string): string =>
  `${/^[aeiou]/i.test(name) ? 'An' : 'A'} ${name.toLowerCase()}`;

/** What an empty row of each kind asks for. */
const placeholderOf = (kind: string): string =>
  kind === 'scene' ? 'name the scene' : kind === 'beat' ? 'what happens' : 'say what it is';
const markOf = (kind: string): string => KINDS[kind]?.mark ?? '•';

export function OutlinerWindow({ file, open, onClose, onUpdate }: OutlinerWindowProps) {
  const outlines = outlinesOf(file);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OutlineItemId | null>(null);
  /** The row whose title is being typed, so a fresh one can be typed into at once. */
  const [editing, setEditing] = useState<OutlineItemId | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  /**
   * What is being dragged, in a ref as well as in state.
   *
   * `dataTransfer.getData` is empty during `dragover` by design, and the
   * handler has to know what is being carried in order to say whether a row is
   * a legal place to put it — so the payload is held here, exactly as the
   * structure board does it.
   */
  const carrying = useRef<
    { kind: 'row'; id: OutlineItemId } | { kind: 'research'; id: ResearchItemId } | null
  >(null);
  const [dragging, setDragging] = useState<OutlineItemId | null>(null);
  /** True while anything at all is being carried, including off the shelf. */
  const [carryingAny, setCarryingAny] = useState(false);
  /** The research item a linked row points at, revealed on the shelf (§5). */
  const [reveal, setReveal] = useState<ResearchItemId | null>(null);
  const [over, setOver] = useState<{ id: OutlineItemId; zone: OutlineZone } | null>(null);
  /** The last pointer height, so the list can scroll itself while held. */
  const edge = useRef(0);

  // Auto-scroll while something is dragged near the top or bottom of a long
  // outline (§8). Without it the row being aimed at cannot be reached at all.
  useEffect(() => {
    if (!carryingAny) return undefined;
    let frame = 0;
    const step = () => {
      const list = listRef.current;
      if (list && edge.current !== 0) list.scrollTop += edge.current;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [carryingAny]);

  const outline: Outline | null = useMemo(() => {
    if (outlines.length === 0) return null;
    const chosen = outlineId ? outlines.find((candidate) => (candidate.id as string) === outlineId) : undefined;
    return chosen ?? outlines[0] ?? null;
  }, [outlines, outlineId]);

  // A project with no outline gets one the first time the Outliner is opened.
  // Unlike a board it starts genuinely empty: there is no row a story must
  // have, so offering one would be the template §1 refuses.
  useEffect(() => {
    if (open && outlines.length === 0) onUpdate((current) => createOutline(current).file);
  }, [open, outlines.length, onUpdate]);

  const rows = useMemo(() => (outline ? outlineRows(outline) : []), [outline]);
  const tally = useMemo(() => (outline ? outlineTally(outline) : null), [outline]);

  const write = (mutate: (current: ProjectFile, id: Outline['id']) => ProjectFile) => {
    if (!outline) return;
    onUpdate((current) => mutate(current, outline.id));
  };

  const chosen = outline && selected ? findOutlineItem(outline, selected) : null;

  /** Whether this row is somewhere the carried one could actually go. */
  const canDrop = useCallback(
    (targetId: OutlineItemId): boolean => {
      const held = carrying.current;
      if (!outline || held === null) return false;
      // Anything off the shelf can land anywhere: it is not in the tree yet,
      // so there is nothing for it to be put inside of.
      if (held.kind === 'research') return true;
      if (held.id === targetId) return false;
      // A row cannot be put inside itself; the domain refuses it too, but the
      // indicator should not offer what will not happen.
      return !isUnder(outline, targetId, held.id);
    },
    [outline],
  );

  const drop = (targetId: OutlineItemId, zone: OutlineZone) => {
    const held = carrying.current;
    if (!outline || held === null || !canDrop(targetId)) return;

    write((current, id) => {
      // The target is read from the document being written to, not from the
      // render that built this handler: a drop is the end of a gesture that
      // has been re-rendering on every move, and where it lands must be
      // decided by what the outline is now.
      const live = findOutline(current, id);
      const target = live ? findOutlineItem(live, targetId) : null;
      if (!target) return current;

      // Into: the last child of the row, which is where a thing added to
      // something belongs. Beside: its sibling, above or below it.
      const where = {
        parentId: zone === 'into' ? target.id : target.parentId,
        ...(zone === 'before' ? { beforeId: target.id } : {}),
        ...(zone === 'after' ? { afterId: target.id } : {}),
      };
      return held.kind === 'research'
        ? addResearchRow(current, id, held.id, where).file
        : moveItem(current, id, held.id, where);
    });
    if (held.kind === 'row') setSelected(held.id);
  };

  const onListDragOver = (event: React.DragEvent) => {
    if (carrying.current === null) return;
    const list = listRef.current;
    if (!list) return;
    const box = list.getBoundingClientRect();
    edge.current = scrollNudge(event.clientY, box.top, box.bottom);
  };

  /**
   * A new row, put where the writer is looking.
   *
   * A **Scene** always goes at the top level — it is the primary story unit,
   * and one nested inside another scene is not a thing the outline means.
   *
   * Everything else depends on how it was asked for, and the two are different
   * sentences. Pressing **+ Character** with a beat selected means *give this
   * beat a character*, so it goes **under** it. Pressing **Return** at the end
   * of a character means *another one of these*, so it goes **beside** it —
   * a beat inside a beat is not what anybody means by "another beat".
   */
  const add = (kind: string, beside = false) => {
    write((current, id) => {
      const live = findOutline(current, id);
      const here = live && selected ? findOutlineItem(live, selected) : null;
      const parentId = kind === 'scene' ? null : beside ? here?.parentId ?? null : here?.id ?? null;
      const afterId =
        kind === 'scene' && here ? topmostOf(live as Outline, here).id : beside ? here?.id ?? null : null;
      const made = addItem(current, id, { parentId, afterId, kind });
      if (made.itemId) {
        // Typed into straight away: outlining is typing, not form-filling (§8).
        queueMicrotask(() => {
          setSelected(made.itemId);
          setEditing(made.itemId);
        });
      }
      return made.file;
    });
  };

  // Keyboard first (§8). Tab and Shift+Tab indent where they are not being
  // used to leave a field, and the arrows walk the outline.
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!outline || !selected) return;
    const at = rows.findIndex((row) => row.item.id === selected);

    if (event.key === 'Tab') {
      event.preventDefault();
      write((current, id) => (event.shiftKey ? outdentItem : indentItem)(current, id, selected));
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (event.altKey || event.metaKey)) {
      event.preventDefault();
      write((current, id) => nudgeItem(current, id, selected, event.key === 'ArrowUp' ? -1 : 1));
      return;
    }
    // Return and the bare arrows belong to the box the caret is in, which
    // knows where the caret is standing; the list only handles what happens
    // outside one — a linked row, or a click on the list itself.
    if (editing) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const to = rows[at + (event.key === 'ArrowUp' ? -1 : 1)];
      if (to) setSelected(to.item.id);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const here = findOutlineItem(outline, selected);
      if (!here || here.kind === 'scene') add('beat');
      else add(here.kind, true);
    }
  };

  if (!open) return null;

  return (
    <div className="outliner" role="dialog" aria-label="Outliner">
      <header className="outliner-bar">
        <h2>Outliner</h2>
        {outline ? <span className="muted small">{outline.name}</span> : null}

        <span className="toolbar-spacer" />

        {outline ? (
          <>
            <button
              type="button"
              className="tool"
              title="A scene: the primary story unit. Always at the top level"
              onClick={() => add('scene')}
            >
              + Scene
            </button>
            {(['beat', 'note', 'idea', 'character', 'setting', 'prop'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className="tool"
                disabled={!chosen}
                title={chosen ? `A ${nameOf(kind).toLowerCase()} under ${chosen.title || 'the selected row'}` : 'Choose a row to put it under'}
                onClick={() => add(kind)}
              >
                + {nameOf(kind)}
              </button>
            ))}

            <span className="outliner-gap" />

            <button
              type="button"
              className="ghost small"
              title="Fold everything"
              onClick={() => write((current, id) => foldAll(current, id, true))}
            >
              Collapse all
            </button>
            <button
              type="button"
              className="ghost small"
              title="Unfold everything"
              onClick={() => write((current, id) => foldAll(current, id, false))}
            >
              Expand all
            </button>

            {tally ? (
              <span className="muted small">
                {tally.scenes} {tally.scenes === 1 ? 'scene' : 'scenes'} · {tally.rows} rows
              </span>
            ) : null}

            {outlines.length > 1 ? (
              <select
                aria-label="Which outline"
                value={outline.id as string}
                onChange={(event) => setOutlineId(event.target.value)}
              >
                {outlines.map((candidate) => (
                  <option key={candidate.id as string} value={candidate.id as string}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}

        <button type="button" className="ghost" onClick={onClose} aria-label="Close the Outliner">
          ×
        </button>
      </header>

      <div className="outliner-body">
        {/* §3: the shelf lives *inside* the Outliner rather than beside it.
            Two full-window overlays cannot be side by side, and a drag cannot
            cross two windows that are not both on screen — so this is the only
            place the thing being asked for can actually happen. */}
        <ResearchShelf
          file={file}
          reveal={reveal}
          onCarry={(researchItemId) => {
            carrying.current = researchItemId === null ? null : { kind: 'research', id: researchItemId };
            setCarryingAny(researchItemId !== null);
            if (researchItemId === null) {
              edge.current = 0;
              setOver(null);
            }
          }}
        />

        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          className={carryingAny ? 'outline-list dragging' : 'outline-list'}
          ref={listRef}
          role="tree"
          tabIndex={0}
          onKeyDown={onKey}
          onDragOver={onListDragOver}
        >
          {rows.length === 0 ? (
            <p className="muted empty-state">
              Nothing yet. Start with a scene — or a note, if what you have is a thought rather than a scene.
              Everything here is a plan until you send it to the script.
            </p>
          ) : null}

          {rows.map((row) => (
            <Row
              key={row.item.id as string}
              row={row}
              title={rowTitle(file, row.item)}
              linked={row.item.source?.type === 'research_item'}
              promoted={isPromoted(row.item)}
              selected={selected === row.item.id}
              editing={editing === row.item.id}
              onSelect={() => setSelected(row.item.id)}
              onEdit={(on) => setEditing(on ? row.item.id : null)}
              onTitle={(title) => write((current, id) => updateItem(current, id, row.item.id, { title }))}
              onFold={() =>
                write((current, id) => updateItem(current, id, row.item.id, { collapsed: !row.item.collapsed }))
              }
              onNudge={(direction) => write((current, id) => nudgeItem(current, id, row.item.id, direction))}
              onIndent={(deeper) =>
                write((current, id) => (deeper ? indentItem : outdentItem)(current, id, row.item.id))
              }
              onRemove={() => {
                setSelected(null);
                write((current, id) => removeItem(current, id, row.item.id));
              }}
              onEnter={() => {
                setSelected(row.item.id);
                // Another of what this is, beside it. A scene is the exception:
                // its Return makes a **beat**, under it, because nobody writes
                // two scene names in a row and a scene with nothing in it is
                // what you have just finished naming.
                if (row.item.kind === 'scene') add('beat');
                else add(row.item.kind, true);
              }}
              onStep={(direction) => {
                const at = rows.findIndex((entry) => entry.item.id === row.item.id);
                const to = rows[at + direction];
                if (to) setSelected(to.item.id);
              }}
              dragging={dragging === row.item.id}
              zone={over?.id === row.item.id ? over.zone : null}
              onDragStart={() => {
                carrying.current = { kind: 'row', id: row.item.id };
                setDragging(row.item.id);
                setCarryingAny(true);
              }}
              onDragEnd={() => {
                carrying.current = null;
                edge.current = 0;
                setDragging(null);
                setCarryingAny(false);
                setOver(null);
              }}
              onDragOver={(zone) => {
                if (!canDrop(row.item.id)) return null;
                setOver((current) =>
                  current?.id === row.item.id && current.zone === zone ? current : { id: row.item.id, zone },
                );
                // Research off the shelf is **copied** in — it stays on the
                // shelf — and a row is **moved**. Saying the wrong one is not
                // cosmetic: a drop whose effect the source did not allow is
                // cancelled by the browser and never happens at all.
                return carrying.current?.kind === 'research' ? 'copy' : 'move';
              }}
              onDragLeave={() => setOver((current) => (current?.id === row.item.id ? null : current))}
              onDrop={(zone) => {
                drop(row.item.id, zone);
                carrying.current = null;
                edge.current = 0;
                setDragging(null);
                setCarryingAny(false);
                setOver(null);
              }}
            />
          ))}
        </div>

        {/* The row's own, beside the outline: its type, its status, and the
            words that are too long to sit on a line (§7, §8). */}
        <aside className="outline-detail">
          {chosen ? (
            <>
              <h3>{nameOf(chosen.kind)}</h3>
              {chosen.source?.type === 'research_item' ? (
                <p className="small outline-from">
                  <strong>{rowTitle(file, chosen)}</strong>, from the research shelf.{' '}
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setReveal(chosen.source?.id as ResearchItemId)}
                  >
                    Show it
                  </button>
                  {rowSource(file, chosen) ? null : (
                    <span className="muted"> It is no longer on the shelf.</span>
                  )}
                </p>
              ) : (
                <label className="field">
                  <span>Title</span>
                  <input
                    aria-label="The row's title"
                    value={chosen.title}
                    onChange={(event) => write((current, id) => updateItem(current, id, chosen.id, { title: event.target.value }))}
                  />
                </label>
              )}
              <label className="field">
                <span>What it is</span>
                <select
                  aria-label="The row's type"
                  value={OUTLINE_KINDS.includes(chosen.kind as (typeof OUTLINE_KINDS)[number]) ? chosen.kind : ''}
                  onChange={(event) => write((current, id) => updateItem(current, id, chosen.id, { kind: event.target.value }))}
                >
                  {/* A type nobody has heard of is kept and shown: the list is
                      a list of words, and §12 says it grows. */}
                  {!OUTLINE_KINDS.includes(chosen.kind as (typeof OUTLINE_KINDS)[number]) ? (
                    <option value="">{nameOf(chosen.kind)}</option>
                  ) : null}
                  {OUTLINE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {nameOf(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Notes</span>
                <textarea
                  aria-label="The row's notes"
                  rows={10}
                  value={chosen.body}
                  onChange={(event) => write((current, id) => updateItem(current, id, chosen.id, { body: event.target.value }))}
                />
              </label>

              {/* §1: a row is a plan until the writer says otherwise, and
                  saying so is this. */}
              <Promotion
                file={file}
                outline={outline as Outline}
                item={chosen}
                onWrite={write}
              />
            </>
          ) : (
            <p className="muted small">
              Choose a row to write its notes. Tab and Shift+Tab move a row in and out; hold Alt with the up and
              down arrows to move it among the rows beside it.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * A plan, or a scene (addendum 06 §6).
 *
 * **A statement of fact and one control, never a form.** A row that is still a
 * plan offers the one move that makes it real; a row that is in the script
 * says which scene it is and offers to let go. A row that can never be either
 * — a Note, an Idea, a Character — says so rather than showing a button that
 * does nothing.
 */
function Promotion({
  file,
  outline,
  item,
  onWrite,
}: {
  file: ProjectFile;
  outline: Outline;
  item: OutlineItem;
  onWrite(mutate: (current: ProjectFile, id: Outline['id']) => ProjectFile): void;
}) {
  const kind = promoteKindOf(item);
  const promoted = promotedOf(file, item);
  const refusal = canPromote(file, outline, item);
  const step = useMemo(
    () => (isPromoted(item) ? rowOutOfStep(file, outline, item.id) : null),
    [file, outline, item],
  );

  if (kind === null) {
    return (
      <p className="muted small outline-promotion">
        Planning. {article(nameOf(item.kind))} is something to know while the scene is written, and it stays here
        when it is.
      </p>
    );
  }

  const what = kind === 'unit' ? 'scene' : 'beat';

  if (promoted) {
    const name =
      promoted.kind === 'unit'
        ? `${promoted.unit.sequenceLabel || ''} ${promoted.unit.title || 'Untitled'}`.trim()
        : promoted.beat.title.trim() || 'Untitled';
    return (
      <section className="outline-promotion in-script">
        <p className="small">
          <span className="outline-real">●</span> This <strong>is</strong> the {what} <em>{name}</em>, in the
          script. Rename it here or there and it is renamed in both.
        </p>
        {step ? (
          <p className="small outline-step">
            In the outline it comes {step.outlineFirst ? 'before' : 'after'} {step.otherTitle}; in the script it
            comes {step.outlineFirst ? 'after' : 'before'}.{' '}
            <button
              type="button"
              className="ghost small"
              onClick={() => onWrite((current, id) => followOutline(current, id, item.id))}
            >
              Move the {what} to match
            </button>
          </p>
        ) : null}
        <button
          type="button"
          className="ghost small"
          onClick={() => onWrite((current, id) => unpromoteRow(current, id, item.id))}
        >
          Take it out of the script
        </button>
      </section>
    );
  }

  const beats = outlineChildren(outline, item.id).filter((child) => child.kind === 'beat').length;
  const existing = kind === 'unit' ? promotableUnits(file, item.id) : [];

  return (
    <section className="outline-promotion">
      <p className="muted small">A plan. It lives only in the outline.</p>

      {refusal === null ? (
        <button
          type="button"
          className="ghost small"
          title={
            kind === 'unit'
              ? `Put this scene in the script${beats > 0 ? `, with its ${beats} ${beats === 1 ? 'beat' : 'beats'}` : ''}`
              : 'Put this beat into its scene'
          }
          onClick={() => onWrite((current, id) => promoteRow(current, id, item.id).file)}
        >
          Send to Script{kind === 'unit' && beats > 0 ? ` — and ${beats} ${beats === 1 ? 'beat' : 'beats'}` : ''}
        </button>
      ) : (
        <p className="muted small">
          {refusal === 'its scene is still a plan'
            ? 'A beat lives inside a scene, so this one can go in as soon as the scene above it does.'
            : refusal === 'there is no lane to put a scene in'
              ? 'There is no plot lane to put a scene in yet.'
              : refusal}
        </p>
      )}

      {existing.length > 0 ? (
        <label className="field">
          <span>or it already exists</span>
          <select
            aria-label="Bind this row to a scene"
            value=""
            onChange={(event) => {
              const unitId = event.target.value;
              if (!unitId) return;
              onWrite((current, id) => bindRow(current, id, item.id, unitId as unknown as StructuralUnitId));
            }}
          >
            <option value="">Choose the scene it is…</option>
            {existing.map((unit) => (
              <option key={unit.id as string} value={unit.id as string}>
                {`${unit.sequenceLabel || unit.kind} ${unit.title || 'Untitled'}`.trim()}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}

/** The scene a row is inside, or the row itself when it is already at the top. */
const topmostOf = (outline: Outline, item: OutlineItem): OutlineItem => {
  let walk = item;
  for (let step = 0; walk.parentId !== null && step <= outline.items.length; step += 1) {
    const parent = findOutlineItem(outline, walk.parentId);
    if (!parent) break;
    walk = parent;
  }
  return walk;
};

/**
 * One row: its mark, its title, and the controls that only appear on it.
 *
 * The title is an input rather than text so renaming is typing rather than
 * opening something (§8), and the indentation is padding rather than nesting
 * so every row is a sibling in the DOM — which is what lets the list be walked
 * with the arrow keys.
 */
function Row({
  row,
  title,
  linked,
  promoted,
  selected,
  editing,
  onSelect,
  onEdit,
  onTitle,
  onFold,
  onNudge,
  onIndent,
  onRemove,
  onEnter,
  onStep,
  dragging,
  zone,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  row: OutlineRow;
  /** Read through to the shelf where the row references research (§5). */
  title: string;
  linked: boolean;
  /** In the script, so the row wears the badge (§6). */
  promoted: boolean;
  selected: boolean;
  editing: boolean;
  onSelect(): void;
  onEdit(on: boolean): void;
  onTitle(title: string): void;
  onFold(): void;
  onNudge(direction: -1 | 1): void;
  onIndent(deeper: boolean): void;
  onRemove(): void;
  /** Return from inside the box: the next row, never a line break. */
  onEnter(): void;
  /** An arrow off the end of the box: the row above or below. */
  onStep(direction: -1 | 1): void;
  /** This row is the one being carried. */
  dragging: boolean;
  /** Where the carried row would land on this one, while it is over it. */
  zone: OutlineZone | null;
  onDragStart(): void;
  onDragEnd(): void;
  /**
   * Answers how the drop would happen, or null where it cannot.
   *
   * The answer is the `dropEffect`, and it has to agree with what the thing
   * being carried allowed: a browser cancels a drop whose effect the source
   * did not permit, silently and without firing `drop` at all.
   */
  onDragOver(zone: OutlineZone): 'copy' | 'move' | null;
  onDragLeave(): void;
  onDrop(zone: OutlineZone): void;
}) {
  const { item, depth, childCount } = row;
  const input = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  return (
    <div
      className={[
        'outline-row',
        `kind-${item.kind}`,
        selected ? 'selected' : '',
        linked ? 'linked' : '',
        promoted ? 'in-script' : '',
        dragging ? 'carried' : '',
        zone ? `drop-${zone}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ paddingLeft: `${8 + depth * STEP}px` }}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={childCount === 0 ? undefined : !item.collapsed}
      onPointerDown={onSelect}
      // The whole row is the handle. A grip would be one more thing to aim at,
      // and the title is an input, so the browser leaves its text alone.
      draggable
      onDragStart={(event) => {
        // Something has to be set or the drag never begins; the payload the
        // handlers actually read is held by the panel (§8).
        event.dataTransfer.setData('text/plain', item.title || nameOf(item.kind));
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        const effect = onDragOver(zoneFor(event));
        // Only a legal target takes the drop, so an illegal one shows the
        // cursor that says so rather than lying about what will happen.
        if (!effect) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = effect;
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(zoneFor(event));
      }}
    >
      {/* The guides: one per level, so the eye can run back up to the parent. */}
      {Array.from({ length: depth }, (unused, level) => (
        <span key={level} className="outline-guide" style={{ left: `${8 + level * STEP + 7}px` }} aria-hidden="true" />
      ))}

      {childCount > 0 ? (
        <button
          type="button"
          className="ghost small outline-fold"
          aria-label={item.collapsed ? `Expand ${item.title || 'this row'}` : `Collapse ${item.title || 'this row'}`}
          title={item.collapsed ? `${childCount} folded away` : 'Fold what is under it'}
          onClick={onFold}
        >
          {item.collapsed ? '▸' : '▾'}
        </button>
      ) : (
        <span className="outline-fold empty" aria-hidden="true" />
      )}

      <span className="outline-mark" title={nameOf(item.kind)} aria-label={nameOf(item.kind)}>
        {markOf(item.kind)}
      </span>

      {/* The badge §6 asks for: a glance says how much of the outline is in
          the script. A row that is still a plan carries no mark. */}
      {promoted ? (
        <span className="outline-real" title="This is in the script" aria-label="In the script">
          ●
        </span>
      ) : null}

      {/*
        Every element sits in a box that **fits what is written in it**: two
        layers in one grid cell, the text under and the box typed in over it,
        laid out identically so the characters land on each other. The layer
        under sizes the cell, which is what makes the box grow with the words
        rather than guessing at a row count — the same way the script's lines
        are built.

        The cell hugs its content up to a line's worth of words and wraps after
        that, so a short row is a short box and a long one is a taller box of
        the same width, never a rule running off across the screen.

        A row that references research is read rather than typed: the name
        belongs to the shelf and is not the row's to change (§5), so it is a
        box with no box in it.
      */}
      <span className={linked ? 'outline-box linked' : 'outline-box'}>
        <span className="outline-ink" aria-hidden="true">
          {title || placeholderOf(item.kind)}
          {/* A zero-width space so a box with nothing in it still has a line's
              height, and the caret has somewhere to stand. */}
          {'\u200b'}
        </span>
        {linked ? (
          <span className="outline-read" title="From the research shelf. Renaming it there renames it here">
            {title}
          </span>
        ) : (
          <textarea
            ref={input}
            className="outline-title"
            rows={1}
            spellCheck={false}
            aria-label={`${nameOf(item.kind)}: what it is`}
            placeholder={placeholderOf(item.kind)}
            value={title}
            onFocus={() => onEdit(true)}
            onBlur={() => onEdit(false)}
            onChange={(event) => onTitle(event.target.value)}
            onKeyDown={(event) => {
              // Return makes the next row rather than a new line inside this
              // one: the box wraps on its own, so a line break typed by hand
              // would only be a way to make a row two rows tall by accident.
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onEnter();
                return;
              }
              // The arrows walk the outline from the ends of the box, and
              // move the caret inside it everywhere else.
              const box = event.currentTarget;
              if (event.key === 'ArrowUp' && box.selectionStart === 0 && !event.altKey) {
                event.preventDefault();
                onStep(-1);
              }
              if (event.key === 'ArrowDown' && box.selectionEnd === box.value.length && !event.altKey) {
                event.preventDefault();
                onStep(1);
              }
            }}
          />
        )}
      </span>

      {item.collapsed && childCount > 0 ? <span className="muted small outline-hidden">{childCount}</span> : null}

      <div className="outline-tools">
        <button type="button" className="ghost small" aria-label={`Move ${item.title || 'this row'} out`} onClick={() => onIndent(false)}>
          ⇤
        </button>
        <button type="button" className="ghost small" aria-label={`Move ${item.title || 'this row'} in`} onClick={() => onIndent(true)}>
          ⇥
        </button>
        <button type="button" className="ghost small" aria-label={`Move ${item.title || 'this row'} up`} onClick={() => onNudge(-1)}>
          ↑
        </button>
        <button type="button" className="ghost small" aria-label={`Move ${item.title || 'this row'} down`} onClick={() => onNudge(1)}>
          ↓
        </button>
        <button type="button" className="ghost small" aria-label={`Remove ${item.title || 'this row'}`} onClick={onRemove}>
          ×
        </button>
      </div>
    </div>
  );
}
