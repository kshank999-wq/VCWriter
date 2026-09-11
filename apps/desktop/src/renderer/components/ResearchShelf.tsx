import { useMemo, useState } from 'react';
import {
  researchItemsIn,
  researchTree,
  type ProjectFile,
  type ResearchCategoryId,
  type ResearchItemId,
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
 */

interface ResearchShelfProps {
  file: ProjectFile;
  /** An item to open the shelf at and mark, when a linked row asks for it. */
  reveal: ResearchItemId | null;
  /** Called with what is being carried, and with null when it is let go. */
  onCarry(itemId: ResearchItemId | null): void;
}

export function ResearchShelf({ file, reveal, onCarry }: ResearchShelfProps) {
  const [query, setQuery] = useState('');
  const [shut, setShut] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);

  const folders = useMemo(() => researchTree(file), [file]);

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

  const draggable = (item: { id: ResearchItemId; title: string; body: string; usage: string }) => (
    <div
      key={item.id as string}
      className={['shelf-item', revealed?.id === item.id ? 'revealed' : '', item.usage === 'used' ? 'used' : '']
        .filter(Boolean)
        .join(' ')}
      title={item.body.slice(0, 300) || item.title}
      draggable
      onDragStart={(event) => {
        // Something has to be set or the drag never begins; what the handlers
        // read is held by the Outliner, because `getData` is empty on dragover.
        event.dataTransfer.setData('text/plain', item.title);
        // Copied rather than moved: the item stays on the shelf, and the row
        // that lands in the outline only references it (§5).
        event.dataTransfer.effectAllowed = 'copy';
        onCarry(item.id);
      }}
      onDragEnd={() => onCarry(null)}
    >
      {item.title}
    </div>
  );

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

      <input
        className="shelf-search"
        type="search"
        placeholder="Search the shelf"
        aria-label="Search the research shelf"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

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
    </aside>
  );
}
