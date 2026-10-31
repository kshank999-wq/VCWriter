import { useEffect, useMemo, useRef, useState } from 'react';
import {
  noteBeatIds,
  outlineFolders,
  placeKey,
  placeNoteOnTrack,
  placeNow,
  placeOf,
  setNoteRewrite,
  textToPlace,
  type BeatId,
  type ProjectFile,
  type ResearchItem,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * The rewrite screen (addendum 28 §7).
 *
 * From Ken: *double click it and it brings up a rewrite screen like the beat
 * screen with a side split showing you the original note so you can cut and
 * paste or rewrite and you can place that on the track.*
 *
 * The original on the left, as it was caught and never changed here — select
 * from it, copy it across, or bring the whole of it over to start from. The
 * rewrite on the right, saved as you type onto the note. **Place on the
 * track** puts the rewrite (or the note, if nothing has been rewritten) into a
 * beat where the note is filed, and from then on the note reads used.
 */
export function NoteRewrite({
  file,
  item,
  currentBeatId,
  onClose,
  onUpdate,
  onGoToBeat,
  addTo,
}: {
  file: ProjectFile;
  item: ResearchItem | null;
  currentBeatId: BeatId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGoToBeat?(beatId: BeatId): void;
  /**
   * Adding the rewrite to the outline, from the Outliner (addendum 28 §9): the
   * row it goes under and the kinds it can be added as. The note is archived.
   */
  addTo?: { under: string; choices: ReadonlyArray<{ kind: string; label: string }>; onAdd(kind: string): void } | null;
}) {
  const dialog = useModal(item !== null);
  const original = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const [said, setSaid] = useState<string | null>(null);

  useEffect(() => {
    setSaid(null);
    if (item) box.current?.focus();
  }, [item?.id]);

  const where = useMemo(() => {
    if (!item) return null;
    const place = placeNow(file, placeOf(item.place));
    if (!place) return null;
    const folder = outlineFolders(file).find((one) => one.key === placeKey(place));
    return folder ? `${folder.number ? `${folder.number} ` : ''}${folder.title}` : null;
  }, [file, item]);

  if (!item) return null;

  const beats = noteBeatIds(file, item);
  const used = beats.length > 0;
  const lastBeat = beats.length > 0 ? file.beats.find((beat) => beat.id === beats[beats.length - 1]) : undefined;
  const unit = lastBeat ? file.units.find((one) => one.id === lastBeat.unitId) : undefined;

  const write = (text: string) => onUpdate((current) => setNoteRewrite(current, item.id, text));

  /** Bring what is selected in the original over, or all of it. */
  const bring = () => {
    const selection = window.getSelection();
    const picked =
      selection && original.current && selection.rangeCount > 0 && original.current.contains(selection.anchorNode)
        ? selection.toString().trim()
        : '';
    const piece = picked || item.body.trim();
    if (!piece) return;
    const field = box.current;
    const now = item.rewrite;
    if (field && document.activeElement === field) {
      const start = field.selectionStart;
      const end = field.selectionEnd;
      write(now.slice(0, start) + piece + now.slice(end));
    } else {
      write(now.trim() ? `${now.replace(/\s+$/, '')}\n\n${piece}` : piece);
    }
  };

  const place = () => {
    // Worked out before the updater runs, so StrictMode's second run cannot
    // place it twice.
    const result = placeNoteOnTrack(file, item.id, { afterBeatId: currentBeatId });
    if (!result.ok) {
      setSaid(result.why);
      return;
    }
    onUpdate(() => result.file);
    const into = result.file.units.find((one) => one.id === result.unitId);
    setSaid(`On the track${into ? ` in ${into.title || 'its section'}` : ''}.`);
  };

  return (
    <dialog ref={dialog} className="note-rewrite" aria-label={`Rewrite ${item.title}`} onClose={onClose} onCancel={onClose}>
      <header className="note-rewrite-head">
        <strong className="note-rewrite-title">{item.title}</strong>
        <span className="muted small">{addTo ? `Sorted into ${addTo.under}` : where ? `Filed under ${where}` : 'Not in a chapter yet'}</span>
        <span className={`note-rewrite-state${used ? ' used' : ''}`}>
          {used ? (
            <>
              <span className="used-x" aria-hidden="true">
                ✕
              </span>{' '}
              Used in the book{unit ? ` · ${unit.title}` : ''}
            </>
          ) : (
            'Not used yet'
          )}
        </span>
        <span className="muted small">✓ Saved as you type</span>
        <button type="button" className="ghost" aria-label="Close the rewrite" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="note-rewrite-split">
        <section className="note-rewrite-pane" aria-label="The original note">
          <header>
            <h4>Original</h4>
            <button type="button" className="ghost small" onClick={bring} title="Bring the selected words across, or all of it">
              Bring across →
            </button>
          </header>
          <div ref={original} className="note-rewrite-original" tabIndex={0}>
            {item.body.trim() ? item.body : <span className="muted">This note has no words, only its title.</span>}
          </div>
        </section>

        <section className="note-rewrite-pane" aria-label="The rewrite">
          <header>
            <h4>Rewrite</h4>
            {!item.rewrite.trim() && item.body.trim() ? (
              <button type="button" className="ghost small" onClick={() => write(item.body)}>
                Start from the original
              </button>
            ) : null}
          </header>
          <textarea
            ref={box}
            className="note-rewrite-box"
            aria-label="Your rewrite"
            placeholder="Rewrite it here — or cut and paste from the original. A blank line starts a new paragraph."
            value={item.rewrite}
            onChange={(event) => write(event.target.value)}
          />
        </section>
      </div>

      <footer className="note-rewrite-foot">
        {said ? <span className="small" role="status">{said}</span> : <span className="muted small">{textToPlace(item) ? '' : 'Nothing written to place yet.'}</span>}
        <span className="note-rewrite-actions">
          {used && lastBeat && onGoToBeat ? (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                onGoToBeat(lastBeat.id);
                onClose();
              }}
            >
              Go to it on the track
            </button>
          ) : null}
          {addTo
            ? addTo.choices.map((choice) => (
                <button
                  key={choice.kind}
                  type="button"
                  disabled={!textToPlace(item)}
                  title={`Add it under ${addTo.under} as ${choice.label.toLowerCase()}. The note goes to the archive.`}
                  onClick={() => {
                    addTo.onAdd(choice.kind);
                    onClose();
                  }}
                >
                  Add as {choice.label.toLowerCase()}
                </button>
              ))
            : null}
          <button type="button" className={addTo ? 'ghost' : undefined} onClick={place} disabled={!textToPlace(item)}>
            {used ? 'Place on the track again' : 'Place on the track'}
          </button>
        </span>
      </footer>
    </dialog>
  );
}
