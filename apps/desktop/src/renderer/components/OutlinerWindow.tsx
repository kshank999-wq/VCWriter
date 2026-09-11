import { useEffect, useMemo, useRef, useState } from 'react';
import {
  OUTLINE_KINDS,
  addItem,
  createOutline,
  findOutline,
  findOutlineItem,
  foldAll,
  indentItem,
  nudgeItem,
  outdentItem,
  outlineChildren,
  outlineRows,
  outlineTally,
  outlinesOf,
  removeItem,
  updateItem,
  type Outline,
  type OutlineItem,
  type OutlineItemId,
  type OutlineRow,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The Outliner (addendum 06), stage 2: the outline on screen.
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
const markOf = (kind: string): string => KINDS[kind]?.mark ?? '•';

export function OutlinerWindow({ file, open, onClose, onUpdate }: OutlinerWindowProps) {
  const outlines = outlinesOf(file);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [selected, setSelected] = useState<OutlineItemId | null>(null);
  /** The row whose title is being typed, so a fresh one can be typed into at once. */
  const [editing, setEditing] = useState<OutlineItemId | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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

  /**
   * A new row, put where the writer is looking.
   *
   * A **Scene** always goes at the top level — it is the primary story unit,
   * and one nested inside another scene is not a thing the outline means.
   * Anything else goes *under* the selected row, which is what "add a note"
   * means when a beat is selected, and at the top when nothing is.
   */
  const add = (kind: string) => {
    write((current, id) => {
      const live = findOutline(current, id);
      const here = live && selected ? findOutlineItem(live, selected) : null;
      const parentId = kind === 'scene' ? null : here?.id ?? null;
      const afterId = kind === 'scene' && here ? topmostOf(live as Outline, here).id : null;
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
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      if (editing) return;
      event.preventDefault();
      const to = rows[at + (event.key === 'ArrowUp' ? -1 : 1)];
      if (to) setSelected(to.item.id);
      return;
    }
    if (event.key === 'Enter' && !editing) {
      event.preventDefault();
      const here = findOutlineItem(outline, selected);
      add(here?.kind === 'scene' ? 'beat' : here?.kind ?? 'note');
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
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div className="outline-list" ref={listRef} role="tree" tabIndex={0} onKeyDown={onKey}>
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
            />
          ))}
        </div>

        {/* The row's own, beside the outline: its type, its status, and the
            words that are too long to sit on a line (§7, §8). */}
        <aside className="outline-detail">
          {chosen ? (
            <>
              <h3>{nameOf(chosen.kind)}</h3>
              <label className="field">
                <span>Title</span>
                <input
                  aria-label="The row's title"
                  value={chosen.title}
                  onChange={(event) => write((current, id) => updateItem(current, id, chosen.id, { title: event.target.value }))}
                />
              </label>
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

              <p className="muted small">
                {/* §1: a row is a plan until it is promoted, and promotion is
                    stage 5. The badge is already here for when it arrives. */}
                {chosen.boundUnitId || chosen.boundBeatId
                  ? 'In the script.'
                  : 'A plan. It lives only in the outline.'}
              </p>
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
  selected,
  editing,
  onSelect,
  onEdit,
  onTitle,
  onFold,
  onNudge,
  onIndent,
  onRemove,
}: {
  row: OutlineRow;
  selected: boolean;
  editing: boolean;
  onSelect(): void;
  onEdit(on: boolean): void;
  onTitle(title: string): void;
  onFold(): void;
  onNudge(direction: -1 | 1): void;
  onIndent(deeper: boolean): void;
  onRemove(): void;
}) {
  const { item, depth, childCount } = row;
  const input = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  return (
    <div
      className={['outline-row', `kind-${item.kind}`, selected ? 'selected' : ''].filter(Boolean).join(' ')}
      style={{ paddingLeft: `${8 + depth * STEP}px` }}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={selected}
      aria-expanded={childCount === 0 ? undefined : !item.collapsed}
      onPointerDown={onSelect}
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

      <input
        ref={input}
        className="outline-title"
        aria-label={`${nameOf(item.kind)}: what it is`}
        placeholder={item.kind === 'scene' ? 'name the scene' : 'say what it is'}
        value={item.title}
        onFocus={() => onEdit(true)}
        onBlur={() => onEdit(false)}
        onChange={(event) => onTitle(event.target.value)}
      />

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
