import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  sendCount,
  sendLadder,
  sendRows,
  sendToOutliner,
  sessionCards,
  sessionProgress,
  shelfOffer,
  sortCategories,
  sortingSessions,
  sourcesOf,
  splitCard,
  unreferenceCard,
  unsortedOf,
  updateResearchCategory,
  updateResearchItem,
  whereFrom,
  nounsFor,
  type NoteSession,
  type NoteSessionId,
  type NoteSource,
  type NoteSourceId,
  type ProjectFile,
  type ResearchCategory,
  type ResearchCategoryId,
  type ResearchItem,
  type ResearchItemId,
  type SendRow,
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

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'gather', label: '1 Gather' },
  { key: 'sort', label: '2 Sort' },
  { key: 'refine', label: '3 Refine' },
  { key: 'send', label: '4 Send to Outliner' },
];

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

const percent = (share: number): string => `${Math.round(share * 100)}%`;

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
  /** In a window of its own there is nothing to uncover, so there is no ✕. */
  standalone?: boolean;
}

export function NoteSorterWindow({
  file,
  open,
  onClose,
  onUpdate,
  onPopOut,
  standalone = false,
}: NoteSorterWindowProps) {
  const sessions = sortingSessions(file);
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
      <header className="sculptor-bar">
        <h2>Note Sorter</h2>
        {sessions.length > 1 ? (
          <select
            aria-label="Which sitting"
            value={(chosen?.id as string) ?? ''}
            onChange={(event) => {
              setSessionId(event.target.value as NoteSessionId);
              setSourceId(null);
              setCardId(null);
            }}
          >
            {sessions.map((one) => (
              <option key={one.id as string} value={one.id as string}>
                {one.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted small">{chosen ? chosen.name : 'Nothing put in yet'}</span>
        )}

        {chosen ? (
          <span className="ns-progress" title="How much of this sitting has been through your hands">
            <span className="ns-progress-rail">
              <span className="ns-progress-run" style={{ width: percent(progress.share) }} />
            </span>
            {/* Progress, never a score (§11): what it answers is *have I been
                through all of this*, and nothing follows from the figure. */}
            <span className="muted small">{percent(progress.share)} dealt with</span>
          </span>
        ) : null}

        <span className="toolbar-spacer" />

        <input
          type="search"
          className="ns-search"
          placeholder="Search notes and cards"
          aria-label="Search every source and every card"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="tool"
          title="Start another sitting, with its own sources and categories"
          onClick={() => {
            let made: NoteSessionId | null = null;
            onUpdate((current) => {
              const begun = beginSession(current, `${current.project.title} · notes`);
              made = begun.session.id;
              return begun.file;
            });
            if (made) {
              setSessionId(made);
              setSourceId(null);
              setTab('gather');
            }
          }}
        >
          + Sitting
        </button>
        {onPopOut ? <PopOutButton onPopOut={onPopOut} what="the Note Sorter" /> : null}
        {standalone ? null : (
          <button type="button" className="ghost" onClick={onClose} aria-label="Close the Note Sorter">
            ✕
          </button>
        )}
      </header>

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
            {one.label}
          </button>
        ))}
      </nav>

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
                      <strong>{one.name}</strong>
                    )}
                    <span className="ns-src-bar" aria-hidden>
                      <span className="ns-src-run" style={{ width: percent(done.share) }} />
                    </span>
                    <span className="muted small">{percent(done.share)}</span>
                  </div>
                  <p className="muted small mono">
                    {one.kind} · {one.text.length.toLocaleString()} characters ·{' '}
                    {one.text.split(/\n\s*\n/).filter((part) => part.trim().length > 0).length} paragraphs
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
      </section>

      <section className="ns-panel">
        <h3>Add material</h3>
        <label className="ns-add">
          <span>Import a file</span>
          <input
            type="file"
            multiple
            accept={NOTE_SOURCE_ACCEPT}
            aria-label="Import notes from a file"
            onChange={(event) => void files(event.target.files)}
          />
          <span className="muted small">Word, text, Markdown or a PDF. You can drop files anywhere on this page.</span>
        </label>

        <label className="ns-add">
          <span>Paste or type</span>
          <textarea
            rows={8}
            value={typed}
            placeholder="Paste a page of notes, or write straight in"
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
              put(typed, 'paste', name.trim() || 'Pasted notes');
              setTyped('');
              setName('');
            }}
          >
            Add it
          </button>
        </label>

        <NotesFromProject file={file} onPut={(text, named) => put(text, 'notes', named)} />
      </section>

      <Dictation onPut={(text) => put(text, 'dictation', `Dictated ${new Date().toLocaleDateString()}`)} onSay={onSay} />
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
function Dictation({ onPut, onSay }: { onPut(text: string): void; onSay(text: string): void }) {
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
    <section className="ns-panel ns-dictate">
      <h3>Say it out loud</h3>
      {/* The line the handoff asks for by name, and it is the point of the
          panel: capture is kept apart from organising. */}
      <p className="ns-just-talk">Just talk. You’ll sort it later.</p>

      <div className="ns-dictate-bar">
        <span className={running ? 'ns-clock on mono' : 'ns-clock mono'}>{clock}</span>
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
}) {
  const page = useRef<HTMLDivElement | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);

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
              {one.name} <span className="muted small">{percent(progressOf(file, one).share)}</span>
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
          {range
            ? `${range.to - range.from} characters highlighted — drop them on a category, or press one.`
            : 'Highlight a passage, then drag it across or press a category. Nothing is ever cut from this page.'}
        </p>
      </section>

      <div className="split-handle" role="separator" aria-label="Resize the raw notes" {...split.dividerProps} />

      <section className="ns-panel ns-stacks">
        <div className="ns-stacks-head">
          <h3>Categories</h3>
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
            <button type="button" className="tool" onClick={() => setNaming(true)}>
              + Category
            </button>
          )}
        </div>

        {categories.length === 0 ? (
          <p className="muted small">
            No categories yet. Make one and the passages you highlight have somewhere to go — you can rename and
            rearrange them afterwards.
          </p>
        ) : (
          <>
            {/* **A category with nothing in it is a chip** (§8). The handoff
                asks for chips so a sitting of fifteen categories still fits,
                and which ones are chips is a *reading* rather than a
                measurement: one you have not used yet is a chip and becomes a
                stack the moment something lands in it. A chip takes a press and
                a drop exactly as a stack does, because a target a writer cannot
                drop on is not a target. */}
            {categories.some((one) => cardsIn(file, one.id).length === 0) ? (
              <div className="ns-chip-row">
                {categories
                  .filter((one) => cardsIn(file, one.id).length === 0)
                  .map((one) => (
                    <button
                      key={one.id as string}
                      type="button"
                      className={over === (one.id as string) ? 'ns-chip over' : 'ns-chip'}
                      title={offerFor(one)}
                      style={one.color ? ({ '--ns-tint': one.color } as React.CSSProperties) : undefined}
                      onClick={() => file_(one.id, null)}
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
                      <span className="ns-dot" />
                      {one.name}
                    </button>
                  ))}
              </div>
            ) : null}
            <div className="ns-stack-row">
            {categories.filter((one) => cardsIn(file, one.id).length > 0).map((one) => {
              const held = cardsIn(file, one.id);
              return (
                <button
                  key={one.id as string}
                  type="button"
                  className={over === (one.id as string) ? 'ns-stack over' : 'ns-stack'}
                  title={offerFor(one)}
                  style={one.color ? ({ '--ns-tint': one.color } as React.CSSProperties) : undefined}
                  onClick={() => file_(one.id, null)}
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
                  <span className="ns-stack-head">
                    <span className="ns-dot" />
                    {one.name}
                    <span className="muted small">{held.length}</span>
                  </span>
                  <span className="ns-stack-cards">
                    {held.slice(0, 4).map((held_) => (
                      <span key={held_.id as string} className="ns-card mini">
                        <span className="ns-card-title">{held_.title}</span>
                        <span className="ns-card-body">{held_.body}</span>
                      </span>
                    ))}
                    {over === (one.id as string) ? <span className="ns-card slot">Drop to add a card</span> : null}
                    {held.length > 4 ? (
                      <span className="muted small">and {held.length - 4} more</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

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
            {picked.length > 1 ? (
              <button
                type="button"
                className="tool"
                onClick={() => {
                  onUpdate((current) => mergeCards(current, picked as ResearchItemId[]).file);
                  onSay(`${picked.length} cards are now one. The rest are in the graveyard if that was wrong.`);
                  onPicked([]);
                }}
              >
                Merge {picked.length} cards
              </button>
            ) : (
              <p className="muted small">Shift-click two or more cards to join them.</p>
            )}
          </>
        )}
      </section>

      <section className="ns-panel ns-detail">
        {card === null ? (
          <p className="muted small">Choose a card to work on it.</p>
        ) : (
          <>
            <h3>The card</h3>
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
            <label className="ns-field">
              <span>Working text</span>
              <textarea
                rows={8}
                value={card.body}
                onChange={(event) =>
                  onUpdate((current) => updateResearchItem(current, card.id, { body: event.target.value }))
                }
              />
              <span className="muted small">Editing this never changes the source.</span>
            </label>
            <label className="ns-field">
              <span>Tags</span>
              <input
                type="text"
                value={card.tags.join(', ')}
                placeholder="craft, opening"
                onChange={(event) =>
                  onUpdate((current) =>
                    updateResearchItem(current, card.id, {
                      tags: event.target.value.split(',').map((one) => one.trim()).filter(Boolean),
                    }),
                  )
                }
              />
            </label>

            <div className="ns-quote">
              <span className="muted small mono">{whereFrom(file, card)}</span>
              <blockquote>{passageOf(file, card) || 'The source has gone.'}</blockquote>
            </div>

            <div className="ns-card-acts">
              <button
                type="button"
                className={splitting ? 'tool on' : 'tool'}
                aria-pressed={splitting}
                onClick={() => setSplitting(!splitting)}
              >
                Split
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

            <div className="ns-appears">
              <span className="muted small">Appears in</span>
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

  return (
    <div className="ns-send">
      <section className="ns-panel ns-picker">
        <h3>What goes</h3>
        {/* The mapping is read off the project's format, and there is nowhere
            to choose a second one: this is a {work}, and a sitting that said
            otherwise would be a second claim about one piece of work. */}
        <p className="muted small">
          This is a {nouns.work.toLowerCase()}, so a top category becomes a {nameOf(ladder.top, false)}, one
          inside it a {nameOf(ladder.sub, false)}, and a card a {nameOf(ladder.card, false)}. Change any row
          with its own control.
        </p>

        {rows.length === 0 ? (
          <p className="muted small">
            Nothing is filed yet. <button type="button" className="ghost" onClick={onRefine}>Go and sort some cards</button>
          </p>
        ) : (
          <ul className="ns-plan">
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
          Unsorted cards are not sent — file them into a category first, and they come with it.
        </p>
      </section>

      <section className="ns-panel ns-preview">
        <h3>In the Outliner</h3>
        <p className="ns-tally">{count.says}</p>
        <ol className="ns-preview-rows">
          {rows
            .filter((one) => one.sent)
            .map((row) => (
              <li key={row.id} style={{ paddingLeft: `${row.depth * 18}px` }}>
                <span className="ns-preview-kind">{nameOf(row.becomes, false)}</span>
                <span>{row.title || 'Untitled'}</span>
              </li>
            ))}
        </ol>
        <div className="ns-send-acts">
          <button type="button" className="ghost" onClick={onRefine}>
            Back to refining
          </button>
          <button
            type="button"
            className="tool"
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
