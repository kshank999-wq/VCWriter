import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RoomSave } from './RoomSave';
import { RoomFormat } from './RoomFormat';
import {
  addSortCategory,
  addSource,
  beginSession,
  cardsIn,
  categoryRemoval,
  extractOffer,
  extractToCategory,
  fileOnShelf,
  mergeCards,
  moveCard,
  placeCard,
  passageOf,
  piecesOf,
  progressOf,
  referenceCard,
  removeSortCategory,
  researchCategoriesInOrder,
  searchSession,
  approvePlacements,
  describeSuggestions,
  placementKey,
  sayWhy,
  scoreCategories,
  sendCount,
  sendLadder,
  sendRows,
  sendToOutliner,
  sessionCards,
  sessionProgress,
  shelfOffer,
  sortCategories,
  sortingSessions,
  sittingName,
  sittingsStanding,
  everyNote,
  extractToOutline,
  outlineDropOffer,
  contentsShelf,
  describeContentsRow,
  placeKey,
  type ContentsRow,
  sourcesOf,
  mergeIdeas,
  suggestCategories,
  suggestPlacements,
  whatToRead,
  worthSaying,
  splitCard,
  unreferenceCard,
  unsortedOf,
  updateResearchCategory,
  updateResearchItem,
  whereFrom,
  nounsFor,
  NOTE_SOURCE_WORDS,
  type NoteSession,
  type NoteSessionId,
  type NoteSource,
  type NoteSourceId,
  type ProjectFile,
  type ResearchCategory,
  type ResearchCategoryId,
  type ResearchItem,
  type ResearchItemId,
  type CategoryIdea,
  type Placement,
  type SendRow,
  type SaveKind,
} from '@vcwriter/domain';
import { PopOutButton } from './PopOutButton';
import { usePreference, useSplit } from '../use-split';
import { NOTE_SOURCE_ACCEPT, noteSourceRefusal, readSourceText } from '../read-notes';
import { dictationKind, startDictation, systemDictationKey, type DictationSession } from '../dictation';

/**
 * The Note Sorter (addendum 26), the seventh room: read, highlight, drag, drop.
 *
 * Four rules shape the screen, and three of them come from the handoff.
 *
 * **No dialog while sorting.** A passage dropped on a category becomes a card
 * at once, named from its first words; renaming is Refine's business. A writer
 * going through twenty pages cannot be asked to name each one on the way past.
 *
 * **The press is the act and the drag is the convenience.** A drag is the
 * gesture the handoff describes and it is unreachable by keyboard and easy to
 * miss, so every category is a *button* that files the live selection, with
 * `extractOffer`'s sentence in its title — and the drag lands on the same
 * button. `carry-work.ts`' rule holds: the drop is claimed by **a MIME type of
 * its own**, so dragging text anywhere else in the program is left alone.
 *
 * **What is sorted is read, never marked.** The left panel is `piecesOf`, and
 * the four display modes — everything, grey, hide, unsorted only — are four ways
 * of drawing one list, so none of them can disagree with the others about what
 * has been dealt with and none of them changes a character of the source.
 *
 * And **nothing is created to draw the room** (addendum 25 §4f): a project with
 * no sitting opens on Gather with somewhere to put material, and the first thing
 * put in begins the sitting. A room that made a record to have something to show
 * would leave one behind every time somebody looked.
 */

type Tab = 'gather' | 'sort' | 'refine' | 'send';

/**
 * The four steps, as the handoff draws them: a numeral in a ring and a name.
 *
 * The number and the label are **two elements rather than one string**, which
 * is the whole of why the ring can be drawn — and it is what lets the current
 * step fill its numeral and underline its label without either of them being
 * spelled out in the markup twice.
 */
const TABS: ReadonlyArray<{ key: Tab; step: string; label: string }> = [
  { key: 'gather', step: '1', label: 'Gather' },
  { key: 'sort', step: '2', label: 'Sort' },
  { key: 'refine', step: '3', label: 'Refine' },
  { key: 'send', step: '4', label: 'Send to Outliner' },
];

/** The handoff's four ways to put material in, plus the loud fifth. */
type WayIn = 'file' | 'paste' | 'typed' | 'notes' | 'dictation';

const WAYS_IN: ReadonlyArray<{ key: WayIn; glyph: string; label: string; said: string }> = [
  { key: 'file', glyph: '⬓', label: 'Import a file', said: 'Word, text, Markdown or a PDF. Drop it here or browse.' },
  { key: 'paste', glyph: '❐', label: 'Paste text', said: 'From an email, a web page, anywhere.' },
  { key: 'typed', glyph: '✎', label: 'Type directly', said: 'A blank page that becomes a source.' },
  { key: 'notes', glyph: '☰', label: 'VC Writer notes', said: 'Research notes, old outlines and scene notes, sorted again.' },
];

/** The mockup's type icon on a source row. */
const SOURCE_GLYPHS: Record<string, string> = {
  file: '⬓',
  paste: '❐',
  typed: '✎',
  notes: '☰',
  dictation: '●',
};

const countWords = (text: string): number => text.split(/\s+/).filter((one) => one.length > 0).length;

const countParagraphs = (text: string): number =>
  text.split(/\n\s*\n/).filter((one) => one.trim().length > 0).length;

/**
 * The outline's own numbers over the rows that are going (§16b).
 *
 * A **reading** rather than a stored figure, like everything else in this
 * module: unticking a category renumbers what is left with nothing run. A card
 * gets no number, because an attached note carries none in the Outliner and a
 * number here would be a promise the other room does not keep.
 */
const numberRows = (rows: readonly SendRow[]): { row: SendRow; number: string }[] => {
  const counters: number[] = [];
  return rows.map((row) => {
    if (row.kind === 'card') return { row, number: '' };
    counters.length = row.depth + 1;
    counters[row.depth] = (counters[row.depth] ?? 0) + 1;
    return { row, number: counters.map((one) => one ?? 1).join('.') };
  });
};

/** The bars of the handoff's waveform. Fixed heights: see the comment at it. */
const WAVE = [8, 20, 32, 16, 26, 12, 36, 22, 10, 28, 18, 6, 24, 30, 14, 20, 34, 11];

/** What is shown of a source (§7). A view setting, and never the text itself. */
type Display = 'all' | 'grey' | 'hide' | 'unsorted';

const DISPLAYS: ReadonlyArray<{ key: Display; label: string; hint: string }> = [
  { key: 'all', label: 'Everything', hint: 'The whole source, sorted and not' },
  { key: 'grey', label: 'Grey sorted', hint: 'What is dealt with, greyed out' },
  { key: 'hide', label: 'Hide sorted', hint: 'What is left, with a mark where the rest was' },
  { key: 'unsorted', label: 'Unsorted only', hint: 'What is left, run together' },
];

/** The colours a category may be given (§8). The writer's, and optional. */
const COLOURS = ['#C9A45C', '#D9607A', '#E08A5A', '#4FA39A', '#8FA8C4', '#9A7FC0', '#6FAE5E', '#6CC4D6'];

/** The drop this room claims, and nothing else in the program reads it. */
const PASSAGE = 'application/x-vcwriter-passage';
const CARD = 'application/x-vcwriter-sortcard';

/** The folder that is a reading rather than a place (§17). */
const ALL_NOTES = 'all-notes';

const percent = (share: number): string => `${Math.round(share * 100)}%`;

/**
 * **What the figure means, said beside it** (addendum 35 §4, from Ken: *on
 * each file, there's a zero percent, and I'm not sure what that means*).
 *
 * It is `coverageOf` — the share of a source that has become cards — and it
 * stood as a bare number on every file and every tab, where a percentage with
 * no noun could as easily have been how much is left, how sure the suggestions
 * are, or how far a file had uploaded. **A number on its own is a reading the
 * writer has to guess the subject of.**
 *
 * The word is **`sorted`**, which the room already uses for this exact state
 * in *Grey sorted*, *Hide sorted* and *Unsorted only* — so the three places
 * that show the figure say what the display modes say, rather than the
 * sitting's bar having a sentence of its own and the files having none.
 */
const sorted = (share: number): string => `${percent(share)} sorted`;

/** Said in full where there is room for it, and in a hover where there is not. */
const COVERAGE_IS =
  'How much of this has been through your hands: the share of it that has become cards. Nothing follows from the figure.';

/**
 * Where in the source a point in the drawn text is.
 *
 * Every piece is one span carrying its own `data-from`, and its only child is a
 * text node, so a point inside it is that offset plus the node offset. **The
 * markup needs nothing added** beyond the attribute the pieces already need to
 * be keyed by (addendum 20 §9d's join, one room over).
 */
const offsetAt = (node: Node | null, offset: number): number | null => {
  const element = node === null ? null : node.nodeType === 3 ? node.parentElement : (node as HTMLElement);
  const span = element?.closest('[data-from]') as HTMLElement | null;
  if (!span?.dataset.from) return null;
  return Number(span.dataset.from) + offset;
};

/** The passage the writer has highlighted in the source, as a range. */
const liveRange = (within: HTMLElement | null): { from: number; to: number } | null => {
  if (!within || typeof window === 'undefined' || !window.getSelection) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!within.contains(range.startContainer) || !within.contains(range.endContainer)) return null;
  const from = offsetAt(range.startContainer, range.startOffset);
  const to = offsetAt(range.endContainer, range.endOffset);
  if (from === null || to === null) return null;
  return { from: Math.min(from, to), to: Math.max(from, to) };
};

export interface NoteSorterWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPopOut?(): void;
  /**
   * Save the project somewhere else, from in here (addendum 29 §2). A room
   * covers the menu bar, so without this the two acts are reachable only by a
   * shortcut nobody can see. Absent where a host hands nothing down.
   */
  onSaveAs?(kind: SaveKind): void;

  /** In a window of its own there is nothing to uncover, so there is no ✕. */
  standalone?: boolean;
  /** The workspace's own undo, for the bar's button. Absent in a satellite. */
  onUndo?(): void;
  canUndo?: boolean;
}

export function NoteSorterWindow({
  file,
  open,
  onClose,
  onUpdate,
  onPopOut,
  onSaveAs,
  standalone = false,
  onUndo,
  canUndo,
}: NoteSorterWindowProps) {
  const sessions = sortingSessions(file);
  /** Each sitting with what is in it, which is what tells one from another (§17). */
  const standing = sittingsStanding(file);
  const [tab, setTab] = useState<Tab>('gather');
  const [sessionId, setSessionId] = useState<NoteSessionId | null>(null);
  const [sourceId, setSourceId] = useState<NoteSourceId | null>(null);
  const [cardId, setCardId] = useState<ResearchItemId | null>(null);
  const [categoryId, setCategoryId] = useState<ResearchCategoryId | null>(null);
  const [query, setQuery] = useState('');
  // A view setting the writer chooses once, so it is remembered per machine
  // rather than per sitting: how much of a page you want to see is a fact about
  // how you work, not about these notes.
  const [display, setDisplay] = usePreference<Display>('sorterDisplay', 'grey');
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [out, setOut] = useState<readonly string[]>([]);
  const [becomes, setBecomes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const chosen: NoteSession | null =
    sessions.find((one) => (one.id as string) === (sessionId as string)) ?? sessions.at(-1) ?? null;

  const sources = chosen ? sourcesOf(file, chosen.id) : [];
  const source: NoteSource | null =
    sources.find((one) => (one.id as string) === (sourceId as string)) ?? sources[0] ?? null;
  const categories = chosen ? sortCategories(file, chosen.id) : [];
  const pile = chosen ? unsortedOf(file, chosen.id) : null;
  const card: ResearchItem | null =
    (chosen ? sessionCards(file, chosen.id) : []).find((one) => (one.id as string) === (cardId as string)) ?? null;

  const split = useSplit({ key: 'sorterSplit', initial: 0.52, min: 320, reserve: 340, axis: 'x' });

  const say = (text: string): void => setMessage(text);
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  /**
   * The sitting, made if there is none.
   *
   * `beginArc`'s shape (addendum 25 §4f): it runs at the first **act** rather
   * than at the first look, so a writer who opens the room and closes it again
   * leaves nothing behind.
   */
  const ensure = (): NoteSessionId => {
    if (chosen) return chosen.id;
    let made: NoteSessionId | null = null;
    onUpdate((current) => {
      const begun = beginSession(current, `${current.project.title} · notes`);
      made = begun.session.id;
      return begun.file;
    });
    if (made) setSessionId(made);
    return made as unknown as NoteSessionId;
  };

  if (!open) return null;

  const progress = chosen ? sessionProgress(file, chosen.id) : { total: 0, sorted: 0, share: 0 };
  const hits = chosen && query.trim().length > 0 ? searchSession(file, chosen.id, query) : [];

  return (
    <div className="ns-room" role="dialog" aria-label="Note Sorter">
      <header className="ns-bar">
        {/* The handoff's lockup is `VC WRITER · NOTE SORTER`, and the first
            half is deliberately not repeated here: the application's own title
            bar is an inch above this one and already carries it, so a second
            copy inside a room would be branding the program to somebody who is
            using it. */}
        <span className="ns-brand">Note Sorter</span>
        <RoomFormat format={file.project.format} />
        {/* **The picker says what is in each one** (§17). It carried names
            alone, and the room named every sitting `<project> · notes`, so a
            writer who pressed *+ Sitting* was offered two identical rows over
            a screen reading *Nothing in yet* — measured, exactly Ken's *you
            can't see all your notes again*. `sittingsStanding` is the one
            reading, and what is in a sitting is what tells it from another. */}
        {standing.length > 1 ? (
          <select
            aria-label="Which sitting"
            value={(chosen?.id as string) ?? ''}
            onChange={(event) => {
              setSessionId(event.target.value as NoteSessionId);
              setSourceId(null);
              setCardId(null);
            }}
          >
            {standing.map((one) => (
              <option key={one.session.id as string} value={one.session.id as string}>
                {one.says}
              </option>
            ))}
          </select>
        ) : (
          <span className="ns-sitting">{chosen ? chosen.name : 'Nothing put in yet'}</span>
        )}

        <nav className="ns-tabs" role="tablist" aria-label="The four steps">
          {TABS.map((one) => (
            <button
              key={one.key}
              type="button"
              role="tab"
              aria-selected={tab === one.key}
              className={tab === one.key ? 'ns-tab on' : 'ns-tab'}
              onClick={() => setTab(one.key)}
            >
              <i aria-hidden="true">{one.step}</i>
              {one.label}
            </button>
          ))}
        </nav>

        <span className="toolbar-spacer" />

        {chosen ? (
          <span className="ns-progress" title="How much of this sitting has been through your hands">
            <span className="ns-progress-rail">
              <span className="ns-progress-run" style={{ width: percent(progress.share) }} />
            </span>
            {/* Progress, never a score (§11): what it answers is *have I been
                through all of this*, and nothing follows from the figure. */}
            <span className="small">{sorted(progress.share)}</span>
          </span>
        ) : null}

        <input
          type="search"
          className="ns-search"
          placeholder="Search notes and cards"
          aria-label="Search every source and every card"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {/* **A sitting is a batch of notes, and the button says so** (§17,
            from Ken: *there's something that says plus sitting. I'm not sure
            what that is*). It read *+ Sitting*, this room's own private word
            on a bar with nothing to explain it, and what it does — put the
            work in front of you away and open an empty screen — is the one act
            here a writer must not press by accident.

            Three things answer him and none of them is a warning: it is named
            for **what it makes**, it is named for the **day** so the one left
            behind can be found again (`sittingName`), and the press **says
            what just happened and where the old one went**, a screen going
            blank with nothing said being the whole of the report. */}
        <button
          type="button"
          className="tool"
          title="Start a separate batch of notes, with its own sources and folders. What is here now is kept and stays on the list at the top left."
          onClick={() => {
            let made: NoteSessionId | null = null;
            let leaving: string | null = chosen?.name ?? null;
            onUpdate((current) => {
              const begun = beginSession(current, sittingName(current));
              made = begun.session.id;
              return begun.file;
            });
            if (made) {
              setSessionId(made);
              setSourceId(null);
              setCardId(null);
              setTab('gather');
              say(
                leaving
                  ? `A separate batch of notes. “${leaving}” is still here — pick it from the list at the top left.`
                  : 'A separate batch of notes.',
              );
            }
          }}
        >
          + New batch
        </button>
        {/* Undo, which the handoff puts on this bar (spec §13).
            **Absent rather than dead in a window of its own**: the history is
            the workspace's, so over there the button would be a control that
            can only refuse, and addendum 26 §15 already records that gap
            rather than pretending it is closed. */}
        {onUndo ? (
          <button
            type="button"
            className="tool"
            onClick={onUndo}
            disabled={canUndo === false}
            title={canUndo === false ? 'Nothing to take back yet' : 'Take back the last thing you did'}
          >
            ↶ Undo
          </button>
        ) : null}
        {onPopOut ? <PopOutButton onPopOut={onPopOut} what="the Note Sorter" /> : null}
        {onSaveAs ? <RoomSave file={file} onSaveAs={onSaveAs} /> : null}
        {standalone ? null : (
          <button type="button" className="ghost" onClick={onClose} aria-label="Close the Note Sorter">
            ✕
          </button>
        )}
      </header>

      {hits.length > 0 ? (
        <div className="ns-hits">
          <span className="muted small">
            {hits.length === 1 ? '1 match' : `${hits.length} matches`} — in the raw notes and in the cards
          </span>
          <ul>
            {hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    if (hit.kind === 'source') {
                      setSourceId(hit.id as NoteSourceId);
                      setTab('sort');
                    } else {
                      setCardId(hit.id as ResearchItemId);
                      setTab('refine');
                    }
                  }}
                >
                  <span className={hit.kind === 'source' ? 'ns-hit-kind raw' : 'ns-hit-kind card'}>
                    {hit.kind === 'source' ? 'raw' : 'card'}
                  </span>
                  <strong>{hit.label}</strong>
                  <span className="muted small">…{hit.context}…</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? <p className="ns-said">{message}</p> : null}

      {tab === 'gather' ? (
        <GatherTab
          file={file}
          session={chosen}
          sources={sources}
          onUpdate={onUpdate}
          ensure={ensure}
          onSay={say}
          onSort={(id) => {
            setSourceId(id);
            setTab('sort');
          }}
        />
      ) : null}

      {tab === 'sort' ? (
        <SortTab
          file={file}
          session={chosen}
          sources={sources}
          source={source}
          categories={categories}
          display={display}
          split={split}
          onDisplay={setDisplay}
          onSource={setSourceId}
          onUpdate={onUpdate}
          onSay={say}
          onGather={() => setTab('gather')}
          onCard={setCardId}
          onRefine={() => setTab('refine')}
        />
      ) : null}

      {tab === 'refine' ? (
        <RefineTab
          file={file}
          session={chosen}
          categories={categories}
          pile={pile}
          categoryId={categoryId}
          card={card}
          picked={picked}
          onCategory={setCategoryId}
          onCard={setCardId}
          onPicked={setPicked}
          onUpdate={onUpdate}
          onSay={say}
        />
      ) : null}

      {tab === 'send' ? (
        <SendTab
          file={file}
          session={chosen}
          out={out}
          becomes={becomes}
          onOut={setOut}
          onBecomes={setBecomes}
          onUpdate={onUpdate}
          onSay={say}
          onRefine={() => setTab('refine')}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ 1 Gather

function GatherTab({
  file,
  session,
  sources,
  onUpdate,
  ensure,
  onSay,
  onSort,
}: {
  file: ProjectFile;
  session: NoteSession | null;
  sources: NoteSource[];
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  ensure(): NoteSessionId;
  onSay(text: string): void;
  onSort(id: NoteSourceId): void;
}) {
  const [typed, setTyped] = useState('');
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  const [way, setWay] = useState<WayIn>('paste');
  const fileBox = useRef<HTMLInputElement | null>(null);

  const put = (text: string, kind: 'file' | 'paste' | 'typed' | 'notes' | 'dictation', named: string): void => {
    if (text.trim().length === 0) {
      onSay('There is nothing in that.');
      return;
    }
    const id = ensure();
    onUpdate((current) => {
      const target = id ?? sortingSessions(current).at(-1)?.id;
      if (!target) return current;
      return addSource(current, { sessionId: target, name: named, text, kind }).file;
    });
    onSay(`${named} is in. Go to Sort and start highlighting.`);
  };

  const files = async (chosen: FileList | null): Promise<void> => {
    if (!chosen || chosen.length === 0) return;
    for (const one of Array.from(chosen)) {
      const refusal = noteSourceRefusal(one.name);
      if (refusal) {
        onSay(refusal);
        continue;
      }
      try {
        const read = await readSourceText(one);
        put(read.text, read.kind, one.name.replace(/\.[^.]+$/, ''));
      } catch (error) {
        onSay(error instanceof Error ? error.message : `${one.name} could not be read.`);
      }
    }
  };

  return (
    <div
      className="ns-gather"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        // The whole page takes a dropped file, which is what a writer with a
        // folder of notes open beside the program will try first.
        if (event.dataTransfer.files.length === 0) return;
        event.preventDefault();
        void files(event.dataTransfer.files);
      }}
    >
      <section className="ns-panel">
        <h3>Sources</h3>
        {sources.length === 0 ? (
          <p className="muted small">
            Nothing in yet. Put a file, some pasted text or a few spoken words in beside this and it appears here.
          </p>
        ) : (
          <ul className="ns-sources">
            {sources.map((one) => {
              const done = progressOf(file, one);
              return (
                <li key={one.id as string}>
                  <div className="ns-source-head">
                    {renaming === (one.id as string) ? (
                      <input
                        autoFocus
                        defaultValue={one.name}
                        aria-label="What this source is called"
                        onBlur={() => setRenaming(null)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') setRenaming(null);
                          if (event.key !== 'Enter') return;
                          const next = event.currentTarget.value.trim();
                          if (next.length > 0) {
                            onUpdate((current) => ({
                              ...current,
                              noteSources: current.noteSources.map((row) =>
                                (row.id as string) === (one.id as string) ? { ...row, name: next } : row,
                              ),
                            }));
                          }
                          setRenaming(null);
                        }}
                      />
                    ) : (
                      <>
                        <span className="ns-src-ico" aria-hidden="true">
                          {SOURCE_GLYPHS[one.kind]}
                        </span>
                        <strong>{one.name}</strong>
                      </>
                    )}
                    <span className="ns-src-pc mono" title={COVERAGE_IS}>
                      {sorted(done.share)}
                    </span>
                  </div>
                  <span className="ns-src-bar" aria-hidden>
                    <span className="ns-src-run" style={{ width: percent(done.share) }} />
                  </span>
                  <p className="muted small">
                    {NOTE_SOURCE_WORDS[one.kind]} ·{' '}
                    {new Date(one.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                    {one.text.split(/\n\s*\n/).filter((part) => part.trim().length > 0).length} paragraphs ·{' '}
                    {countWords(one.text).toLocaleString()} words
                  </p>
                  <div className="ns-source-acts">
                    <button type="button" className="tool" onClick={() => onSort(one.id)}>
                      Sort
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      aria-expanded={showing === (one.id as string)}
                      onClick={() => setShowing(showing === (one.id as string) ? null : (one.id as string))}
                    >
                      {showing === (one.id as string) ? 'Hide original' : 'Show original'}
                    </button>
                    <button type="button" className="ghost" onClick={() => setRenaming(one.id as string)}>
                      Rename
                    </button>
                  </div>
                  {showing === (one.id as string) ? (
                    // The source as it came in, with nothing over it: no grey,
                    // no marks, no cards. §6's promise is only keepable because
                    // the text is never edited, so this is a read.
                    <pre className="ns-original">{one.text}</pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {/* §6's promise, said where somebody about to sort can read it. It is
            the sentence that makes the whole room safe to use quickly. */}
        <p className="ns-safe small">
          Sorting never cuts or deletes. <strong>Show original</strong> always rebuilds a source exactly as it
          came in.
        </p>
        {sources.length > 0 ? (
          <button type="button" className="ns-go" onClick={() => onSort(sources[0]!.id)}>
            Start sorting
          </button>
        ) : null}
      </section>

      <section className="ns-panel ns-material">
        <h3>Add material</h3>
        {/* **At the top of the page** (addendum 35 §4, from Ken: *where it says
            drop files anywhere on this page, that needs to be at the top of the
            page*). It stood at the **foot**, under the four ways in and the
            loud fifth — so the cheapest way of all to get material in was the
            last thing a writer read, after they had already picked one of the
            others. It says what the whole panel can do, which is a heading's
            place rather than a footnote's. */}
        <div className="ns-drop" aria-hidden="true">
          Drop files anywhere on this page
        </div>
        {/* The handoff's four ways in, as tiles rather than as four boxes all
            open at once (§16b). **Paste text and Type directly are one
            control** — a box you put words in — reached through two doors,
            which is addendum 20 §16d's rule rather than a shortcut: what
            differs is what the writer means to do, and the box says which they
            asked for. Two *boxes* would have been the second answer. */}
        <div className="ns-opts">
          {WAYS_IN.map((one) => (
            <button
              key={one.key}
              type="button"
              className={way === one.key ? 'ns-opt on' : 'ns-opt'}
              aria-pressed={way === one.key}
              onClick={() => {
                if (one.key === 'file') {
                  fileBox.current?.click();
                  return;
                }
                setWay(one.key);
              }}
            >
              <span className="ns-opt-ico" aria-hidden="true">
                {one.glyph}
              </span>
              <b>{one.label}</b>
              <span>{one.said}</span>
            </button>
          ))}
        </div>
        <input
          ref={fileBox}
          type="file"
          multiple
          className="ns-file"
          accept={NOTE_SOURCE_ACCEPT}
          aria-label="Import notes from a file"
          onChange={(event) => void files(event.target.files)}
        />

        {way === 'paste' || way === 'typed' ? (
          <label className="ns-add">
            <span>{way === 'paste' ? 'Paste text' : 'Type directly'}</span>
            <textarea
              rows={7}
              value={typed}
              placeholder={way === 'paste' ? 'Paste a page of notes' : 'Write straight in'}
              onChange={(event) => setTyped(event.target.value)}
            />
            <input
              type="text"
              value={name}
              placeholder="What to call it"
              aria-label="What to call it"
              onChange={(event) => setName(event.target.value)}
            />
            <button
              type="button"
              className="tool"
              onClick={() => {
                put(typed, way, name.trim() || (way === 'paste' ? 'Pasted notes' : 'Typed notes'));
                setTyped('');
                setName('');
              }}
            >
              Add it
            </button>
          </label>
        ) : null}

        {way === 'notes' ? (
          <NotesFromProject file={file} onPut={(text, named) => put(text, 'notes', named)} />
        ) : null}

        {/* The one the handoff draws large, and it is right to: talking is the
            cheapest way to get a page of notes and the easiest to put off. */}
        <button type="button" className="ns-loud" onClick={() => setWay('dictation')}>
          <span className="ns-opt-ico ns-red" aria-hidden="true">
            ●
          </span>
          <span>
            <b>Raw dictation session</b>
            <span>Talk it out. No sorting while you speak. What you say becomes a source.</span>
          </span>
        </button>

      </section>

      <Dictation
        armed={way === 'dictation'}
        onPut={(text) => put(text, 'dictation', `Dictated ${new Date().toLocaleDateString()}`)}
        onSay={onSay}
      />
      {session === null ? (
        <p className="ns-foot muted small">
          A sitting starts itself the moment you put something in — nothing is made just by looking.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The research shelf as a source (§3's *VC Writer notes*).
 *
 * It reads `researchCategoriesInOrder`, so a sitting's own working categories
 * are not offered: sorting a sitting's cards back into itself would be a loop,
 * and the predicate is research's own rather than a copy here.
 */
function NotesFromProject({
  file,
  onPut,
}: {
  file: ProjectFile;
  onPut(text: string, named: string): void;
}) {
  const folders = researchCategoriesInOrder(file);
  const [pickedId, setPickedId] = useState<string>('');
  const folder = folders.find((one) => (one.id as string) === pickedId) ?? null;
  const items = folder ? cardsIn(file, folder.id) : [];

  return (
    <label className="ns-add">
      <span>Notes already in this project</span>
      <select
        value={pickedId}
        aria-label="Which research folder to take"
        onChange={(event) => setPickedId(event.target.value)}
      >
        <option value="">Choose a folder…</option>
        {folders.map((one) => (
          <option key={one.id as string} value={one.id as string}>
            {one.name}
          </option>
        ))}
      </select>
      <span className="muted small">
        {folder === null
          ? 'Research notes, old outlines and scene notes can all be sorted again.'
          : items.length === 0
            ? 'Nothing is filed there.'
            : `${items.length === 1 ? '1 note' : `${items.length} notes`} — they come in as one page you can read through.`}
      </span>
      {folder !== null && items.length > 0 ? (
        <button
          type="button"
          className="tool"
          onClick={() =>
            onPut(
              items.map((one) => `## ${one.title}\n\n${one.body}`).join('\n\n'),
              folder.name,
            )
          }
        >
          Add {folder.name}
        </button>
      ) : null}
    </label>
  );
}

/**
 * Dictation into a source (§3's *Raw dictation session*).
 *
 * The recogniser is `startDictation`, which addendum 09 §8 built and which is
 * reused whole — what is new here is only that the transcript becomes a
 * **source** rather than typed screenplay elements. Which recogniser there is
 * gets answered by trying, and where there is none the system's is named, which
 * is that module's own rule and its own wording.
 */
function Dictation({
  onPut,
  onSay,
  armed = false,
}: {
  onPut(text: string): void;
  onSay(text: string): void;
  /** Pressed *Raw dictation session* over there — the panel says so here. */
  armed?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [guess, setGuess] = useState('');
  const [seconds, setSeconds] = useState(0);
  const live = useRef<DictationSession | null>(null);
  const kind = dictationKind();

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((was) => was + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => () => live.current?.stop(), []);

  const begin = (): void => {
    const session = startDictation({
      onFinal: (heard) => setText((was) => `${was}${was.length > 0 && !was.endsWith(' ') ? ' ' : ''}${heard}`),
      onInterim: setGuess,
      onError: (why) => {
        onSay(why);
        setRunning(false);
      },
      onEnd: () => setRunning(false),
    });
    if (!session) {
      onSay(`No speech service here — ${systemDictationKey()} and talk into the box.`);
      return;
    }
    live.current = session;
    setRunning(true);
    setSeconds(0);
  };

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <section className={armed ? 'ns-panel ns-dictate armed' : 'ns-panel ns-dictate'}>
      <div className="ns-dictate-head">
        <span className={running ? 'ns-rec on' : 'ns-rec'} aria-hidden="true" />
        <h3>{running ? 'Dictating' : 'Say it out loud'}</h3>
        <span className={running ? 'ns-clock on mono' : 'ns-clock mono'}>{clock}</span>
      </div>
      {/* The waveform the handoff draws. It is **decoration and says so**: no
          speech API here reports a level, so bars that rose and fell would be
          an animation pretending to be a meter. It moves while the recogniser
          is running and stands still when it is not, which is the one thing
          about it that is true. */}
      <div className={running ? 'ns-wave on' : 'ns-wave'} aria-hidden="true">
        {WAVE.map((height, index) => (
          <span key={index} style={{ height: `${height}px`, animationDelay: `${index * 0.08}s` }} />
        ))}
      </div>
      {/* The line the handoff asks for by name, and it is the point of the
          panel: capture is kept apart from organising. */}
      <p className="ns-just-talk">Just talk. You’ll sort it later.</p>

      <div className="ns-dictate-bar">
        {running ? (
          <button
            type="button"
            className="tool on"
            onClick={() => {
              live.current?.stop();
              live.current = null;
              setRunning(false);
            }}
          >
            ⏸ Pause
          </button>
        ) : (
          <button type="button" className="tool" onClick={begin}>
            ● Start dictating
          </button>
        )}
        <button
          type="button"
          className="tool"
          disabled={text.trim().length === 0}
          onClick={() => {
            live.current?.stop();
            live.current = null;
            setRunning(false);
            onPut(text);
            setText('');
            setGuess('');
            setSeconds(0);
          }}
        >
          Stop &amp; save
        </button>
      </div>

      <textarea
        rows={10}
        className="ns-transcript"
        value={guess.length > 0 ? `${text} ${guess}` : text}
        aria-label="What has been heard so far"
        onChange={(event) => {
          setText(event.target.value);
          setGuess('');
        }}
      />
      <p className="muted small">
        {kind === 'system'
          ? `This build has no speech service. ${systemDictationKey()} and it types into the box.`
          : 'Correct anything in the box as you go — what is saved is what stands there.'}
      </p>
    </section>
  );
}

// -------------------------------------------------------------------- 2 Sort

function SortTab({
  file,
  session,
  sources,
  source,
  categories,
  display,
  split,
  onDisplay,
  onSource,
  onUpdate,
  onSay,
  onGather,
  onCard,
  onRefine,
}: {
  file: ProjectFile;
  session: NoteSession | null;
  sources: NoteSource[];
  source: NoteSource | null;
  categories: ResearchCategory[];
  display: Display;
  split: ReturnType<typeof useSplit>;
  onDisplay(next: Display): void;
  onSource(id: NoteSourceId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onSay(text: string): void;
  onGather(): void;
  onCard(id: ResearchItemId): void;
  onRefine(): void;
}) {
  const page = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  /**
   * Which folder is open. **Nothing is stored** — which drawer you have in
   * front of you is about this minute, addendum 20 §9h's rail — and only one
   * is open at a time, the panel being a column a writer scans.
   */
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  /** Every note of the sitting, for the folder that is a reading (§17). */
  const notes = useMemo(() => (session ? everyNote(file, session.id) : []), [file, session]);
  /** Which outline row a passage is being dragged over. */
  const [overRow, setOverRow] = useState<string | null>(null);
  /**
   * Which of the two screens is showing (§17). **Nothing is stored** — which
   * one you are sorting into is about this minute, and a writer who left it on
   * Outline a fortnight ago opening on a screen they did not choose is the
   * fault addendum 02 §6d names about a moved window.
   */
  const [where, setWhere] = useState<'folders' | 'outline'>('folders');
  /**
   * The outline as a table (§17): addendum 28's own reading, so the book's
   * chapters and the Outliner's planned rows are one list and neither is
   * copied here.
   */
  const outline = useMemo(() => contentsShelf(file), [file]);

  const pieces = useMemo(() => (source ? piecesOf(file, source) : []), [file, source]);
  /**
   * What is drawn. **Four modes and four different pages**: driving the room
   * found *Hide sorted* and *Unsorted only* drawing exactly the same 358
   * characters, which is two controls for one behaviour and therefore one of
   * them lying about what it does. The difference the handoff means is *in
   * place* against *run together* — hiding keeps a mark where the sorted
   * stretch was, so the page keeps its shape and a writer can see where they
   * have been, and *unsorted only* takes even that away.
   */
  const shown =
    display === 'all' || display === 'grey' ? pieces : pieces.filter((one) => !one.sorted || display === 'hide');

  if (session === null || source === null) {
    return (
      <div className="ns-empty">
        <p>Nothing to sort yet.</p>
        <button type="button" className="tool" onClick={onGather}>
          Go to Gather and put something in
        </button>
      </div>
    );
  }

  /** File the highlighted passage into a category — the press and the drop. */
  const file_ = (into: ResearchCategoryId, asked: { from: number; to: number } | null): void => {
    const where = asked ?? range;
    if (!where) {
      onSay('Highlight some words first.');
      return;
    }
    const offer = extractOffer(file, { sourceId: source.id, ...where, categoryId: into });
    if (!offer.can) {
      onSay(offer.says);
      return;
    }
    onUpdate((current) => extractToCategory(current, { sourceId: source.id, ...where, categoryId: into }).file);
    onSay(offer.says);
    setRange(null);
    window.getSelection?.()?.removeAllRanges();
  };

  /** File the highlighted passage straight under a chapter or section (§17). */
  const intoOutline = (row: ContentsRow, asked: { from: number; to: number } | null): void => {
    const where = asked ?? range;
    if (!where || !session || !source) {
      onSay('Highlight some words first.');
      return;
    }
    const offer = outlineDropOffer(file, {
      sessionId: session.id,
      sourceId: source.id,
      ...where,
      where: describeContentsRow(row, file),
    });
    if (!offer.can) {
      onSay(offer.says);
      return;
    }
    onUpdate(
      (current) =>
        extractToOutline(current, {
          sessionId: session.id,
          sourceId: source.id,
          ...where,
          place: row.place,
        }).file,
    );
    onSay(offer.says);
    setRange(null);
    window.getSelection?.()?.removeAllRanges();
  };

  /** What the highlighted passage looks like, where anything does (§15). */
  const looksLike = (() => {
    if (!range || !session) return null;
    const passage = source.text.slice(range.from, range.to).trim();
    if (passage.length < 12) return null;
    const best = scoreCategories(file, session.id, passage)[0];
    return best && worthSaying(best)
      ? { categoryId: best.categoryId, name: best.name, why: sayWhy(best) }
      : null;
  })();

  const offerFor = (into: ResearchCategory): string =>
    range
      ? extractOffer(file, { sourceId: source.id, ...range, categoryId: into.id }).says
      : `Highlight a passage on the left, then press ${into.name}.`;

  return (
    <div className="ns-sort">
      <section className="ns-panel ns-raw" style={{ flexBasis: `${split.size}px` }}>
        <div className="ns-src-tabs">
          {sources.map((one) => (
            <button
              key={one.id as string}
              type="button"
              className={(one.id as string) === (source.id as string) ? 'ns-src-tab on' : 'ns-src-tab'}
              onClick={() => onSource(one.id)}
            >
              {one.name}{' '}
              <span className="muted small" title={COVERAGE_IS}>
                {sorted(progressOf(file, one).share)}
              </span>
            </button>
          ))}
          <button type="button" className="ns-src-tab add" onClick={onGather}>
            + Add source
          </button>
        </div>

        <div className="ns-modes" role="group" aria-label="What to show of the source">
          {DISPLAYS.map((one) => (
            <button
              key={one.key}
              type="button"
              className={display === one.key ? 'ns-mode on' : 'ns-mode'}
              aria-pressed={display === one.key}
              title={one.hint}
              onClick={() => onDisplay(one.key)}
            >
              {one.label}
            </button>
          ))}
        </div>

        {/* **Not `draggable`.** It was, and measuring the real browser showed
            what that costs: a `draggable` element cannot have text selected
            inside it with the mouse at all, so the first of the module's four
            verbs — read, *highlight*, drag, drop — did not work. Chromium drags
            a selection of its own accord and fires `dragstart` here as it goes,
            so the drag is the browser's affordance rather than an attribute,
            and what this room supplies is the press. */}
        <div
          className={`ns-page ns-page-${display}`}
          ref={page}
          onMouseUp={() => setRange(liveRange(page.current))}
          onKeyUp={() => setRange(liveRange(page.current))}
          onDragStart={(event) => {
            const where = liveRange(page.current);
            if (!where) {
              event.preventDefault();
              return;
            }
            setRange(where);
            // Claimed by a MIME type of its own, so dragging text anywhere else
            // in the program is left entirely alone (`carry-work.ts`).
            event.dataTransfer.setData(PASSAGE, JSON.stringify(where));
            event.dataTransfer.effectAllowed = 'copy';
          }}
        >
          {shown.map((piece) =>
            piece.sorted && display === 'hide' ? (
              // In place: a mark standing for what has gone, saying how much,
              // and never selectable — there is nothing there to highlight.
              <span
                key={`${piece.from}-${piece.to}`}
                className="ns-elided"
                title={`${piece.to - piece.from} characters, already sorted`}
              >
                ⋯
              </span>
            ) : (
              <span
                key={`${piece.from}-${piece.to}`}
                data-from={piece.from}
                className={piece.sorted ? 'ns-done' : 'ns-todo'}
              >
                {piece.text}
              </span>
            ),
          )}
        </div>

        <p className="ns-foot muted small">
          {/* The mockup's *p. 3 of 20*, said in the unit this room actually
              has. A source is a string rather than a paginated document, so
              *page* would be a number nobody could check; paragraphs are what
              `piecesOf` and `whereFrom` already count, and a card's own
              reference says ¶ too. */}
          {/* Where you are, and **only once there is a where**: with nothing
              highlighted the honest answer is how long the page is, not
              paragraph zero of five. */}
          <span className="mono">
            {range
              ? `¶ ${countParagraphs(source.text.slice(0, range.from)) || 1} of ${countParagraphs(source.text)}`
              : `${countParagraphs(source.text)} paragraphs`}
          </span>
          <span className="ns-foot-rule" aria-hidden="true" />
          {range ? (
            <>
              {range.to - range.from} characters highlighted — drop them on a category, or press one.
              {/* §15's **Suggest Destination**, which is `scoreCategories`
                  pointed at the live selection: the same engine as the panel
                  below, said where the writer's hands already are. */}
              {looksLike ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="ghost small ns-looks"
                    title={looksLike.why}
                    onClick={() => file_(looksLike.categoryId, range)}
                  >
                    Looks like {looksLike.name} →
                  </button>
                </>
              ) : null}
            </>
          ) : (
            'Highlight a passage, then drag it across or press a category. Nothing is ever cut from this page.'
          )}
          {/* The handoff puts this in the Sort footer as well as on Gather: a
              writer looking at a greyed page is exactly who wants to see what
              the page said before anybody touched it. It is the same read
              (§6), reached from the other room. */}
          <button type="button" className="ghost small ns-see-raw" onClick={onGather}>
            Show original source
          </button>
        </p>
      </section>

      <div className="split-handle" role="separator" aria-label="Resize the raw notes" {...split.dividerProps} />

      <section className="ns-panel ns-stacks">
        <div className="ns-stacks-head">
          {/* **Two screens rather than two tables** (§17, from Ken: *you'll
              have a categories tab, and then you'll have an outline tab for
              sorting, which will give you two separate screens*). Both answer
              *where does this passage go* and they answer it about different
              things — which shelf a note sits on, and where it belongs in the
              book (addendum 28 §3) — so stacking them in one column made a
              writer scroll past one to reach the other and read as one long
              list of places. The switch is **absent where there is no outline
              to show**, a tab that can only be empty being one that lies. */}
          {outline.length > 0 ? (
            <div className="ns-where" role="tablist" aria-label="Sort into">
              <button
                type="button"
                role="tab"
                aria-selected={where === 'folders'}
                className={where === 'folders' ? 'ns-where-tab on' : 'ns-where-tab'}
                onClick={() => setWhere('folders')}
              >
                Categories
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={where === 'outline'}
                className={where === 'outline' ? 'ns-where-tab on' : 'ns-where-tab'}
                onClick={() => setWhere('outline')}
              >
                Outline
              </button>
            </div>
          ) : (
            <h3>Categories</h3>
          )}
          {naming ? (
            <input
              autoFocus
              placeholder="What it is called"
              aria-label="What the new category is called"
              onBlur={() => setNaming(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setNaming(false);
                if (event.key !== 'Enter') return;
                const name = event.currentTarget.value.trim();
                if (name.length > 0) {
                  onUpdate((current) => addSortCategory(current, { sessionId: session.id, name }).file);
                }
                setNaming(false);
              }}
            />
          ) : (
            where === 'folders' ? (
              <button type="button" className="tool" onClick={() => setNaming(true)}>
                + Category
              </button>
            ) : null
          )}
        </div>

        {where === 'folders' && categories.length === 0 ? (
          <p className="muted small">
            No categories yet. Make one and the passages you highlight have somewhere to go — you can rename and
            rearrange them afterwards.
          </p>
        ) : where === 'folders' ? (
          <>
            {/* **Folders, stacked, and you can look inside one** (§17, from
                Ken: *the categories also need to show up in a box stacked on
                top of each other… like it looks like the outline, but it's
                little folders. And then you can click in those folders and see
                the notes in that folder*).

                Two things change and both are his. They were a **row that
                wrapped**, so a dozen folders read as a paragraph of boxes
                rather than a list; and §8's **chip** — a folder with nothing in
                it drawn small — is **gone rather than kept beside them**, that
                decision having been made so fifteen categories would fit across
                a row, which a column does by being a column. A folder is a
                folder whether or not anything is in it.

                And a press opens one. It could not before: `file_` refuses
                with *Highlight some words first* where nothing is in hand, so
                the only thing a writer could do to a folder was file into it,
                and what was inside could be read only from another tab.
                **With nothing in hand the press opens it rather than
                refusing** — addendum 28 §4c's own rule, in the room it came
                from — so the drag still files, the press still files while a
                passage is held, and the gesture that was a refusal is now the
                way in. */}
            <div className="ns-folders">
              {/* **All notes**, which is the ask said twice (*Definitely need
                  a way to see all notes*). It is a **reading and not a place**,
                  so it takes no drop and carries no colour: every note of the
                  sitting with the folder it is in, which is the one list this
                  room never had. */}
              <div className={openFolder === ALL_NOTES ? 'ns-folder all open' : 'ns-folder all'}>
                <button
                  type="button"
                  className="ns-folder-head"
                  aria-expanded={openFolder === ALL_NOTES}
                  onClick={() => setOpenFolder(openFolder === ALL_NOTES ? null : ALL_NOTES)}
                >
                  <span className="ns-fold-arrow" aria-hidden="true">
                    {openFolder === ALL_NOTES ? '▾' : '▸'}
                  </span>
                  All notes
                  <span className="muted small">{notes.length}</span>
                </button>
                {openFolder === ALL_NOTES ? (
                  <div className="ns-folder-cards">
                    {notes.length === 0 ? (
                      <p className="muted small">
                        Nothing yet. Highlight a passage on the left and drop it into a folder.
                      </p>
                    ) : (
                      notes.map((one) => (
                        <button
                          key={one.card.id as string}
                          type="button"
                          className="ns-card mini"
                          onClick={() => {
                            onCard(one.card.id);
                            onRefine();
                          }}
                        >
                          <span className="ns-card-title">{one.card.title}</span>
                          <span className="ns-card-body">{one.card.body}</span>
                          <span className="ns-card-from mono">
                            {one.where} · {whereFrom(file, one.card)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              {categories.map((one) => {
                const held = cardsIn(file, one.id);
                const open = openFolder === (one.id as string);
                return (
                  <div
                    key={one.id as string}
                    className={
                      (over === (one.id as string) ? 'ns-folder over' : 'ns-folder') + (open ? ' open' : '')
                    }
                    style={one.color ? ({ '--ns-tint': one.color } as React.CSSProperties) : undefined}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes(PASSAGE)) return;
                      event.preventDefault();
                      setOver(one.id as string);
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(event) => {
                      setOver(null);
                      const raw = event.dataTransfer.getData(PASSAGE);
                      if (!raw) return;
                      event.preventDefault();
                      try {
                        file_(one.id, JSON.parse(raw) as { from: number; to: number });
                      } catch {
                        onSay('That drop could not be read.');
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="ns-folder-head"
                      title={offerFor(one)}
                      aria-expanded={open}
                      onClick={() => {
                        // The press files what is in hand, and where nothing
                        // is held it opens the folder rather than refusing.
                        if (range) file_(one.id, null);
                        else setOpenFolder(open ? null : (one.id as string));
                      }}
                    >
                      <span className="ns-fold-arrow" aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                      <span className="ns-dot" />
                      {one.name}
                      <span className="muted small">{held.length}</span>
                    </button>
                    {open ? (
                      <div className="ns-folder-cards">
                        {held.length === 0 ? (
                          <p className="muted small">Nothing filed here yet.</p>
                        ) : (
                          held.map((held_) => (
                            <button
                              key={held_.id as string}
                              type="button"
                              className="ns-card mini"
                              onClick={() => {
                                onCard(held_.id);
                                onRefine();
                              }}
                            >
                              <span className="ns-card-title">{held_.title}</span>
                              <span className="ns-card-body">{held_.body}</span>
                              {/* The lineage on the face of the card, which is
                                  what makes it an index card rather than a
                                  coloured box: *Brainstorm \u00b63*, read by
                                  `whereFrom` and stored nowhere, so cutting the
                                  source says so here. */}
                              <span className="ns-card-from mono">{whereFrom(file, held_)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                    {over === (one.id as string) ? <span className="ns-card slot">Drop to add a note</span> : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {/* **The outline, as a second table** (§17, from Ken: *make a second
            table for the outline in the sorting area that just shows outline
            chapters sections and subsections*).

            It is `contentsShelf` — addendum 28's own reading, which already
            lists the book's chapters and sections and then the Outliner's rows
            that are still plans — so **nothing about the outline is copied
            here**: a chapter renamed in the Outliner is renamed on this table
            with nothing run, and a section added there appears here, which is
            his *it will continually update with new sections*. The count is the
            notes already filed under that row, his *it'll show what notes are
            sorted into those categories*.

            **Absent where there is nothing to drop onto** rather than an empty
            table, and the folders above are untouched: a folder says which
            shelf a note is on and a row here says where it belongs in the book,
            which are two questions (addendum 28 §3). */}
        {where === 'outline' && session && outline.length > 0 ? (
          <div className="ns-outline">
            <p className="field-note">
              Drop a passage on a chapter or section to file it there. It waits in Unsorted until you give it a
              folder.
            </p>
            <div className="ns-outline-rows">
              {outline.map((row) => {
                const key = placeKey(row.place);
                const says = range
                  ? outlineDropOffer(file, {
                      sessionId: session.id,
                      sourceId: source.id,
                      ...range,
                      where: describeContentsRow(row, file),
                    }).says
                  : `Highlight a passage on the left, then press ${row.title || row.number}.`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={
                      (overRow === key ? 'ns-outline-row over' : 'ns-outline-row') +
                      (row.planned ? ' planned' : '') +
                      ` d${row.depth}`
                    }
                    title={says}
                    onClick={() => intoOutline(row, null)}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes(PASSAGE)) return;
                      event.preventDefault();
                      setOverRow(key);
                    }}
                    onDragLeave={() => setOverRow(null)}
                    onDrop={(event) => {
                      setOverRow(null);
                      const raw = event.dataTransfer.getData(PASSAGE);
                      if (!raw) return;
                      event.preventDefault();
                      try {
                        intoOutline(row, JSON.parse(raw) as { from: number; to: number });
                      } catch {
                        onSay('That drop could not be read.');
                      }
                    }}
                  >
                    <span className="ns-outline-n mono">{row.number}</span>
                    <span className="ns-outline-name">{row.title || 'Untitled'}</span>
                    {/* Said rather than hidden: a chapter the book has and one
                        that is still a plan are two different things to aim
                        research at (addendum 28 §4c). */}
                    {row.planned ? <span className="ns-outline-plan">plan</span> : null}
                    <span className="muted small">{row.notes.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Auto-sort suggestions (§14). **Under the stacks rather than in
            Refine**, where the handoff draws them: they are about the material
            still in the raw notes, and by the time a writer is refining, every
            card is already filed and the panel would have nothing to say. Here
            approving one greys the passage on the left an inch away, which is
            the whole of why it is trustworthy. */}
        {session ? (
          <Suggestions
            file={file}
            session={session}
            sourceId={source.id}
            onUpdate={onUpdate}
            onSay={onSay}
          />
        ) : null}
      </section>
    </div>
  );
}

/**
 * The suggestion panel (§14), and every rule it keeps is one sentence.
 *
 * **Nothing moves until you approve**, said on the panel and true by
 * construction: a suggestion is a reading, so there is nothing to undo if it is
 * ignored and nothing to clean up if it is dismissed.
 *
 * **Every row says why**, in a fact about the writer's own filing rather than a
 * verdict — which is what a writer checks the second time and trusts the tenth.
 *
 * **The switch is per machine and dismissing is about this minute**: whether
 * you want the panel at all is a fact about how you work, while *not that one*
 * is about this reading of these notes, and the reading changes every time
 * anything is filed.
 */
function Suggestions({
  file,
  session,
  sourceId,
  onUpdate,
  onSay,
}: {
  file: ProjectFile;
  session: NoteSession;
  sourceId: NoteSourceId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onSay(text: string): void;
}) {
  const [on, setOn] = usePreference<boolean>('sorterSuggest', true);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [ticked, setTicked] = useState<readonly string[]>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  /**
   * The model's half of *Suggest new categories* (§14a).
   *
   * **Held in the screen and never stored**: names asked for once are about
   * this pile as it stands, and filing anything changes what the answer would
   * be. They are cleared whenever the reading's own ideas change beneath them,
   * which is the same argument said in code.
   */
  const [named, setNamed] = useState<readonly { name: string; because: string }[]>([]);
  const [naming, setNaming] = useState(false);
  const [canName, setCanName] = useState<{ available: boolean; reason: string | null } | null>(null);

  const all = useMemo(
    () => (on ? suggestPlacements(file, session.id, { sourceId, limit: 24 }) : []),
    [on, file, session.id, sourceId],
  );
  const rows = all.filter((one) => !dismissed.includes(placementKey(one)));
  const putAside = all.length - rows.length;
  const chosen = rows.filter((one) => ticked.includes(placementKey(one)));
  const read = ideasOpen ? suggestCategories(file, session.id) : [];
  const ideas: CategoryIdea[] = ideasOpen ? mergeIdeas(file, session.id, read, named) : [];

  // Whether names can be asked for at all, so the button is **absent rather
  // than greyed**: the panel is complete without it — the read ideas are the
  // feature and this is more of them — so its absence is not a hole.
  useEffect(() => {
    if (!ideasOpen || canName !== null) return;
    const bridge = window.vcwriter;
    if (!bridge?.noteCategoriesStatus) {
      // No bridge at all: the read ideas are the whole panel, and it says
      // nothing about a button that was never going to be there.
      setCanName({ available: false, reason: null });
      return;
    }
    let alive = true;
    void bridge.noteCategoriesStatus().then((answer) => {
      if (!alive) return;
      setCanName(
        answer.ok && answer.data
          ? answer.data
          : { available: false, reason: answer.error ?? 'Naming groupings is unavailable.' },
      );
    });
    return () => {
      alive = false;
    };
  }, [ideasOpen, canName]);

  return (
    <div className="ns-suggest">
      <div className="ns-suggest-head">
        <h3>Suggestions</h3>
        <label className="ns-switch">
          {/* Named for **what it switches**, not for which way it is turned:
              *On* is not the name of a control (addendum 02 §4a's switch, whose
              whole point is that *off* means nothing on its own). */}
          <input
            type="checkbox"
            checked={on}
            aria-label="Suggest where unsorted passages belong"
            onChange={(event) => setOn(event.target.checked)}
          />
          <span className="muted small">{on ? 'On' : 'Off'}</span>
        </label>
      </div>

      {!on ? (
        <p className="muted small">
          Off. Turn it on and the unsorted passages that look like one of your categories are listed here.
        </p>
      ) : (
        <>
          <p className="muted small">{describeSuggestions(file, session.id, rows, putAside)}</p>

          {putAside > 0 && rows.length > 0 ? (
            <button type="button" className="ghost small ns-bring-back" onClick={() => setDismissed([])}>
              Bring back {putAside === 1 ? 'the one I put aside' : `the ${putAside} I put aside`}
            </button>
          ) : null}
          {putAside > 0 && rows.length === 0 ? (
            <button type="button" className="tool" onClick={() => setDismissed([])}>
              Bring them back
            </button>
          ) : null}

          {rows.length > 0 ? (
            <ul className="ns-suggest-rows">
              {rows.map((one) => {
                const key = placementKey(one);
                return (
                  <li key={key}>
                    <label className="ns-suggest-row">
                      <input
                        type="checkbox"
                        checked={ticked.includes(key)}
                        aria-label={`Put “${one.title}” in ${nameOfCategory(file, one)}`}
                        onChange={(event) =>
                          setTicked(
                            event.target.checked
                              ? [...ticked, key]
                              : ticked.filter((other) => other !== key),
                          )
                        }
                      />
                      <span className="ns-suggest-words">
                        <span className="ns-suggest-passage">{one.passage}</span>
                        <span className="muted small">{one.because}</span>
                      </span>
                      <span className="ns-suggest-into">→ {nameOfCategory(file, one)}</span>
                    </label>
                    <button
                      type="button"
                      className="ghost item-x"
                      aria-label={`Not that one: “${one.title}”`}
                      onClick={() => setDismissed([...dismissed, key])}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="ns-suggest-acts">
            <button
              type="button"
              className="tool"
              disabled={chosen.length === 0}
              onClick={() => {
                let made = 0;
                onUpdate((current) => {
                  const done = approvePlacements(current, chosen);
                  made = done.made;
                  return done.file;
                });
                onSay(made === 1 ? '1 card made, and the passage is grey.' : `${made} cards made.`);
                setTicked([]);
              }}
            >
              {chosen.length === 0 ? 'Approve' : `Approve ${chosen.length}`}
            </button>
            {rows.length > 0 ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setDismissed(all.map(placementKey));
                  setTicked([]);
                }}
              >
                Dismiss all
              </button>
            ) : null}
            <button
              type="button"
              className={ideasOpen ? 'ghost on' : 'ghost'}
              aria-pressed={ideasOpen}
              onClick={() => setIdeasOpen(!ideasOpen)}
            >
              Suggest new categories
            </button>
          </div>

          {ideasOpen ? (
            <>
              {ideas.length === 0 ? (
                <p className="muted small">
                  Nothing repeats often enough in what is left to be worth a category of its own.
                </p>
              ) : (
                <ul className="ns-ideas">
                  {ideas.map((idea) => (
                    <li key={idea.name}>
                      <button
                        type="button"
                        className="tool"
                        title={idea.because}
                        onClick={() => {
                          onUpdate((current) =>
                            addSortCategory(current, { sessionId: session.id, name: idea.name }).file,
                          );
                          // Made empty, never filled — whichever half proposed
                          // it. The passages then suggest themselves into it,
                          // which is the writer's press (spec §15's caveat).
                          onSay(`${idea.name} is a category now. Nothing has been filed in it.`);
                        }}
                      >
                        + {idea.name}
                      </button>
                      {/* **Which half said it, on the row**: a counted idea is
                          something a writer can go and check, a named one is
                          something they can only judge, and the two are not the
                          same kind of claim (`found`, addendum 25 §2). */}
                      {idea.found === 'suggested' ? (
                        <span className="ns-from-model" title="Named by reading the unsorted notes">
                          suggested
                        </span>
                      ) : null}
                      <span className="muted small">{idea.because}</span>
                    </li>
                  ))}
                </ul>
              )}

              {canName?.available ? (
                <div className="ns-name-more">
                  <button
                    type="button"
                    className="tool"
                    disabled={naming}
                    onClick={() => {
                      const read_ = whatToRead(file, session.id);
                      if (read_.passages.length === 0) {
                        onSay('There is nothing unsorted left to read.');
                        return;
                      }
                      const bridge = window.vcwriter;
                      if (!bridge?.suggestNoteCategories) return;
                      setNaming(true);
                      void bridge
                        .suggestNoteCategories(read_)
                        .then((answer) => {
                          if (answer.ok && answer.data) setNamed(answer.data);
                          else onSay(answer.error ?? 'The groupings could not be named.');
                        })
                        .finally(() => setNaming(false));
                    }}
                  >
                    {naming ? 'Reading the notes…' : 'Name more from the notes'}
                  </button>
                  {/* Said beside the press, because a writer sending a page of
                      private notes somewhere should be told that is what it
                      does (addendum 16 §10's rule about what leaves). */}
                  <span className="muted small">
                    Sends the unsorted passages and your category names. Nothing is filed.
                  </span>
                </div>
              ) : canName ? (
                // Absent rather than greyed, with the reason said once.
                <p className="muted small">{canName.reason}</p>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

/** What a placement's category is called. */
const nameOfCategory = (file: ProjectFile, one: Placement): string =>
  file.researchCategories.find((row) => (row.id as string) === (one.categoryId as string))?.name ??
  'a category that has gone';

// ------------------------------------------------------------------ 3 Refine

function RefineTab({
  file,
  session,
  categories,
  pile,
  categoryId,
  card,
  picked,
  onCategory,
  onCard,
  onPicked,
  onUpdate,
  onSay,
}: {
  file: ProjectFile;
  session: NoteSession | null;
  categories: ResearchCategory[];
  pile: ResearchCategory | null;
  categoryId: ResearchCategoryId | null;
  card: ResearchItem | null;
  picked: readonly string[];
  onCategory(id: ResearchCategoryId | null): void;
  onCard(id: ResearchItemId | null): void;
  onPicked(next: readonly string[]): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onSay(text: string): void;
}) {
  const [asking, setAsking] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [splitting, setSplitting] = useState(false);
  /** Where a dragged card would land: the gold line the handoff draws. */
  const [landing, setLanding] = useState<number | null>(null);
  const all = pile ? [...categories, pile] : categories;
  const here =
    all.find((one) => (one.id as string) === (categoryId as string)) ?? categories[0] ?? pile ?? null;
  const cards = here ? cardsIn(file, here.id) : [];

  if (session === null) {
    return <div className="ns-empty">Nothing to refine yet.</div>;
  }

  return (
    <div className="ns-refine">
      <section className="ns-panel ns-tree">
        <h3>Categories</h3>
        <ul>
          {all.map((one) => {
            const isPile = (one.id as string) === (pile?.id as string);
            const held = cardsIn(file, one.id);
            return (
              <li key={one.id as string} className={isPile ? 'ns-pile' : undefined}>
                <div className={(here?.id as string) === (one.id as string) ? 'item-row on' : 'item-row'}>
                  {renaming === (one.id as string) ? (
                    <input
                      autoFocus
                      defaultValue={one.name}
                      aria-label="What this category is called"
                      onBlur={() => setRenaming(null)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') setRenaming(null);
                        if (event.key !== 'Enter') return;
                        const name = event.currentTarget.value.trim();
                        if (name.length > 0) {
                          onUpdate((current) => updateResearchCategory(current, one.id, { name }));
                        }
                        setRenaming(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="ghost ns-tree-name" onClick={() => onCategory(one.id)}>
                      <span className="ns-dot" style={one.color ? { background: one.color } : undefined} />
                      {one.name}
                      <span className="muted small">{held.length}</span>
                    </button>
                  )}
                  {/* The pile is where a deleted category's cards land, so it
                      has no × and no rename — absent with the reason said,
                      rather than a control that can only refuse. */}
                  {isPile ? null : (
                    <>
                      <button
                        type="button"
                        className="ghost item-x"
                        aria-label={`Rename ${one.name}`}
                        onClick={() => setRenaming(one.id as string)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="ghost item-x"
                        aria-label={`Delete ${one.name}`}
                        onClick={() => setAsking(one.id as string)}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>

                {isPile ? (
                  <p className="muted small row-note">Where a deleted category’s cards land. It stays.</p>
                ) : null}

                {asking === (one.id as string) ? (
                  <div className="row-ask">
                    <p className="muted small">{categoryRemoval(file, one.id)}</p>
                    <div className="ns-ask-acts">
                      <button
                        type="button"
                        className="tool"
                        onClick={() => {
                          if (!pile) return;
                          onUpdate((current) => removeSortCategory(current, one.id, pile.id));
                          setAsking(null);
                          onCategory(null);
                        }}
                      >
                        Delete it
                      </button>
                      {/* Merge into… is the same act with a different target,
                          which is why there is one function and not two. */}
                      {categories.length > 1 ? (
                        <select
                          aria-label={`Merge ${one.name} into`}
                          defaultValue=""
                          onChange={(event) => {
                            const into = event.target.value as ResearchCategoryId;
                            if (!into) return;
                            onUpdate((current) => removeSortCategory(current, one.id, into));
                            setAsking(null);
                          }}
                        >
                          <option value="">Merge into…</option>
                          {categories
                            .filter((other) => (other.id as string) !== (one.id as string))
                            .map((other) => (
                              <option key={other.id as string} value={other.id as string}>
                                {other.name}
                              </option>
                            ))}
                        </select>
                      ) : null}
                      <button type="button" className="ghost" onClick={() => setAsking(null)}>
                        Keep it
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {here && (here.id as string) !== (pile?.id as string) ? (
          <div className="ns-colours" role="group" aria-label={`A colour for ${here.name}`}>
            <span className="muted small">Colour</span>
            {COLOURS.map((colour) => (
              <button
                key={colour}
                type="button"
                className={here.color === colour ? 'ns-swatch on' : 'ns-swatch'}
                style={{ background: colour }}
                aria-label={`Colour ${here.name} ${colour}`}
                onClick={() => onUpdate((current) => updateResearchCategory(current, here.id, { color: colour }))}
              />
            ))}
            <button
              type="button"
              className="ghost small"
              onClick={() => onUpdate((current) => updateResearchCategory(current, here.id, { color: null }))}
            >
              None
            </button>
          </div>
        ) : null}
      </section>

      <section className="ns-panel ns-sequence">
        <h3>{here ? here.name : 'Cards'}</h3>
        {cards.length === 0 ? (
          <p className="muted small">Nothing filed here yet.</p>
        ) : (
          <>
            <p className="muted small">
              The order is the order they would be written in. Drag one to move it.
            </p>
            <ol className="ns-cards">
              {cards.map((one, index) => {
                const chosenCard = (card?.id as string) === (one.id as string);
                const marked = picked.includes(one.id as string);
                return (
                  <li
                    key={one.id as string}
                    className={landing === index ? 'ns-landing' : undefined}
                    onDragOver={(event) => {
                      if (!event.dataTransfer.types.includes(CARD)) return;
                      event.preventDefault();
                      setLanding(index);
                    }}
                    onDragLeave={() => setLanding((was) => (was === index ? null : was))}
                    onDrop={(event) => {
                      const moved = event.dataTransfer.getData(CARD);
                      setLanding(null);
                      if (!moved || !here) return;
                      event.preventDefault();
                      // `placeCard` takes the place rather than the neighbour,
                      // so the same act serves a drop above the first card and
                      // one below the last.
                      onUpdate((current) => placeCard(current, moved as ResearchItemId, here.id, index));
                    }}
                  >
                    <button
                      type="button"
                      className={`ns-card${chosenCard ? ' on' : ''}${marked ? ' marked' : ''}`}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData(CARD, one.id as string)}
                      onClick={(event) => {
                        if (event.shiftKey) {
                          onPicked(
                            marked
                              ? picked.filter((id) => id !== (one.id as string))
                              : [...picked, one.id as string],
                          );
                          return;
                        }
                        onPicked([]);
                        onCard(one.id);
                      }}
                    >
                      <span className="ns-card-n">{index + 1}</span>
                      <span className="ns-card-title">{one.title}</span>
                      <span className="ns-card-body">{one.body}</span>
                      <span className="muted small mono">{whereFrom(file, one)}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {/* The hint alone, as the handoff draws it: **Merge lives once**,
                on the card's own acts row, and a second button here would be a
                second answer to *how do I join two cards*. */}
            <p className="muted small">
              {picked.length > 1
                ? `${picked.length} marked — press Merge on the right.`
                : 'Shift-click two or more cards to join them.'}
            </p>
          </>
        )}
      </section>

      <section className="ns-panel ns-detail">
        {card === null ? (
          <p className="muted small">Choose a card to work on it.</p>
        ) : (
          <>
            <h3>The card</h3>
            {/* The handoff's four acts as one row at the top, which is where
                it draws them and where they belong: they are what you *do* to
                the card, and the fields under them are what it *is*. */}
            <div className="ns-card-acts">
              <button
                type="button"
                className={splitting ? 'act on' : 'act'}
                aria-pressed={splitting}
                onClick={() => setSplitting(!splitting)}
              >
                ⑂ Split
              </button>
              {/* Merge is the same act the sequence's shift-click performs,
                  reached from the card in hand — one act, two doors (addendum
                  20 §16d), never a second way of joining cards. It refuses in
                  a sentence rather than being greyed to silence, because
                  *why can I not merge* is the question a greyed button leaves
                  somebody holding. */}
              <button
                type="button"
                className="act"
                title={
                  picked.length > 1
                    ? `Join the ${picked.length} marked cards into one`
                    : 'Shift-click a second card on the left first'
                }
                onClick={() => {
                  if (picked.length < 2) {
                    onSay('Shift-click two or more cards on the left, then press Merge.');
                    return;
                  }
                  onUpdate((current) => mergeCards(current, picked as ResearchItemId[]).file);
                  onSay(`${picked.length} cards are now one. The rest are in the graveyard if that was wrong.`);
                  onPicked([]);
                }}
              >
                ⋈ Merge{picked.length > 1 ? ` ${picked.length}` : ''}
              </button>
              <select
                aria-label="Move this card to"
                value=""
                onChange={(event) => {
                  const into = event.target.value as ResearchCategoryId;
                  if (!into) return;
                  onUpdate((current) => moveCard(current, card.id, into));
                }}
              >
                <option value="">Move to…</option>
                {all
                  .filter((one) => (one.id as string) !== (card.categoryId as string))
                  .map((one) => (
                    <option key={one.id as string} value={one.id as string}>
                      {one.name}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Also show this card in"
                value=""
                onChange={(event) => {
                  const into = event.target.value as ResearchCategoryId;
                  if (!into) return;
                  onUpdate((current) => referenceCard(current, card.id, into));
                  onSay('It is on both lists now, and there is still one card.');
                }}
              >
                <option value="">Also show in…</option>
                {categories
                  .filter(
                    (one) =>
                      (one.id as string) !== (card.categoryId as string) &&
                      !card.alsoIn.some((ref) => (ref as string) === (one.id as string)),
                  )
                  .map((one) => (
                    <option key={one.id as string} value={one.id as string}>
                      {one.name}
                    </option>
                  ))}
              </select>
              <span className="ns-made small">
                Made {new Date(card.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {card.updatedAt !== card.createdAt
                  ? ` · edited ${new Date(card.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : null}
              </span>
            </div>

            {splitting ? (
              <SplitHere
                card={card}
                onSplit={(at) => {
                  onUpdate((current) => splitCard(current, card.id, at).file);
                  setSplitting(false);
                }}
              />
            ) : null}

            {/* Title and tags read together — what it is called and how it is
                filed — so they stand side by side as the handoff draws them. */}
            <div className="ns-pair">
              <label className="ns-field">
                <span>Working title</span>
                <input
                  type="text"
                  value={card.title}
                  onChange={(event) =>
                    onUpdate((current) => updateResearchItem(current, card.id, { title: event.target.value }))
                  }
                />
              </label>
              <div className="ns-field">
                <span>Tags</span>
                {/* Pills rather than a comma-separated line: the handoff draws
                    them as chips because a tag is a thing you take off, and ✕
                    on the tag is the only gesture that says so. The box below
                    adds one; there is no second list to keep in step. */}
                <div className="ns-tags">
                  {card.tags.map((tag) => (
                    <span key={tag} className="ns-tag">
                      {tag}
                      <button
                        type="button"
                        className="ghost"
                        aria-label={`Take “${tag}” off`}
                        onClick={() =>
                          onUpdate((current) =>
                            updateResearchItem(current, card.id, {
                              tags: card.tags.filter((one) => one !== tag),
                            }),
                          )
                        }
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="ns-tag-in"
                    placeholder="+ tag"
                    aria-label="Add a tag"
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      const next = event.currentTarget.value.trim();
                      event.currentTarget.value = '';
                      if (next.length === 0 || card.tags.includes(next)) return;
                      onUpdate((current) =>
                        updateResearchItem(current, card.id, { tags: [...card.tags, next] }),
                      );
                    }}
                  />
                </div>
              </div>
            </div>

            <label className="ns-field">
              <span>Working text</span>
              <textarea
                rows={7}
                className="ns-working"
                value={card.body}
                onChange={(event) =>
                  onUpdate((current) => updateResearchItem(current, card.id, { body: event.target.value }))
                }
              />
              <span className="muted small">Editing this never changes the source.</span>
            </label>

            <div className="ns-pair">
              <div className="ns-field">
                <span>Source</span>
                <div className="ns-quote">
                  <blockquote>{passageOf(file, card) || 'The source has gone.'}</blockquote>
                  <span className="muted small mono">{whereFrom(file, card)}</span>
                </div>
              </div>
              <div className="ns-appears ns-field">
              <span>Appears in</span>
              <ul>
                <li>
                  {all.find((one) => (one.id as string) === (card.categoryId as string))?.name ?? 'Nowhere'}{' '}
                  <span className="muted small">home</span>
                </li>
                {card.alsoIn.map((ref) => (
                  <li key={ref as string}>
                    {all.find((one) => (one.id as string) === (ref as string))?.name ?? 'A category that has gone'}
                    <button
                      type="button"
                      className="ghost item-x"
                      aria-label="Stop showing it there"
                      onClick={() => onUpdate((current) => unreferenceCard(current, card.id, ref))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              </div>
            </div>

            {/* A note about the card, never in it (§16b). Three fields answer
                three questions: the working text is what travels, the source
                is where it came from, and this is *pair with the Hans Gruber
                example?* — which belongs in neither. */}
            <label className="ns-field">
              <span>Comment</span>
              <input
                type="text"
                value={card.comment}
                placeholder="A note to yourself about this card"
                onChange={(event) =>
                  onUpdate((current) => updateResearchItem(current, card.id, { comment: event.target.value }))
                }
              />
            </label>

            <ToTheShelf file={file} card={card} onUpdate={onUpdate} onSay={onSay} />
          </>
        )}
      </section>
    </div>
  );
}

/** Where to cut a card in two: a dashed line through the working text (§10). */
function SplitHere({ card, onSplit }: { card: ResearchItem; onSplit(at: number): void }) {
  const [at, setAt] = useState(() => Math.floor(card.body.length / 2));
  return (
    <div className="ns-split">
      <p className="muted small">Put the line where the second card should begin.</p>
      <input
        type="range"
        min={1}
        max={Math.max(1, card.body.length - 1)}
        value={at}
        aria-label="Where to split the card"
        onChange={(event) => setAt(Number(event.target.value))}
      />
      <p className="ns-split-text">
        {card.body.slice(0, at)}
        <span className="ns-split-line" aria-hidden />
        {card.body.slice(at)}
      </p>
      <button
        type="button"
        className="tool"
        disabled={card.body.slice(0, at).trim().length === 0 || card.body.slice(at).trim().length === 0}
        onClick={() => onSplit(at)}
      >
        Cut it here
      </button>
      <p className="muted small">Both halves keep the source.</p>
    </div>
  );
}

/** §12: put one card on the research shelf, saying what that costs first. */
function ToTheShelf({
  file,
  card,
  onUpdate,
  onSay,
}: {
  file: ProjectFile;
  card: ResearchItem;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onSay(text: string): void;
}) {
  const folders = researchCategoriesInOrder(file);
  const [pickedId, setPickedId] = useState('');
  const folder = folders.find((one) => (one.id as string) === pickedId) ?? null;
  const offer = folder ? shelfOffer(file, card.id, folder.id) : null;

  return (
    <div className="ns-shelf">
      <span className="muted small">Send it somewhere else as well</span>
      <select
        value={pickedId}
        aria-label="A research folder to file this card in"
        onChange={(event) => setPickedId(event.target.value)}
      >
        <option value="">A research folder…</option>
        {folders.map((one) => (
          <option key={one.id as string} value={one.id as string}>
            {one.name}
          </option>
        ))}
      </select>
      {offer ? <p className="muted small">{offer.says}</p> : null}
      {offer?.can ? (
        <button
          type="button"
          className="tool"
          onClick={() => {
            onUpdate((current) => fileOnShelf(current, card.id, folder!.id));
            onSay(`It is in ${folder!.name} on the shelf.`);
            setPickedId('');
          }}
        >
          File it in {folder!.name}
        </button>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------- 4 Send

function SendTab({
  file,
  session,
  out,
  becomes,
  onOut,
  onBecomes,
  onUpdate,
  onSay,
  onRefine,
}: {
  file: ProjectFile;
  session: NoteSession | null;
  out: readonly string[];
  becomes: Record<string, string>;
  onOut(next: readonly string[]): void;
  onBecomes(next: Record<string, string>): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onSay(text: string): void;
  onRefine(): void;
}) {
  const format = file.project.format;
  const nouns = nounsFor(format);
  /**
   * What each rung is called — the noun table's words, so nothing here spells
   * *Section*. A textbook sends Chapters and Sections, a novel Chapters and
   * Passages, a screenplay Scenes and Beats, and the mapping is one reading
   * (`sendLadder`) rather than a list on this screen.
   */
  const nameOf = (kind: string, many: boolean): string => {
    const one =
      kind === 'chapter'
        ? 'Chapter'
        : kind === 'scene'
          ? nouns.unit
          : kind === 'beat'
            ? nouns.sub
            : kind === 'idea'
              ? 'Idea'
              : 'Note';
    return many ? `${one}s` : one;
  };

  if (session === null) {
    return <div className="ns-empty">Nothing to send yet.</div>;
  }

  const ladder = sendLadder(format);
  const rows = sendRows(file, session.id, format, { out, becomes });
  const count = sendCount(rows, nameOf);
  const kinds = ['chapter', 'scene', 'beat', 'note', 'idea'];
  /** A category's colour, for the dot the mockup puts beside its name. */
  const colourOf = (id: string): string | null =>
    sortCategories(file, session.id).find((one) => (one.id as string) === id)?.color ?? null;

  return (
    <div className="ns-send">
      <section className="ns-panel ns-picker">
        <h3>What goes</h3>
        {/* The handoff's *Writing mode* block. There is **no mode to choose**:
            the project has had a format since the first migration, so a
            second claim about what is being written would be a second answer,
            and the block says what the format decided rather than asking. */}
        <dl className="ns-rules">
          <div>
            <dt>This is a</dt>
            <dd>
              <b>{nouns.work}</b>
            </dd>
          </div>
          <div>
            <dt>Top categories</dt>
            <dd>
              become <b>{nameOf(ladder.top, true)}</b>
            </dd>
          </div>
          <div>
            <dt>One inside it</dt>
            <dd>
              becomes a <b>{nameOf(ladder.sub, false)}</b>
            </dd>
          </div>
          <div>
            <dt>Cards</dt>
            <dd>
              become <b>{nameOf(ladder.card, true)}</b>
              <span className="muted small"> — change any row with its own control</span>
            </dd>
          </div>
        </dl>

        {rows.length === 0 ? (
          <p className="muted small">
            Nothing is filed yet. <button type="button" className="ghost" onClick={onRefine}>Go and sort some cards</button>
          </p>
        ) : (
          <ul className="ns-plan">
            <li className="ns-plan-head">
              <span className="lbl">In this order</span>
              <span className="lbl">Becomes</span>
            </li>
            {rows.map((row) => (
              <li key={row.id} style={{ paddingLeft: `${row.depth * 18}px` }}>
                <label className={row.sent ? 'ns-plan-row' : 'ns-plan-row off'}>
                  <input
                    type="checkbox"
                    checked={!out.includes(row.id)}
                    onChange={(event) =>
                      onOut(
                        event.target.checked ? out.filter((id) => id !== row.id) : [...out, row.id],
                      )
                    }
                  />
                  {row.kind === 'category' ? (
                    <span
                      className="ns-dot"
                      style={
                        colourOf(row.id)
                          ? ({ '--ns-tint': colourOf(row.id) } as React.CSSProperties)
                          : undefined
                      }
                    />
                  ) : null}
                  <span className="ns-plan-title">{row.title || 'Untitled'}</span>
                  {row.sent ? (
                    <select
                      aria-label={`What ${row.title || 'this row'} becomes`}
                      value={row.becomes}
                      onChange={(event) => onBecomes({ ...becomes, [row.id]: event.target.value })}
                    >
                      {kinds.map((kind) => (
                        <option key={kind} value={kind}>
                          {nameOf(kind, false)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted small">not sent</span>
                  )}
                  {row.kind === 'category' ? (
                    <span className="muted small">{row.cards === 1 ? '1 card' : `${row.cards} cards`}</span>
                  ) : null}
                </label>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          Unsorted cards are not sent — file them into a category first, and they come with it. A category with
          nothing in it is not listed here: it is a shelf waiting for something, and an empty chapter is a
          heading nobody wrote.
        </p>
      </section>

      <section className="ns-panel ns-preview">
        <h3>In the Outliner</h3>
        <p className="ns-tally">{count.says}</p>
        <ol className="ns-preview-rows">
          {numberRows(rows.filter((one) => one.sent)).map(({ row, number }) => (
            <li
              key={row.id}
              className={row.kind === 'card' ? 'ns-preview-note' : undefined}
              style={{ paddingLeft: `${row.depth * 22}px` }}
            >
              {/* A number where the outline will carry one, and a card glyph
                  where it will not: an attached note is not numbered, so a
                  number beside one would be a claim the Outliner then fails to
                  make. The numbers are a **reading of these rows**, so
                  unticking a category renumbers what is left with nothing
                  run — which is the whole reason they are worth drawing. */}
              {number ? (
                <span className="ns-preview-n mono">{number}</span>
              ) : (
                <span className="ns-preview-card" aria-hidden="true" />
              )}
              <span className="ns-preview-title">{row.title || 'Untitled'}</span>
              <span className="ns-preview-kind">{nameOf(row.becomes, false)}</span>
            </li>
          ))}
        </ol>
        <div className="ns-send-acts">
          <button type="button" className="ghost" onClick={onRefine}>
            Back to refining
          </button>
          <button
            type="button"
            className="ns-go"
            disabled={count.total === 0}
            onClick={() => {
              let made = 0;
              onUpdate((current) => {
                const sent = sendToOutliner(current, session.id, format, { out, becomes });
                made = sent.made;
                return sent.file;
              });
              onSay(
                `${made === 1 ? '1 row' : `${made} rows`} are in the Outliner. The cards stay here, and the rows read them.`,
              );
            }}
          >
            Send to Outliner
          </button>
        </div>
        <p className="muted small">
          The cards stay in the sorter. A row reads its card, so renaming one here renames the row too.
        </p>
      </section>
    </div>
  );
}
