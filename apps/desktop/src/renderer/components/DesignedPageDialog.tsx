import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FACE_NAMES,
  FACE_NOTES,
  PART_FACES,
  PART_INFO,
  PART_TEMPLATES,
  PART_TEMPLATE_WORDS,
  bookMetrics,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  bookVars,
  chapterPageStyleSchema,
  halfOf,
  partChanges,
  partLogo,
  partModeOf,
  partStyleOf,
  partTemplateOf,
  partTemplatePatch,
  partsOf,
  proseStyleBase,
  renderBookPage,
  titlePageOf,
  updatePart,
  type BookPart,
  type PartMode,
  type PartStyle,
  type PartTemplate,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

import type { Laying } from '../book-typeset';

/**
 * A designed page of the front matter, set on one screen (addendum 20 §9n,
 * from Ken's handoff).
 *
 * It replaces the part dialog's stack of fields for the four pages that are
 * **a block of words on a page of their own** — the half title, the title
 * page, a dedication, an epigraph — which `partPlacement` has called `block`
 * since §7a. Every other kind keeps the old fields, because the three
 * sections here are about placing a block and a page that flows has no block
 * to place.
 *
 * Three decisions carry it.
 *
 * **The mode is a reading.** What the page carries in place of its title —
 * the words, a logotype, a page of art — is `partModeOf`, read off the
 * record, so the tiles cannot disagree with what the page prints. Choosing a
 * tile is putting the picture in or taking it out, never setting a flag
 * beside one.
 *
 * **A template is a height, and the alignment is beside it.** The old five
 * conflated the two, so ranging a page left made it *Custom* though it sat
 * where *Classic* put it. Four heights, one alignment control, and the
 * template still read back rather than stored.
 *
 * **Cancel means cancel.** The room saves as you type and this dialog goes
 * on doing that, because a look is tuned against the sheet beside it (§12a)
 * — so the part as it stood when the screen opened is held, and Cancel puts
 * it back. Done keeps what is there, having already been kept.
 */

type Guides = boolean;

const MODES: ReadonlyArray<{ id: PartMode; label: string; hint: string }> = [
  { id: 'text', label: 'Title text', hint: 'Set in type from the book’s title' },
  { id: 'logo', label: 'Logotype', hint: 'An image in place of the title' },
  { id: 'art', label: 'Full-page art', hint: 'An image fills the whole page' },
];

const ALIGNS: ReadonlyArray<{ id: PartStyle['align']; label: string }> = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centred' },
  { id: 'right', label: 'Right' },
];

const CASES: ReadonlyArray<{ id: PartStyle['title']['case']; label: string }> = [
  { id: 'as_typed', label: 'As typed' },
  { id: 'capitals', label: 'CAPITALS' },
  { id: 'small_caps', label: 'Small caps' },
];

export function DesignedPageDialog({
  file,
  part,
  laying,
  onUpdate,
  onClose,
  onPickLogo,
  onPickArt,
  onOpenBookSettings,
  onTurn,
}: {
  file: ProjectFile;
  part: BookPart | null;
  laying: Laying | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** Choose a logotype from a file; it joins the library like every picture. */
  onPickLogo(partId: string): void;
  /** Choose the page's art; the same picker, a different home on the part. */
  onPickArt(partId: string): void;
  onOpenBookSettings(): void;
  /** Turn to another page of the book, by its sheet. */
  onTurn(sheet: number): void;
}) {
  const dialog = useModal(part !== null);
  const [guides, setGuides] = useState<Guides>(false);
  /**
   * The part as it stood when the screen opened, so Cancel can put it back.
   * Held in a ref rather than in state: it is not something the screen
   * draws, and re-rendering on every keystroke would keep re-taking it.
   */
  const held = useRef<BookPart | null>(null);
  const openOn = part?.id ?? null;
  useEffect(() => {
    held.current = openOn ? (partsOf(file).find((one) => one.id === openOn) ?? null) : null;
    // Only when the screen opens on a different page: the point is the state
    // it was in **then**, which every later edit must not disturb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOn]);

  return (
    <dialog ref={dialog} className="designed-page-dialog" aria-label={part ? PART_INFO[part.kind].name : 'Page'} onClose={onClose}>
      {part ? (
        <Body
          file={file}
          part={part}
          laying={laying}
          guides={guides}
          onGuides={setGuides}
          onUpdate={onUpdate}
          onPickLogo={onPickLogo}
          onPickArt={onPickArt}
          onOpenBookSettings={onOpenBookSettings}
          onTurn={onTurn}
          onCancel={() => {
            const was = held.current;
            if (was) onUpdate((current) => updatePart(current, was.id, was));
            onClose();
          }}
          onClose={onClose}
        />
      ) : null}
    </dialog>
  );
}

function Body({
  file,
  part,
  laying,
  guides,
  onGuides,
  onUpdate,
  onPickLogo,
  onPickArt,
  onOpenBookSettings,
  onTurn,
  onCancel,
  onClose,
}: {
  file: ProjectFile;
  part: BookPart;
  laying: Laying | null;
  guides: Guides;
  onGuides(on: Guides): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPickLogo(partId: string): void;
  onPickArt(partId: string): void;
  onOpenBookSettings(): void;
  onTurn(sheet: number): void;
  onCancel(): void;
  onClose(): void;
}) {
  const settings = bookSettingsOf(file);
  const base = proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), settings.size);
  const style = partStyleOf(part, base);
  const template = partTemplateOf(style);
  const titlePage = titlePageOf(file.project, file.settings);
  const mode = partModeOf(part, titlePage.titleImage);
  const changes = partChanges(part, base);
  const names = bookNames(file);
  const partId = part.id;

  const write = (patch: Partial<PartStyle>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      return updatePart(current, partId, { style: { ...partStyleOf(now, base), ...patch } });
    });

  /**
   * Where this page falls in the book, for the navigator — a **reading** of
   * the laid pages rather than a number kept anywhere, so adding a page in
   * front of it moves it with nothing run.
   */
  const rows = useMemo(() => (laying ? bookPageRows(laying.laid.pages, laying.blocks) : []), [laying]);
  const at = rows.findIndex((row) => row.partId === partId);
  const here = at >= 0 ? rows[at] : undefined;
  const half = halfOf(part) === 'front' ? 'front matter' : 'back matter';

  /**
   * What goes on the page. A tile is **the act**, not a flag: choosing art
   * or a logotype opens the room's own picker, and choosing the words takes
   * the picture off — the mode is read back from what is there.
   */
  const pick = (want: PartMode) => {
    if (want === mode) return;
    if (want === 'art') {
      onPickArt(partId);
      return;
    }
    if (want === 'logo') {
      // A page of art stands in the way of a logotype, so it goes first.
      if (part.assetId) onUpdate((current) => updatePart(current, partId, { assetId: null }));
      onPickLogo(partId);
      return;
    }
    onUpdate((current) => updatePart(current, partId, { assetId: null, logoAssetId: null }));
  };

  const logo = partLogo(part, titlePage.titleImage);
  const showPlacement = mode !== 'art';
  const showType = mode === 'text';

  return (
    <>
      <header className="dp-head">
        <div className="dp-title">
          <strong>{PART_INFO[part.kind].name}</strong>
          <span className="muted small">
            {half} · {here ? `page ${here.counted}` : 'not laid yet'} · {here && here.sheet % 2 === 1 ? 'right-hand page' : 'left-hand page'}
          </span>
        </div>
        <div className="dp-nav">
          <button
            type="button"
            className="ghost"
            aria-label="The page before"
            disabled={!here || here.sheet <= 1}
            onClick={() => here && onTurn(here.sheet - 1)}
          >
            ‹
          </button>
          {/* The **sheet** rather than the printed number: the front matter
              counts in roman and the story in arabic, so *page i of 9* puts
              two numbering systems in one sentence. What it prints is on the
              chip beside the page and in the line under the name. */}
          <span className="muted small">
            {here ? `Page ${here.sheet} of ${rows.length}` : 'Page —'} · {half}
          </span>
          <button
            type="button"
            className="ghost"
            aria-label="The page after"
            disabled={!here || here.sheet >= rows.length}
            onClick={() => here && onTurn(here.sheet + 1)}
          >
            ›
          </button>
        </div>
        <button type="button" className="ghost dp-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="dp-body">
        <div className="dp-fields">
          <section className="dp-card">
            <h3>
              <span className="dp-num">1</span> What goes on the page
            </h3>
            <div className="dp-tiles">
              {MODES.map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={mode === one.id ? 'dp-tile on' : 'dp-tile'}
                  aria-pressed={mode === one.id}
                  onClick={() => pick(one.id)}
                >
                  <strong>{one.label}</strong>
                  <span className="muted small">{one.hint}</span>
                </button>
              ))}
            </div>
            {mode === 'text' ? (
              <div className="dp-slot">
                <div>
                  <span className="dp-label">Title from the book</span>
                  <p className="dp-serif">{titlePage.title || names.title}</p>
                </div>
                {/* The title is read-only here because it is the **book's**
                    (§3a): one reading names the book and everything that
                    prints it asks that, so a second box would be a second
                    answer. */}
                <button type="button" className="raised small" onClick={onOpenBookSettings}>
                  Edit in Book settings
                </button>
              </div>
            ) : (
              <div className="dp-slot dp-slot-empty">
                <p className="muted small">
                  {mode === 'logo'
                    ? logo
                      ? 'A logotype stands in place of the title. The words are not set.'
                      : 'No logotype yet.'
                    : 'The picture is the page, edge to edge. Nothing is set over it.'}
                </p>
                <button type="button" className="raised small" onClick={() => (mode === 'logo' ? onPickLogo(partId) : onPickArt(partId))}>
                  {mode === 'logo' ? (logo ? 'Another logotype…' : 'Choose a logotype…') : part.assetId ? 'Another picture…' : 'Choose a picture…'}
                </button>
              </div>
            )}
          </section>

          {/* Absent rather than greyed on a page of art (§9n): the art bleeds
              to the trim, so there is no block to place and no type to set. */}
          {showPlacement ? (
            <section className="dp-card">
              <h3>
                <span className="dp-num">2</span> Placement
                <span className="muted small dp-says">{template ? PART_TEMPLATE_WORDS[template].name : 'Custom · placed by hand'}</span>
              </h3>
              <div className="dp-templates">
                {PART_TEMPLATES.map((one) => (
                  <button
                    key={one}
                    type="button"
                    className={template === one ? 'dp-template on' : 'dp-template'}
                    aria-pressed={template === one}
                    title={PART_TEMPLATE_WORDS[one].says}
                    onClick={() => write(partTemplatePatch(one))}
                  >
                    <span className="dp-sheet" aria-hidden="true">
                      <span style={{ top: `${PART_TEMPLATE_WORDS[one].drop}%` }} />
                    </span>
                    {PART_TEMPLATE_WORDS[one].name}
                  </button>
                ))}
              </div>
              <label className="field dp-slider">
                <span>
                  Height on the page <strong>{style.drop}% down</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={1}
                  aria-label="Height on the page"
                  value={style.drop}
                  onChange={(event) => write({ drop: Number(event.target.value) })}
                />
              </label>
              <div className="dp-marks" aria-hidden="true">
                <span>Top</span>
                <span>Middle</span>
                <span>Bottom</span>
              </div>
              <div className="dp-row">
                <span className="dp-row-label">Alignment</span>
                <div className="dp-seg" role="group" aria-label="Alignment">
                  {ALIGNS.map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      className={style.align === one.id ? 'on' : ''}
                      aria-pressed={style.align === one.id}
                      onClick={() => write({ align: one.id })}
                    >
                      {one.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {showType ? (
            <section className="dp-card">
              <h3>
                <span className="dp-num">3</span> Typography
              </h3>
              <div className="dp-pair">
                <label className="field">
                  <span>Typeface</span>
                  <select aria-label="Typeface" value={style.face} onChange={(event) => write({ face: event.target.value as PartStyle['face'] })}>
                    {PART_FACES.map((one) => (
                      <option key={one} value={one}>
                        {one === 'book' ? 'The book’s own face' : `${FACE_NAMES[one]} — ${FACE_NOTES[one]}`}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="field">
                  <span>Size</span>
                  <div className="dp-step">
                    <button
                      type="button"
                      className="raised small"
                      aria-label="Smaller"
                      onClick={() => write({ title: { ...style.title, size: Math.max(10, style.title.size - 1) } })}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      aria-label="Size in points"
                      min={10}
                      max={72}
                      value={style.title.size}
                      onChange={(event) =>
                        write({ title: { ...style.title, size: Math.min(72, Math.max(10, Number(event.target.value) || style.title.size)) } })
                      }
                    />
                    <button
                      type="button"
                      className="raised small"
                      aria-label="Larger"
                      onClick={() => write({ title: { ...style.title, size: Math.min(72, style.title.size + 1) } })}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="dp-row">
                <span className="dp-row-label">Case</span>
                <div className="dp-seg" role="group" aria-label="Case">
                  {CASES.map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      className={style.title.case === one.id ? 'on' : ''}
                      aria-pressed={style.title.case === one.id}
                      onClick={() => write({ title: { ...style.title, case: one.id } })}
                    >
                      {one.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dp-row">
                <span className="dp-row-label">Style</span>
                <button
                  type="button"
                  className={style.title.bold ? 'dp-mark on' : 'dp-mark'}
                  aria-label="Bold"
                  aria-pressed={style.title.bold}
                  onClick={() => write({ title: { ...style.title, bold: !style.title.bold } })}
                >
                  B
                </button>
                <button
                  type="button"
                  className={style.title.italic ? 'dp-mark dp-italic on' : 'dp-mark dp-italic'}
                  aria-label="Italic"
                  aria-pressed={style.title.italic}
                  onClick={() => write({ title: { ...style.title, italic: !style.title.italic } })}
                >
                  I
                </button>
              </div>
              <label className="field dp-slider">
                <span>
                  Letter spacing <strong>{(style.title.tracking / 100).toFixed(2)} em</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  aria-label="Letter spacing"
                  value={style.title.tracking}
                  onChange={(event) => write({ title: { ...style.title, tracking: Number(event.target.value) } })}
                />
              </label>
              <button
                type="button"
                className="dp-switch"
                role="switch"
                aria-checked={style.rule}
                aria-label="Rule under the title"
                onClick={() => write({ rule: !style.rule })}
              >
                <span className={style.rule ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                  <span />
                </span>
                Rule under the title
              </button>
            </section>
          ) : null}
        </div>

        <div className="dp-preview">
          <div className="dp-preview-head">
            <span className="dp-label">Preview</span>
            <span className="dp-chip">{here && here.folio ? `Page ${here.folio}` : 'Unnumbered'}</span>
            <span className="dp-chip">{here && here.sheet % 2 === 1 ? 'Recto' : 'Verso'}</span>
            <button
              type="button"
              className={guides ? 'dp-chip dp-chip-on' : 'dp-chip'}
              aria-pressed={guides}
              onClick={() => onGuides(!guides)}
            >
              Guides
            </button>
          </div>
          <Sheet laying={laying} partId={partId} guides={guides} drop={style.drop} />
        </div>
      </div>

      <footer className="dp-foot">
        {/* What the page owes the style it would otherwise take. It counts
            the **resolved** settings rather than the keys in the record, so a
            field set back to its default by hand is not a change. */}
        <span className={changes > 0 ? 'dp-status dp-status-off' : 'dp-status dp-status-on'}>
          {changes > 0
            ? `${changes} change${changes === 1 ? '' : 's'} from the ${half === 'front matter' ? 'front-matter' : 'back-matter'} style`
            : `Matches the ${half === 'front matter' ? 'front-matter' : 'back-matter'} style`}
        </span>
        <span className="dp-spacer" />
        <button type="button" className="ghost" onClick={() => onUpdate((current) => updatePart(current, partId, { style: {} }))}>
          Reset to page style
        </button>
        <button type="button" className="raised" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="raised dp-done" onClick={onClose}>
          Done
        </button>
      </footer>
    </>
  );
}

/**
 * The page itself, drawn by the **same renderer the book prints with**, so
 * what is on the screen is what is on the paper — the room's rule since the
 * spread was first drawn.
 *
 * The guides are the room's own and nothing about them is stored: the text
 * block from the geometry, and a line at the chosen height, which is the one
 * thing a writer cannot otherwise see themselves setting.
 */
function Sheet({ laying, partId, guides, drop }: { laying: Laying | null; partId: string; guides: boolean; drop: number }) {
  const blocks = useMemo(() => new Map((laying?.blocks ?? []).map((block) => [block.id, block])), [laying]);
  const page = (laying?.laid.pages ?? []).find((one) =>
    one.pieces.some((piece) => {
      const block = blocks.get(piece.blockId);
      return block !== undefined && (block.id === partId || block.partId === partId);
    }),
  );
  if (!laying || !page) return <div className="dp-sheet-box muted small">Setting the page…</div>;
  const { pageWidthPx, pageHeightPx } = bookMetrics(laying.geometry);
  const scale = Math.min(1, 570 / pageHeightPx, 420 / pageWidthPx);
  const vars = {
    ...bookVars(laying.context),
    '--bk-page-width': `${pageWidthPx}px`,
    '--bk-page-height': `${pageHeightPx}px`,
  } as React.CSSProperties;
  return (
    <div className="dp-sheet-box" style={{ width: pageWidthPx * scale, height: pageHeightPx * scale }}>
      <div className="layout-spread" style={{ ...vars, transform: `scale(${scale})` }}>
        {/* The page's own markup, every string in it escaped by the builder. */}
        <div className="layout-sheet" dangerouslySetInnerHTML={{ __html: renderBookPage(page, blocks, laying.context) }} />
        {guides ? (
          <div className="dp-guides" aria-hidden="true">
            <span
              className="dp-guide-block"
              style={{
                top: `${laying.geometry.margins.top}in`,
                bottom: `${laying.geometry.margins.bottom}in`,
                left: `${page.side === 'recto' ? laying.geometry.margins.inside : laying.geometry.margins.outside}in`,
                right: `${page.side === 'recto' ? laying.geometry.margins.outside : laying.geometry.margins.inside}in`,
              }}
            />
            <span className="dp-guide-line" style={{ top: `${drop}%` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
