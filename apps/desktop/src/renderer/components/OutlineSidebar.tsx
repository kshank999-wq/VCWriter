import { useMemo, useState, type DragEvent } from 'react';
import { folderFolded, noteUsed, outlineFolders, type NotePlace, type OutlineFolder, type ProjectFile, type ResearchItem, type ResearchItemId } from '@vcwriter/domain';

/**
 * The outline beside the notes (addendum 28 §7).
 *
 * From Ken: *bundle ideas in folders by dragging from the notes screen into
 * the right side bar which will have the sections or categories from the
 * outline — chapter and subsections… you can see your chapters, sections,
 * subsections, ideas in the right side bar and you can quickly drag into the
 * folders.*
 *
 * Every folder is a part of the outline, read off it (`outlineFolders`), so
 * there is nothing to make here: a chapter added in the Outliner is a folder
 * here. A note dropped on one is filed there — one field on the note — and its
 * shelf folder is untouched. Under each folder are the notes filed in it; a
 * red ✕ in the corner says one is on the track. Click a note to see it,
 * double-click to rewrite it.
 */
export interface OutlineSidebarProps {
  file: ProjectFile;
  /** What is being dragged in the room, so a folder can take it. */
  dragging: { kind: 'item' | 'folder' | 'capture'; id: string } | null;
  selectedId: ResearchItemId | null;
  onFile(dragging: { kind: 'item' | 'capture'; id: string }, place: NotePlace): void;
  onDragNote(id: ResearchItemId | null): void;
  onSelect(item: ResearchItem): void;
  onRewrite(item: ResearchItem): void;
  onHide(): void;
  /** The folder whose notes are open in the pane beside, if any. */
  openKey?: string | null;
  /**
   * Open a folder's notes in the pane beside the outline (from Ken: *you open
   * that chapter, section, scene, and it has another right-hand list of those
   * notes that were dropped in*). The arrow still folds; the name opens.
   */
  onOpenFolder?(folder: OutlineFolder): void;
  /**
   * Fold or unfold folders that are rows of the outline, on the outline itself,
   * so the Outliner folds with them and the fold is kept with the project
   * (from Ken, 11 November: *same functionality as in the outline page*).
   * Absent, every fold is this column's own, for the session.
   */
  onFold?(folders: OutlineFolder[], collapsed: boolean): void;
}

const KIND_LABEL: Record<OutlineFolder['kind'], string> = {
  chapter: 'Chapter',
  section: 'Section',
  subsection: 'Subsection',
  idea: 'Idea',
  heading: 'Heading',
};

const KIND_MARK: Record<OutlineFolder['kind'], string> = {
  chapter: '▤',
  section: '▣',
  subsection: '◈',
  idea: '✦',
  heading: '▤',
};

export function OutlineSidebar({ file, dragging, selectedId, onFile, onDragNote, onSelect, onRewrite, onHide, openKey = null, onOpenFolder, onFold }: OutlineSidebarProps) {
  const folders = useMemo(() => outlineFolders(file), [file]);
  /** Folds of folders with no outline row to keep them on (or all, without `onFold`). */
  const [localClosed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const sharedFold = (folder: OutlineFolder): boolean | null => (onFold ? folderFolded(file, folder) : null);
  const closed = useMemo(
    () => new Set(folders.filter((folder) => sharedFold(folder) ?? localClosed.has(folder.key)).map((folder) => folder.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folders, localClosed, file, onFold],
  );
  const foldable = (folder: OutlineFolder, index: number) =>
    folder.notes.length > 0 || (folders[index + 1]?.depth ?? -1) > folder.depth;
  const fold = (targets: OutlineFolder[], collapsed: boolean) => {
    const shared = targets.filter((folder) => sharedFold(folder) !== null);
    if (shared.length > 0) onFold?.(shared, collapsed);
    const own = targets.filter((folder) => sharedFold(folder) === null).map((folder) => folder.key);
    setClosed((current) => {
      const next = new Set(current);
      for (const key of own) {
        if (collapsed) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };
  /** How many folders a folded one hides: everything deeper, up to the next at its level. */
  const hiddenUnder = (index: number): number => {
    let count = 0;
    for (let at = index + 1; at < folders.length && folders[at]!.depth > folders[index]!.depth; at += 1) count += 1;
    return count;
  };
  const [over, setOver] = useState<string | null>(null);
  const droppable = dragging !== null && dragging.kind !== 'folder';
  const fromBook = folders.some((folder) => !folder.fromOutline) && folders.some((folder) => folder.fromOutline);

  const drop = (folder: OutlineFolder) => (event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    if (!dragging || dragging.kind === 'folder') return;
    onFile({ kind: dragging.kind, id: dragging.id }, folder.place);
  };

  return (
    <aside className="research-outline" aria-label="Outline folders">
      <header className="research-outline-head">
        <h3>Outline</h3>
        {/* Fold the lot to the chapters, or open everything (from Ken: *I want
            to be able to collapse the sections and subsections and chapters*). */}
        {folders.length > 0 ? (
          <span className="research-outline-folding">
            <button
              type="button"
              className="ghost small"
              title="Fold every chapter, section and subsection"
              onClick={() => fold(folders.filter((one, index) => foldable(one, index)), true)}
            >
              Collapse all
            </button>
            <button type="button" className="ghost small" title="Open every chapter, section and subsection" onClick={() => fold(folders, false)}>
              Expand all
            </button>
          </span>
        ) : null}
        <button type="button" className="ghost small" aria-label="Hide the outline" title="Hide the outline" onClick={onHide}>
          ›
        </button>
      </header>
      {folders.length === 0 ? (
        <p className="muted small research-outline-empty">
          No chapters yet. Add chapters, sections, subsections and ideas in the Outliner and they show here as folders to drag notes into.
        </p>
      ) : (
        <>
          <p className="muted small research-outline-hint">Drag a note onto a folder. Double-click a note to rewrite it.</p>
          <ul className="research-outline-list">
            {folders.map((folder, index) => {
              // A folded chapter hides its sections and subsections too: the
              // folders after it that sit deeper, up to the next at its level.
              const hiddenBy = folders
                .slice(0, index)
                .reverse()
                .reduce<{ depth: number; hidden: boolean }>(
                  (walk, above) => {
                    if (walk.hidden || above.depth >= walk.depth) return walk;
                    return { depth: above.depth, hidden: closed.has(above.key) };
                  },
                  { depth: folder.depth, hidden: false },
                );
              if (hiddenBy.hidden) return null;
              const open = !closed.has(folder.key);
              const hasInside = folder.notes.length > 0 || (folders[index + 1]?.depth ?? -1) > folder.depth;
              const label = `${folder.number ? `${folder.number} ` : ''}${folder.title || KIND_LABEL[folder.kind]}`;
              return (
                <li key={folder.key} className={`research-outline-folder kind-${folder.kind}`}>
                  {fromBook && !folder.fromOutline && folders[index - 1]?.fromOutline ? (
                    <p className="research-outline-group muted small">In the book, not in the outline</p>
                  ) : null}
                  <div
                    className={`research-outline-row${over === folder.key ? ' over' : ''}${droppable ? ' droppable' : ''}`}
                    style={{ paddingLeft: 8 + folder.depth * 14 }}
                    onDragOver={(event) => {
                      if (!droppable) return;
                      event.preventDefault();
                      if (over !== folder.key) setOver(folder.key);
                    }}
                    onDragLeave={() => setOver((current) => (current === folder.key ? null : current))}
                    onDrop={drop(folder)}
                  >
                    <button
                      type="button"
                      className="research-outline-toggle research-outline-fold"
                      aria-expanded={open}
                      aria-label={`${open ? 'Fold' : 'Unfold'} ${label}`}
                      disabled={!hasInside}
                      onClick={() => fold([folder], open)}
                    >
                      <span className="research-outline-chevron" aria-hidden="true">
                        {hasInside ? (open ? '▾' : '▸') : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`research-outline-toggle research-outline-open${openKey === folder.key ? ' open' : ''}`}
                      aria-label={`Open ${label}`}
                      title={folder.notes.length > 0 ? `See the ${folder.notes.length === 1 ? 'note' : `${folder.notes.length} notes`} filed here` : 'Nothing filed here yet — drag a note onto it'}
                      onClick={() => onOpenFolder?.(folder)}
                    >
                      <span className="research-outline-mark" title={KIND_LABEL[folder.kind]}>
                        {KIND_MARK[folder.kind]}
                      </span>
                      <span className="research-outline-title">{label}</span>
                      {!open && hiddenUnder(index) > 0 ? (
                        <span className="research-outline-hidden" title={`${hiddenUnder(index)} folded away inside`}>
                          {hiddenUnder(index)}
                        </span>
                      ) : null}
                      {folder.notes.length > 0 ? (
                        <span className="count muted" title={`${folder.used} of ${folder.notes.length} on the track`}>
                          {folder.used > 0 ? `${folder.used}/` : ''}
                          {folder.notes.length}
                        </span>
                      ) : null}
                    </button>
                  </div>
                  {open && folder.notes.length > 0 ? (
                    <ul className="research-outline-notes" style={{ paddingLeft: 22 + folder.depth * 14 }}>
                      {folder.notes.map((note) => {
                        const used = noteUsed(file, note);
                        return (
                          <li key={note.id}>
                            <button
                              type="button"
                              className={`research-outline-note${used ? ' used' : ' waiting'}${selectedId === note.id ? ' selected' : ''}`}
                              draggable
                              onDragStart={(event) => {
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', note.title);
                                onDragNote(note.id);
                              }}
                              onDragEnd={() => onDragNote(null)}
                              onClick={() => onSelect(note)}
                              onDoubleClick={() => onRewrite(note)}
                              title={used ? 'Used in the book. Double-click to rewrite.' : 'Yellow: sorted here, not in the manuscript yet. Double-click to rewrite and place it.'}
                            >
                              <span className="research-outline-note-title">{note.title}</span>
                              {used ? (
                                <span className="used-x" aria-label="Used in the book">
                                  ✕
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </aside>
  );
}
