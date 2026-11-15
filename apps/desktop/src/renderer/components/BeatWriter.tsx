import { BookHeadingLine } from './BookHeadingLine';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  findPassageInDraft,
  countWords,
  draftText,
  draftsOf,
  findTrack,
  findUnit,
  newId,
  pageBreaks,
  noteUsed,
  markupNotesOf,
  markupNotePlace,
  setMarkAddressed,
  isProseFormat,
  printsBookHeadings,
  sectionHeading,
  subsectionHeading,
  beatsForUnit,
  updateUnit,
  reformatUntyped,
  startRevision,
  switchRevision,
  nounsFor,
  updateBeat,
  type Beat,
  type BeatId,
  type BeatRevisionId,
  type ManuscriptElementId,
  type ProjectFile,
  type ManuscriptSegment,
  notesForBeat,
  notesForSection,
  rowsBeneathBeat,
  placeNoteText,
  type ResearchItem,
  type ResearchItemId,
  addMarkupDraft,
  archiveRevision,
  editDraft,
  isMarkupDraft,
  addPassage,
  canAddPassage,
  nudgeItem,
  isInstructional,
  passageBeatIds,
  promoteRow,
  subsectionOfPassage,
  updateItem,
  type OutlineItem,
} from '@vcwriter/domain';
import { ElementNotes } from './ElementNotes';
import { MarkupNotes } from './MarkupNotes';
import type { MarkupPlace } from './BeatBody';
import { NoteRewrite } from './NoteRewrite';
import { BeatBody } from './BeatBody';
import { MarkedDraft, MarkedLine, MarkingPage } from './MarkedDraft';
import { ManuscriptDataLists } from './ManuscriptDataLists';
import { usePreference } from '../use-split';
import { useRoom } from '../room';
import { taskFrom } from './RoomBar';

const NEW_REVISION = '__new__';
const WORKING = '__working__';

/** What the page can be scaled to, as a fraction of its true printed size. */
const ZOOMS = [0.75, 0.85, 1, 1.15, 1.35, 1.6];

export interface BeatWriterProps {
  file: ProjectFile;
  beat: Beat;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Writing in a beat makes it the selection, so the rest of the app follows. */
  onSelect?(beatId: BeatId): void;
  /** Absent in a window of its own, where the window's own close does it. */
  onClose?(): void;
  /** Offered where it can be honoured: the workspace, not a satellite window. */
  onPopOut?(): void;
  /**
   * Grab the bar and move the screen (addendum 02 §6d, from Ken: *when you
   * open a beat you should be able to grab the top bar and drag it around*).
   *
   * Absent in a window of its own, where there is nothing to move it within
   * and the window's own title bar already does it — which is also the answer
   * to *drag it to another screen*, the ⧉ beside this making that window.
   */
  onGrab?(event: ReactPointerEvent<HTMLElement>): void;
  /**
   * **Go to the Outliner** at this beat's row (from Ken, 13 November). Absent
   * where there is no Outliner to open, or the beat has no row in it.
   */
  onGoToOutline?(): void;
  /** **Go to the Sculptor** at this beat's card; null greys it, where the beat is on no board (from Ken, 14 November). */
  onGoToSculptor?: (() => void) | null;
  /** Open another beat in this screen: a passage from its subsection's list, or back to the subsection. */
  onOpenBeat?(beatId: BeatId): void;
}

/**
 * The writing screen (addendum 02 §7): one beat, a full page.
 *
 * This is where the writing is done, and it is a page — 8½ by 11 at the
 * margins a script is actually printed at, so a line that will break on
 * paper breaks here, and the rules across it are the printed page breaks
 * from the same paginator the PDF uses. The element flow is the one every
 * screenwriter has in their hands already: Return gives the element that
 * conventionally follows, Tab re-types the line you are on, cues and
 * sluglines complete from what the script already knows.
 *
 * There is no sidebar. The bar across the top carries the three things that
 * belong to the beat as a whole: its **name**, centred; the **version** it
 * is being written in; and whether it is **in the script**. Everything else
 * about the beat — colour, status, links, what it sets up — is the
 * inspector's business, and stays out of the way of the page.
 */
export function BeatWriter({ file, beat, onUpdate, onSelect, onClose, onPopOut, onGrab, onGoToOutline, onGoToSculptor, onOpenBeat }: BeatWriterProps) {
  const unit = findUnit(file, beat.unitId);
  /**
   * The notes for this beat, down the right (from Ken): those filed to it,
   * then those filed to its scene or section, each once; and the outline's
   * rows beneath it, which are written here rather than placed on the track.
   */
  const beatNotes = (() => {
    const mine = notesForBeat(file, beat.id as string);
    const seen = new Set(mine.map((one) => one.id as string));
    const scene = unit ? notesForSection(file, unit.id as string).filter((one) => !seen.has(one.id as string)) : [];
    return [...mine, ...scene];
  })();
  const beneath = rowsBeneathBeat(file, beat.id as string);
  /**
   * **Passages** (from Ken, 15 November): in a book, the rows beneath a
   * subsection are its passages, printed under it untitled. Listed beside the
   * page to rename, open, put in the page and add to; a passage's own screen
   * says whose it is and goes back to it.
   */
  const passageIds = passageBeatIds(file);
  const ownerSubsection = subsectionOfPassage(file, beat.id, passageIds);
  const passageList =
    isInstructional(file.project.format) && !passageIds.has(beat.id as string)
      ? {
          rename: (row: OutlineItem, title: string) => onUpdate((current) => updateItem(current, row.outlineId, row.id, { title })),
          open: (row: OutlineItem) => {
            if (row.boundBeatId) onOpenBeat?.(row.boundBeatId);
          },
          place: (row: OutlineItem) => onUpdate((current) => promoteRow(current, row.outlineId, row.id).file),
          // Reordered among the passages beside it, in the outline — and the
          // page follows, as every move in the outline does (from Ken, 15
          // November: *those passages can be reordered within the subsection
          // from the right menu*).
          canMove: (row: OutlineItem, direction: -1 | 1) => {
            const siblings = beneath.filter((one) => one.parentId === row.parentId);
            const at = siblings.findIndex((one) => one.id === row.id);
            return at + direction >= 0 && at + direction < siblings.length;
          },
          move: (row: OutlineItem, direction: -1 | 1) => {
            const siblings = beneath.filter((one) => one.parentId === row.parentId);
            const at = siblings.findIndex((one) => one.id === row.id);
            if (at + direction < 0 || at + direction >= siblings.length) return;
            onUpdate((current) => nudgeItem(current, row.outlineId, row.id, direction));
          },
          depthOf: (row: OutlineItem) => {
            let depth = 0;
            for (let at = row.parentId; at; ) {
              const parent = beneath.find((one) => one.id === at);
              if (!parent) break;
              depth += 1;
              at = parent.parentId;
            }
            return depth;
          },
          ...(canAddPassage(file, beat.id)
            ? { add: () => onUpdate((current) => addPassage(current, beat.id)?.file ?? current) }
            : {}),
        }
      : undefined;
  const [rewritingNote, setRewritingNote] = useState<ResearchItemId | null>(null);
  /** The line the cursor was last in, where placed text goes. */
  const cursorLine = useRef<ManuscriptElementId | null>(null);
  /** The lines just placed from a note, drawn and dragged as one block. */
  const [placed, setPlaced] = useState<string[]>([]);
  const placeText = (note: ResearchItem): string | null => {
    const result = placeNoteText(file, note.id, beat.id, cursorLine.current);
    if (!result.ok) return result.why;
    onUpdate(() => result.file);
    setPlaced(result.elementIds as string[]);
    return null;
  };
  const track = unit ? findTrack(file, unit.trackId) : undefined;
  const [naming, setNaming] = useState(false);
  /**
   * **Notes is the list down the right** (from Ken, 13 November: *when you hit
   * notes, it just moves the main screen over… if there is a purpose for that,
   * explain it; if not, fix that*). It used to open a second panel of the
   * Outliner's plan beside the notes list that already shows the same notes,
   * squeezing the page between them; now the button and the list's own fold
   * are one switch, remembered on this computer.
   */
  const [planOpen, setPlanOpen] = usePreference('beatNotesOpen', true);
  const planCount = beatNotes.filter((note) => !noteUsed(file, note)).length;

  /**
   * **Markup notes** (from Ken, 13 November): every mark on this beat's
   * markup drafts, numbered, in a margin that opens and folds, each found on
   * the page as it reads now and circled with its number. Folding the margin
   * takes the circles off the page too.
   */
  const markupNotes = useMemo(() => markupNotesOf(beat), [beat]);
  const [markupOpen, setMarkupOpen] = usePreference('beatMarkupOpen', true);
  const [hideAddressed, setHideAddressed] = usePreference('markupHideAddressed', true);
  const markupFound = useMemo(
    () => markupNotes.map((note) => ({ note, place: markupNotePlace(beat.manuscript, note) })),
    [markupNotes, beat.manuscript],
  );
  const markupMissing = useMemo(
    () => new Set(markupFound.filter((one) => !one.place).map((one) => one.note.number)),
    [markupFound],
  );
  const markupPlaces = useMemo<MarkupPlace[]>(
    () =>
      markupOpen
        ? markupFound.flatMap(({ note, place }) =>
            place && !(hideAddressed && note.mark.addressed) ? [{ number: note.number, kind: note.mark.kind, ranges: place.ranges }] : [],
          )
        : [],
    [markupFound, markupOpen, hideAddressed],
  );
  const markupWaiting = markupNotes.filter((one) => !one.mark.addressed).length;
  /** Which draft is being read beside the one being written; null for none. */
  /**
   * The drafts read beside the working one, up to two (from Ken: *see, like,
   * three versions across the screen at a time, or two, or just the one*).
   * Empty is writing alone.
   */
  const [comparing, setComparingList] = useState<string[]>([]);
  /** Show one draft beside the working one, replacing what was there. */
  const setComparing = (id: string | null) => setComparingList(id ? [id] : []);
  /**
   * The room's master beside the draft, read only (addendum 07 §31; spec v1.1
   * §6.1). Offered only in a Writers Room window, where the bridge can read the
   * master; nothing here can write to it.
   */
  const readMaster = typeof window !== 'undefined' ? window.vcwriter?.roomMaster : undefined;
  const [masterOn, setMasterOn] = useState(false);
  /**
   * **The passage the task is about** (addendum 07 §37): opened from a task
   * that was given out by highlighting words in the room's Script screen, the
   * same words are lit in the writer's draft, and named above the page.
   */
  const room = useRoom();
  const taskKey = typeof window === 'undefined' ? null : taskFrom(window.location.search);
  const asked = taskKey?.startsWith('a:')
    ? (room.assignments.find((one) => `a:${one.id}` === taskKey && one.targetId === (beat.id as string) && one.passage) ?? null)
    : null;
  const passage = useMemo(
    () => (asked?.passage ? findPassageInDraft(beat.manuscript, asked.passage) : null),
    [asked?.passage, beat.manuscript],
  );
  const [passageShown, setPassageShown] = useState(true);
  const [masterBeat, setMasterBeat] = useState<{ label: string; manuscript: ManuscriptSegment | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!masterOn || !readMaster) return;
    let live = true;
    setMasterBeat(null);
    void readMaster.call(window.vcwriter, { withText: true }).then((result) => {
      if (!live) return;
      if (!result.ok || !result.data) {
        setMasterBeat({ label: '', manuscript: null, error: result.error ?? 'The master could not be read.' });
        return;
      }
      const theirs = (result.data.file as ProjectFile | null)?.beats.find((one) => one.id === beat.id) ?? null;
      setMasterBeat({ label: result.data.label, manuscript: theirs?.manuscript ?? null, error: null });
    });
    return () => {
      live = false;
    };
  }, [masterOn, readMaster, beat.id]);
  /** How many pages stand beside the one being written. */
  const beside = comparing.length + (masterOn ? 1 : 0);
  /** Where the writing screen's own tools go — see the slot below. */
  const [tools, setTools] = useState<HTMLDivElement | null>(null);
  const [fromCopy, setFromCopy] = useState(false);
  const [name, setName] = useState('');
  const [zoom, setZoom] = usePreference('writerZoom', 1);
  /** Marking up the working draft (addendum 07 §27.3); off is writing as usual. */
  const [marking, setMarking] = useState(false);
  /** Whoever marks up on this computer, so their marks carry their name. */
  const [markerName, setMarkerName] = usePreference('markupName', '');

  // Where the printed pages break, from the one paginator the exports use.
  // Only this beat's elements are in it; the rest of the map costs nothing.
  // Not on a book: its writing screen is the manuscript, and page rules read
  // as numbered paragraphs (from Ken). Pages are Preview's and Layout's.
  const breaks = useMemo(() => (isProseFormat(file.project.format) ? null : pageBreaks(file)), [file]);
  /** A book's headings over the writing, as the book prints them. */
  const headed = printsBookHeadings(file);
  const firstInUnit = beatsForUnit(file, beat.unitId)[0]?.id === beat.id;

  // The tool offers itself only when it would actually change something, so
  // a beat that is already a script leaves it greyed out.
  const reformatted = useMemo(
    () => reformatUntyped(beat.manuscript.elements, file.project.format),
    [beat.manuscript.elements, file.project.format],
  );
  const untyped =
    reformatted.length !== beat.manuscript.elements.length ||
    reformatted.some((part, position) => {
      const original = beat.manuscript.elements[position];
      return !original || original.type !== part.type || original.text !== part.text;
    });

  /**
   * Re-read the beat's plain lines as a script, keeping every line that was
   * deliberately styled exactly as it is — and keeping the identity of the
   * elements the text came from, so nothing hanging off them is lost.
   */
  const reformat = () => {
    onUpdate((current) => {
      const beatNow = current.beats.find((candidate) => candidate.id === beat.id);
      if (!beatNow) return current;
      const source = beatNow.manuscript.elements;
      const elements = reformatUntyped(source, current.project.format).map((part) => {
        const original = part.from === undefined ? undefined : source[part.from];
        return original
          ? { ...original, type: part.type, text: part.text }
          : {
              id: newId<ManuscriptElementId>(),
              type: part.type,
              text: part.text,
              characterId: null,
              attributes: {},
            };
      });
      return updateBeat(current, beat.id, { manuscript: { elements } });
    });
  };

  /** The draft being read alongside, resolved to its text. */
  const against = useMemo(
    () =>
      comparing.flatMap((id) => {
        const revision = beat.revisions.find((candidate) => (candidate.id as string) === id);
        const manuscript = draftText(beat, id);
        return revision && manuscript ? [{ name: revision.name, manuscript, revision }] : [];
      }),
    [beat, comparing],
  );

  const chooseVersion = (value: string) => {
    if (value === NEW_REVISION) {
      setName(`Draft ${beat.revisions.length + 2}`);
      setFromCopy(false);
      setNaming(true);
      return;
    }
    if (value === WORKING) return;
    // A markup draft, or anything in the archive, is read beside the working
    // draft rather than swapped in (addendum 07 §27.2): it is the record of
    // what was said, and the writing goes on in the working draft.
    const picked = beat.revisions.find((revision) => (revision.id as string) === value);
    if (picked && (isMarkupDraft(picked) || picked.archived)) {
      setComparing(value);
      if (zoom > 0.85) setZoom(0.75);
      return;
    }
    onUpdate((current) => switchRevision(current, beat.id, value as BeatRevisionId));
  };

  // §14: a writer in Book Mode is never made to work around Beat or Script.
  const nouns = nounsFor(file.project.format);
  return (
    <>
      <ManuscriptDataLists file={file} />

      <header
        className={onGrab ? 'writer-bar bar-grab' : 'writer-bar'}
        style={{ borderLeftColor: beat.color ?? track?.color }}
        // The bar is a handle only where it can be (absent in the beat's own
        // window). That a press on the name, the draft or a switch is that
        // control's and never a drag is `useMovedDialog`'s rule, said once
        // for every bar rather than written out on each.
        {...(onGrab ? { onPointerDown: onGrab } : {})}
      >
        <span className="writer-caption muted">{nouns.sub} name</span>
        <input
          className="writer-name"
          aria-label={`${nouns.sub} name`}
          placeholder={`Name this ${nouns.sub.toLowerCase()}`}
          value={beat.title}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
        />
        <div className="writer-tools">
          {/* **The beat's plan beside it** (from Ken): the notes, characters
              and ideas the Outliner holds under this beat, in a side panel
              that collapses. */}
          <button
            type="button"
            className={planOpen ? 'ghost small active' : 'ghost small'}
            aria-pressed={planOpen}
            title={planOpen ? 'Fold the notes list away' : 'Show the notes filed to this part, down the right'}
            onClick={() => setPlanOpen(!planOpen)}
          >
            Notes{planCount > 0 ? ` (${planCount})` : ''}
          </button>
          {onGoToOutline ? (
            <button
              type="button"
              className="ghost small"
              title="Open the Outliner at this point"
              onClick={onGoToOutline}
            >
              Outliner ▸
            </button>
          ) : null}
          {markupNotes.length > 0 ? (
            <button
              type="button"
              className={markupOpen ? 'ghost small active' : 'ghost small'}
              aria-pressed={markupOpen}
              title={markupOpen ? 'Hide the markup notes and their numbers' : 'Show the markup notes, numbered, in the margin'}
              onClick={() => setMarkupOpen(!markupOpen)}
            >
              Markup notes{markupWaiting > 0 ? ` (${markupWaiting})` : ''}
            </button>
          ) : null}
          {/* Mark up this draft (from Ken: *a markup ability … so you can mark
              up your own work, or someone that opens it can*). The page turns
              into a copy that can be marked and not typed in. */}
          <button
            type="button"
            className={marking ? 'ghost small active' : 'ghost small'}
            aria-pressed={marking}
            title={marking ? 'Back to writing' : 'Mark up this draft: highlight, strike, underline, note or suggest'}
            onClick={() => setMarking(!marking)}
          >
            Mark up
          </button>
          <label className="revision-picker">
            <span className="muted">Draft</span>
            <select aria-label="Draft" value={WORKING} onChange={(event) => chooseVersion(event.target.value)}>
              <option value={WORKING}>{beat.revisionName}</option>
              {beat.revisions
                .filter((revision) => !revision.archived && !isMarkupDraft(revision))
                .map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {revision.name}
                  </option>
                ))}
              {/* Markups brought in from the room, named for the writer ("MA
                  markup"); choosing one reads it beside this draft. */}
              {beat.revisions.some((revision) => !revision.archived && isMarkupDraft(revision)) ? (
                <optgroup label="Markups">
                  {beat.revisions
                    .filter((revision) => !revision.archived && isMarkupDraft(revision))
                    .map((revision) => (
                      <option key={revision.id} value={revision.id}>
                        {revision.name} ✎
                      </option>
                    ))}
                </optgroup>
              ) : null}
              {beat.revisions.some((revision) => revision.archived) ? (
                <optgroup label="Archive">
                  {beat.revisions
                    .filter((revision) => revision.archived)
                    .map((revision) => (
                      <option key={revision.id} value={revision.id}>
                        {revision.name}
                      </option>
                    ))}
                </optgroup>
              ) : null}
              <option value={NEW_REVISION}>New draft…</option>
            </select>
          </label>

          {/* Two drafts side by side: the one being written, and one to read
              against it. Only offered when there is another to read. */}
          {beat.revisions.length > 0 ? (
            <label className="check" title="Read another draft beside this one">
              <input
                type="checkbox"
                aria-label="Compare"
                checked={comparing.length > 0}
                onChange={(event) => {
                  const on = event.target.checked;
                  setComparing(on ? (beat.revisions[0]?.id as string) : null);
                  // Two pages need two pages' worth of room; the page size
                  // comes down to fit and the writer can put it back.
                  if (on && zoom > 0.85) setZoom(0.75);
                }}
              />
              <span>Compare</span>
            </label>
          ) : null}

          {comparing.map((id, index) => (
            <label key={index} className="revision-picker">
              <span className="muted">{index === 0 ? 'Against' : 'And'}</span>
              <select
                aria-label={index === 0 ? 'Draft to compare' : 'Third draft to compare'}
                value={id}
                onChange={(event) =>
                  setComparingList((now) =>
                    event.target.value === '' ? now.filter((_, at) => at !== index) : now.map((one, at) => (at === index ? event.target.value : one)),
                  )
                }
              >
                {index > 0 ? <option value="">— none —</option> : null}
                {beat.revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {revision.name}
                    {isMarkupDraft(revision) ? ' ✎' : ''}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {/* Three across: the working draft and two others. */}
          {comparing.length === 1 && beat.revisions.length > 1 ? (
            <button
              type="button"
              className="ghost small"
              title="Put a third draft across the page"
              onClick={() => {
                const next = beat.revisions.find((revision) => !comparing.includes(revision.id as string));
                if (next) setComparingList((now) => [...now, next.id as string]);
                if (zoom > 0.6) setZoom(0.55);
              }}
            >
              + Third
            </button>
          ) : null}
          {readMaster ? (
            <label className="check" title="Read the room’s master of this beat beside your draft. The master cannot be changed from here.">
              <input
                type="checkbox"
                aria-label="View master"
                checked={masterOn}
                onChange={(event) => {
                  setMasterOn(event.target.checked);
                  if (event.target.checked && zoom > 0.85) setZoom(0.75);
                }}
              />
              <span>View master</span>
            </label>
          ) : null}
          <label className="check" title={`Off: the ${nouns.sub.toLowerCase()} keeps its text and leaves the ${nouns.manuscript.toLowerCase()}`}>
            <input
              type="checkbox"
              aria-label="In script"
              checked={beat.inScript}
              onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { inScript: event.target.checked }))}
            />
            <span>In {nouns.manuscript.toLowerCase()}</span>
          </label>
          {onPopOut ? (
            <button
              type="button"
              className="ghost"
              aria-label={`Open this ${nouns.sub.toLowerCase()} in its own window`}
              title={`Open this ${nouns.sub.toLowerCase()} in its own window — put it on another monitor`}
              onClick={onPopOut}
            >
              ⧉
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
      </header>

      {naming ? (
        <form
          className="revision-naming"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate((current) => startRevision(current, beat.id, name, { from: fromCopy ? 'copy' : 'blank' }));
            setNaming(false);
            setName('');
          }}
        >
          <span className="muted">
            {beat.revisionName} is kept whole, and the page clears: a new draft is the scene written again.
          </span>
          <input aria-label="New draft name" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          <label className="check" title="Start from what is there instead of a blank page">
            <input
              type="checkbox"
              aria-label="Start from a copy"
              checked={fromCopy}
              onChange={(event) => setFromCopy(event.target.checked)}
            />
            <span>Start from a copy</span>
          </label>
          <button type="submit">Start</button>
          <button type="button" className="ghost" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      {/* The writing screen's own tools, off the paper (§8c, from Ken: *move
          the dictate button to just below where it says in script… but off of
          the page. I don't want distractions when people are writing*).

          It is a **slot** rather than a second dictation control: `BeatBody`
          still owns every part of hearing and laying words in, and renders its
          button through here, so there is one implementation standing in the
          chrome instead of on the manuscript. Where nothing is put in it the
          strip collapses to nothing. */}
      <div className="writer-tools" ref={setTools} />

      {asked?.passage && passageShown ? (
        <div className="task-passage-bar" role="note">
          <span className="task-passage-label">Your task is about</span>
          <q className="task-passage-quote">{asked.passage.quote}</q>
          {asked.note.trim() ? <span className="task-passage-ask">— {asked.note.trim()}</span> : null}
          <span className="muted small">
            {passage?.how === 'exact'
              ? 'Lit on the page.'
              : passage?.how === 'moved'
                ? 'Lit where it is now on the page.'
                : passage?.how === 'lines'
                  ? 'Its lines are lit; the words have changed since.'
                  : 'No longer in this draft.'}
          </span>
          {passage ? (
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                document
                  .querySelector(`.writer-sheet [data-element-id="${passage.ranges[0]!.elementId}"]`)
                  ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }
            >
              Show
            </button>
          ) : null}
          <button type="button" className="ghost small" aria-label="Hide the passage" onClick={() => setPassageShown(false)}>
            Hide
          </button>
        </div>
      ) : null}

      <div
        className={[
          beside > 0 ? 'writer-body comparing' : 'writer-body',
          beside > 1 ? 'three-across' : '',
          beside === 0 && markupNotes.length > 0 ? 'with-markup' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* The page itself, at the size it prints, scaled by the zoom. */}
        <div
          className="writer-sheet"
          style={{ '--page-zoom': zoom } as React.CSSProperties}
          // Where the cursor is, so a note's text can be placed there.
          onFocusCapture={(event) => {
            const line = (event.target as HTMLElement).closest('[data-element-id]');
            if (line) cursorLine.current = line.getAttribute('data-element-id') as ManuscriptElementId;
          }}
        >
          {beside > 0 ? <p className="writer-column-name muted">{beat.revisionName} — writing</p> : null}
          {headed && unit && firstInUnit ? (
            <BookHeadingLine
              heading={sectionHeading(file, unit)}
              untitled="Untitled section"
              onToggle={(shown) => onUpdate((current) => updateUnit(current, unit.id, { headingShown: shown }))}
            />
          ) : null}
          {ownerSubsection ? (
            <p className="passage-of muted small">
              A passage of <strong>{ownerSubsection.title || 'its subsection'}</strong> — printed under it with no heading.
              {onOpenBeat ? (
                <button type="button" className="ghost small" onClick={() => onOpenBeat(ownerSubsection.id)}>
                  ‹ Back to the subsection
                </button>
              ) : null}
            </p>
          ) : null}
          {headed && !ownerSubsection ? (
            <BookHeadingLine
              heading={subsectionHeading(file, beat)}
              untitled="Untitled subsection"
              onToggle={(shown) => onUpdate((current) => updateBeat(current, beat.id, { headingShown: shown }))}
            />
          ) : null}
          {marking ? (
            <MarkingPage
              manuscript={beat.manuscript}
              name={markerName}
              onName={setMarkerName}
              onCancel={() => setMarking(false)}
              onSave={(marks) => {
                onUpdate((current) => addMarkupDraft(current, { beatId: beat.id as string, marks, markedBy: markerName }));
                setMarking(false);
                // The marks come back as markup notes in the margin, numbered
                // on the page, while the writing goes on.
                setMarkupOpen(true);
              }}
            />
          ) : null}
          {marking ? null : <BeatBody
            file={file}
            beat={beat}
            breaks={breaks}
            onUpdate={onUpdate}
            onActivate={() => onSelect?.(beat.id)}
            // One beat, being written: the place dictation belongs (spec §9).
            dictation
            dictationSlot={tools}
            // **How the writing is set** (addendum 02 §19a, from Ken: *put a
            // toolbar on the top of the beats screen*). The writing screen is
            // where somebody sets a paragraph; the Script draws every beat at
            // once, and a row of buttons over each would be the distraction
            // §8c took the Dictate button off the page to avoid.
            toolbar
            movable
            placedBlock={placed}
            taskPassage={passageShown ? passage : null}
            markupPlaces={markupPlaces}
            menuExtra={[
              {
                label: 'Go to the Outliner',
                note: 'Opens the Outliner at this point.',
                disabled: onGoToOutline ? null : 'Not in the outline yet',
                onPick: () => onGoToOutline?.(),
              },
              {
                label: 'Go to the Sculptor',
                note: 'Opens the Sculptor at this card.',
                disabled: onGoToSculptor ? null : 'Not in the Sculptor yet',
                onPick: () => onGoToSculptor?.(),
              },
            ]}
          />}
        </div>

        {/* The drafts beside the working one. Each is a draft of its own, so
            typing in one never touches another (from Ken: *we need to have
            editing ability right in there*). A markup draft is the record of
            what was said and is read, not written in. */}
        {against.map((one) => (
          <div
            key={one.revision.id}
            // A markup is read; a draft beside the working one is written in,
            // and looks it.
            className={isMarkupDraft(one.revision) ? 'writer-sheet reading' : 'writer-sheet compared'}
            style={{ '--page-zoom': zoom } as React.CSSProperties}
          >
            <p className="writer-column-name muted">
              {one.name} — {isMarkupDraft(one.revision) ? 'markup' : 'editing'}
            </p>
            {isMarkupDraft(one.revision) ? (
              <MarkedDraft
                revision={one.revision}
                onArchive={(archived) => onUpdate((current) => archiveRevision(current, beat.id, one.revision.id, archived))}
              />
            ) : (
              <BeatBody
                file={file}
                beat={{ ...beat, manuscript: one.manuscript, revisions: [] }}
                onUpdate={(change) => onUpdate((current) => editDraft(current, beat.id, one.revision.id, change))}
              />
            )}
          </div>
        ))}
        {masterOn ? (
          <div className="writer-sheet reading master-beside" style={{ '--page-zoom': zoom } as React.CSSProperties}>
            <p className="writer-column-name muted">
              Master{masterBeat?.label ? ` — ${masterBeat.label}` : ''} — read only
            </p>
            {masterBeat === null ? (
              <p className="muted small">Reading the master…</p>
            ) : masterBeat.error ? (
              <p className="error small">{masterBeat.error}</p>
            ) : masterBeat.manuscript ? (
              <div className="marked-draft-page">
                {masterBeat.manuscript.elements.map((element) => (
                  <MarkedLine key={element.id as string} id={element.id as string} type={element.type} text={element.text} marks={[]} />
                ))}
              </div>
            ) : (
              <p className="muted small">The master has no {nouns.sub.toLowerCase()} by this name yet: this one is new in your draft.</p>
            )}
          </div>
        ) : null}
        {beside === 0 && markupNotes.length > 0 && !marking ? (
          <MarkupNotes
            notes={markupNotes}
            open={markupOpen}
            onOpenChange={setMarkupOpen}
            hideAddressed={hideAddressed}
            onHideAddressed={setHideAddressed}
            missing={markupMissing}
            onAddressed={(note, addressed) =>
              onUpdate((current) => setMarkAddressed(current, beat.id as string, note.revisionId, note.mark.id, addressed))
            }
            onShow={(note) =>
              document
                .querySelector(`.writer-sheet [data-mark-number="${note.number}"]`)
                ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }
          />
        ) : null}
        {beside === 0 && !marking ? (
          <ElementNotes
            file={file}
            notes={beatNotes}
            rows={beneath}
            {...(passageList ? { passages: passageList } : {})}
            placeWord="place its text where your cursor is"
            onOpen={(note) => setRewritingNote(note.id)}
            open={planOpen}
            onOpenChange={setPlanOpen}
          />
        ) : null}
      </div>
      <NoteRewrite
        file={file}
        item={rewritingNote ? (file.researchItems.find((one) => one.id === rewritingNote) ?? null) : null}
        currentBeatId={beat.id}
        onClose={() => setRewritingNote(null)}
        onUpdate={onUpdate}
        onPlaceText={placeText}
      />

      <footer className="writer-status muted">
        <span>
          {unit ? `${unit.sequenceLabel || unit.kind} ${unit.title || ''}`.trim() : ''}
          {track ? ` · ${track.name}` : ''}
        </span>
        <span>
          {countWords(beat.manuscript)} words
          {beat.inScript ? '' : ' · not in the script'}
        </span>
        <span className="writer-actions">
          {/* Text that came in as plain text, read as a script (§7.1). It
              only ever re-types lines nobody styled, so it is safe to press
              and pressing it twice does nothing further. */}
          <button
            type="button"
            className="ghost"
            disabled={!untyped}
            title={untyped ? 'Read the plain lines as sluglines, cues and dialogue' : 'Nothing left to reformat'}
            onClick={reformat}
          >
            Reformat
          </button>
          <label className="writer-zoom">
            <span className="muted">Page</span>
            <select aria-label="Page size" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {ZOOMS.map((step) => (
                <option key={step} value={step}>
                  {Math.round(step * 100)}%
                </option>
              ))}
            </select>
          </label>
          <span>Return for the next element · Tab to change its type</span>
        </span>
      </footer>
    </>
  );
}
