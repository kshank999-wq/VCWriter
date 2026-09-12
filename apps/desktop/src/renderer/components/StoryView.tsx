import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  beatsForUnit,
  isProseFormat,
  pageBreaks,
  storyLayout,
  updateBeat,
  updateUnit,
  type Beat,
  type BeatId,
  type ProjectFile,
  type StoryLayout,
  type StructuralUnit,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { BeatBody } from './BeatBody';
import { DEFAULT_PAGE_STYLE, ScriptOptions, type PageStyle } from './ScriptOptions';
import { ManuscriptDataLists } from './ManuscriptDataLists';
import { useAsk, useMark, useRoom, useTalk } from '../room';
import { AssignedMark } from './AssignedMark';
import { ContributorMark } from './ContributorMark';
import { TalkMark } from './TalkMark';

/** What the Script shows besides the manuscript itself (addendum 02 §6). */
export interface ScriptDisplay {
  /** Scene headings — the sluglines. A script has them; a novel has none. */
  headings: boolean;
  /** The scene's own name and number: structure, not manuscript. */
  sceneNames: boolean;
  /** The beat names: authoring labels, never printed. */
  beatNames: boolean;
  /** Act breaks where a marker starts. */
  acts: boolean;
  /** Rules where the printed pages break, numbered. Continuous view only. */
  pages: boolean;
}

export const DEFAULT_SCRIPT_DISPLAY: ScriptDisplay = {
  headings: true,
  sceneNames: false,
  beatNames: false,
  acts: true,
  pages: true,
};

/**
 * How the page is laid out under the writing (addendum 02 §6.1).
 *
 * `flow` is one continuous column with the printed page breaks ruled across
 * it. `pages` is the script as sheets of paper: 8½ by 11, one after another,
 * scrolled through.
 */
export type ScriptLayout = 'flow' | 'pages';

/**
 * What the page can be scaled to, as a fraction of its true printed size.
 * Zero is *fit the width there is*, which is what the Script's own column
 * usually wants — a page is 8½ inches and a quarter of a screen is not.
 */
const FIT = 0;
const ZOOMS = [FIT, 0.6, 0.75, 0.85, 1, 1.15, 1.35];
const PAGE_PX = 816; // 8.5in at 96dpi, the size the sheet is drawn at zoom 1.

interface StoryViewProps {
  file: ProjectFile;
  /** Precomputed by the workspace; computed here only when absent (tests). */
  layout?: StoryLayout;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  focusMode: boolean;
  /** A beat whose title should take focus once it appears — a beat just added. */
  focusTitleBeatId: BeatId | null;
  onTitleFocused(): void;
  dictationShortcut: string | null;
  /** Held by the workspace so the choice survives a restart; local if absent. */
  display?: ScriptDisplay;
  onDisplay?(next: ScriptDisplay): void;
  /** Flow or pages, likewise held by the workspace when it cares. */
  scriptLayout?: ScriptLayout;
  onScriptLayout?(next: ScriptLayout): void;
  pageZoom?: number;
  onPageZoom?(next: number): void;
  /** Paper, ink and face — the writer's, not the program's (§6.3). */
  pageStyle?: PageStyle;
  onPageStyle?(next: PageStyle): void;
  /** A scene name was double-clicked: open the scene pop-up. */
  onOpenUnit?(unitId: StructuralUnitId): void;
  /** A beat name was double-clicked: open the beat in the writing screen. */
  onOpenBeat?(beatId: BeatId): void;
}

/**
 * The Script: the manuscript as it will be delivered (addendum 02 §6).
 *
 * This is the view where the work comes together, so it is the finished
 * thing — the page geometry, the indents and the capitals of a shooting
 * script or a manuscript, on paper, with the page breaks where the printed
 * pages actually break. What is *about* the story rather than in it — scene
 * names, beat names, act breaks — is off by default and comes back one
 * toggle at a time, because a writer reading for flow and a writer working
 * on structure want different amounts of scaffolding.
 *
 * It is written in, not only read: putting the cursor in a line and typing
 * is the same edit the beat's writing screen makes, through the same
 * mutations and with the same keys.
 */
export function StoryView({
  file,
  layout: givenLayout,
  selectedBeatId,
  onSelectBeat,
  onUpdate,
  focusMode,
  focusTitleBeatId,
  onTitleFocused,
  dictationShortcut,
  display: givenDisplay,
  onDisplay,
  scriptLayout: givenScriptLayout,
  onScriptLayout,
  pageZoom: givenZoom,
  onPageZoom,
  pageStyle: givenStyle,
  onPageStyle,
  onOpenUnit,
  onOpenBeat,
}: StoryViewProps) {
  const layout = useMemo(() => givenLayout ?? storyLayout(file), [givenLayout, file]);
  const prose = isProseFormat(file.project.format);
  const [ownDisplay, setOwnDisplay] = useState<ScriptDisplay>(DEFAULT_SCRIPT_DISPLAY);
  const [ownLayout, setOwnLayout] = useState<ScriptLayout>('flow');
  const [ownZoom, setOwnZoom] = useState(1);
  const [ownStyle, setOwnStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const display = givenDisplay ?? ownDisplay;
  const setDisplay = onDisplay ?? setOwnDisplay;
  const scriptLayout = givenScriptLayout ?? ownLayout;
  const setScriptLayout = onScriptLayout ?? setOwnLayout;
  const zoom = givenZoom ?? ownZoom;
  const setZoom = onPageZoom ?? setOwnZoom;
  const style = givenStyle ?? ownStyle;
  const setStyle = onPageStyle ?? setOwnStyle;
  const paged = scriptLayout === 'pages';
  const blocks = useRef(new Map<string, HTMLElement>());
  const titles = useRef(new Map<string, HTMLInputElement>());


  // Where the printed pages break, from the one paginator the exports use.
  // The page view needs them to know what goes on which sheet; the
  // continuous view only when the writer asks for the rules.
  const breaks = useMemo(
    () => (paged || display.pages ? pageBreaks(file) : null),
    [file, paged, display.pages],
  );
  const sheets = useMemo(
    () => (paged ? toPages(file, layout, display, breaks ?? new Map()) : null),
    [paged, file, layout, display, breaks],
  );

  /**
   * The stack of sheets is laid out at its true size and then scaled, so the
   * page's geometry never depends on the size it is being looked at. That
   * costs two measurements: the room there is, for fitting the width, and
   * the stack's own height, because a scaled element still takes up its
   * unscaled room unless it is told otherwise.
   */
  const shell = useRef<HTMLDivElement>(null);
  const stack = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(PAGE_PX);
  const [tall, setTall] = useState(0);
  useEffect(() => {
    const scroller = shell.current;
    const sheets = stack.current;
    if (!paged || !scroller || !sheets || typeof ResizeObserver !== 'function') return;
    const measure = () => {
      if (scroller.clientWidth > 0) setRoom(scroller.clientWidth - 40);
      setTall(sheets.offsetHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(sheets);
    return () => observer.disconnect();
  }, [paged, sheets?.length, display, file]);
  const scale = zoom === FIT ? Math.max(0.25, Math.min(1.6, room / PAGE_PX)) : zoom;

  // A selection made in the lanes or the inspector brings the beat into view.
  // One made here — the cursor is already in it — must not yank the page.
  useEffect(() => {
    if (!selectedBeatId) return;
    const block = blocks.current.get(selectedBeatId);
    if (!block || block.contains(document.activeElement)) return;
    if (typeof block.scrollIntoView === 'function') block.scrollIntoView({ block: 'center' });
  }, [selectedBeatId, paged]);

  useEffect(() => {
    if (!focusTitleBeatId) return;
    const input = titles.current.get(focusTitleBeatId);
    if (!input) return;
    input.focus();
    input.select();
    onTitleFocused();
  }, [focusTitleBeatId, onTitleFocused, display.beatNames]);

  // Whose work a record is, where this window is in a Writers Room and is
  // drawing colour at all; nothing outside one (addendum 07 §6).
  const mark = useMark();
  // And who the room is *expecting* it from, which is a different question
  // from whose it is — and never a lock (addendum 07 §8).
  const ask = useAsk();
  // And whether the room is talking about it, which is neither of those and
  // also not a bar to writing (addendum 07 §14).
  const talk = useTalk();
  const roomId = useRoom().identity?.roomId ?? null;

  const noun = prose ? 'Chapter' : 'Scene';
  const toggle = (key: keyof ScriptDisplay) => setDisplay({ ...display, [key]: !display[key] });

  const registerBlock = (beatId: string) => (node: HTMLElement | null) => {
    // In the page view a beat can be drawn on two sheets; the first one is
    // the one worth scrolling to.
    if (node) {
      if (!blocks.current.has(beatId)) blocks.current.set(beatId, node);
    } else {
      blocks.current.delete(beatId);
    }
  };
  const registerTitle = (beatId: string) => (node: HTMLInputElement | null) => {
    if (node) titles.current.set(beatId, node);
    else titles.current.delete(beatId);
  };

  const sceneHeader = (unit: StructuralUnit) => (
    <header
      className="scene-name"
      title={onOpenUnit ? `Double-click to open this ${unit.kind}` : undefined}
      onDoubleClick={() => onOpenUnit?.(unit.id)}
    >
      <input
        className="bar-label"
        aria-label="Sequence label"
        placeholder={prose ? 'Ch.' : 'Sc.'}
        value={unit.sequenceLabel}
        onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { sequenceLabel: event.target.value }))}
      />
      <input
        className="bar-title"
        aria-label={`${unit.kind} title`}
        placeholder={`Untitled ${unit.kind}`}
        value={unit.title}
        onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { title: event.target.value }))}
      />
      <ContributorMark who={mark(unit.origin)} />
      <AssignedMark {...(ask({ kind: 'scene', id: unit.id as string }) ?? { assignment: null, who: null })} />
      <TalkMark count={talk({ kind: 'scene', id: unit.id as string })} roomId={roomId} />
    </header>
  );

  const beatHeader = (beat: Beat) => (
    <header
      className="beat-name"
      title={onOpenBeat ? 'Double-click to open this beat' : undefined}
      onClick={() => onSelectBeat(beat.id)}
      onDoubleClick={() => onOpenBeat?.(beat.id)}
    >
      <input
        ref={registerTitle(beat.id)}
        aria-label="Beat title (not printed)"
        placeholder="What happens in this beat"
        value={beat.title}
        onFocus={() => onSelectBeat(beat.id)}
        onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
        onClick={(event) => event.stopPropagation()}
      />
      {beat.revisions.length > 0 ? <span className="revision-chip muted">{beat.revisionName}</span> : null}
    </header>
  );

  const beatBody = (beat: Beat, only: ReadonlySet<number> | null, lead: boolean) => (
    <article
      ref={lead ? registerBlock(beat.id) : undefined}
      className={`beat-block${beat.id === selectedBeatId ? ' selected' : ''}${beat.color ? ' coloured' : ''}`}
      style={beat.color ? ({ '--beat-colour': beat.color } as React.CSSProperties) : undefined}
      aria-current={beat.id === selectedBeatId ? 'true' : undefined}
    >
      {/* The writing is done here as well as in the beat's own screen; this
          is the way to that screen without taking double-click away from
          selecting a word. */}
      {/* Whose beat this is, in a room (addendum 07 §6.2), on the block
          itself rather than on the name row — the names are an authoring
          annotation the writer turns off, and whose words these are is not.
          It sits opposite the ✎, outside the page's own column. */}
      {lead ? <ContributorMark who={mark(beat.origin)} /> : null}
      {lead ? (
        <AssignedMark {...(ask({ kind: 'beat', id: beat.id as string }) ?? { assignment: null, who: null })} />
      ) : null}
      {lead ? <TalkMark count={talk({ kind: 'beat', id: beat.id as string })} roomId={roomId} /> : null}
      {onOpenBeat && lead ? (
        <button
          type="button"
          className="beat-open"
          aria-label="Write in this beat"
          title="Write in this beat"
          onClick={() => onOpenBeat(beat.id)}
        >
          ✎
        </button>
      ) : null}
      <BeatBody
        file={file}
        beat={beat}
        breaks={paged ? null : breaks}
        only={only}
        emptyLabel={null}
        onUpdate={onUpdate}
        onActivate={() => onSelectBeat(beat.id)}
      />
    </article>
  );

  return (
    <div
      className={['story script-view', focusMode ? 'focus' : '', paged ? 'paged' : '', style.on ? 'own-paper' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        style.on
          ? // Names of their own rather than the paper preference's: the
            // sheet re-declares those locally, and a variable cannot be
            // inherited past a declaration on the element itself.
            ({ '--own-paper': style.paper, '--own-ink': style.ink, '--own-face': style.face } as React.CSSProperties)
          : undefined
      }
    >
      <ManuscriptDataLists file={file} />

      {focusMode ? null : (
        <div className="script-options" role="group" aria-label="Script display">
          {/* Everything about how the page looks is behind the gear now: the
              bar above the page should be the page's, not a control panel. */}
          <button
            type="button"
            className={optionsOpen ? 'chip on gear' : 'chip gear'}
            aria-label="Page options"
            aria-haspopup="dialog"
            aria-expanded={optionsOpen}
            title="Paper, ink, typeface and what shows"
            onClick={() => setOptionsOpen((current) => !current)}
          >
            ⚙
          </button>
          <span className="muted">{paged ? 'Pages' : 'Continuous'}</span>
          {paged ? (
            <label className="script-zoom">
              <span className="muted">Page</span>
              <select aria-label="Page size" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
                {ZOOMS.map((step) => (
                  <option key={step} value={step}>
                    {step === FIT ? 'Fit width' : `${Math.round(step * 100)}%`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <ScriptOptions
            open={optionsOpen}
            onClose={() => setOptionsOpen(false)}
            style={style}
            onStyle={setStyle}
            display={display}
            onDisplay={setDisplay}
            scriptLayout={scriptLayout}
            onScriptLayout={setScriptLayout}
            prose={prose}
          />
        </div>
      )}

      {paged && sheets ? (
        <div className="script-pages" ref={shell} style={{ '--page-zoom': scale } as React.CSSProperties}>
          {/* The frame takes the room the scaled stack looks like it takes;
              the stack itself is laid out at the page's true size. */}
          <div
            className="page-frame"
            style={{ width: PAGE_PX * scale, height: tall > 0 ? tall * scale : undefined }}
          >
            <div className="page-stack" ref={stack}>
              {sheets.map((items, index) => (
            <section
              key={index}
              className={display.headings ? 'page-sheet' : 'page-sheet no-headings'}
              aria-label={`Page ${index + 1}`}
            >
              <span className="page-sheet-number" aria-hidden="true">
                {index + 1}.
              </span>
              {/* No title block. The title page is a page of the document,
                  printed when the writer asks for it in Page setup — not a
                  heading over the work (§6.1). Page one is page one. */}
              {/* Fragments rather than wrappers: the sheet's own children must
                  be the blocks themselves, so the blank line the paginator
                  puts between two of them is a rule between siblings. */}
              {items.map((item) => (
                <Fragment key={item.key}>
                  {item.kind === 'act' ? (
                    <div className="act-bar">
                      <span>{item.title}</span>
                    </div>
                  ) : item.kind === 'scene' ? (
                    sceneHeader(item.unit)
                  ) : item.kind === 'beatName' ? (
                    beatHeader(item.beat)
                  ) : (
                    beatBody(item.beat, item.only, item.lead)
                  )}
                </Fragment>
              ))}
                </section>
              ))}
            </div>
          </div>
          {sheets.length === 0 ? (
            <p className="muted empty-state">Add a scene from the lanes toolbar to start writing.</p>
          ) : null}
        </div>
      ) : (
        <div className={display.headings ? 'script-sheet' : 'script-sheet no-headings'}>
          {layout.spans.map((span) => {
            const unit = span.unit;
            // A scene switched off leaves the script and stays on the timeline.
            if (!unit.inScript) return null;
            const beats = beatsForUnit(file, unit.id).filter((beat) => beat.inScript);
            return (
              <section key={unit.id} className="scene" aria-label={`${unit.kind} ${unit.title || 'untitled'}`}>
                {display.acts && span.marker ? (
                  <div className="act-bar">
                    <span>{span.marker.title || span.marker.kind}</span>
                  </div>
                ) : null}

                {display.sceneNames ? sceneHeader(unit) : null}

                {beats.map((beat) => (
                  <div key={beat.id}>
                    {display.beatNames ? beatHeader(beat) : null}
                    {beatBody(beat, null, true)}
                  </div>
                ))}

                {beats.length === 0 ? (
                  <p className="muted collapsed-note">Nothing in this {unit.kind} is in the script.</p>
                ) : null}
              </section>
            );
          })}

          {layout.spans.length === 0 ? (
            <p className="muted empty-state">Add a scene from the lanes toolbar to start writing.</p>
          ) : null}
        </div>
      )}

      {focusMode ? null : (
        <footer className="script-foot muted">
          {/* The page is not a preview of the writing: it *is* the writing,
              with the same keys and the same formatting as the beat's own
              screen. Saying so is the difference between a writer using it
              and a writer double-clicking their way around it. */}
          The whole {prose ? 'manuscript' : 'script'} in story order · type straight into the page, or double-click a beat to
          open it on its own · Return for the next element, Tab to change its type
          {dictationShortcut ? ` · to dictate, ${dictationShortcut}` : ''}
        </footer>
      )}
    </div>
  );
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick(): void }) {
  return (
    <button type="button" className={on ? 'chip on' : 'chip'} aria-pressed={on} aria-label={label} onClick={onClick}>
      {label}
    </button>
  );
}

// ------------------------------------------------------------- the sheets

type PageItem =
  | { kind: 'act'; key: string; title: string }
  | { kind: 'scene'; key: string; unit: StructuralUnit }
  | { kind: 'beatName'; key: string; beat: Beat }
  /** A run of one beat's elements: all of it, or the part that is on this sheet. */
  | { kind: 'body'; key: string; beat: Beat; only: ReadonlySet<number>; lead: boolean };

/**
 * The script dealt out onto sheets of paper (addendum 02 §6.1).
 *
 * The pages are the paginator's, not a guess: `pageBreaks` says which
 * element opens each printed page, and a beat whose elements straddle one is
 * drawn in two runs, on the sheet each run belongs to.
 *
 * Act bars, scene names and beat names print nothing and take up no printed
 * lines, so they are held until the first manuscript run after them and go
 * onto whichever sheet that lands on. Otherwise a scene name could end up
 * alone at the foot of a page while its first line is over the leaf.
 */
const toPages = (
  file: ProjectFile,
  layout: StoryLayout,
  display: ScriptDisplay,
  breaks: Map<string, number>,
): PageItem[][] => {
  const sheets: PageItem[][] = [[]];
  const sheet = (number: number): PageItem[] => {
    while (sheets.length < number) sheets.push([]);
    return sheets[number - 1] as PageItem[];
  };

  let page = 1;
  let waiting: PageItem[] = [];
  const settle = (number: number) => {
    if (waiting.length === 0) return;
    sheet(number).push(...waiting);
    waiting = [];
  };

  for (const span of layout.spans) {
    const unit = span.unit;
    // A scene switched off leaves the script and stays on the timeline.
    if (!unit.inScript) continue;

    if (display.acts && span.marker) {
      waiting.push({ kind: 'act', key: `act-${unit.id}`, title: span.marker.title || span.marker.kind });
    }
    if (display.sceneNames) waiting.push({ kind: 'scene', key: `scene-${unit.id}`, unit });

    for (const beat of beatsForUnit(file, unit.id).filter((candidate) => candidate.inScript)) {
      if (display.beatNames) waiting.push({ kind: 'beatName', key: `name-${beat.id}`, beat });

      const elements = beat.manuscript.elements;
      if (elements.length === 0) {
        settle(page);
        continue;
      }

      let runPage = page;
      let run: number[] = [];
      let lead = true;
      const emit = () => {
        if (run.length === 0) return;
        settle(runPage);
        sheet(runPage).push({ kind: 'body', key: `${beat.id}-${runPage}`, beat, only: new Set(run), lead });
        run = [];
        lead = false;
      };

      elements.forEach((element, index) => {
        const opens = breaks.get(element.id);
        if (opens !== undefined && opens !== runPage) {
          emit();
          runPage = opens;
        }
        run.push(index);
      });
      emit();
      page = runPage;
    }
  }

  settle(page);
  return sheets;
};
