import { useEffect, useRef } from 'react';
import { beatsInStoryOrder, unitsInStoryOrder, type BeatId, type ProjectFile } from '@vcwriter/domain';

interface TimelineProps {
  file: ProjectFile;
  selectedBeatId: BeatId | null;
  onSelectBeat(beatId: BeatId): void;
}

/**
 * Every beat in story order, as one horizontal strip (docs/brand.md, layout).
 *
 * The lanes below show *where* a beat sits; this shows *when*. It is the
 * reading order the manuscript will print in, which is the thing the lane
 * view cannot show at a glance once a story has more than one lane. Clicking
 * a beat here opens it on the left, same as clicking it in its lane.
 */
export function Timeline({ file, selectedBeatId, onSelectBeat }: TimelineProps) {
  const beats = beatsInStoryOrder(file);
  const units = unitsInStoryOrder(file);
  const unitTitle = new Map(units.map((unit) => [unit.id as string, unit.title || `Untitled ${unit.kind}`]));
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // Keep the selected beat in view when it changes from elsewhere.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedBeatId]);

  let lastUnit: string | null = null;

  return (
    <div className="timeline" role="list" aria-label="Beats in story order">
      {beats.length === 0 ? <p className="muted empty">No beats yet.</p> : null}
      {beats.map((beat, index) => {
        const startsUnit = beat.unitId !== lastUnit;
        lastUnit = beat.unitId;
        const selected = beat.id === selectedBeatId;
        return (
          <div key={beat.id} className={startsUnit ? 'timeline-cell unit-start' : 'timeline-cell'} role="listitem">
            {startsUnit ? <span className="timeline-unit">{unitTitle.get(beat.unitId)}</span> : null}
            <button
              type="button"
              ref={selected ? selectedRef : null}
              className={selected ? 'timeline-beat selected' : 'timeline-beat'}
              aria-current={selected}
              onClick={() => onSelectBeat(beat.id)}
              title={`${index + 1}. ${beat.title || 'Untitled beat'}`}
            >
              <span className="timeline-index">{index + 1}</span>
              <span className="timeline-title">{beat.title || 'Untitled beat'}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
