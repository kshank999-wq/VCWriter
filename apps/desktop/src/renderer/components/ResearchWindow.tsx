import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { RoomSave } from './RoomSave';
import {
  deleteResearchItem,
  describeDeleting,
  graveyardCount,
  removeCharacter,
  removeTrack,
  dissolveTrack,
  folderRemoval,
  trackRemoval,
  motifsInOrder,
  themesInOrder,
  threadsInOrder,
  addCharacter,
  addResearchCategory,
  addResearchItem,
  approveCapture,
  groupOffer,
  openGroupFolder,
  castByCategory,
  cuesWithoutCharacter,
  notedCast,
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
  contentsShelf,
  isInstructional,
  isProseFormat,
  living,
  locationsInOrder,
  setupsBoard,
  nounsFor,
  type ApprovalDecision,
  type BeatId,
  type CaptureItem,
  type Character,
  type Track,
  type CharacterId,
  type ProjectFile,
  type ProjectFormat,
  type ResearchCategoryId,
  type ResearchFolder,
  type ResearchItem,
  type ResearchItemId,
  type StoryMarkerId,
  type ResearchView,
  WORK_STANDING_WORDS,
  reviewRows,
  type SaveKind,
} from '@vcwriter/domain';
import { PopOutButton } from './PopOutButton';
import { InlineText } from './InlineText';
import { RelatedPanel } from './RelatedPanel';
import { SetupsPanel } from './SetupsPanel';
import { GraphicsPanel } from './GraphicsPanel';
import { ContentsPanel } from './ContentsPanel';
import { NoteDialog } from './NoteDialog';
import { ChapterPageDialog } from './ChapterPageDialog';
import { GraveyardPanel } from './GraveyardPanel';
import { ImportNotesPanel } from './ImportNotesPanel';
import { LinksTimeline } from './LinksTimeline';
import { LocationsPanel } from './LocationsPanel';
import { ThemesPanel } from './ThemesPanel';
import { CastPanel } from './CastPanel';
import { CharacterCreator, type CreatorTab } from './CharacterCreator';
import { CharacterMap } from './CharacterMap';
import { MobileInbox } from './MobileInbox';
import { usePhoneNotes } from '../phone-notes';
import { CharacterReview, type ReviewMode } from './CharacterReview';
import { useModal } from '../use-modal';

interface ResearchWindowProps {
  file: ProjectFile;
  open: boolean;
  /** Which view to land on, when something sent the writer here to look. */
  openOn?: ResearchView;
  /**
   * Which of this room's own screens to land on (addendum 33). File ▸ Import
   * routes notes and pictures here rather than building a second importer on
   * a menu: this room already has the one that works.
   */
  openAt?: 'importer' | 'graphics';
  /** The beat being written, so material can be marked used where it landed. */
  currentBeatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Move research into a window of its own, for a second monitor (§8). */
  onPopOut?(): void;
  /**
   * Save the project somewhere else, from in here (addendum 29 §2). A room
   * covers the menu bar, so without this the two acts are reachable only by a
   * shortcut nobody can see. Absent where a host hands nothing down.
   */
  onSaveAs?(kind: SaveKind): void;
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
   * The book's chapters and sections, and what is filed under each
   * (addendum 28 §4). Instructional books only, and it **defines nothing** —
   * the chapters are the Outliner's and this is a reading of them.
   */
  | { kind: 'contents' }
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
  openAt,
  currentBeatId,
  onClose,
  onUpdate,
  onPopOut,
  onSaveAs,
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
          {...(openAt ? { openAt } : {})}
          {...(onPopOut ? { onPopOut } : {})}
          {...(onSaveAs ? { onSaveAs } : {})}
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
  openAt,
  onClose,
  onUpdate,
  onPopOut,
  onSaveAs,
  onGoToBeat,
}: {
  file: ProjectFile;
  currentBeatId: BeatId | null;
  /** Which view to land on. The report's "research not used" arrives here. */
  openOn?: ResearchView;
  /** Which of this room's own screens to land on — File ▸ Import arrives here. */
  openAt?: 'importer' | 'graphics';
  onGoToBeat?(beatId: BeatId): void;
  onClose(): void;
  onUpdate: ResearchWindowProps['onUpdate'];
  onPopOut?(): void;
  /**
   * Save the project somewhere else, from in here (addendum 29 §2). A room
   * covers the menu bar, so without this the two acts are reachable only by a
   * shortcut nobody can see. Absent where a host hands nothing down.
   */
  onSaveAs?(kind: SaveKind): void;
}) {
  const [selection, setSelection] = useState<Selection>({ kind: 'view', view: openOn ?? 'all' });

  // Arriving from somewhere that named a view — the report's count of what
  // nothing points at — lands on it, even if the window was already open.
  useEffect(() => {
    if (openOn) setSelection({ kind: 'view', view: openOn });
  }, [openOn]);

  // Sent here by File ▸ Import (addendum 33). Keyed on arriving rather than
  // on the value, so closing the importer and staying in the room does not
  // put it back in front — addendum 20 §16b's `openOnKind` rule.
  useEffect(() => {
    if (openAt) setSelection({ kind: openAt });
  }, [openAt]);
  const [selectedItemId, setSelectedItemId] = useState<ResearchItemId | null>(null);
  /**
   * The note open in the middle (addendum 28 §6), and where its cursor starts.
   * About this minute, so it is remembered nowhere — a note that reopened by
   * itself a fortnight later is one you go looking for (addendum 02 §6d).
   */
  const [writing, setWriting] = useState<{ id: ResearchItemId; on: 'title' | 'body' } | null>(null);
  /**
   * Where opening somebody came from, so **Back** goes there rather than
   * somewhere plausible. Opening from the map should return to the map.
   */
  const [cameFrom, setCameFrom] = useState<Selection | null>(null);
  /**
   * The mode and the person the review was asked to open on (addendum 25 §3).
   * Held here rather than in the review, because the ask comes from another
   * screen and the review is unmounted between the two.
   */
  const [reviewOn, setReviewOn] = useState<{ mode: ReviewMode; characterId: CharacterId } | null>(null);
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
   * The chapter whose own page is open (addendum 28 §4a).
   *
   * The room holds its own `ChapterPageDialog` for the reason the Layout room
   * does (addendum 20 §9d): handing the chapter up to the workspace was fine
   * while the screen was only ever reached from the File menu, and wrong the
   * moment a room offers a way into it — a route that only works while the
   * workspace is in front of it is not a route.
   */
  const [chapterPageFor, setChapterPageFor] = useState<StoryMarkerId | null>(null);
  /**
   * What the phone has sent and nobody has placed (addendum 09 §9).
   *
   * Read here rather than inside the inbox because the *drops* happen out in
   * the side menu, on folders and on the cast — so the list and the thing that
   * removes from it have to be the same piece of state.
   */
  const phone = usePhoneNotes(file.project.id as string);
  const captures = phone.notes;

  const waiting = useMemo(
    () =>
      inboxGroups(captures, file.project.format as ProjectFormat).reduce(
        (total, group) => total + group.captures.length,
        0,
      ),
    [captures, file.project.format],
  );

  // How many are waiting in the graveyard, for the menu's count.
  const buried = graveyardCount(file);
  const tree = useMemo(() => researchTree(file), [file]);
  const folders = useMemo(() => flatten(tree), [tree]);

  /**
   * The cast **under its headings** (§8b, from Ken: *we need to have
   * something that defines and organizes in that character screen, major
   * characters*).
   *
   * `castByCategory` has grouped them since the categories were built, and
   * the menu threw the groups away with a `flatMap` — so a project that had
   * said who its leads were showed one undifferentiated list. The headings
   * are the writer's own words and their order is main-before-minor, which
   * is the order names are offered in while a cue is typed.
   *
   * **An empty heading is dropped here** and kept in the cast panel, which
   * is not a contradiction: the panel is where a writer *files* somebody, so
   * an empty heading there is where the next one goes, while this is a list
   * of people to click into and a heading over nobody points at nothing. A
   * new project seeds three, so without this a cast of two under one of them
   * would be drawn beneath two empty labels.
   */
  const groups = useMemo(() => castByCategory(file).filter((group) => group.characters.length > 0), [file]);
  const cast = useMemo(() => groups.flatMap((group) => group.characters), [groups]);
  /** Has anybody a type at all? Until somebody has, the list is just a list. */
  const typed = useMemo(() => groups.some((group) => group.category !== null), [groups]);
  /**
   * Names that speak in the manuscript and have no character record (§4d).
   * `cuesWithoutCharacter` has answered this since addendum 08 stage 13; what
   * was missing was anywhere to act on it.
   */
  const unknownCues = useMemo(() => cuesWithoutCharacter(file), [file]);

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

  /**
   * How many found rows the search shows before it says there are more.
   * A search that returned two hundred is one nobody reads.
   */
  const FOUND_LIMIT = 12;

  /** Character work matching the search, across the whole cast (§7). */
  const found = useMemo(
    () => (query.trim().length === 0 ? [] : reviewRows(file, { query }).slice(0, FOUND_LIMIT)),
    [file, query],
  );

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
      if (made) {
        setSelectedItemId(made.id);
        // **The act opens the screen it made.** Ken's complaint is about this
        // press: before it, + Note made a note and left focus on the button,
        // so a writer had to go and find a 287px box in the right-hand column.
        setWriting({ id: made.id, on: 'title' });
      }
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
    phone.setError(null);
    try {
      // Worked out before the updater runs: an updater can run twice in
      // StrictMode, and reading the result from inside it would double the note.
      const result = approveCapture(file, capture, decision);
      onUpdate(() => result.file);

      // The note is in the project; only the queue entry can still fail, and
      // saying so beats pretending nothing happened.
      const why = await phone.resolve(result.capture);
      if (why) phone.setError(why);
    } catch (cause) {
      phone.setError(cause instanceof Error ? cause.message : 'That note could not be filed');
    }
  };

  /**
   * A whole spoken group, filed at once (addendum 09 §12).
   *
   * **The folder is made here and nowhere else.** The phone said a word and
   * created nothing; this is the deliberate press, by somebody looking at what
   * is about to go in it.
   *
   * The file is threaded by hand rather than by calling `placeCapture` in a
   * loop: that one reads `file` from the closure, so every note after the first
   * would be approved against the document as it stood before any of them —
   * which is addendum 18 stage 7's lesson, a value caught before the host has
   * run the update.
   */
  const placeGroup = async (category: string | null, group: string) => {
    phone.setError(null);
    const offer = groupOffer(file, captures, category, group);
    if (!offer.parentId || offer.count === 0) {
      phone.setError(offer.why);
      return;
    }

    try {
      const opened = openGroupFolder(file, category, group);
      let next = opened.file;
      const waiting = captures.filter(
        (one) =>
          (one.status === 'pending' || one.status === 'needs_review') &&
          one.category === category &&
          (one.subcategory ?? '').trim().toLowerCase() === group.trim().toLowerCase(),
      );

      for (const capture of waiting) {
        const result = approveCapture(next, capture, { kind: 'research', categoryId: opened.categoryId });
        next = result.file;
        const why = await phone.resolve(result.capture);
        if (why) {
          // What has been filed is filed; say what stopped rather than
          // pretending the whole press failed or that all of it worked.
          onUpdate(() => next);
          phone.setError(why);
          return;
        }
      }

      onUpdate(() => next);
    } catch (cause) {
      phone.setError(cause instanceof Error ? cause.message : 'That group could not be filed');
    }
  };

  const discardCapture = async (capture: CaptureItem) => {
    const why = await phone.resolve(rejectCapture(capture));
    if (why) phone.setError(why);
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

  // `living` rather than a plain find: deleting somebody while their Creator
  // is open must close it, or the one screen in the room still showing them
  // would be the one the writer is looking at.
  const creator =
    selection.kind === 'creator'
      ? (file.characters.find((person) => person.id === selection.id && living(person)) ?? null)
      : null;

  // …and the room goes back where they came from rather than staying pointed
  // at somebody who is not there: a selection with nobody behind it drew a
  // nameless folder in the middle and lit nothing in the menu.
  useEffect(() => {
    if (selection.kind !== 'creator') return;
    if (file.characters.some((person) => person.id === selection.id && living(person))) return;
    setSelection(cameFrom ?? { kind: 'view', view: 'all' });
    setCameFrom(null);
  }, [file, selection, cameFrom]);

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
      : selection.kind === 'contents'
      ? 'Table of contents'
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
        {onSaveAs ? <RoomSave file={file} onSaveAs={onSaveAs} /> : null}
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
          selection.kind === 'contents' ||
          selection.kind === 'review' ||
          selection.kind === 'mobile'
            ? 'research-body creating'
            : 'research-body'
        }
      >
        {/* The side menu: what is not a place, then the folders. */}
        <nav className="research-side" aria-label="Research folders">
          {/* The table of contents, at the top and on a book alone (addendum
              28 §4, from Ken: *the research section on the top will have table
              of contents*). It stands first because on an instructional book
              it is the thing the room is organised around — where in the book
              a note goes is the question, and which shelf it is on is the
              filing. Absent rather than greyed elsewhere: a screenplay has no
              chapters to file against. */}
          {instructional ? (
            <ul className="research-views">
              <li>
                <button
                  type="button"
                  className={selection.kind === 'contents' ? 'folder-row selected' : 'folder-row'}
                  title="The chapters and sections of the book, and what is filed under each"
                  onClick={() => setSelection({ kind: 'contents' })}
                >
                  <span className="folder-name">Table of contents</span>
                  <span className="count muted">{contentsShelf(file).length}</span>
                </button>
              </li>
            </ul>
          ) : null}

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
          {/* **The section stands whether or not anybody is in it** (§8b,
              from Ken: *I accidentally deleted all the characters and I
              don't know how to get those back*). It used to be drawn only
              where the cast had somebody in it, so deleting the last person
              took the whole module off the menu — with no way to make
              another and nothing saying where the old ones had gone. A
              feature that vanishes when its list is empty is one a writer
              cannot get back into. */}
          {!instructional ? (
            <>
              <h4>Character Creator</h4>
              {groups.map((group) => (
                <ul key={group.category?.id ?? 'unfiled'} className="research-views research-cast">
                  {/* The heading is the character **type** — the writer's own
                      word for who these people are to the story (§4c).

                      **It is drawn as soon as anybody has a type**, which is
                      the correction: it used to appear only where there was
                      more than one group, so a cast filed entirely as main
                      characters said nothing about being one — which is what
                      Ken asked the left-hand list to say.

                      And it is **all of the headings or none**. The first
                      draft drew one over every real type and none over *Not
                      filed*, since that names nothing; driving it showed what
                      that costs — a group with no heading takes the one above
                      it, so Victor Marsh, whom nobody had typed, sat under
                      BACKGROUND CHARACTERS reading as one. */}
                  {typed ? <li className="research-cast-head">{group.name}</li> : null}
                  {group.characters.map((person) => (
                    <CastMenuRow
                      key={person.id}
                      file={file}
                      person={person}
                      chosen={selection.kind === 'creator' && selection.id === person.id}
                      waiting={onDeck[person.id as string] ?? 0}
                      onOpen={() => openCreator(person.id)}
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
                      onUpdate={onUpdate}
                    />
                  ))}
                </ul>
              ))}
              <ul className="research-views">
                <li>
                  {/* **A form, not `window.prompt`.**

                      It was a prompt, and **Electron does not implement one**
                      — it writes *prompt() is and will not be supported.* to a
                      console no writer sees and returns nothing — so on the
                      desktop build this button did nothing at all, silently.
                      That is Ken's report: *I added two new characters and
                      neither of them show up.* In the browser preview it
                      worked, which is why it survived.

                      The rule it breaks is the one the whole room follows
                      anyway: **an act asks for what it needs where it stands**,
                      the way a folder, a trait and a story are named. */}
                  <NewCharacter
                    onMake={(name) =>
                      onUpdate((current) => {
                        const made = addCharacter(current, { name });
                        const person = made.characters[made.characters.length - 1];
                        if (person) setSelection({ kind: 'creator', id: person.id });
                        return made;
                      })
                    }
                  />
                </li>
                {/* **The cast the script already names** (§4d). Whatever
                    happened at import — a document read as prose, a PDF with
                    no geometry to read, a cue style the reader did not know —
                    the script itself still says who speaks, and this files
                    them. It is a **reading**, so it is absent the moment there
                    is nobody left to add, and it says how many rather than
                    promising something it may not do. */}
                {unknownCues.length > 0 ? (
                  <li>
                    <button
                      type="button"
                      className="folder-row"
                      title="Every name that speaks in the script and has no record yet"
                      onClick={() => onUpdate((current) => notedCast(current))}
                    >
                      <span className="folder-name">
                        + {unknownCues.length === 1 ? 'Add 1 name from the script' : `Add ${unknownCues.length} names from the script`}
                      </span>
                    </button>
                  </li>
                ) : null}
                {/* Where the deleted ones went, said **here** rather than
                    only at the foot of the menu: somebody who has just lost
                    a cast is looking at where it used to be. */}
                {cast.length === 0 && buried > 0 ? (
                  <li>
                    <button type="button" className="folder-row" onClick={() => setSelection({ kind: 'graveyard' })}>
                      <span className="folder-name">
                        {buried === 1 ? '1 deleted record is in the Graveyard' : `${buried} deleted records are in the Graveyard`}
                      </span>
                    </button>
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}

          <h4>Also</h4>
          <ul className="research-views">
            {/* **Every format's** (addendum 33). It was an instructional
                book's alone, which is a fair reading of who has a folder of
                lecture notes and a wrong one about who has research: a
                screenwriter with a drawer of clippings and a novelist with a
                folder of photographs both have exactly what this brings in,
                and on their formats the one screen built for it was not
                drawn. Nothing in `importFiles` asks the format. */}
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
                    {/* The module's reading, for the Locations count's reason
                        (addendum 24 §5h, §5i). */}
                    <span className="count muted">{setupsBoard(file).length}</span>
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
                    {/* The module's own reading, not the raw collection: a
                        deleted place keeps its place in `file.locations`
                        (addendum 24 §2), so counting them here counted the
                        buried — the §5d fault, one surface late. */}
                    <span className="count muted">{locationsInOrder(file).length}</span>
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
                <span className="count muted">{threadsInOrder(file).length}</span>
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
                <span className="count muted">{themesInOrder(file).length + motifsInOrder(file).length}</span>
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
                    onClick={() => {
                      // Off the menu it is the review's own opening reading,
                      // rather than whatever somebody last asked it for.
                      setReviewOn(null);
                      setSelection({ kind: 'review' });
                    }}
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
                file={file}
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
              onReview={(mode) => {
                setReviewOn({ mode, characterId: creator.id });
                setCameFrom({ kind: 'creator', id: creator.id });
                setSelection({ kind: 'review' });
              }}
              // Into somebody else's arc (addendum 25 §5). The Creator is a
              // **selection** rather than a layer (addendum 08 §11), so this
              // is the same act as clicking them in the menu — which is why
              // coming back is clicking the first person again.
              // A button reading *Open their arc* that lands on their Overview
              // is a route that does not do what it says, so the tab goes with
              // the act — which is a change to where that person is *left*,
              // the same fact §11 remembers per person.
              onOpenCharacter={(id, tab) => {
                setCameFrom({ kind: 'creator', id: creator.id });
                // The tab goes with the act where the act names one: a button
                // reading *Open their arc* that lands on their Overview is a
                // route that does not do what it says. Where it names none —
                // a person pressed on the map — they open on whatever tab
                // they were last left on (addendum 08 §11).
                if (tab) setTabFor((current) => ({ ...current, [id as string]: tab }));
                setSelection({ kind: 'creator', id });
              }}
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
            // The table of contents counts per chapter, on the boxes
            // themselves; the room's own figure is the *folder's*, so beside
            // boxes reading 1 note each it drew a contradictory 0.
            selection.kind === 'contents' ||
            // A count of *notes* means nothing on a screen that is not notes.
            selection.kind === 'graveyard' ? null : (
              <span className="muted">
                {items.length} {items.length === 1 ? 'note' : 'notes'}
                {query.length > 0 ? ' found' : ''}
              </span>
            )}
          </header>

          {/* **The search finds character work too** (addendum 25 §7). The box
              said *Search titles, notes and tags* and meant it: a writer who
              typed *coal tongs* found nothing, though it is a moment under
              Silas's Miserly trait. The audit pays again — `reviewRows` with
              no `characterId` has searched across the whole cast since
              addendum 08 stage 10, matching the work, its trait's name and the
              person's — so this is a **second reader of one reading** rather
              than a second search, shown where the search already puts things
              and **absent rather than empty** where nothing matches. */}
          {found.length > 0 ? (
            <section className="research-found" aria-label="Character work found">
              <h4>
                Character work · {found.length}
                {found.length === FOUND_LIMIT ? '+' : ''}
              </h4>
              <ul>
                {found.map((row) => {
                  const who = file.characters.find((one) => one.id === row.work.characterId);
                  return (
                    <li key={`${row.work.kind}-${row.work.id}`}>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setCameFrom(null);
                          setSelection({ kind: 'creator', id: row.work.characterId });
                          setTabFor((current) => ({
                            ...current,
                            [row.work.characterId as string]:
                              row.work.kind === 'arc_point' ? 'arc' : 'traits',
                          }));
                        }}
                      >
                        {row.work.text}
                      </button>
                      <span className="muted small">
                        {who?.name ?? 'Somebody'}
                        {row.unitTitle ? ` · ${row.unitTitle}` : ''} ·{' '}
                        {WORK_STANDING_WORDS[row.standing]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

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
              loading={phone.loading}
              error={phone.error}
              draggingId={dragging?.kind === 'capture' ? dragging.id : null}
              onDragStart={(capture) => setDragging({ kind: 'capture', id: capture.id as string })}
              onDragEnd={() => setDragging(null)}
              onAcceptSuggestion={(capture) => {
                const decision = suggestRouting(file, capture).decision;
                if (decision) void placeCapture(capture, decision);
              }}
              onReject={(capture) => void discardCapture(capture)}
              onPlace={(capture, decision) => void placeCapture(capture, decision)}
              onRefresh={() => void phone.reload()}
              onFileGroup={(category, group) => void placeGroup(category, group)}
            />
          ) : selection.kind === 'review' ? (
            <CharacterReview file={file} onOpenCreator={openCreator} openOn={reviewOn} />
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
          ) : selection.kind === 'contents' ? (
            <div className="research-embedded">
              <ContentsPanel
                file={file}
                onUpdate={onUpdate}
                dragging={dragging}
                onDragEnd={() => setDragging(null)}
                // **What is in the air has one answer.** The shelf of unplaced
                // notes lives inside the panel (addendum 28 §4c), so it has to
                // say what it has picked up — and it says it here rather than
                // keeping a second piece of drag state the boxes would then
                // have to read beside this one.
                onDragNote={(id) => setDragging(id ? { kind: 'item', id: id as string } : null)}
                // A note opens where it lives, which is still its folder: the
                // table of contents says where in the book it goes and never
                // where it is kept.
                onOpenNote={(item) => setSelection({ kind: 'folder', id: item.categoryId })}
                // The chapter's title and what it is about are set on the
                // chapter page's own screen. A route, never a second copy.
                onOpenChapter={(markerId) => setChapterPageFor(markerId)}
              />
            </div>
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
                <NoteCard
                  key={item.id}
                  file={file}
                  item={item}
                  colour={folderOf(item)?.color ?? undefined}
                  folderName={folderOf(item)?.name ?? ''}
                  chosen={item.id === selectedItemId}
                  onChoose={() => setSelectedItemId(item.id)}
                  // The gesture this program already uses for *open the thing*
                  // — the beat, the part, the chapter page, a contents box. The
                  // writing takes the cursor, the note being named already.
                  onOpen={() => {
                    setSelectedItemId(item.id);
                    setWriting({ id: item.id, on: 'body' });
                  }}
                  onDragStart={() => setDragging({ kind: 'item', id: item.id })}
                  onDragEnd={() => setDragging(null)}
                  onUpdate={onUpdate}
                />
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

      {/* The chapter's own page, opened from a box in the table of contents
          (§4a). The room owns the dialog rather than asking the workspace to
          open it, because a room in a window of its own has no workspace in
          front of it — addendum 02 §8's rule that a room on the other monitor
          must not be able to do less. There is no spread here, so no box is
          drawn and no pages are laid. */}
      {/* The note's own screen (§6). The room owns it for `ChapterPageDialog`'s
          reason: a room in a window of its own has no workspace in front of it,
          and addendum 02 §8's rule is that it must not be able to do less. */}
      <NoteDialog
        file={file}
        item={writing ? file.researchItems.find((one) => one.id === writing.id) ?? null : null}
        startOn={writing?.on ?? 'title'}
        onClose={() => setWriting(null)}
      >
        {({ titleRef, bodyRef }) => {
          const open = writing ? file.researchItems.find((one) => one.id === writing.id) : null;
          if (!open) return null;
          return (
            <NoteFields
              file={file}
              item={open}
              rows={16}
              titleRef={titleRef}
              bodyRef={bodyRef}
              onUpdate={onUpdate}
              onGoToFolder={(id) => setSelection({ kind: 'folder', id })}
            />
          );
        }}
      </NoteDialog>

      <ChapterPageDialog
        file={file}
        open={chapterPageFor !== null}
        initialMarkerId={chapterPageFor}
        onClose={() => setChapterPageFor(null)}
        onUpdate={onUpdate}
      />
    </>
  );
}

const flatten = (folders: ResearchFolder[]): ResearchFolder[] =>
  folders.flatMap((folder) => [folder, ...flatten(folder.children)]);

/**
 * Somebody in the cast, in the side menu.
 *
 * The row carries the delete because **this is where a writer meets the cast**
 * — the panel inside the Characters folder has had one all along, and a person
 * added by accident is added from here. It is the folders' own shape: the name
 * opens them, the × waits until the row is pointed at, and it asks in the
 * graveyard's words rather than this menu's.
 */
/**
 * Making a character, from the menu (§4d).
 *
 * A form of its own rather than a `window.prompt`, which Electron does not
 * implement — see the call site. It is **its own component** because a
 * component declared inside another is a new type on every render, and the
 * `<input>` a writer is typing into is thrown away with the caret in it
 * (addendum 20 §16e).
 *
 * The row **is** the act until it is pressed, so the menu does not carry a box
 * nobody is using: pressing *+ New character* opens the field, Escape and an
 * empty blur put it away, and Enter makes them and opens them in the Creator.
 */
function NewCharacter({ onMake }: { onMake(name: string): void }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const done = () => {
    const wanted = name.trim();
    setName('');
    setNaming(false);
    if (wanted.length > 0) onMake(wanted);
  };

  if (!naming) {
    return (
      <button
        type="button"
        className="folder-row"
        title="Make a character and open them in the Creator"
        onClick={() => setNaming(true)}
      >
        <span className="folder-name">+ New character</span>
      </button>
    );
  }

  return (
    <form
      className="research-new-cast"
      onSubmit={(event) => {
        event.preventDefault();
        done();
      }}
    >
      <input
        aria-label="Who?"
        placeholder="Who?"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={done}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          setName('');
          setNaming(false);
        }}
      />
    </form>
  );
}

function CastMenuRow({
  file,
  person,
  chosen,
  waiting,
  onOpen,
  onDragOver,
  onDrop,
  onUpdate,
}: {
  file: ProjectFile;
  person: Character;
  chosen: boolean;
  waiting: number;
  onOpen(): void;
  onDragOver(event: DragEvent<HTMLElement>): void;
  onDrop(): void;
  onUpdate: ResearchWindowProps['onUpdate'];
}) {
  const [asking, setAsking] = useState(false);
  return (
    <li>
      <div
        className={chosen ? 'folder-row selected' : 'folder-row'}
        aria-current={chosen ? 'true' : undefined}
        // A note from the phone dropped here is filed *about* them — never as
        // a second person of the same name.
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="folder-open folder-name"
          title={`Build ${person.name}: traits, how they show, and what is still on deck`}
          onClick={onOpen}
        >
          {person.name}
        </button>
        {/* Nothing waiting is not worth a nought beside every name; something
            waiting is worth saying. */}
        {waiting > 0 ? (
          <span className="count muted" title="Waiting to be shown">
            {waiting}
          </span>
        ) : null}
        <button
          type="button"
          className="ghost danger"
          aria-label={`Delete ${person.name}`}
          title={`Delete ${person.name}`}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      </div>
      {asking ? (
        <div className="row-ask">
          <span className="muted small">{describeDeleting(file, { kind: 'character', id: person.id as string })}</span>
          <span className="row-ask-buttons">
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onUpdate((current) => removeCharacter(current, person.id));
                setAsking(false);
              }}
            >
              Delete
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </span>
        </div>
      ) : null}
    </li>
  );
}

function FolderNode({
  file,
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
  file: ProjectFile;
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
  const [asking, setAsking] = useState(false);
  const removal = folderRemoval(file, category.id);
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
        {/* It asks now (addendum 24 §5g). It used to remove the folder on one
            click with the whole explanation in a `title`, which is the answer
            to *what happened to my notes* given where nobody reads it. */}
        {seeded && !removal.allowed ? null : (
          <button
            type="button"
            className="ghost danger"
            title={`Delete ${category.name}`}
            aria-label={`Remove ${category.name}`}
            onClick={() => setAsking(true)}
          >
            ×
          </button>
        )}
      </div>
      {asking ? (
        <div className="row-ask">
          <span className="muted small">{removal.sentence}</span>
          <span className="row-ask-buttons">
            {removal.allowed ? (
              <button
                type="button"
                className="ghost small danger"
                onClick={() => {
                  onUpdate((current) => removeResearchCategory(current, category.id));
                  setAsking(false);
                }}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              {removal.allowed ? 'Keep' : 'Close'}
            </button>
          </span>
        </div>
      ) : null}
      {shut || children.length === 0 ? null : (
        <ul>
          {children.map((child) => (
            <FolderNode
              key={child.category.id}
              file={file}
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

/**
 * What a note **is** — its name, its words, its tags and which shelf it is on
 * (addendum 28 §6).
 *
 * **One component, two places**: the dialog a writer types into and the aside
 * that describes the selection. They write the same fields through the same
 * calls, so this is *a second control onto one field* (addendum 20 §16d) and
 * never a second answer — `ChapterStyleFields`' own shape (§9m), which is the
 * only arrangement where the two cannot come to disagree about what a note is.
 *
 * `rows` is the caller's because that is the whole of what differs: the aside
 * has 287px of column and the dialog has the middle of the screen.
 */
function NoteFields({
  file,
  item,
  rows,
  titleRef,
  bodyRef,
  onUpdate,
  onGoToFolder,
}: {
  file: ProjectFile;
  item: ResearchItem;
  rows: number;
  titleRef?: React.RefObject<HTMLInputElement>;
  bodyRef?: React.RefObject<HTMLTextAreaElement>;
  onUpdate: ResearchWindowProps['onUpdate'];
  onGoToFolder(id: ResearchCategoryId): void;
}) {
  const folders = useMemo(() => flatten(researchTree(file)), [file]);
  return (
    <>
      <label className="field">
        Title
        <input
          {...(titleRef ? { ref: titleRef } : {})}
          value={item.title}
          onChange={(event) => onUpdate((current) => updateResearchItem(current, item.id, { title: event.target.value }))}
        />
      </label>
      <label className="field">
        Note
        <textarea
          {...(bodyRef ? { ref: bodyRef } : {})}
          rows={rows}
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
    </>
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
  const where = file.beats.filter((beat) => item.usedInBeatIds.includes(beat.id));

  return (
    <>
      <NoteFields file={file} item={item} rows={10} onUpdate={onUpdate} onGoToFolder={onGoToFolder} />

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
        {/* Delete stands beside *Put away* rather than replacing it, because
            they are two different things a writer means (addendum 24 §1) —
            and it can exist at all because there is now somewhere for a
            mistake to land. It asks, and says where it goes. */}
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
        <PlotRow key={track.id} file={file} track={track} onUpdate={onUpdate} />
      ))}
    </ul>
  );
}

/**
 * One plot, with the × on its row (addendum 24 §5e).
 *
 * A track is **not** a graveyard record — burying one would have to bury its
 * scenes — so the promise the rest of the room keeps is kept here another way:
 * the safe answer comes first and says where the scenes go, and cutting the
 * writing is the second offer rather than what a bare × does.
 */
function PlotRow({
  file,
  track,
  onUpdate,
}: {
  file: ProjectFile;
  track: Track;
  onUpdate: ResearchWindowProps['onUpdate'];
}) {
  const [asking, setAsking] = useState(false);
  const removal = trackRemoval(file, track.id);
  return (
    <li>
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
            <span className="count muted">{removal.sceneCount}</span>
            {/* The last plot keeps no ×: it cannot go, and a control that
                refuses every time is one that lies about what it does. */}
            {removal.allowed ? (
              <button
                type="button"
                className="ghost small danger item-x"
                aria-label={`Delete ${track.name}`}
                title={`Delete ${track.name}`}
                onClick={() => setAsking(true)}
              >
                ×
              </button>
            ) : null}
          </div>
          {asking ? (
            <div className="row-ask">
              <span className="muted small">{removal.sentence}</span>
              <span className="row-ask-buttons">
                {removal.sceneCount > 0 && removal.moveTo ? (
                  <>
                    <button
                      type="button"
                      className="small"
                      onClick={() => {
                        onUpdate((current) => dissolveTrack(current, track.id));
                        setAsking(false);
                      }}
                    >
                      Move them and delete the plot
                    </button>
                    <button
                      type="button"
                      className="ghost small danger"
                      onClick={() => {
                        onUpdate((current) => removeTrack(current, track.id));
                        setAsking(false);
                      }}
                    >
                      Delete the writing too
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ghost small danger"
                    onClick={() => {
                      onUpdate((current) => dissolveTrack(current, track.id));
                      setAsking(false);
                    }}
                  >
                    Delete
                  </button>
                )}
                <button type="button" className="ghost small" onClick={() => setAsking(false)}>
                  Keep
                </button>
              </span>
            </div>
          ) : null}
          <textarea
            rows={2}
            aria-label={`What ${track.name} is about`}
            placeholder="What this thread of the story is about"
            value={track.description}
            onChange={(event) => onUpdate((current) => updateTrack(current, track.id, { description: event.target.value }))}
          />
        </li>
  );
}

/**
 * A note, on the shelf (addendum 24 §5g).
 *
 * The delete was §5a's, in the detail beside *Put away*, which is the
 * placement §5d moved every other list away from — a writer looking at the
 * note they want rid of is looking at the **card**. So the × is on the card,
 * waiting until it is pointed at, and *Put away* stays in the detail for the
 * setups' reason: archiving is a decision about the work.
 */
function NoteCard({
  file,
  item,
  colour,
  folderName,
  chosen,
  onChoose,
  onOpen,
  onDragStart,
  onDragEnd,
  onUpdate,
}: {
  file: ProjectFile;
  item: ResearchItem & { usage?: string };
  colour: string | undefined;
  folderName: string;
  chosen: boolean;
  onChoose(): void;
  onOpen(): void;
  onDragStart(): void;
  onDragEnd(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <li>
      <div className="research-card-wrap">
        <button
          type="button"
          className={chosen ? 'research-card selected' : 'research-card'}
          style={{ borderLeftColor: colour }}
          aria-current={chosen ? 'true' : undefined}
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onClick={onChoose}
          onDoubleClick={onOpen}
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
            {folderName}
            {item.tags.length > 0 ? ` · ${item.tags.join(', ')}` : ''}
            {item.archived ? ' · put away' : ''}
          </span>
        </button>
        <button
          type="button"
          className="ghost small danger card-x"
          aria-label={`Delete ${item.title}`}
          title={`Delete ${item.title}`}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      </div>
      {asking ? (
        <div className="row-ask">
          <span className="muted small">{describeDeleting(file, { kind: 'researchItem', id: item.id as string })}</span>
          <span className="row-ask-buttons">
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onUpdate((current) => deleteResearchItem(current, item.id));
                setAsking(false);
              }}
            >
              Delete
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </span>
        </div>
      ) : null}
    </li>
  );
}
