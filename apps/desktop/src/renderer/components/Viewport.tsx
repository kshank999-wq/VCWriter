import { useEffect, useMemo, useRef, useState } from 'react';
import {
  beatsInStoryOrder,
  findUnit,
  paginateUnit,
  storyLayout,
  type BeatId,
  type ProjectFile,
  type StoryLayout,
  type ThreadLayout,
} from '@vcwriter/domain';
import { Paper } from './Paper';
import { ThreadView } from './ThreadView';

export type ViewportView = 'page' | 'threads';

interface ViewportProps {
  file: ProjectFile;
  layout?: StoryLayout;
  threads?: ThreadLayout;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  view: ViewportView;
  onView(view: ViewportView): void;
}

/**
 * The viewport (addendum 02 §6): where an editor shows the picture, this
 * shows the story. Two views: **Page**, the selected scene as it prints, and
 * **Threads**, the connections through the whole story. The header names
 * the scene and counts pages the way a viewer shows a clip and a timecode;
 * the transport row under it steps through beats in story order.
 */
export function Viewport({ file, layout: givenLayout, threads, selectedBeatId, onSelectBeat, onUpdate, view, onView }: ViewportProps) {
  const beats = useMemo(() => beatsInStoryOrder(file), [file]);
  const position = beats.findIndex((beat) => beat.id === selectedBeatId);
  const beat = beats[position];
  const unit = beat ? findUnit(file, beat.unitId) : undefined;
  // A scene switched off has no pages to show: it is out of the script.
  const pages = useMemo(() => (unit?.inScript ? paginateUnit(file, unit.id) : []), [file, unit]);
  const layout = useMemo(() => givenLayout ?? storyLayout(file), [givenLayout, file]);
  const span = unit ? layout.spans.find((candidate) => candidate.unit.id === unit.id) : undefined;
  const total = Math.max(1, Math.ceil(layout.totalPages));

  // Fit the sheet to the viewport: an 8.5in page is 816px, and the viewport
  // is often narrower than that. `zoom` scales layout and text together.
  const body = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = body.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const fit = () => setScale(Math.min(1, Math.max(0.35, (node.clientWidth - 28) / 816)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [view]);

  const step = (direction: -1 | 1 | 'first' | 'last') => {
    const target =
      direction === 'first' ? beats[0] : direction === 'last' ? beats[beats.length - 1] : beats[position + direction];
    if (target) onSelectBeat(target.id);
  };

  return (
    <section className="viewport" aria-label="Viewport">
      <header className="viewport-head">
        <div className="tabs" role="tablist" aria-label="Viewport view">
          <button type="button" role="tab" aria-selected={view === 'page'} className={view === 'page' ? 'tab selected' : 'tab'} onClick={() => onView('page')}>
            Page
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'threads'}
            className={view === 'threads' ? 'tab selected' : 'tab'}
            onClick={() => onView('threads')}
          >
            Threads
          </button>
        </div>
        <div className="viewport-title" title={unit ? `${unit.sequenceLabel} ${unit.title}` : ''}>
          {unit ? (
            <>
              <span className="muted">{unit.sequenceLabel || unit.kind}</span> {unit.title || `Untitled ${unit.kind}`}
              {unit.inScript ? null : <span className="muted"> · off</span>}
            </>
          ) : (
            <span className="muted">No scene selected</span>
          )}
        </div>
        <div className="viewport-counter" aria-label="Page position">
          <span className="muted">p.</span> {span ? Math.floor(span.startPage) + 1 : '–'}
          <span className="muted"> / {total}</span>
        </div>
      </header>

      <div
        ref={body}
        className={view === 'page' ? 'viewport-body page-view' : 'viewport-body'}
        style={{ '--page-scale': scale } as React.CSSProperties}
      >
        {view === 'page' ? (
          <Paper
            pages={pages}
            empty={
              !unit
                ? 'Select a scene to see its pages.'
                : unit.inScript
                  ? 'Nothing written in this scene yet.'
                  : `Switched off: this ${unit.kind} is not in the script. Open it from the timeline to switch it back on.`
            }
          />
        ) : (
          <ThreadView file={file} threads={threads} selectedBeatId={selectedBeatId} onSelectBeat={onSelectBeat} onUpdate={onUpdate} />
        )}
      </div>

      <footer className="transport" aria-label="Transport">
        <span className="transport-beat muted">
          {beat ? `${position + 1} / ${beats.length} · ${beat.title || 'Untitled beat'}` : 'No beats'}
        </span>
        <div className="transport-buttons">
          <button type="button" className="tool" title="First beat" aria-label="First beat" onClick={() => step('first')} disabled={position <= 0}>
            ⏮
          </button>
          <button type="button" className="tool" title="Previous beat (Alt+PageUp)" aria-label="Previous beat" onClick={() => step(-1)} disabled={position <= 0}>
            ◀
          </button>
          <button
            type="button"
            className="tool"
            title="Next beat (Alt+PageDown)"
            aria-label="Next beat"
            onClick={() => step(1)}
            disabled={position < 0 || position >= beats.length - 1}
          >
            ▶
          </button>
          <button
            type="button"
            className="tool"
            title="Last beat"
            aria-label="Last beat"
            onClick={() => step('last')}
            disabled={position < 0 || position >= beats.length - 1}
          >
            ⏭
          </button>
        </div>
        <span className="transport-spacer" />
      </footer>
    </section>
  );
}
