import { useEffect, useMemo, useRef, useState } from 'react';
import {
  beatsForUnit,
  findLane,
  isProseFormat,
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
import { STATUS_GLYPH } from './status';

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
  /** A scene bar was double-clicked: open the scene pop-up. */
  onOpenUnit?(unitId: StructuralUnitId): void;
  /** A beat bar was double-clicked: open the beat pop-up. */
  onOpenBeat?(beatId: BeatId): void;
}

/**
 * The whole manuscript in the order it prints (addendum 02 §4).
 *
 * Structure appears as bars in the flow of the text: a scene bar in the
 * lane's colour at the start of each scene, a lighter beat bar at the start
 * of each beat, and under each beat bar the beat's manuscript. The beat title
 * is a bar and not a line of script, which is what keeps §5.3's rule visible:
 * the writer can see it is not part of the page.
 *
 * Putting the cursor in a beat selects it; selecting a beat anywhere else
 * scrolls here. Nothing else in this file knows about the lanes.
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
  onOpenUnit,
  onOpenBeat,
}: StoryViewProps) {
  const layout = useMemo(() => givenLayout ?? storyLayout(file), [givenLayout, file]);
  const prose = isProseFormat(file.project.format);
  const [collapsedBeats, setCollapsedBeats] = useState<ReadonlySet<string>>(() => new Set());
  const blocks = useRef(new Map<string, HTMLElement>());
  const titles = useRef(new Map<string, HTMLInputElement>());

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
  }, [focusTitleBeatId, onTitleFocused]);

  const toggleBeat = (beatId: string) =>
    setCollapsedBeats((current) => {
      const next = new Set(current);
      if (next.has(beatId)) next.delete(beatId);
      else next.add(beatId);
      return next;
    });

  const characterNames = file.characters.map((character) => character.name);

  return (
    <div className={focusMode ? 'story focus' : 'story'}>
      <datalist id="vcwriter-characters">
        {characterNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {layout.spans.map((span) => {
        const unit = span.unit;
        // A scene switched off leaves the script (addendum 02 §4); it is
        // still on the timeline, dimmed, and opens from there.
        if (!unit.inScript) return null;
        const lane = findLane(file, unit.laneId);
        const beats = beatsForUnit(file, unit.id);
        const noun = unit.kind;
        return (
          <section key={unit.id} className="scene" aria-label={`${noun} ${unit.title || 'untitled'}`}>
            {span.marker ? (
              <div className="act-bar">
                <span>{span.marker.title || span.marker.kind}</span>
              </div>
            ) : null}
            <header
              className={unit.collapsed ? 'scene-bar collapsed' : 'scene-bar'}
              style={{ borderLeftColor: lane?.color }}
              title={onOpenUnit ? `Double-click to open this ${noun}` : undefined}
              onClick={() => {
                const first = beats[0];
                if (first) onSelectBeat(first.id);
              }}
              onDoubleClick={() => onOpenUnit?.(unit.id)}
            >
              <button
                type="button"
                className="ghost twisty"
                aria-expanded={!unit.collapsed}
                aria-label={unit.collapsed ? `Expand ${noun}` : `Collapse ${noun}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onUpdate((current) => updateUnit(current, unit.id, { collapsed: !unit.collapsed }));
                }}
              >
                {unit.collapsed ? '▸' : '▾'}
              </button>
              <input
                className="bar-label"
                aria-label="Sequence label"
                placeholder={noun === 'chapter' ? 'Ch.' : 'Sc.'}
                value={unit.sequenceLabel}
                onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { sequenceLabel: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
              />
              <input
                className="bar-title"
                aria-label={`${noun} title`}
                placeholder={`Untitled ${noun}`}
                value={unit.title}
                onChange={(event) => onUpdate((current) => updateUnit(current, unit.id, { title: event.target.value }))}
                onClick={(event) => event.stopPropagation()}
              />
              <span className="bar-meta">
                {lane ? (
                  <span className="lane-chip" style={{ color: lane.color }}>
                    {lane.name}
                  </span>
                ) : null}
                <span className="muted">p. {Math.floor(span.startPage) + 1}</span>
              </span>
            </header>

            {unit.collapsed ? (
              <p className="muted collapsed-note">
                {beats.length} {beats.length === 1 ? 'beat' : 'beats'}
              </p>
            ) : (
              <>
                {beats.map((beat) => (
                  <BeatBlock
                    key={beat.id}
                    file={file}
                    beat={beat}
                    selected={beat.id === selectedBeatId}
                    collapsed={collapsedBeats.has(beat.id)}
                    onToggle={() => toggleBeat(beat.id)}
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
                  <p className="muted collapsed-note">No beats in this {noun} yet. Use + Beat on the lanes toolbar.</p>
                ) : null}
              </>
            )}
          </section>
        );
      })}

      {layout.spans.length === 0 ? (
        <p className="muted empty-state">Add a scene from the lanes toolbar to start writing.</p>
      ) : null}

      <footer className="story-hints muted">
        <p>
          Return for the next element · Tab to change its type · Shift+Return for a line break
          {prose ? '' : ' · Tab from a character cue gives a parenthetical'}
        </p>
        {/*
          Dictation (§9). Electron's Chromium ships no working speech-recognition
          API, so this points at the system dictation that already works in any
          focused field. VC Writer Notes on a phone uses the browser API.
        */}
        <p>
          To dictate, put the cursor in an element and use your system dictation
          {dictationShortcut ? ` (${dictationShortcut})` : ''}.
        </p>
      </footer>
    </div>
  );
}

interface BeatBlockProps {
  file: ProjectFile;
  beat: Beat;
  selected: boolean;
  collapsed: boolean;
  onToggle(): void;
  onSelect(): void;
  onOpen?(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  registerBlock(node: HTMLElement | null): void;
  registerTitle(node: HTMLInputElement | null): void;
}

function BeatBlock({ file, beat, selected, collapsed, onToggle, onSelect, onOpen, onUpdate, registerBlock, registerTitle }: BeatBlockProps) {
  return (
    <article
      ref={registerBlock}
      className={`beat-block${selected ? ' selected' : ''}${beat.color ? ' coloured' : ''}`}
      style={beat.color ? ({ '--beat-colour': beat.color } as React.CSSProperties) : undefined}
      aria-current={selected ? 'true' : undefined}
    >
      <header
        className="beat-bar"
        title={onOpen ? 'Double-click to open this beat' : undefined}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <button
          type="button"
          className="ghost twisty"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand beat' : 'Collapse beat'}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        {/* The internal beat title: authoring metadata, never manuscript (§5.3, §19). */}
        <input
          ref={registerTitle}
          className="bar-title beat"
          aria-label="Beat title (not printed)"
          placeholder="What happens in this beat"
          value={beat.title}
          onFocus={onSelect}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
          onClick={(event) => event.stopPropagation()}
        />
        {beat.revisions.length > 0 ? (
          <span className="revision-chip muted" title={`${beat.revisions.length} other ${beat.revisions.length === 1 ? 'revision' : 'revisions'} kept`}>
            {beat.revisionName}
          </span>
        ) : null}
        <span className={`status-pill status-${beat.status}`} title={beat.status}>
          <span aria-hidden="true">{STATUS_GLYPH[beat.status]}</span> {beat.status}
        </span>
      </header>
      {collapsed ? null : <BeatBody file={file} beat={beat} onUpdate={onUpdate} onActivate={onSelect} />}
    </article>
  );
}
