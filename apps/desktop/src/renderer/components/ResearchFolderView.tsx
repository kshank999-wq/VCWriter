import { useMemo, useState } from 'react';
import {
  noteOnTrack,
  researchItemsIn,
  researchTree,
  updateResearchItem,
  type BeatId,
  type ProjectFile,
  type ResearchCategoryId,
  type ResearchFolder,
  type ResearchItemId,
} from '@vcwriter/domain';
import { NoteRewrite } from './NoteRewrite';

/**
 * One research folder, open on its own (addendum 28 §8).
 *
 * From Ken: *that research area should be folders with categories. So you can
 * open that and it'll bring a pop-up box that you can take to another
 * monitor… and you can see your research.*
 *
 * The same component in two frames: a window of its own in the desktop app
 * (the `folder:<id>` pane, which a writer can drag to the other monitor), and a
 * movable box in the room where there are no windows to open. The notes down
 * the left with a red ✕ on what is on the track, the chosen one on the right
 * to read and edit, and a double-click opens the rewrite screen.
 */
export function ResearchFolderView({
  file,
  categoryId,
  currentBeatId = null,
  onUpdate,
  onGoToBeat,
}: {
  file: ProjectFile;
  categoryId: ResearchCategoryId;
  currentBeatId?: BeatId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToBeat?(beatId: BeatId): void;
}) {
  const [folderId, setFolderId] = useState<ResearchCategoryId>(categoryId);
  const [chosen, setChosen] = useState<ResearchItemId | null>(null);
  const [rewriting, setRewriting] = useState<ResearchItemId | null>(null);

  const folder = useMemo(() => findFolder(researchTree(file), folderId), [file, folderId]);
  const notes = useMemo(() => researchItemsIn(file, { categoryId: folderId }), [file, folderId]);
  const item = chosen ? notes.find((one) => one.id === chosen) ?? null : null;

  if (!folder) return <p className="muted empty-state">This folder is no longer in the project.</p>;

  const parent = folder.category.parentId;
  return (
    <div className="research-folder-view">
      <header className="research-folder-view-head">
        {parent ? (
          <button type="button" className="ghost small" onClick={() => setFolderId(parent)}>
            ‹ Up
          </button>
        ) : null}
        <span className="research-folder-dot" style={{ background: folder.category.color ?? undefined }} />
        <h3>{folder.category.name}</h3>
        <span className="muted small">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'} · {notes.filter((one) => noteOnTrack(file, one)).length} used
        </span>
      </header>
      {folder.children.length > 0 ? (
        <div className="research-folder-view-subs">
          {folder.children.map((child) => (
            <button key={child.category.id} type="button" className="ghost small" onClick={() => setFolderId(child.category.id)}>
              ▸ {child.category.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="research-folder-view-body">
        {notes.length === 0 ? (
          <p className="muted empty-state">Nothing filed here yet.</p>
        ) : (
          <ul className="research-folder-view-list" aria-label="Notes in this folder">
            {notes.map((note) => {
              const used = noteOnTrack(file, note);
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    className={`research-folder-view-note${note.id === chosen ? ' selected' : ''}${used ? ' used' : ''}`}
                    onClick={() => setChosen(note.id)}
                    onDoubleClick={() => {
                      setChosen(note.id);
                      setRewriting(note.id);
                    }}
                  >
                    <span className="research-card-title">{note.title}</span>
                    {note.body.trim() ? <span className="research-card-body">{note.body}</span> : null}
                    {used ? (
                      <span className="used-x research-card-used" aria-label="Used in the book" title="Used in the book">
                        ✕
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <section className="research-folder-view-note-open" aria-label="The note">
          {item ? (
            <>
              <label className="field">
                Title
                <input
                  value={item.title}
                  onChange={(event) => onUpdate((current) => updateResearchItem(current, item.id, { title: event.target.value }))}
                />
              </label>
              <label className="field research-folder-view-words">
                Note
                <textarea
                  value={item.body}
                  onChange={(event) => onUpdate((current) => updateResearchItem(current, item.id, { body: event.target.value }))}
                />
              </label>
              <div className="research-actions">
                <button type="button" onClick={() => setRewriting(item.id)}>
                  Rewrite and place…
                </button>
              </div>
            </>
          ) : (
            <p className="muted empty-state">Pick a note to read it here. Double-click one to rewrite it.</p>
          )}
        </section>
      </div>
      <NoteRewrite
        file={file}
        item={rewriting ? (file.researchItems.find((one) => one.id === rewriting) ?? null) : null}
        currentBeatId={currentBeatId}
        onClose={() => setRewriting(null)}
        onUpdate={onUpdate}
        {...(onGoToBeat ? { onGoToBeat } : {})}
      />
    </div>
  );
}

const findFolder = (folders: ResearchFolder[], id: ResearchCategoryId): ResearchFolder | null => {
  for (const folder of folders) {
    if (folder.category.id === id) return folder;
    const inside = findFolder(folder.children, id);
    if (inside) return inside;
  }
  return null;
};
