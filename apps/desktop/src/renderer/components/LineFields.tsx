import {
  BOOK_FACES,
  FACE_NAMES,
  LINE_ALIGNS,
  TYPE_CASES,
  faceOfFont,
  type BookFont,
  type LineAlign,
  type LineStyle,
  type TypeCase,
} from '@vcwriter/domain';

/**
 * **One line of type, and the one control that sets it** (addendum 20 §18,
 * from Ken: *in any of the dialog boxes that you can add text, right now only
 * the headings can be stylized, but the body text needs to be able to be
 * stylized, centered, justified right, left, change the font, change the size,
 * also*).
 *
 * It existed, and it was **exported from a dialog** — `ChapterPageDialog`'s
 * own `Line` — which is why the other three screens that set a line of type
 * each wrote their own row of controls instead of reaching for it, and why the
 * one line none of them offered was the **body**. A control lives beside the
 * screen that happened to need it first and the next screen copies it; a
 * control in a file of its own is the one the next screen uses.
 *
 * The two new rows are the two a heading never needed and prose always did:
 * **where it is ranged** and **what it is set in**. Both are drawn only where
 * the caller hands over a writer for them, which is `tracking={false}`'s own
 * idiom in this component — *absent rather than greyed* for a control that
 * does not apply, a chapter number having no alignment of its own and a
 * running head being placed rather than ranged.
 */

/**
 * What each case is called. It lived in `ChapterPageDialog` beside the control
 * that happened to be written first; it names a `LineStyle`'s own field, so it
 * belongs with the one control that sets one (§18).
 */
export const CASE_WORDS: Record<TypeCase, string> = {
  as_typed: 'As typed',
  capitals: 'CAPITALS',
  small_caps: 'Small caps',
};

/** What each alignment is called, in the words a writer uses (§18, Ken's own). */
export const ALIGN_WORDS: Record<LineAlign, string> = {
  left: 'Left',
  center: 'Centred',
  right: 'Right',
  justify: 'Justified',
};

/** What the **page's own** answer is called, where a line does not give one. */
export const SAME_AS_PAGE = 'The page’s';

export function LineFields({
  label,
  style,
  tracking = true,
  align = false,
  fonts,
  onPatch,
}: {
  label: string;
  style: LineStyle;
  tracking?: boolean;
  /**
   * Whether this line may say where it is ranged and what it is set in (§18).
   * Offered on prose and withheld from furniture: a chapter number is placed
   * by the opening's own layout, and a running head by `runningHeadStyle`'s
   * `place`, so a control here could only disagree with them.
   */
  align?: boolean;
  /** The book's imported fonts, so a line may be set in one (§6b). */
  fonts?: readonly BookFont[];
  onPatch(patch: Partial<LineStyle>): void;
}) {
  return (
    <div className="chapter-line-style">
      <span className="chapter-line-label">{label}</span>
      <label className="chapter-line-control">
        <span className="muted small">Size</span>
        <input
          type="number"
          aria-label={`${label} size`}
          min={6}
          max={72}
          value={style.size}
          onChange={(event) => onPatch({ size: Number(event.target.value) })}
        />
      </label>
      <label className="chapter-line-control">
        <span className="muted small">Case</span>
        <select
          aria-label={`${label} case`}
          value={style.case}
          onChange={(event) => onPatch({ case: event.target.value as TypeCase })}
        >
          {TYPE_CASES.map((one) => (
            <option key={one} value={one}>
              {CASE_WORDS[one]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label={`${label} bold`}
        aria-pressed={style.bold}
        className={style.bold ? 'chapter-line-mark on' : 'chapter-line-mark'}
        onClick={() => onPatch({ bold: !style.bold })}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        aria-label={`${label} italic`}
        aria-pressed={style.italic}
        className={style.italic ? 'chapter-line-mark on' : 'chapter-line-mark'}
        onClick={() => onPatch({ italic: !style.italic })}
      >
        <i>I</i>
      </button>
      {tracking ? (
        <label className="chapter-line-control">
          <span className="muted small">Tracking</span>
          <input
            type="range"
            aria-label={`${label} tracking`}
            min={0}
            max={50}
            value={style.tracking}
            onChange={(event) => onPatch({ tracking: Number(event.target.value) })}
          />
        </label>
      ) : null}
      {align ? (
        <>
          {/* **Where the words are ranged** (§18). *The page's* is the first
              option rather than a fifth at the end, because null is the state
              every line starts in and a list whose default sits last reads as
              though something has been chosen. */}
          <label className="chapter-line-control">
            <span className="muted small">Align</span>
            <select
              aria-label={`${label} alignment`}
              value={style.align ?? ''}
              onChange={(event) => onPatch({ align: (event.target.value || null) as LineAlign | null })}
            >
              <option value="">{SAME_AS_PAGE}</option>
              {LINE_ALIGNS.map((one) => (
                <option key={one} value={one}>
                  {ALIGN_WORDS[one]}
                </option>
              ))}
            </select>
          </label>
          {/* **What it is set in**, which is a face of its own and not the
              page's — a sans heading over a serif body being ordinary
              typography (§18). An imported font is offered by name, since
              `faceStackOf` reads `font:<id>` and the record is a string for
              exactly that reason. */}
          <label className="chapter-line-control">
            <span className="muted small">Face</span>
            <select
              aria-label={`${label} face`}
              value={style.face ?? ''}
              onChange={(event) => onPatch({ face: event.target.value || null })}
            >
              <option value="">{SAME_AS_PAGE}</option>
              {BOOK_FACES.filter((one) => one !== 'imported').map((one) => (
                <option key={one} value={one}>
                  {FACE_NAMES[one]}
                </option>
              ))}
              {(fonts ?? []).map((font) => (
                <option key={font.id} value={faceOfFont(font)}>
                  {font.family}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}
