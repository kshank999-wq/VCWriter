import React, { useMemo, useState } from 'react';
import { useMark } from '../room';
import { ContributorMark } from './ContributorMark';
import {
  blocksOf,
  boardsOf,
  childrenOf,
  outlineRows,
  outlinesOf,
  researchItemsIn,
  researchTree,
  rowTitle,
  type Board,
  type Outline,
  type ProjectFile,
  type ResearchCategoryId,
  type ResearchItemId,
  type SculptorNode,
  type SculptorNodeId,
  type OutlineItemId,
} from '@vcwriter/domain';

/**
 * The Research shelf, down the side of the Outliner (addendum 06 §3).
 *
 * The source specification asks for Research and the Outliner **side by
 * side**, with material dragged from one to the other. Two full-window
 * overlays cannot be side by side, and a drag cannot cross two windows that
 * are not both on screen — so the shelf lives *inside*, which is not a
 * compromise but the honest form of the requirement: the thing being asked for
 * is *drag research into the plan*, and this is where it can happen.
 *
 * It is the same tree as the Research window, narrow: folders that open, the
 * items in them, and a search. Everything here is a **source**, never a
 * target — nothing is dropped onto the shelf, and nothing is edited on it.
 *
 * It holds **the other plan** as well (§2, §12 stage 7). The Outliner's shelf
 * offers the board; the Sculptor's offers the outline. That is the same
 * argument as the one above, applied again: material is meant to pass between
 * the two by hand, and two full-window workspaces cannot be dragged between,
 * so the one you are not in is here to drag *from*. Carried across, never
 * converted — a board is a picture of possibilities, most of which are not in
 * the story.
 */

/** What is being carried off the shelf: research, or a card from the other plan. */
export type ShelfCarry =
  | { kind: 'research'; id: ResearchItemId }
  | { kind: 'node'; id: SculptorNodeId }
  | { kind: 'row'; id: OutlineItemId };

interface ResearchShelfProps {
  file: ProjectFile;
  /** Which plan is looking at the shelf, so it can offer the other one. */
  from: 'outline' | 'board';
  /** An item to open the shelf at and mark, when a linked row asks for it. */
  reveal: ResearchItemId | null;
  /** Called with what is being carried, and with null when it is let go. */
  onCarry(carrying: ShelfCarry | null): void;
}

export function ResearchShelf({ file, from, reveal, onCarry }: ResearchShelfProps) {
  const [query, setQuery] = useState('');
  const [shut, setShut] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  /** Research, or the other plan. One shelf, two things to drag off it. */
  const [showing, setShowing] = useState<'research' | 'other'>('research');
  /** Whose an idea is, in a room; nothing at all outside one (§11). */
  const mark = useMark();

  const folders = useMemo(() => researchTree(file), [file]);

  // The plan the writer is *not* in, to drag from (§2). The Outliner offers
  // the board; the Sculptor offers the outline.
  const other = useMemo((): OtherPlan | null => {
    if (from === 'outline') {
      const board = boardsOf(file)[0];
      return board ? boardAsCards(board) : null;
    }
    const outline = outlinesOf(file)[0];
    return outline ? outlineAsCards(file, outline) : null;
  }, [file, from]);

  // A search looks through everything; otherwise the tree is read folder by
  // folder, which is how the writer filed it.
  const found = useMemo(
    () => (query.trim().length === 0 ? null : researchItemsIn(file, { view: 'all' }, { query })),
    [file, query],
  );

  // What the panel was asked to reveal: its folder is opened and the row lit.
  const revealed = reveal === null ? null : file.researchItems.find((item) => item.id === reveal) ?? null;
  const isShut = (id: ResearchCategoryId): boolean =>
    shut.has(id as string) && revealed?.categoryId !== id;

  const toggle = (id: ResearchCategoryId) =>
    setShut((current) => {
      const next = new Set(current);
      if (next.has(id as string)) next.delete(id as string);
      else next.add(id as string);
      return next;
    });

  if (!open) {
    return (
      <button
        type="button"
        className="ghost shelf-shut"
        title="The research shelf"
        aria-label="Show the research shelf"
        onClick={() => setOpen(true)}
      >
        Research
      </button>
    );
  }

  const draggable = (item: {
    id: ResearchItemId;
    title: string;
    body: string;
    usage: string;
    author?: { authorId: string } | null;
  }) => {
    // Whose idea it is, in a room (addendum 07 §11). The shelf lives inside
    // the Sculptor and the Outliner, so colouring it here reaches both without
    // either of them being taught anything — which is the consequence §11
    // said would fall out for free.
    const who = mark(item.author ?? null);
    return (
    <div
      key={item.id as string}
      className={['shelf-item', revealed?.id === item.id ? 'revealed' : '', item.usage === 'used' ? 'used' : '']
        .filter(Boolean)
        .join(' ')}
      style={who ? ({ '--room-colour': who.colour } as React.CSSProperties) : undefined}
      title={who ? `${item.body.slice(0, 300) || item.title} — ${who.name}` : item.body.slice(0, 300) || item.title}
      draggable
      onDragStart={(event) => {
        // Something has to be set or the drag never begins; what the handlers
        // read is held by the workspace, because `getData` is empty on dragover.
        event.dataTransfer.setData('text/plain', item.title);
        // Copied rather than moved: the item stays on the shelf, and the row
        // that lands in the outline only references it (§5).
        event.dataTransfer.effectAllowed = 'copy';
        onCarry({ kind: 'research', id: item.id });
      }}
      onDragEnd={() => onCarry(null)}
    >
      {item.title}
      {who ? <ContributorMark who={who} /> : null}
    </div>
    );
  };

  return (
    <aside className="research-shelf" aria-label="Research">
      <header className="shelf-bar">
        <h3>Research</h3>
        <button
          type="button"
          className="ghost small"
          aria-label="Hide the research shelf"
          title="Out of the way"
          onClick={() => setOpen(false)}
        >
          ⇤
        </button>
      </header>

      {/* Two things to drag off one shelf: the material, and the other plan
          (§2). Only offered when the other plan has something on it. */}
      {other ? (
        <div className="shelf-tabs" role="tablist">
          {(['research', 'other'] as const).map((which) => (
            <button
              key={which}
              type="button"
              role="tab"
              aria-selected={showing === which}
              className={showing === which ? 'ghost small on' : 'ghost small'}
              onClick={() => setShowing(which)}
            >
              {which === 'research' ? 'Research' : other.name}
            </button>
          ))}
        </div>
      ) : null}

      {showing === 'research' || !other ? (
        <input
          className="shelf-search"
          type="search"
          placeholder="Search the shelf"
          aria-label="Search the research shelf"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : null}

      {showing === 'other' && other ? (
        <div className="shelf-tree">
          <p className="muted small shelf-note">
            Drag a card across to start with. It is copied, not moved, and what is under it comes too.
          </p>
          {other.cards.map((card) => (
            <div
              key={card.id}
              className="shelf-item shelf-card"
              style={{ paddingLeft: `${14 + card.depth * 10}px` }}
              title={card.title || 'Untitled'}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData('text/plain', card.title);
                event.dataTransfer.effectAllowed = 'copy';
                onCarry(card.carry);
              }}
              onDragEnd={() => onCarry(null)}
            >
              {card.title || 'Untitled'}
            </div>
          ))}
          {other.cards.length === 0 ? <p className="muted small">Nothing on it yet.</p> : null}
        </div>
      ) : (
      <div className="shelf-tree">
        {found ? (
          found.length === 0 ? (
            <p className="muted small">Nothing filed under that.</p>
          ) : (
            found.map((item) => draggable(item))
          )
        ) : (
          folders.map((folder) => {
            const items = researchItemsIn(
              file,
              { categoryId: folder.category.id },
              { includeDescendants: false },
            );
            return (
              <div
                key={folder.category.id as string}
                className="shelf-folder"
                style={{ paddingLeft: `${folder.depth * 10}px` }}
              >
                <button
                  type="button"
                  className="ghost small shelf-folder-name"
                  aria-expanded={!isShut(folder.category.id)}
                  onClick={() => toggle(folder.category.id)}
                >
                  <span className="shelf-fold">{isShut(folder.category.id) ? '▸' : '▾'}</span>
                  {folder.category.name}
                  <span className="muted"> {folder.total}</span>
                </button>
                {isShut(folder.category.id) ? null : items.map((item) => draggable(item))}
              </div>
            );
          })
        )}

        {folders.length === 0 ? (
          <p className="muted small">
            Nothing on the shelf yet. Research is where the material is gathered; this is where it is arranged.
          </p>
        ) : null}
      </div>
      )}
    </aside>
  );
}

/**
 * The other plan, flattened into a list that can be dragged from.
 *
 * A board read down its structure column and out to the right, an outline read
 * top to bottom: in both cases the order somebody reading it would go in, with
 * the depth kept so the shape is visible. It is a **source only**, so nothing
 * here folds or is edited — that is what the other workspace is for.
 */
interface OtherPlan {
  name: string;
  cards: { id: string; title: string; depth: number; carry: ShelfCarry }[];
}

const boardAsCards = (board: Board): OtherPlan => {
  const cards: OtherPlan['cards'] = [];
  const walk = (node: SculptorNode, depth: number): void => {
    cards.push({ id: node.id as string, title: node.title, depth, carry: { kind: 'node', id: node.id } });
    for (const child of childrenOf(board, node.id)) walk(child, depth + 1);
  };
  for (const block of blocksOf(board)) walk(block, 0);
  return { name: board.name || 'Board', cards };
};

const outlineAsCards = (file: ProjectFile, outline: Outline): OtherPlan => ({
  name: outline.name || 'Outline',
  cards: outlineRows(outline).map((row) => ({
    id: row.item.id as string,
    title: rowTitle(file, row.item),
    depth: row.depth,
    carry: { kind: 'row', id: row.item.id },
  })),
});
