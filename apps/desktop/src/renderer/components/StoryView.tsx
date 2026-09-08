import { useEffect, useMemo, useRef, useState } from 'react';
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
  type StructuralUnitId,
} from '@vcwriter/domain';
import { BeatBody } from './BeatBody';
import { ManuscriptDataLists } from './ManuscriptDataLists';

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
  /** Rules where the printed pages break, numbered. */
  pages: boolean;
}

export const DEFAULT_SCRIPT_DISPLAY: ScriptDisplay = {
  headings: true,
  sceneNames: false,
  beatNames: false,
  acts: true,
  pages: true,
};

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
 * script or a manuscript, on paper, with the page breaks ruled where the
 * printed pages actually break. What is *about* the story rather than in
 * it — scene names, beat names, act breaks — is off by default and comes
 * back one toggle at a time, because a writer reading for flow and a
 * writer working on structure want different amounts of scaffolding.
 *
 * It stays editable: putting the cursor in a line and typing is the same
 * edit the beat's writing screen makes, through the same mutation.
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
  onOpenUnit,
  onOpenBeat,
}: StoryViewProps) {
  const layout = useMemo(() => givenLayout ?? storyLayout(file), [givenLayout, file]);
  const prose = isProseFormat(file.project.format);
  const [ownDisplay, setOwnDisplay] = useState<ScriptDisplay>(DEFAULT_SCRIPT_DISPLAY);
  const display = givenDisplay ?? ownDisplay;
  const setDisplay = onDisplay ?? setOwnDisplay;
  const blocks = useRef(new Map<string, HTMLElement>());
  const titles = useRef(new Map<string, HTMLInputElement>());

  // Where the printed pages break, from the one paginator the exports use.
  const breaks = useMemo(() => (display.pages ? pageBreaks(file) : null), [file, display.pages]);

  // A selection made in the lanes or the inspector brings the beat into view.
  // One made here — the cursor is already in it — must not yank the page.
  useEffect(() => {
    if (!selectedBeatId) return;
    const block = blocks.current.get(selectedBeatId);
    if (!block || block.contains(document.activeElement)) return;
    if (typeof block.scrollIntoView === 'function') block.scrollIntoView({ block: 'center' });
  }, [selectedBeatId]);

  useEffect(() => {
    if (!focusTitleBeatId) return;
    const input = titles.current.get(focusTitleBeatId);
    if (!input) return;
    input.focus();
    input.select();
    onTitleFocused();
  }, [focusTitleBeatId, onTitleFocused, display.beatNames]);

  const noun = prose ? 'Chapter' : 'Scene';
  const toggle = (key: keyof ScriptDisplay) => setDisplay({ ...display, [key]: !display[key] });

  return (
    <div className={focusMode ? 'story script-view focus' : 'story script-view'}>
      <ManuscriptDataLists file={file} />

      {focusMode ? null : (
        <div className="script-options" role="group" aria-label="Script display">
          <span className="muted">Display</span>
          {prose ? null : <Chip label="Scene headings" on={display.headings} onClick={() => toggle('headings')} />}
          <Chip label={`${noun} names`} on={display.sceneNames} onClick={() => toggle('sceneNames')} />
          <Chip label="Beat names" on={display.beatNames} onClick={() => toggle('beatNames')} />
          <Chip label="Acts" on={display.acts} onClick={() => toggle('acts')} />
          <Chip label="Page breaks" on={display.pages} onClick={() => toggle('pages')} />
        </div>
      )}

      <div className={display.headings ? 'script-sheet' : 'script-sheet no-headings'}>
        <header className="script-title-block">
          <h1>{file.project.title}</h1>
          {file.project.author ? <p>by {file.project.author}</p> : null}
        </header>

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

              {display.sceneNames ? (
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
                </header>
              ) : null}

              {beats.map((beat) => (
                <BeatBlock
                  key={beat.id}
                  file={file}
                  beat={beat}
                  selected={beat.id === selectedBeatId}
                  showName={display.beatNames}
                  breaks={breaks}
                  onSelect={() => onSelectBeat(beat.id)}
                  onOpen={onOpenBeat ? () => onOpenBeat(beat.id) : undefined}
                  onUpdate={onUpdate}
                  registerBlock={(node) => {
                    if (node) blocks.current.set(beat.id, node);
                    else blocks.current.delete(beat.id);
                  }}
                  registerTitle={(node) => {
                    if (node) titles.current.set(beat.id, node);
                    else titles.current.delete(beat.id);
                  }}
                />
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

interface BeatBlockProps {
  file: ProjectFile;
  beat: Beat;
  selected: boolean;
  showName: boolean;
  breaks: Map<string, number> | null;
  onSelect(): void;
  onOpen?(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  registerBlock(node: HTMLElement | null): void;
  registerTitle(node: HTMLInputElement | null): void;
}

function BeatBlock({
  file,
  beat,
  selected,
  showName,
  breaks,
  onSelect,
  onOpen,
  onUpdate,
  registerBlock,
  registerTitle,
}: BeatBlockProps) {
  return (
    <article
      ref={registerBlock}
      className={`beat-block${selected ? ' selected' : ''}${beat.color ? ' coloured' : ''}`}
      style={beat.color ? ({ '--beat-colour': beat.color } as React.CSSProperties) : undefined}
      aria-current={selected ? 'true' : undefined}
    >
      {/* The beat's name is authoring metadata, never manuscript (§5.3, §19),
          so it is shown only when the writer asks for it. */}
      {/* The writing is done in the beat's own screen; this is how you get
          there from the page, without taking double-click away from the text. */}
      {onOpen ? (
        <button type="button" className="beat-open" aria-label="Write in this beat" title="Write in this beat" onClick={onOpen}>
          ✎
        </button>
      ) : null}
      {showName ? (
        <header
          className="beat-name"
          title={onOpen ? 'Double-click to open this beat' : undefined}
          onClick={onSelect}
          onDoubleClick={onOpen}
        >
          <input
            ref={registerTitle}
            aria-label="Beat title (not printed)"
            placeholder="What happens in this beat"
            value={beat.title}
            onFocus={onSelect}
            onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
            onClick={(event) => event.stopPropagation()}
          />
          {beat.revisions.length > 0 ? <span className="revision-chip muted">{beat.revisionName}</span> : null}
        </header>
      ) : null}
      <BeatBody file={file} beat={beat} breaks={breaks} emptyLabel={null} onUpdate={onUpdate} onActivate={onSelect} />
    </article>
  );
}
