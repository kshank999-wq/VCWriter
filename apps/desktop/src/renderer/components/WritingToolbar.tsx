import { useId, useState } from 'react';
import {
  ALIGN_WORDS,
  PARAGRAPH_ALIGNS,
  TEXT_INKS,
  TEXT_SIZES,
  TYPE_REACH_NOTE,
  isInkColour,
  type InlineMark,
  type LineType,
  type ParagraphAlign,
} from '@vcwriter/domain';

/**
 * **The writing screen's toolbar** (addendum 02 §19a, from Ken: *there's no
 * way to adjust the style of the text in the beats. So you need to be able
 * to bold, italicize, or underline. and be able to justify it left, right,
 * or center. Put a toolbar on the top of the beats screen*).
 *
 * It **draws controls and decides nothing**. Every act here is one `BeatBody`
 * already performs — `toggleInline` is what Ctrl/Cmd+B, I and U have run
 * since the editor was written, and the type is `withLineType` on the
 * element the cursor is in — so there is one implementation of each and the
 * buttons are a **second door onto it** rather than a second answer (addendum
 * 20 §16d). Which is the whole point: the keys worked all along and nothing
 * on the screen said so, which is addendum 29 §2's lesson.
 *
 * It stands in §8c's `writer-tools` strip, built as *a slot, never a second
 * control* for the Dictate button and empty until something is put in it.
 */

export interface WritingToolbarProps {
  /** Whether the type half applies here at all — prose formats only. */
  type: boolean;
  /** How the line the cursor is in is set, or null while the cursor is nowhere. */
  line: LineType | null;
  /** What this line is called, in the format's own noun. */
  noun: string;
  onMark(mark: InlineMark): void;
  onType(patch: Partial<LineType>): void;
}

const MARKS: ReadonlyArray<{ mark: InlineMark; label: string; glyph: string; key: string }> = [
  { mark: 'bold', label: 'Bold', glyph: 'B', key: 'B' },
  { mark: 'italic', label: 'Italic', glyph: 'I', key: 'I' },
  { mark: 'underline', label: 'Underline', glyph: 'U', key: 'U' },
];

/**
 * The four ranged, drawn rather than lettered.
 *
 * A glyph has to **be** the thing it names here: *Left*, *Centred*, *Right*
 * and *Justified* share a word and differ only in where the short line
 * falls, so four copies of `≡` would be four controls a writer can only tell
 * apart by hovering — which is the hover this toolbar exists to remove.
 */
const ALIGN_ROWS: Record<ParagraphAlign, ReadonlyArray<[number, number]>> = {
  left: [[0, 14], [0, 9], [0, 14], [0, 7]],
  center: [[0, 14], [3, 8], [0, 14], [4, 6]],
  right: [[0, 14], [5, 9], [0, 14], [7, 7]],
  justify: [[0, 14], [0, 14], [0, 14], [0, 14]],
};

const AlignGlyph = ({ align }: { align: ParagraphAlign }) => (
  <svg viewBox="0 0 14 11" width="14" height="11" aria-hidden="true" focusable="false">
    {ALIGN_ROWS[align].map(([x, width], row) => (
      <rect key={row} x={x} y={row * 3} width={width} height="1.4" rx="0.7" fill="currentColor" />
    ))}
  </svg>
);

export function WritingToolbar({ type, line, noun, onMark, onType }: WritingToolbarProps) {
  const customId = useId();
  const [custom, setCustom] = useState('#b4232a');
  /**
   * **Nothing refuses while the cursor is nowhere.** A writer who has not
   * put the cursor in a line yet is shown the toolbar as it will be rather
   * than a row of dead controls, and the first press lands where they then
   * click — so the type controls read *the book's* and do nothing until
   * there is a line to do it to.
   */
  const at = line ?? { align: null, size: null, colour: null };
  const ink = at.colour;
  const ownInk = ink !== null && !TEXT_INKS.some((one) => one.value === ink);

  return (
    <div className="writing-tools" role="group" aria-label="How the writing is set">
      <div className="wt-group" role="group" aria-label="Emphasis">
        {MARKS.map((one) => (
          <button
            key={one.mark}
            type="button"
            className={`wt-mark wt-${one.mark}`}
            // The key is named here because this is where somebody will read
            // it — the whole reason the buttons exist.
            title={`${one.label} — Ctrl/Cmd+${one.key}. Goes round the words you have picked.`}
            aria-label={one.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onMark(one.mark)}
          >
            {one.glyph}
          </button>
        ))}
      </div>

      {type ? (
        <>
          <div className="wt-group" role="group" aria-label="How the paragraph is ranged">
            {PARAGRAPH_ALIGNS.map((align) => (
              <button
                key={align}
                type="button"
                className={`wt-align wt-align-${align}`}
                // **A press on the one already on puts it back to the book's**,
                // because there is no *none* chip to reach for and a writer who
                // centred a paragraph by mistake must be able to undo it with
                // the control they used.
                aria-pressed={at.align === align}
                title={`${ALIGN_WORDS[align]} — the whole ${noun.toLowerCase()} the cursor is in`}
                aria-label={ALIGN_WORDS[align]}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onType({ align: at.align === align ? null : align })}
              >
                <AlignGlyph align={align} />
              </button>
            ))}
          </div>

          <label className="wt-size">
            <span className="muted">Size</span>
            <select
              aria-label="Text size"
              value={at.size === null ? '' : String(at.size)}
              onChange={(event) => onType({ size: event.target.value === '' ? null : Number(event.target.value) })}
            >
              {/* Null first and named for what it is: the book's own body
                  size, which is what every paragraph takes until somebody
                  says otherwise. A list whose default sits last reads as
                  though something had been picked (§18). */}
              <option value="">The book’s</option>
              {TEXT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} pt
                </option>
              ))}
            </select>
          </label>

          <div className="wt-group wt-inks" role="group" aria-label="Ink">
            <button
              type="button"
              className={ink === null ? 'wt-ink wt-ink-none on' : 'wt-ink wt-ink-none'}
              aria-pressed={ink === null}
              title="The book’s own ink"
              aria-label="Default ink"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onType({ colour: null })}
            >
              <span aria-hidden="true">A</span>
            </button>
            {TEXT_INKS.map((one) => (
              <button
                key={one.value}
                type="button"
                className={ink === one.value ? 'wt-ink on' : 'wt-ink'}
                // The swatch is drawn **on paper** rather than on the screen's
                // own background: the colour is chosen here and read in a
                // printed book, and this is the only place that can say so.
                style={{ '--swatch': one.value } as React.CSSProperties}
                aria-pressed={ink === one.value}
                title={one.label}
                aria-label={one.label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onType({ colour: one.value })}
              >
                <span aria-hidden="true">A</span>
              </button>
            ))}
            <label
              className={ownInk ? 'wt-ink wt-ink-own on' : 'wt-ink wt-ink-own'}
              style={{ '--swatch': ownInk ? (ink as string) : custom } as React.CSSProperties}
              htmlFor={customId}
              title="An ink of your own"
            >
              {/* **It says it is a picker rather than a seventh colour.**
                  Drawn with the same letter as its neighbours it was a red A
                  on cream standing beside a red A on cream, which a writer can
                  only tell apart by pressing — so with nothing of their own in
                  force it is a spectrum, and once there is one it wears it,
                  because then the thing worth showing is what they picked. */}
              <span aria-hidden="true">{ownInk ? 'A' : ''}</span>
              <input
                id={customId}
                type="color"
                aria-label="An ink of your own"
                value={ownInk ? (ink as string) : custom}
                onChange={(event) => {
                  const picked = event.target.value;
                  setCustom(picked);
                  if (isInkColour(picked)) onType({ colour: picked });
                }}
              />
            </label>
          </div>
        </>
      ) : null}

      {/* Where the line between the two halves falls, said rather than found
          by pressing — three words picked and **Centred** moves the whole
          paragraph, and nothing else on the screen could explain why. */}
      <span className="wt-note muted small" title={TYPE_REACH_NOTE}>
        ?
      </span>
    </div>
  );
}
