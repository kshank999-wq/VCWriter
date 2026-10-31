import { useMemo, useState, type DragEvent } from 'react';
import { noteUsed, outlineFolders, type NotePlace, type OutlineFolder, type ProjectFile, type ResearchItem, type ResearchItemId } from '@vcwriter/domain';

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

export function OutlineSidebar({ file, dragging, selectedId, onFile, onDragNote, onSelect, onRewrite, onHide }: OutlineSidebarProps) {
  const folders = useMemo(() => outlineFolders(file), [file]);
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
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
              const open = !closed.has(folder.key);
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
                      className="research-outline-toggle"
                      aria-expanded={open}
                      aria-label={`${open ? 'Fold' : 'Unfold'} ${label}`}
                      onClick={() =>
                        setClosed((current) => {
                          const next = new Set(current);
                          if (next.has(folder.key)) next.delete(folder.key);
                          else next.add(folder.key);
                          return next;
                        })
                      }
                    >
                      <span className="research-outline-mark" title={KIND_LABEL[folder.kind]}>
                        {KIND_MARK[folder.kind]}
                      </span>
                      <span className="research-outline-title">{label}</span>
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
