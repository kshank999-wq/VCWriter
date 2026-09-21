import { useMemo, useRef, useState } from 'react';
import {
  addGraphic,
  describeGraphics,
  figuresInOrder,
  graphicsInOrder,
  placementsOf,
  removeGraphic,
  unplacedGraphics,
  updateGraphic,
  type AssetId,
  type BeatId,
  type ProjectFile,
} from '@vcwriter/domain';
import { readPicture } from '../read-picture';

/**
 * The graphics library (addendum 16 §9).
 *
 * Pictures wait here before they are in the book, and §3 is explicit that
 * research may stay unassigned — so **"not used yet" is a fact on the row and
 * never a warning**. What *is* worth flagging is a picture in the book with no
 * description, because that is a promise to a reader who cannot see it.
 *
 * A picture is placed from the manuscript rather than from here: putting a
 * figure into a section is an act about the writing, and it belongs where the
 * writing is. This screen is the library, what each picture says, and where
 * each one ended up.
 */
interface GraphicsPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Go and look at a figure where it sits. Absent in the popped-out window. */
  onGoToBeat?(beatId: BeatId): void;
}

export function GraphicsPanel({ file, onUpdate, onGoToBeat }: GraphicsPanelProps) {
  const graphics = useMemo(() => graphicsInOrder(file), [file]);
  const unplaced = useMemo(() => new Set(unplacedGraphics(file).map((one) => one.id as string)), [file]);
  const figures = useMemo(() => figuresInOrder(file), [file]);
  const [chosenId, setChosenId] = useState<AssetId | null>(null);
  const [asking, setAsking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const chosen = graphics.find((one) => one.id === chosenId) ?? graphics[0] ?? null;
  const where = chosen ? placementsOf(file, chosen.id) : [];

  const take = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const one of Array.from(files)) {
      if (!one.type.startsWith('image/')) continue;
      try {
        const read = await readPicture(one);
        onUpdate((current) => addGraphic(current, { name: one.name, ...read }).file);
      } catch {
        // One unreadable file must not stop the rest of a drop.
      }
    }
    setBusy(false);
  };

  return (
    <div className="graphics">
      <aside className="graphics-list">
        <div className="panel-header">
          <span className="muted small">{describeGraphics(file)}</span>
        </div>

        {/* §9: from import, direct upload, or drag and drop. */}
        <div
          className={dragging ? 'graphics-drop over' : 'graphics-drop'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void take(event.dataTransfer.files);
          }}
        >
          <p className="muted small">{busy ? 'Reading…' : 'Drop pictures here'}</p>
          <button type="button" className="ghost small" onClick={() => picker.current?.click()}>
            Choose files…
          </button>
          <input
            ref={picker}
            type="file"
            accept="image/*"
            multiple
            aria-label="Add graphics"
            style={{ display: 'none' }}
            onChange={(event) => {
              void take(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        <ul className="item-list">
          {graphics.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                className={one.id === chosen?.id ? 'item selected' : 'item'}
                onClick={() => setChosenId(one.id)}
              >
                <span className="item-title">{one.name || 'Untitled'}</span>
                {/* A fact, not a fault: research may stay unassigned (§3). */}
                {unplaced.has(one.id as string) ? (
                  <span className="muted small">not used yet</span>
                ) : null}
                {one.altText.trim().length === 0 && !unplaced.has(one.id as string) ? (
                  <span className="graphics-nodesc" title="In the book with no description">
                    no description
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="graphics-detail">
        {chosen ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="graphics-plate" src={chosen.data} alt={chosen.altText || chosen.name} />

            <label className="field">
              <span>Name</span>
              <input
                aria-label="Graphic name"
                value={chosen.name}
                onChange={(event) => onUpdate((current) => updateGraphic(current, chosen.id, { name: event.target.value }))}
              />
            </label>

            <label className="field">
              <span>Caption</span>
              <textarea
                aria-label="Caption"
                rows={2}
                placeholder="What prints under the figure"
                value={chosen.caption}
                onChange={(event) => onUpdate((current) => updateGraphic(current, chosen.id, { caption: event.target.value }))}
              />
            </label>
            <p className="muted small">
              The caption is the picture&rsquo;s. A figure placed in the book starts with it and then
              keeps its own, so the same diagram can be captioned twice without either changing the
              other.
            </p>

            <label className="field">
              <span>What it shows</span>
              <textarea
                aria-label="Description for a reader who cannot see it"
                rows={2}
                placeholder="For a reader who cannot see it"
                value={chosen.altText}
                onChange={(event) => onUpdate((current) => updateGraphic(current, chosen.id, { altText: event.target.value }))}
              />
            </label>

            <h3>Where it is used ({where.length})</h3>
            {where.length === 0 ? (
              <p className="muted">Not in the book yet. Place it from the section you want it in.</p>
            ) : (
              <ul className="graphics-where">
                {where.map((one) => (
                  <li key={one.elementId}>
                    <span className="muted small">
                      Figure {one.number} · Chapter {one.unitIndex + 1}
                    </span>
                    <span>{one.caption || 'No caption'}</span>
                    {onGoToBeat ? (
                      <button type="button" className="ghost small" onClick={() => onGoToBeat(one.beatId)}>
                        Go to it
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="graphics-actions">
              {asking ? (
                <span className="graphics-confirm">
                  <span className="muted small">
                    {where.length === 0
                      ? 'Nothing in the book uses it.'
                      : `${where.length} ${where.length === 1 ? 'figure keeps' : 'figures keep'} its place and reads as missing. The writing around them is untouched.`}
                  </span>
                  <button
                    type="button"
                    className="ghost small danger"
                    onClick={() => {
                      onUpdate((current) => removeGraphic(current, chosen.id));
                      setChosenId(null);
                      setAsking(false);
                    }}
                  >
                    Remove it
                  </button>
                  <button type="button" className="ghost small" onClick={() => setAsking(false)}>
                    Keep it
                  </button>
                </span>
              ) : (
                <button type="button" className="ghost small danger" onClick={() => setAsking(true)}>
                  Remove this graphic
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="muted empty">
            {figures.length > 0
              ? 'Every picture this book used has been removed from the library.'
              : 'Drop a picture to start the library.'}
          </p>
        )}
      </section>
    </div>
  );
}
