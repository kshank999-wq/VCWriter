import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAPTER_LAYOUTS,
  CHAPTER_SINKS,
  FIRST_LINES,
  GRAPHIC_SIZES,
  MARKER_NUMBERINGS,
  beatsInScript,
  bookFaceOf,
  bookSettingsOf,
  chapterLayout,
  chapterLayoutOf,
  chapterLeafContent,
  chapterPageStyleOf,
  chapterSheetVars,
  chaptersOverriding,
  describeApplyToAll,
  divisionSpan,
  firstLineCut,
  firstLineOf,
  geometryOf,
  graphicSizeOf,
  isCollection,
  markerNumbering,
  nounsFor,
  placedMarkers,
  setChapterLayout,
  setChapterPage,
  setChapterPageStyle,
  setFirstLine,
  sinkInches,
  sinkOf,
  updateMarker,
  type ChapterLayoutId,
  type ChapterSink,
  type FirstLine,
  type GraphicSize,
  type MarkerNumbering,
  type PlacedMarker,
  type ProjectFile,
  type StoryMarkerId,
} from '@vcwriter/domain';

import { ChapterLeaf } from './Paper';

/**
 * **Chapter Opening Layout** (addendum 20 §14, from Ken's own handoff): the
 * one screen where a writer chooses how a chapter's opening page looks.
 *
 * Three things shape it beyond the handoff's own drawing.
 *
 * **Every control writes a field that already existed.** The number style is
 * the book's `markerNumbering`, which has decided what a chapter prints since
 * the markers were built; the sink is `dropInches`; the size is
 * `graphicWidth`. A second control for any of them would be a second answer
 * about what the page says, which is the fault §6a, §7a and §9c each found.
 *
 * **The named steps are read back.** Shallow, Standard and Deep are inches on
 * the page; the buttons set them and one lights where the stored number
 * matches, so a writer who typed a depth elsewhere sees none of the three lit
 * rather than a button lying about what will print (`bookPresetOf`'s rule).
 *
 * **Applying to every opener says first what it takes.** It is the one act
 * here that reaches work somebody did — clearing the chapters set on their
 * own — so `describeApplyToAll` says how many before the press, and the
 * button asks inline rather than warning.
 */

export interface ChapterLayoutDialogProps {
  file: ProjectFile;
  open: boolean;
  /** The chapter to open on, where the caller has one in mind. */
  initialMarkerId?: StoryMarkerId | null;
  onClose(): void;
  onUpdate(change: (file: ProjectFile) => ProjectFile): void;
}

export function ChapterLayoutDialog({ file, open, initialMarkerId = null, onClose, onUpdate }: ChapterLayoutDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const chapters = useMemo(() => placedMarkers(file).filter((one) => one.marker.kind === 'chapter'), [file]);
  const [markerId, setMarkerId] = useState<StoryMarkerId | null>(initialMarkerId);
  const [scope, setScope] = useState<'this' | 'all'>('this');
  /**
   * The layout waiting on the ask, where applying to every opening would clear
   * chapters set on their own. It holds **which layout was asked for** rather
   * than a flag: a flag left the act reading the layout in force, so pressing
   * *Set every opening* applied the one already there.
   */
  const [asking, setAsking] = useState<ChapterLayoutId | null>(null);

  useEffect(() => {
    if (open) setMarkerId(initialMarkerId ?? chapters[0]?.marker.id ?? null);
  }, [open, initialMarkerId, chapters]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const placed: PlacedMarker | null = chapters.find((one) => one.marker.id === markerId) ?? chapters[0] ?? null;
  const marker = placed?.marker ?? null;
  const style = chapterPageStyleOf(file);
  const nouns = nounsFor(file.project.format);
  const unit = nouns.division;
  const settings = bookSettingsOf(file);
  const geometry = useMemo(() => geometryOf(settings, file.project.format, 200), [settings, file.project.format]);
  const layoutId = chapterLayoutOf(file, marker);
  const layout = chapterLayout(layoutId);
  const sink = sinkOf(style.dropInches, geometry.trim.height);
  const size = marker ? graphicSizeOf(marker.page.graphicWidth) : null;
  const first = firstLineOf(file);
  const numbering = markerNumbering(file);
  const overriding = chaptersOverriding(file);

  /** Which chapter the change lands on: this one, or the book (§14). */
  const target = (): StoryMarkerId | null => (scope === 'all' ? null : (marker?.id ?? null));

  const pickLayout = (id: ChapterLayoutId) => {
    if (scope === 'all' && overriding.length > 0) {
      setAsking(id);
      return;
    }
    onUpdate((current) => setChapterLayout(current, target(), id));
  };

  const pickSink = (step: ChapterSink) => {
    const inches = sinkInches(step, geometry.trim.height);
    onUpdate((current) => setChapterPageStyle(current, { dropInches: inches }));
  };

  const pickSize = (step: GraphicSize) => {
    const share = GRAPHIC_SIZES.find((one) => one.id === step)?.share ?? 45;
    if (!marker) return;
    onUpdate((current) => setChapterPage(current, marker.id, { graphicWidth: share }));
  };

  const preview = placed ? chapterLeafContent(file, placed) : null;
  /**
   * The chapter's own first words, under the opening (§14).
   *
   * Without them the sheet shows a heading in space, and the **first line**
   * control shows nothing at all — a drop cap is a fact about the paragraph
   * under the heading, so a preview that omits the paragraph cannot answer
   * the question the control asks. They are the chapter's real words, because
   * a preview set in someone else's prose is a picture rather than a preview.
   */
  const words = useMemo(() => {
    if (!marker) return [] as string[];
    const units = divisionSpan(file, marker.id);
    const out: string[] = [];
    for (const unit of units) {
      for (const beat of beatsInScript(file, unit.id)) {
        for (const element of beat.manuscript.elements) {
          if (element.type !== 'paragraph') continue;
          if (element.text.trim().length > 0) out.push(element.text.trim());
          if (out.length >= 3) return out;
        }
      }
    }
    return out;
  }, [file, marker]);
  /** Where the first paragraph is cut, by the same rule the print takes. */
  const cut = words[0] ? firstLineCut(words[0], first) : 0;

  return (
    <dialog
      ref={ref}
      className="chapter-layout-dialog"
      aria-label={`${unit} opening layout`}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="chl-head">
        <div className="chl-head-words">
          <h2>{unit} opening layout</h2>
          <p className="muted small">
            {placed ? `${placed.label || unit} · ${marker?.title.trim() || 'Untitled'}` : `This project has no ${unit.toLowerCase()} yet.`}
          </p>
        </div>
        {chapters.length > 1 ? (
          <label className="field chl-which">
            <span className="visually-hidden">Which {unit.toLowerCase()}</span>
            <select
              aria-label={`Which ${unit.toLowerCase()}`}
              value={(marker?.id as string) ?? ''}
              onChange={(event) => setMarkerId(event.target.value as StoryMarkerId)}
            >
              {chapters.map((one) => (
                <option key={one.marker.id as string} value={one.marker.id as string}>
                  {one.label || unit} — {one.marker.title.trim() || 'Untitled'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="ghost chl-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="chl-body">
        <div className="chl-controls">
          <section className="chl-section">
            <div className="chl-section-head">
              <h3>Layout</h3>
              <span className="muted small">{layout.name}</span>
            </div>
            <div className="chl-thumbs">
              {CHAPTER_LAYOUTS.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={one.id === layoutId ? 'chl-thumb on' : 'chl-thumb'}
                  aria-pressed={one.id === layoutId}
                  title={one.says}
                  onClick={() => pickLayout(one.id)}
                >
                  <LayoutThumb id={one.id} />
                  <span>{one.name}</span>
                </button>
              ))}
            </div>
            <p className="muted small">{layout.says}.</p>
          </section>

          <div className="chl-two">
            <section className="chl-section">
              <h3>{unit} title</h3>
              {layout.hideTitle ? (
                <p className="muted small">This layout shows the number only.</p>
              ) : (
                <input
                  type="text"
                  aria-label={`${unit} title`}
                  value={marker?.title ?? ''}
                  disabled={!marker}
                  placeholder="Untitled"
                  onChange={(event) => {
                    const text = event.target.value;
                    if (marker) onUpdate((current) => updateMarker(current, marker.id, { title: text }));
                  }}
                />
              )}
            </section>

            <section className="chl-section">
              <h3>{unit} number</h3>
              {/* The book's own numbering (§14). It has decided what a chapter
                  prints since the markers were built, so this **is** that
                  setting rather than a second one beside it. */}
              <div className="chl-pills">
                {MARKER_NUMBERINGS.filter((one) => one.value !== 'symbol' && one.value !== 'roman_lower').map((one) => (
                  <button
                    key={one.value}
                    type="button"
                    className={one.value === numbering ? 'chl-pill on' : 'chl-pill'}
                    aria-pressed={one.value === numbering}
                    title={one.label}
                    onClick={() =>
                      onUpdate((current) => ({
                        ...current,
                        settings: { ...current.settings, markerNumbering: one.value as MarkerNumbering },
                      }))
                    }
                  >
                    {one.example || 'None'}
                  </button>
                ))}
              </div>
            </section>

            <section className="chl-section">
              <h3>Opening sink</h3>
              {layout.ignoresSink ? (
                <p className="muted small">The picture sets the depth on this layout.</p>
              ) : (
                <>
                  <div className="chl-pills">
                    {CHAPTER_SINKS.map((one) => (
                      <button
                        key={one.id}
                        type="button"
                        className={one.id === sink ? 'chl-pill on' : 'chl-pill'}
                        aria-pressed={one.id === sink}
                        onClick={() => pickSink(one.id)}
                      >
                        {one.label}
                      </button>
                    ))}
                  </div>
                  {/* Read back, never stored: a depth typed elsewhere lights
                      none of the three rather than the nearest one. */}
                  <p className="muted small">
                    {sink === null
                      ? `${style.dropInches.toFixed(2)} in down the page — none of the three.`
                      : `${style.dropInches.toFixed(2)} in down the page.`}
                  </p>
                </>
              )}
            </section>

            <section className="chl-section">
              <h3>First line</h3>
              <div className="chl-pills">
                {FIRST_LINES.map((one) => (
                  <button
                    key={one.id}
                    type="button"
                    className={one.id === first ? 'chl-pill on' : 'chl-pill'}
                    aria-pressed={one.id === first}
                    title={one.says}
                    onClick={() => onUpdate((current) => setFirstLine(current, one.id as FirstLine))}
                  >
                    {one.label}
                  </button>
                ))}
              </div>
              {/* The book's, never a chapter's: a book where chapter four
                  alone has a drop cap has a mistake in it. */}
              <p className="muted small">The whole book’s, so every chapter opens the same way.</p>
            </section>
          </div>

          <section className="chl-section">
            <h3>Graphic</h3>
            {layout.graphic === null ? (
              <p className="muted small">
                This layout has no graphic. Pick one of the layouts with a gold block to give the page a picture.
              </p>
            ) : (
              <div className="chl-graphic">
                <span className="muted small">
                  {marker?.page.assetId || marker?.page.image
                    ? marker.page.image?.name || 'A picture from the library'
                    : 'No picture yet — the page holds its space.'}
                </span>
                {layout.ignoresGraphicSize ? (
                  <span className="muted small">The picture is the width of the page on this layout.</span>
                ) : (
                  <div className="chl-pills">
                    {GRAPHIC_SIZES.map((one) => (
                      <button
                        key={one.id}
                        type="button"
                        className={one.id === size ? 'chl-pill on' : 'chl-pill'}
                        aria-pressed={one.id === size}
                        aria-label={one.says}
                        disabled={!marker}
                        onClick={() => pickSize(one.id)}
                      >
                        {one.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="chl-preview">
          <div className="chl-section-head">
            <h3>Preview</h3>
            <span className="muted small">
              {geometry.trim.width} × {geometry.trim.height} in
            </span>
          </div>
          <div className="chl-sheet-well">
            {preview ? (
              <div className="chapter-leaf-sheet chl-sheet" style={chapterSheetVars(file, style) as React.CSSProperties}>
                <ChapterLeaf chapter={preview} style={style} face={bookFaceOf(file)} />
                {/* The words the chapter opens with, so the sink and the
                    first line can be judged against something. A chapter that
                    opens on a leaf of its own says so instead: the words are
                    overleaf, and drawing them here would be a lie about the
                    page. */}
                {marker?.page.include ? (
                  <p className="chl-overleaf">The words begin on the page after this one.</p>
                ) : (
                  <div className="chl-words">
                    {words.map((text, at) => (
                      <p key={at} className={at === 0 ? 'chl-word-first' : undefined}>
                        {at === 0 && cut > 0 ? (
                          <>
                            <span className={first === 'drop_cap' ? 'chl-drop-cap' : 'chl-lead-in'}>{text.slice(0, cut)}</span>
                            {text.slice(cut)}
                          </>
                        ) : (
                          text
                        )}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="muted small">Nothing to show yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="chl-foot">
        <span className="muted small">Apply to</span>
        <div className="chl-pills">
          <button
            type="button"
            className={scope === 'this' ? 'chl-pill on' : 'chl-pill'}
            aria-pressed={scope === 'this'}
            onClick={() => {
              setScope('this');
              setAsking(null);
            }}
          >
            This {unit.toLowerCase()}
          </button>
          <button
            type="button"
            className={scope === 'all' ? 'chl-pill on' : 'chl-pill'}
            aria-pressed={scope === 'all'}
            onClick={() => setScope('all')}
          >
            Every {isCollection(file.project.format) ? 'story' : unit.toLowerCase()} opening
          </button>
        </div>
        <span className="chl-spacer" />
        {/* Applying to all is the one act that reaches work somebody did, so
            it says how much before the press rather than after it. */}
        {scope === 'all' ? <span className="muted small">{describeApplyToAll(file, asking ?? layoutId)}</span> : null}
        {asking ? (
          <>
            <button
              type="button"
              className="raised small"
              onClick={() => {
                const wanted = asking;
                setAsking(null);
                onUpdate((current) => setChapterLayout(current, null, wanted));
              }}
            >
              Set every opening
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(null)}>
              Leave them
            </button>
          </>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * A layout as a small page: a gold block where the picture goes, a dark bar
 * for the heading, grey lines for the words. Drawn from the **same slot list**
 * the print walks (§14), so a new layout draws a thumbnail without anything
 * here being told about it.
 */
function LayoutThumb({ id }: { id: ChapterLayoutId }) {
  const layout = chapterLayout(id);
  const piece = (slot: string, at: number) => {
    switch (slot) {
      case 'sink':
        return <span className="chl-t-sink" key={at} />;
      case 'graphic':
        return layout.graphic === 'bleed' || layout.graphic === 'page' ? (
          <span className={`chl-t-art ${layout.graphic}`} key={at} />
        ) : (
          <span className="chl-t-device" key={at} />
        );
      case 'number':
        return <span className={layout.numberScale === 'display' ? 'chl-t-num big' : 'chl-t-num'} key={at} />;
      case 'rule':
        return layout.rule ? <span className="chl-t-rule" key={at} /> : null;
      case 'title':
        return layout.hideTitle ? null : <span className="chl-t-title" key={at} />;
      case 'epigraph':
        return layout.epigraphApart ? <span className="chl-t-epi" key={at} /> : null;
      case 'body':
        return (
          <span className="chl-t-body" key={at}>
            {Array.from({ length: 9 }, (unused, line) => (
              <span key={line} />
            ))}
          </span>
        );
      default:
        return null;
    }
  };
  return (
    <span className={`chl-t-page${layout.align === 'left' ? ' left' : ''}`} aria-hidden="true">
      {layout.slots.map((slot, at) => piece(slot, at))}
    </span>
  );
}
