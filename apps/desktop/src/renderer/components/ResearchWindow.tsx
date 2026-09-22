import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  graveyardCount,
  addResearchCategory,
  addResearchItem,
  approveCapture,
  castByCategory,
  characterBoard,
  inboxGroups,
  rejectCapture,
  suggestRouting,
  trackKindSchema,
  tracksInOrder,
  markResearchUsed,
  moveResearchItem,
  ref,
  removeResearchCategory,
  reparentResearchCategory,
  researchItemsIn,
  researchTree,
  restoreResearchItem,
  setResearchArchived,
  updateTrack,
  updateResearchCategory,
  updateResearchItem,
  isInstructional,
  isProseFormat,
  nounsFor,
  type ApprovalDecision,
  type BeatId,
  type CaptureItem,
  type CharacterId,
  type ProjectFile,
  type ProjectFormat,
  type ResearchCategoryId,
  type ResearchFolder,
  type ResearchItem,
  type ResearchItemId,
  type ResearchView,
} from '@vcwriter/domain';
import { PopOutButton } from './PopOutButton';
import { InlineText } from './InlineText';
import { RelatedPanel } from './RelatedPanel';
import { SetupsPanel } from './SetupsPanel';
import { GraphicsPanel } from './GraphicsPanel';
import { GraveyardPanel } from './GraveyardPanel';
import { ImportNotesPanel } from './ImportNotesPanel';
import { LinksTimeline } from './LinksTimeline';
import { LocationsPanel } from './LocationsPanel';
import { ThemesPanel } from './ThemesPanel';
import { CastPanel } from './CastPanel';
import { CharacterCreator, type CreatorTab } from './CharacterCreator';
import { CharacterMap } from './CharacterMap';
import { MobileInbox } from './MobileInbox';
import { CharacterReview } from './CharacterReview';
import { useModal } from '../use-modal';

interface ResearchWindowProps {
  file: ProjectFile;
  open: boolean;
  /** Which view to land on, when something sent the writer here to look. */
  openOn?: ResearchView;
  /** The beat being written, so material can be marked used where it landed. */
  currentBeatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Move research into a window of its own, for a second monitor (§8). */
  onPopOut?(): void;
  /**
   * Go and look at a passage. Given by the workspace, where there is a script
   * beside this to go to; absent in the popped-out window, which has none.
   */
  onGoToBeat?(beatId: BeatId): void;
}

/** What the side menu can be pointed at. */
type Selection =
  | { kind: 'view'; view: ResearchView }
  | { kind: 'folder'; id: ResearchCategoryId }
  | { kind: 'plots' }
  | { kind: 'setups' }
  /** Themes and motifs (addendum 12), one screen with two tabs inside it. */
  | { kind: 'thematics' }
  /** The location library (addendum 14). */
  | { kind: 'locations' }
  /** The story-relationship timeline (addendum 15) — every track at once. */
  | { kind: 'links' }
  /** The graphics library (addendum 16 §9): every prose format's, since a novel has plates. */
  | { kind: 'graphics' }
  /** Bringing notes and pictures in (addendum 16 §4). Instructional books only. */
  | { kind: 'importer' }
  /** The relationship mind map (addendum 08 §12) — a view of the whole cast. */
  | { kind: 'charmap' }
  /** Search, filters and the review modes (addendum 08 §18). */
  | { kind: 'review' }
  /** What the phone caught, waiting to be placed (addendum 09 §9). */
  | { kind: 'mobile' }
  /** What has been deleted and can still be put back (addendum 24). */
  | { kind: 'graveyard' }
  /**
   * Somebody open in the Character Creator (addendum 08 §5).
   *
   * The Creator is a **selection** rather than a thing laid over one, and that
   * is the whole of why it stays put: the side menu can be pointed at a person
   * the same way it is pointed at a folder, so leaving them is clicking
   * something else and coming back is clicking them again.
   */
  | { kind: 'creator'; id: CharacterId };

/**
 * The four views, named for the format.
 *
 * *Used in the script* is exactly the phrasing §14 forbids on a book, so the
 * label reads the noun table rather than saying a word of its own — the same
 * rule every other surface follows since addendum 16 §1.
 */
const viewsFor = (format: ProjectFormat): ReadonlyArray<{ view: ResearchView; label: string }> => [
  { view: 'all', label: 'All research' },
  { view: 'unused', label: 'Not yet used' },
  { view: 'used', label: `Used in the ${nounsFor(format).manuscript.toLowerCase()}` },
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
 * Everything that is not the script lives here, so the plot tracks and the
 * setups and payoffs are the last two entries in the same menu.
 */
export function ResearchWindow({
  file,
  open,
  openOn,
  currentBeatId,
  onClose,
  onUpdate,
  onPopOut,
  onGoToBeat,
}: ResearchWindowProps) {
  const dialog = useModal(open);
  return (
    <dialog ref={dialog} className="research-window" aria-label="Research" onClose={onClose}>
      {open ? (
        <ResearchBody
          file={file}
          currentBeatId={currentBeatId}
          onClose={onClose}
          onUpdate={onUpdate}
          {...(openOn ? { openOn } : {})}
          {...(onPopOut ? { onPopOut } : {})}
          {...(onGoToBeat ? { onGoToBeat } : {})}
        />
      ) : null}
    </dialog>
  );
}

/**
 * The window's contents, without the window. A research window on a second
 * monitor is this, in an OS window rather than over the workspace (§8).
 */
export function ResearchBody({
  file,
  currentBeatId,
  openOn,
  onClose,
  onUpdate,
  onPopOut,
  onGoToBeat,
}: {
  file: ProjectFile;
  currentBeatId: BeatId | null;
  /** Which view to land on. The report's "research not used" arrives here. */
  openOn?: ResearchView;
  onGoToBeat?(beatId: BeatId): void;
  onClose(): void;
  onUpdate: ResearchWindowProps['onUpdate'];
  onPopOut?(): void;
}) {
  const [selection, setSelection] = useState<Selection>({ kind: 'view', view: openOn ?? 'all' });

  // Arriving from somewhere that named a view — the report's count of what
  // nothing points at — lands on it, even if the window was already open.
  useEffect(() => {
    if (openOn) setSelection({ kind: 'view', view: openOn });
  }, [openOn]);
  const [selectedItemId, setSelectedItemId] = useState<ResearchItemId | null>(null);
  /**
   * Where opening somebody came from, so **Back** goes there rather than
   * somewhere plausible. Opening from the map should return to the map.
   */
  const [cameFrom, setCameFrom] = useState<Selection | null>(null);
  /**
   * The tab each person was last left on.
   *
   * Kept out here rather than inside the Creator because the Creator is
   * unmounted the moment the writer looks at a folder. Coming back to somebody
   * mid-way through their arc and landing on Overview would make the module
   * feel like it had forgotten them.
   */
  const [tabFor, setTabFor] = useState<Readonly<Record<string, CreatorTab>>>({});
  /**
   * An instructional book keeps a different research shelf (addendum 16 §3),
   * and §15 requires the two stay distinct — so the *menu* is the taxonomy.
   * A professor is not offered a Character Creator to ignore.
   */
  const instructional = isInstructional(file.project.format);
  const prose = isProseFormat(file.project.format);
  const views = useMemo(() => viewsFor(file.project.format), [file.project.format]);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [dragging, setDragging] = useState<{ kind: 'item' | 'folder' | 'capture'; id: string } | null>(null);
  /**
   * What the phone has sent and nobody has placed (addendum 09 §9).
   *
   * Read here rather than inside the inbox because the *drops* happen out in
   * the side menu, on folders and on the cast — so the list and the thing that
   * removes from it have to be the same piece of state.
   */
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(false);
  const [capturesError, setCapturesError] = useState<string | null>(null);

  const loadCaptures = useCallback(async () => {
    // The browser preview and the tests run this component without the
    // Electron bridge behind it. No bridge means no phone, which is an empty
    // inbox rather than an error a writer would have to read.
    if (typeof window.vcwriter?.listCaptures !== 'function') return;

    setCapturesLoading(true);
    setCapturesError(null);
    const result = await window.vcwriter.listCaptures(file.project.id);
    setCapturesLoading(false);
    if (!result.ok || !result.data) {
      setCapturesError(result.error ?? 'The phone\u2019s notes could not be read');
      return;
    }
    setCaptures(result.data);
  }, [file.project.id]);

  // Fetched once the window is open rather than when Mobile App is chosen, so
  // the count beside it is true before anybody clicks it.
  useEffect(() => {
    void loadCaptures();
  }, [loadCaptures]);

  const waiting = useMemo(
    () => inboxGroups(captures).reduce((total, group) => total + group.captures.length, 0),
    [captures],
  );

  // How many are waiting in the graveyard, for the menu's count.
  const buried = graveyardCount(file);
  const tree = useMemo(() => researchTree(file), [file]);
  const folders = useMemo(() => flatten(tree), [tree]);

  /** The cast in the order it is offered while typing: main characters first. */
  const cast = useMemo(
    () => castByCategory(file).flatMap((group) => group.characters),
    [file],
  );

  /**
   * How much is waiting on each of them, read off the usage links like
   * everywhere else — never a count kept on the character, which would be a
   * second place for the truth to live.
   */
  const onDeck = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const person of cast) {
      counts[person.id as string] = characterBoard({ characterId: person.id as string, file }).counts.onDeck;
    }
    return counts;
  }, [cast, file]);

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

  /**
   * Place a note from the phone (addendum 09 §1).
   *
   * **One function for every way of doing it** — the drag, the button under the
   * suggestion, all of it — because placing a note has two halves that must not
   * come apart: the project gains something, and the capture stops waiting. A
   * second copy of this would eventually do one without the other.
   */
  const placeCapture = async (capture: CaptureItem, decision: ApprovalDecision) => {
    setCapturesError(null);
    try {
      // Worked out before the updater runs: an updater can run twice in
      // StrictMode, and reading the result from inside it would double the note.
      const result = approveCapture(file, capture, decision);
      onUpdate(() => result.file);

      const written = await window.vcwriter.resolveCapture(result.capture);
      if (!written.ok) {
        // The note is in the project; only the queue entry failed to update. Say
        // that, rather than pretending nothing happened.
        setCapturesError(written.error ?? 'The note was filed, but the phone\u2019s copy could not be marked done');
        return;
      }
      setCaptures((current) => current.filter((one) => one.id !== capture.id));
    } catch (cause) {
      setCapturesError(cause instanceof Error ? cause.message : 'That note could not be filed');
    }
  };

  const discardCapture = async (capture: CaptureItem) => {
    const written = await window.vcwriter.resolveCapture(rejectCapture(capture));
    if (!written.ok) {
      setCapturesError(written.error ?? 'That note could not be set aside');
      return;
    }
    setCaptures((current) => current.filter((one) => one.id !== capture.id));
  };

  /** The note being dragged, when one is. */
  const draggedCapture = (): CaptureItem | null =>
    dragging?.kind === 'capture'
      ? (captures.find((one) => (one.id as string) === dragging.id) ?? null)
      : null;

  /** A note or a folder dropped on a folder is filed there. */
  const dropOn = (categoryId: ResearchCategoryId) => {
    if (!dragging) return;
    if (dragging.kind === 'capture') {
      const capture = draggedCapture();
      setDragging(null);
      if (capture) void placeCapture(capture, { kind: 'research', categoryId });
      return;
    }
    if (dragging.kind === 'item') {
      onUpdate((current) =>
        moveResearchItem(current, { itemId: dragging.id as ResearchItemId, toCategoryId: categoryId, index: 0 }),
      );
    } else if (dragging.id !== categoryId) {
      onUpdate((current) => reparentResearchCategory(current, dragging.id as ResearchCategoryId, categoryId));
    }
    setDragging(null);
  };

  const creator =
    selection.kind === 'creator'
      ? (file.characters.find((person) => person.id === selection.id) ?? null)
      : null;

  /**
   * Open somebody, remembering where the writer was. Called from the cast in
   * the side menu, from a cast row's right-click, from the map and from the
   * review — every one of them the same act, so every one of them comes here.
   */
  const openCreator = (characterId: CharacterId) => {
    setSelection((current) => {
      if (current.kind !== 'creator') setCameFrom(current);
      return { kind: 'creator', id: characterId };
    });
  };

  // The system Characters folder: the one the cast is shown in.
  const isCastFolder =
    selection.kind === 'folder' &&
    file.researchCategories.some(
      (category) => category.id === selection.id && category.systemKey === 'characters',
    );

  const title =
    selection.kind === 'creator'
      ? (creator?.name ?? 'Character')
      : selection.kind === 'view'
      ? (views.find((entry) => entry.view === selection.view)?.label ?? 'Research')
      : selection.kind === 'mobile'
      ? 'Mobile App'
      : selection.kind === 'graveyard'
      ? 'Graveyard'
      : selection.kind === 'charmap'
        ? 'Character map'
        : selection.kind === 'review'
        ? 'Character review'
        : selection.kind === 'plots'
        ? 'Plots'
        : selection.kind === 'graphics'
          ? 'Graphics'
        : selection.kind === 'importer'
          ? 'Import'
        : selection.kind === 'links'
          ? 'Links'
        : selection.kind === 'locations'
          ? 'Locations'
        : selection.kind === 'thematics'
          ? 'Themes & motifs'
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
        {onPopOut ? <PopOutButton what="research" onPopOut={onPopOut} /> : null}
        <button type="button" className="ghost" aria-label="Close research" onClick={onClose}>
          ×
        </button>
      </header>

      {/* The Creator and the map both want the detail pane's room as well as
          their own: each has its own second column inside it. */}
      <div
        className={
          creator ||
          // The wiring diagram wants the whole width: it is a timeline.
          selection.kind === 'links' ||
          selection.kind === 'graphics' ||
          selection.kind === 'importer' ||
          selection.kind === 'charmap' ||
          selection.kind === 'review' ||
          selection.kind === 'mobile'
            ? 'research-body creating'
            : 'research-body'
        }
      >
        {/* The side menu: what is not a place, then the folders. */}
        <nav className="research-side" aria-label="Research folders">
          <h4>Everything</h4>
          <ul className="research-views">
            {views.map((entry) => (
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

          {/* The Character Creator, by the people in it. It is named rather
              than called "Cast" because it is a thing the product *does* —
              build a character — and a menu that says what a feature is called
              is how somebody finds it after reading about it. The order is the
              order names are offered while a cue is being typed: main
              characters first. */}
          {cast.length > 0 && !instructional ? (
            <>
              <h4>Character Creator</h4>
              <ul className="research-views research-cast">
                {cast.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      // A note from the phone dropped here is filed *about*
                      // them — never as a second person of the same name.
                      onDragOver={(event) => {
                        if (dragging?.kind === 'capture') event.preventDefault();
                      }}
                      onDrop={() => {
                        const capture = draggedCapture();
                        setDragging(null);
                        if (capture) {
                          void placeCapture(capture, { kind: 'about_character', characterId: person.id });
                        }
                      }}
                      className={
                        selection.kind === 'creator' && selection.id === person.id
                          ? 'folder-row selected'
                          : 'folder-row'
                      }
                      aria-current={
                        selection.kind === 'creator' && selection.id === person.id ? 'true' : undefined
                      }
                      title={`Build ${person.name}: traits, how they show, and what is still on deck`}
                      onClick={() => openCreator(person.id)}
                    >
                      <span className="folder-name">{person.name}</span>
                      {/* Nothing waiting is not worth a nought beside every
                          name; something waiting is worth saying. */}
                      {(onDeck[person.id as string] ?? 0) > 0 ? (
                        <span className="count muted" title="Waiting to be shown">
                          {onDeck[person.id as string]}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <h4>Also</h4>
          <ul className="research-views">
            {instructional ? (
              <li>
                <button
                  type="button"
                  className={selection.kind === 'importer' ? 'folder-row selected' : 'folder-row'}
                  title="Bring in notes, documents and pictures"
                  onClick={() => setSelection({ kind: 'importer' })}
                >
                  <span className="folder-name">Import</span>
                </button>
              </li>
            ) : null}
            {/* The graphics library is every book's (addendum 20 §9): a
                novel's plates and chapter art live here too, so the Layout
                room's *from the library* has somewhere a writer can find. */}
            {prose ? (
              <li>
                <button
                  type="button"
                  className={selection.kind === 'graphics' ? 'folder-row selected' : 'folder-row'}
                  title="The book’s pictures: plates, chapter art and figures"
                  onClick={() => setSelection({ kind: 'graphics' })}
                >
                  <span className="folder-name">Graphics</span>
                  <span className="count muted">{(file.assets ?? []).length}</span>
                </button>
              </li>
            ) : null}
            {/* Absent rather than greyed on a book (addendum 16 §3): a plot
                track, a planted setup and a place read off a slugline are
                things a textbook does not have, and a disabled control says
                *not yet* about something that is never coming. Themes, Links
                and the phone stay: a work of nonfiction has all three. */}
            {!instructional ? (
              <>
                <li>
                  <button
                    type="button"
                    className={selection.kind === 'plots' ? 'folder-row selected' : 'folder-row'}
                    onClick={() => setSelection({ kind: 'plots' })}
                  >
                    <span className="folder-name">Plots</span>
                    <span className="count muted">{file.tracks.length}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={selection.kind === 'setups' ? 'folder-row selected' : 'folder-row'}
                    onClick={() => setSelection({ kind: 'setups' })}
                  >
                    <span className="folder-name">Setups &amp; payoffs</span>
                    <span className="count muted">
                      {file.setupsPayoffs.filter((record) => !record.archived).length}
                    </span>
                  </button>
                </li>
                {/* Places, as a first-class entry rather than a folder of notes:
                    a location is a project asset like a character (addendum 14). */}
                <li>
                  <button
                    type="button"
                    className={selection.kind === 'locations' ? 'folder-row selected' : 'folder-row'}
                    onClick={() => setSelection({ kind: 'locations' })}
                  >
                    <span className="folder-name">Locations</span>
                    <span className="count muted">
                      {(file.locations ?? []).filter((one) => !one.archived).length}
                    </span>
                  </button>
                </li>
              </>
            ) : null}
            {/* The story-relationship timeline (addendum 15). It sits with the
                modules it draws rather than under one of them, because it is
                the track engine for all four and belongs to none. */}
            <li>
              <button
                type="button"
                className={selection.kind === 'links' ? 'folder-row selected' : 'folder-row'}
                title="How story elements travel through the script"
                onClick={() => setSelection({ kind: 'links' })}
              >
                <span className="folder-name">Links</span>
                <span className="count muted">{(file.threads ?? []).filter((one) => !one.archived).length}</span>
              </button>
            </li>
            {/* Named as one entry with two tabs behind it, rather than two
                entries: a theme and a motif are separate kinds, and the menu
                is where a writer looks for the pair. */}
            <li>
              <button
                type="button"
                className={selection.kind === 'thematics' ? 'folder-row selected' : 'folder-row'}
                onClick={() => setSelection({ kind: 'thematics' })}
              >
                <span className="folder-name">Themes &amp; motifs</span>
                <span className="count muted">{(file.themes ?? []).length + (file.motifs ?? []).length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className={selection.kind === 'mobile' ? 'folder-row selected' : 'folder-row'}
                title="What the phone caught, waiting to be put somewhere"
                onClick={() => setSelection({ kind: 'mobile' })}
              >
                <span className="folder-name">Mobile App</span>
                {waiting > 0 ? <span className="count muted">{waiting}</span> : null}
              </button>
            </li>
            {/* The Character Creator's two whole-cast readings. Gone with the
                cast itself on a book: the menu already declined to offer the
                people, and offering the map of them afterwards would be the
                same mistake made twice. */}
            {!instructional ? (
              <>
                <li>
                  <button
                    type="button"
                    className={selection.kind === 'charmap' ? 'folder-row selected' : 'folder-row'}
                    onClick={() => setSelection({ kind: 'charmap' })}
                  >
                    <span className="folder-name">Character map</span>
                    <span className="count muted">{file.characterRelationships.length}</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={selection.kind === 'review' ? 'folder-row selected' : 'folder-row'}
                    onClick={() => setSelection({ kind: 'review' })}
                  >
                    <span className="folder-name">Character review</span>
                    <span className="count muted">
                      {file.characterizationItems.length + file.arcPoints.length}
                    </span>
                  </button>
                </li>
              </>
            ) : null}
          </ul>

          {/* Last, because they are the least of it. The research a writer
              actually opens this window for has a name higher up the menu; the
              folders are where the rest goes. */}
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

          {/* Last of all, which is where Ken asked for it (addendum 24): it is
              not a place work is kept, it is where work waits after a
              mistake, so it sits under everything rather than among it. */}
          <ul className="research-tree research-graveyard">
            <li>
              <button
                type="button"
                className={selection.kind === 'graveyard' ? 'folder-row selected' : 'folder-row'}
                aria-pressed={selection.kind === 'graveyard'}
                title="What has been deleted, and how to put it back"
                onClick={() => setSelection({ kind: 'graveyard' })}
              >
                <span className="folder-name">Graveyard</span>
                {buried > 0 ? <span className="count muted">{buried}</span> : null}
              </button>
            </li>
          </ul>
        </nav>

        {/* What is in it — or, when somebody is being built, them. */}
        <section className="research-contents" aria-label={creator ? creator.name : title}>
          {creator ? (
            <CharacterCreator
              // Keyed on the person so switching between two of them starts
              // clean: the open trait belongs to whoever was being read, and
              // carrying it across would show the next person an empty shelf.
              key={creator.id}
              file={file}
              characterId={creator.id}
              currentBeatId={currentBeatId}
              backLabel={
                cameFrom?.kind === 'charmap'
                  ? 'Map'
                  : cameFrom?.kind === 'review'
                    ? 'Review'
                    : 'Research'
              }
              tab={tabFor[creator.id as string] ?? 'overview'}
              onTab={(next) => setTabFor((current) => ({ ...current, [creator.id as string]: next }))}
              onUpdate={onUpdate}
              onBack={() => setSelection(cameFrom ?? { kind: 'view', view: 'all' })}
            />
          ) : (
            <>
          <header className="research-contents-head">
            <h3>{title}</h3>
            {selection.kind === 'plots' ||
            selection.kind === 'setups' ||
            selection.kind === 'thematics' ||
            selection.kind === 'locations' ||
            selection.kind === 'links' ||
            selection.kind === 'graphics' ||
            selection.kind === 'importer' ||
            selection.kind === 'charmap' ||
            selection.kind === 'review' ||
            selection.kind === 'mobile' ||
            // A count of *notes* means nothing on a screen that is not notes.
            selection.kind === 'graveyard' ? null : (
              <span className="muted">
                {items.length} {items.length === 1 ? 'note' : 'notes'}
                {query.length > 0 ? ' found' : ''}
              </span>
            )}
          </header>

          {/* The Characters folder opens with the cast itself — the people,
              under the headings they are filed under (addendum 02 §16) —
              and the notes about them below it. Two views of the same
              folder rather than two folders both called Characters. */}
          {isCastFolder ? (
            <div className="research-embedded">
              <CastPanel file={file} onUpdate={onUpdate} onOpenCreator={openCreator} />
            </div>
          ) : null}

          {selection.kind === 'mobile' ? (
            <MobileInbox
              file={file}
              captures={captures}
              loading={capturesLoading}
              error={capturesError}
              draggingId={dragging?.kind === 'capture' ? dragging.id : null}
              onDragStart={(capture) => setDragging({ kind: 'capture', id: capture.id as string })}
              onDragEnd={() => setDragging(null)}
              onAcceptSuggestion={(capture) => {
                const decision = suggestRouting(file, capture).decision;
                if (decision) void placeCapture(capture, decision);
              }}
              onReject={(capture) => void discardCapture(capture)}
              onRefresh={() => void loadCaptures()}
            />
          ) : selection.kind === 'review' ? (
            <CharacterReview file={file} onOpenCreator={openCreator} />
          ) : selection.kind === 'charmap' ? (
            <CharacterMap
              file={file}
              onUpdate={onUpdate}
              // Back from here returns to the map, because that is where
              // they came from — openCreator remembers it.
              onOpenCreator={openCreator}
            />
          ) : selection.kind === 'plots' ? (
            <Plots file={file} onUpdate={onUpdate} />
          ) : selection.kind === 'graveyard' ? (
            <div className="research-embedded">
              <GraveyardPanel file={file} onUpdate={onUpdate} />
            </div>
          ) : selection.kind === 'graphics' ? (
            <div className="research-embedded">
              <GraphicsPanel
                file={file}
                onUpdate={onUpdate}
                {...(onGoToBeat ? { onGoToBeat } : {})}
              />
            </div>
          ) : selection.kind === 'importer' ? (
            <div className="research-embedded">
              <ImportNotesPanel file={file} onUpdate={onUpdate} />
            </div>
          ) : selection.kind === 'links' ? (
            <div className="research-embedded">
              <LinksTimeline
                file={file}
                onUpdate={onUpdate}
                {...(onGoToBeat ? { onGoToBeat } : {})}
              />
            </div>
          ) : selection.kind === 'locations' ? (
            <div className="research-embedded">
              <LocationsPanel file={file} onUpdate={onUpdate} />
            </div>
          ) : selection.kind === 'thematics' ? (
            <div className="research-embedded">
              <ThemesPanel
                file={file}
                onUpdate={onUpdate}
                {...(onGoToBeat ? { onGoTo: onGoToBeat } : {})}
              />
            </div>
          ) : selection.kind === 'setups' ? (
            <div className="research-embedded">
              <SetupsPanel
                file={file}
                currentBeatId={currentBeatId}
                onUpdate={onUpdate}
                {...(onGoToBeat ? { onGoTo: onGoToBeat } : {})}
              />
            </div>
          ) : items.length === 0 ? (
            <p className="muted empty-state">
              {query.length > 0
                ? 'Nothing here matches that.'
                : isCastFolder
                  ? 'No notes on anyone yet. + Note writes one up; the cast above is who is in it.'
                  : 'Nothing filed here yet. + Note puts something in it.'}
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
            </>
          )}
        </section>

        {/* The thing itself. The Creator has the whole pane, so there is no
            second selection to show beside it. */}
        <aside
          className="research-detail"
          aria-label="Detail"
          hidden={creator !== null || selection.kind === 'charmap' || selection.kind === 'review'}
        >
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
  dragging: { kind: 'item' | 'folder' | 'capture'; id: string } | null;
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
        {/* One click opens the folder, two rename it. The name is text rather
            than a control of its own: a button inside a button is neither
            valid nor navigable. */}
        <button type="button" className="folder-open" onClick={() => onSelect(category.id)}>
          <InlineText
            value={category.name}
            begin="doubleClick"
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

/** The plot tracks as records, which is what the Research tab used to show. */
function Plots({ file, onUpdate }: { file: ProjectFile; onUpdate: ResearchWindowProps['onUpdate'] }) {
  return (
    <ul className="research-plots">
      {tracksInOrder(file).map((track) => (
        <li key={track.id}>
          <div className="research-plot-head">
            <input
              type="color"
              className="swatch"
              aria-label={`Colour of ${track.name}`}
              value={track.color}
              onChange={(event) => onUpdate((current) => updateTrack(current, track.id, { color: event.target.value }))}
            />
            <InlineText
              value={track.name}
              ariaLabel="Plot name"
              className="research-plot-name"
              onCommit={(name) => onUpdate((current) => updateTrack(current, track.id, { name: name || 'Track' }))}
            />
            <select
              aria-label={`Kind of ${track.name}`}
              value={track.kind}
              onChange={(event) => onUpdate((current) => updateTrack(current, track.id, { kind: event.target.value as typeof track.kind }))}
            >
              {trackKindSchema.options.map((kind) => (
                <option key={kind} value={kind}>
                  {kind.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <span className="count muted">{file.units.filter((unit) => unit.trackId === track.id).length}</span>
          </div>
          <textarea
            rows={2}
            aria-label={`What ${track.name} is about`}
            placeholder="What this thread of the story is about"
            value={track.description}
            onChange={(event) => onUpdate((current) => updateTrack(current, track.id, { description: event.target.value }))}
          />
        </li>
      ))}
    </ul>
  );
}
