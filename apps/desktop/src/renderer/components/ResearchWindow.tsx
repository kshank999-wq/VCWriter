import { useMemo, useState } from 'react';
import {
  addResearchCategory,
  addResearchItem,
  laneKindSchema,
  lanesInOrder,
  markResearchUsed,
  moveResearchItem,
  ref,
  removeResearchCategory,
  reparentResearchCategory,
  researchItemsIn,
  researchTree,
  restoreResearchItem,
  setResearchArchived,
  updateLane,
  updateResearchCategory,
  updateResearchItem,
  type BeatId,
  type ProjectFile,
  type ResearchCategoryId,
  type ResearchFolder,
  type ResearchItem,
  type ResearchItemId,
  type ResearchView,
} from '@vcwriter/domain';
import { InlineText } from './InlineText';
import { RelatedPanel } from './RelatedPanel';
import { SetupsPanel } from './SetupsPanel';
import { useModal } from '../use-modal';

interface ResearchWindowProps {
  file: ProjectFile;
  open: boolean;
  /** The beat being written, so material can be marked used where it landed. */
  currentBeatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/** What the side menu can be pointed at. */
type Selection =
  | { kind: 'view'; view: ResearchView }
  | { kind: 'folder'; id: ResearchCategoryId }
  | { kind: 'plots' }
  | { kind: 'setups' };

const VIEWS: ReadonlyArray<{ view: ResearchView; label: string }> = [
  { view: 'all', label: 'All research' },
  { view: 'unused', label: 'Not yet used' },
  { view: 'used', label: 'Used in the script' },
  { view: 'archived', label: 'Put away' },
];

/**
 * The research window (addendum 02 §7).
 *
 * Research is where the material is kept before, during and after it is
 * used — a working inventory, not a junk drawer — so it gets the whole
 * screen rather than a quarter of it, and its own shape: **folders down the
 * left**, what is in the selected folder in the middle, and the selected
 * thing itself on the right.
 *
 * The folders are a tree: a character folder holds a folder of their
 * journey, which holds the notes of it. Above them are the views that are
 * not places — everything, what has not been used yet, what has, and what
 * was put away — which is the part Causality's fixed folders cannot do.
 * Dragging a note onto a folder files it there; dragging a folder onto
 * another files that.
 *
 * Everything that is not the script lives here, so the plot lanes and the
 * setups and payoffs are the last two entries in the same menu.
 */
export function ResearchWindow({ file, open, currentBeatId, onClose, onUpdate }: ResearchWindowProps) {
  const dialog = useModal(open);
  return (
    <dialog ref={dialog} className="research-window" aria-label="Research" onClose={onClose}>
      {open ? <ResearchBody file={file} currentBeatId={currentBeatId} onClose={onClose} onUpdate={onUpdate} /> : null}
    </dialog>
  );
}

function ResearchBody({
  file,
  currentBeatId,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  currentBeatId: BeatId | null;
  onClose(): void;
  onUpdate: ResearchWindowProps['onUpdate'];
}) {
  const [selection, setSelection] = useState<Selection>({ kind: 'view', view: 'all' });
  const [selectedItemId, setSelectedItemId] = useState<ResearchItemId | null>(null);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [dragging, setDragging] = useState<{ kind: 'item' | 'folder'; id: string } | null>(null);

  const tree = useMemo(() => researchTree(file), [file]);
  const folders = useMemo(() => flatten(tree), [tree]);

  const items = useMemo(() => {
    if (selection.kind === 'folder') return researchItemsIn(file, { categoryId: selection.id }, { query });
    if (selection.kind === 'view') return researchItemsIn(file, { view: selection.view }, { query });
    return [];
  }, [file, selection, query]);

  const selectedItem = selectedItemId ? file.researchItems.find((item) => item.id === selectedItemId) ?? null : null;
  const folderOf = (item: ResearchItem) => file.researchCategories.find((category) => category.id === item.categoryId);

  /** Where a new note goes: the folder in hand, or the first one there is. */
  const homeFolder = (): ResearchCategoryId | null =>
    selection.kind === 'folder' ? selection.id : (folders[0]?.category.id ?? null);

  const addNote = () => {
    const categoryId = homeFolder();
    if (!categoryId) return;
    onUpdate((current) => {
      const next = addResearchItem(current, { categoryId, title: 'New note' });
      const made = next.researchItems[next.researchItems.length - 1];
      if (made) setSelectedItemId(made.id);
      return next;
    });
    if (selection.kind === 'view') setSelection({ kind: 'folder', id: categoryId });
  };

  const addFolder = () => {
    const parentId = selection.kind === 'folder' ? selection.id : null;
    onUpdate((current) => addResearchCategory(current, { name: 'New folder', parentId }).file);
  };

  /** A note or a folder dropped on a folder is filed there. */
  const dropOn = (categoryId: ResearchCategoryId) => {
    if (!dragging) return;
    if (dragging.kind === 'item') {
      onUpdate((current) =>
        moveResearchItem(current, { itemId: dragging.id as ResearchItemId, toCategoryId: categoryId, index: 0 }),
      );
    } else if (dragging.id !== categoryId) {
      onUpdate((current) => reparentResearchCategory(current, dragging.id as ResearchCategoryId, categoryId));
    }
    setDragging(null);
  };

  const title =
    selection.kind === 'view'
      ? (VIEWS.find((entry) => entry.view === selection.view)?.label ?? 'Research')
      : selection.kind === 'plots'
        ? 'Plots'
        : selection.kind === 'setups'
          ? 'Setups & payoffs'
          : (folders.find((folder) => folder.category.id === selection.id)?.category.name ?? 'Research');

  return (
    <>
      <header className="research-head">
        <span className="research-name">Research</span>
        <input
          className="research-search"
          type="search"
          aria-label="Search research"
          placeholder="Search titles, notes and tags"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="ghost" onClick={addNote}>
          + Note
        </button>
        <button type="button" className="ghost" onClick={addFolder}>
          + Folder
        </button>
        <button type="button" className="ghost" aria-label="Close research" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="research-body">
        {/* The side menu: what is not a place, then the folders. */}
        <nav className="research-side" aria-label="Research folders">
          <h4>Everything</h4>
          <ul className="research-views">
            {VIEWS.map((entry) => (
              <li key={entry.view}>
                <button
                  type="button"
                  className={selection.kind === 'view' && selection.view === entry.view ? 'folder-row selected' : 'folder-row'}
                  aria-current={selection.kind === 'view' && selection.view === entry.view ? 'true' : undefined}
                  onClick={() => setSelection({ kind: 'view', view: entry.view })}
                >
                  <span className="folder-name">{entry.label}</span>
                  <span className="count muted">{researchItemsIn(file, { view: entry.view }).length}</span>
                </button>
              </li>
            ))}
          </ul>

          <h4>Folders</h4>
          <ul className="research-tree">
            {tree.map((folder) => (
              <FolderNode
                key={folder.category.id}
                folder={folder}
                selection={selection}
                collapsed={collapsed}
                onToggle={(id) =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onSelect={(id) => setSelection({ kind: 'folder', id })}
                onUpdate={onUpdate}
                dragging={dragging}
                onDragStart={(id) => setDragging({ kind: 'folder', id })}
                onDragEnd={() => setDragging(null)}
                onDrop={dropOn}
              />
            ))}
          </ul>

          <h4>Also</h4>
          <ul className="research-views">
            <li>
              <button
                type="button"
                className={selection.kind === 'plots' ? 'folder-row selected' : 'folder-row'}
                onClick={() => setSelection({ kind: 'plots' })}
              >
                <span className="folder-name">Plots</span>
                <span className="count muted">{file.lanes.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={selection.kind === 'setups' ? 'folder-row selected' : 'folder-row'}
                onClick={() => setSelection({ kind: 'setups' })}
              >
                <span className="folder-name">Setups &amp; payoffs</span>
                <span className="count muted">{file.setupsPayoffs.filter((record) => !record.archived).length}</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* What is in it. */}
        <section className="research-contents" aria-label={title}>
          <header className="research-contents-head">
            <h3>{title}</h3>
            {selection.kind === 'plots' || selection.kind === 'setups' ? null : (
              <span className="muted">
                {items.length} {items.length === 1 ? 'note' : 'notes'}
                {query.length > 0 ? ' found' : ''}
              </span>
            )}
          </header>

          {selection.kind === 'plots' ? (
            <Plots file={file} onUpdate={onUpdate} />
          ) : selection.kind === 'setups' ? (
            <div className="research-embedded">
              <SetupsPanel file={file} currentBeatId={currentBeatId} onUpdate={onUpdate} />
            </div>
          ) : items.length === 0 ? (
            <p className="muted empty-state">
              {query.length > 0 ? 'Nothing here matches that.' : 'Nothing filed here yet. + Note puts something in it.'}
            </p>
          ) : (
            <ul className="research-cards" aria-label="Notes">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.id === selectedItemId ? 'research-card selected' : 'research-card'}
                    style={{ borderLeftColor: folderOf(item)?.color ?? undefined }}
                    aria-current={item.id === selectedItemId ? 'true' : undefined}
                    draggable
                    onDragStart={() => setDragging({ kind: 'item', id: item.id })}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => setSelectedItemId(item.id)}
                  >
                    <span className="research-card-head">
                      <span className="research-card-title">{item.title}</span>
                      {item.usage === 'used' ? (
                        <span className="used-mark" title="Used in the script">
                          ✓
                        </span>
                      ) : null}
                    </span>
                    {item.body.trim().length > 0 ? <span className="research-card-body">{item.body}</span> : null}
                    <span className="research-card-foot muted">
                      {folderOf(item)?.name ?? ''}
                      {item.tags.length > 0 ? ` · ${item.tags.join(', ')}` : ''}
                      {item.archived ? ' · put away' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* The thing itself. */}
        <aside className="research-detail" aria-label="Detail">
          {selectedItem ? (
            <Detail
              file={file}
              item={selectedItem}
              currentBeatId={currentBeatId}
              onUpdate={onUpdate}
              onGoToFolder={(id) => setSelection({ kind: 'folder', id })}
            />
          ) : (
            <p className="muted empty-state">Pick something to see it here.</p>
          )}
        </aside>
      </div>
    </>
  );
}

const flatten = (folders: ResearchFolder[]): ResearchFolder[] =>
  folders.flatMap((folder) => [folder, ...flatten(folder.children)]);

function FolderNode({
  folder,
  selection,
  collapsed,
  onToggle,
  onSelect,
  onUpdate,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
}: {
  folder: ResearchFolder;
  selection: Selection;
  collapsed: ReadonlySet<string>;
  onToggle(id: string): void;
  onSelect(id: ResearchCategoryId): void;
  onUpdate: ResearchWindowProps['onUpdate'];
  dragging: { kind: 'item' | 'folder'; id: string } | null;
  onDragStart(id: string): void;
  onDragEnd(): void;
  onDrop(id: ResearchCategoryId): void;
}) {
  const { category, children, total } = folder;
  const seeded = category.systemKey !== null;
  const shut = collapsed.has(category.id);
  const chosen = selection.kind === 'folder' && selection.id === category.id;

  return (
    <li>
      <div
        className={chosen ? 'folder-row selected' : 'folder-row'}
        style={{ paddingLeft: `${8 + folder.depth * 14}px` }}
        // A seeded folder stays where it is; anything else can be filed.
        draggable={!seeded}
        onDragStart={() => onDragStart(category.id)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (dragging) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDrop(category.id);
        }}
      >
        <button
          type="button"
          className="ghost twisty"
          aria-expanded={!shut}
          aria-label={shut ? `Expand ${category.name}` : `Collapse ${category.name}`}
          style={{ visibility: children.length > 0 ? 'visible' : 'hidden' }}
          onClick={() => onToggle(category.id)}
        >
          {shut ? '▸' : '▾'}
        </button>
        <span className="folder-dot" style={{ background: category.color ?? 'transparent' }} aria-hidden="true" />
        <button type="button" className="folder-open" onClick={() => onSelect(category.id)}>
          <InlineText
            value={category.name}
            ariaLabel="Folder name"
            className="folder-name"
            onCommit={(name) => onUpdate((current) => updateResearchCategory(current, category.id, { name: name || 'Folder' }))}
          />
        </button>
        <span className="count muted">{total}</span>
        <input
          type="color"
          className="folder-colour"
          aria-label={`Colour of ${category.name}`}
          value={category.color ?? '#c9a45c'}
          onChange={(event) => onUpdate((current) => updateResearchCategory(current, category.id, { color: event.target.value }))}
        />
        <button
          type="button"
          className="ghost"
          title="New folder in this one"
          aria-label={`New folder in ${category.name}`}
          onClick={() => onUpdate((current) => addResearchCategory(current, { name: 'New folder', parentId: category.id }).file)}
        >
          +
        </button>
        {seeded ? null : (
          <button
            type="button"
            className="ghost danger"
            title="Remove this folder; what is in it moves up"
            aria-label={`Remove ${category.name}`}
            onClick={() => onUpdate((current) => removeResearchCategory(current, category.id))}
          >
            ×
          </button>
        )}
      </div>
      {shut || children.length === 0 ? null : (
        <ul>
          {children.map((child) => (
            <FolderNode
              key={child.category.id}
              folder={child}
              selection={selection}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onUpdate={onUpdate}
              dragging={dragging}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Detail({
  file,
  item,
  currentBeatId,
  onUpdate,
  onGoToFolder,
}: {
  file: ProjectFile;
  item: ResearchItem;
  currentBeatId: BeatId | null;
  onUpdate: ResearchWindowProps['onUpdate'];
  onGoToFolder(id: ResearchCategoryId): void;
}) {
  const folders = useMemo(() => flatten(researchTree(file)), [file]);
  const where = file.beats.filter((beat) => item.usedInBeatIds.includes(beat.id));

  return (
    <>
      <label className="field">
        Title
        <input
          value={item.title}
          onChange={(event) => onUpdate((current) => updateResearchItem(current, item.id, { title: event.target.value }))}
        />
      </label>
      <label className="field">
        Note
        <textarea
          rows={10}
          value={item.body}
          onChange={(event) => onUpdate((current) => updateResearchItem(current, item.id, { body: event.target.value }))}
        />
      </label>
      <label className="field">
        Tags
        <input
          value={item.tags.join(', ')}
          placeholder="comma, separated"
          onChange={(event) =>
            onUpdate((current) =>
              updateResearchItem(current, item.id, {
                tags: event.target.value.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0),
              }),
            )
          }
        />
      </label>
      <label className="field">
        Folder
        <select
          aria-label="Folder"
          value={item.categoryId}
          onChange={(event) => {
            const toCategoryId = event.target.value as ResearchCategoryId;
            onUpdate((current) => moveResearchItem(current, { itemId: item.id, toCategoryId, index: 0 }));
            onGoToFolder(toCategoryId);
          }}
        >
          {folders.map((folder) => (
            <option key={folder.category.id} value={folder.category.id}>
              {`${'— '.repeat(folder.depth)}${folder.category.name}`}
            </option>
          ))}
        </select>
      </label>

      <div className="research-actions">
        {item.usage === 'used' ? (
          <button type="button" className="ghost" onClick={() => onUpdate((current) => restoreResearchItem(current, item.id))}>
            Back to not used
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onUpdate((current) =>
                markResearchUsed(current, {
                  itemId: item.id,
                  confirmed: true,
                  ...(currentBeatId ? { beatId: currentBeatId } : {}),
                }),
              )
            }
          >
            {currentBeatId ? 'Used in the beat I am writing' : 'Mark used'}
          </button>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => onUpdate((current) => setResearchArchived(current, item.id, !item.archived))}
        >
          {item.archived ? 'Take back out' : 'Put away'}
        </button>
      </div>

      {where.length > 0 ? (
        <dl className="inspector-facts">
          <dt>Used in</dt>
          <dd>{where.map((beat) => beat.title || 'Untitled beat').join(', ')}</dd>
        </dl>
      ) : null}

      <RelatedPanel file={file} target={ref('research_item', item.id)} onUpdate={onUpdate} />
    </>
  );
}

/** The plot lanes as records, which is what the Research tab used to show. */
function Plots({ file, onUpdate }: { file: ProjectFile; onUpdate: ResearchWindowProps['onUpdate'] }) {
  return (
    <ul className="research-plots">
      {lanesInOrder(file).map((lane) => (
        <li key={lane.id}>
          <div className="research-plot-head">
            <input
              type="color"
              className="swatch"
              aria-label={`Colour of ${lane.name}`}
              value={lane.color}
              onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { color: event.target.value }))}
            />
            <InlineText
              value={lane.name}
              ariaLabel="Plot name"
              className="research-plot-name"
              onCommit={(name) => onUpdate((current) => updateLane(current, lane.id, { name: name || 'Lane' }))}
            />
            <select
              aria-label={`Kind of ${lane.name}`}
              value={lane.kind}
              onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { kind: event.target.value as typeof lane.kind }))}
            >
              {laneKindSchema.options.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <span className="count muted">{file.units.filter((unit) => unit.laneId === lane.id).length}</span>
          </div>
          <textarea
            rows={2}
            aria-label={`What ${lane.name} is about`}
            placeholder="What this thread of the story is about"
            value={lane.description}
            onChange={(event) => onUpdate((current) => updateLane(current, lane.id, { description: event.target.value }))}
          />
        </li>
      ))}
    </ul>
  );
}
