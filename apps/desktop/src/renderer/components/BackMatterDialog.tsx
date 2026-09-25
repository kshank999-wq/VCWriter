import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AUTHOR_LINKS,
  AUTHOR_LINK_WORDS,
  AUTHOR_PHOTO_PLACES,
  AUTHOR_PHOTO_SHAPES,
  BACK_SINKS,
  FACE_NAMES,
  FACE_NOTES,
  PART_FACES,
  PART_INFO,
  aboutAuthorOf,
  acknowledgementsOf,
  authorNameOf,
  backMatterStatus,
  backSinkOf,
  bookMetrics,
  bookSettingsOf,
  bookVars,
  chapterPageStyleSchema,
  isBackMatterPage,
  partChanges,
  partStyleOf,
  partPlacement,
  partsOf,
  proseStyleBase,
  renderBookPage,
  sinkPatch,
  updatePart,
  wordsIn,
  type BookPart,
  type PartStyle,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

import type { Laying } from '../book-typeset';

/**
 * **A back-matter page, on one screen** (addendum 20 §17, from Ken's handoff
 * for seven of them).
 *
 * The handoff asks for one shell with a page-specific first section, and says
 * why: *identical in structure to the Half title and Title page panels*. So
 * sections **2 and 3 are written once here** and every page gets them — the
 * heading and the page style are the same questions whatever the page is
 * about, and a copy per page would be seven answers to *how deep is
 * Standard*.
 *
 * What each page owns is section 1, which is `Card` below plus a branch. The
 * two built here are the two that were already prose parts: the
 * acknowledgements and *About the author*.
 *
 * Everything sections 2 and 3 set is `partStyleOf` — the heading's line, the
 * alignment, the rule and the body's size since §7a, and the sink, the
 * the folio and the recto added for this. **Reset to page style
 * clears the override and never the content**, which falls out of the style
 * and the words being two different fields.
 */

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

export function BackMatterDialog({
  file,
  part,
  laying,
  onUpdate,
  onClose,
  onPickPhoto,
  onTurn,
}: {
  file: ProjectFile;
  part: BookPart | null;
  laying: Laying | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** The author's photograph, through the room's own picker. */
  onPickPhoto(partId: string): void;
  /** Step to another back-matter page, by its part id. */
  onTurn(partId: string): void;
}) {
  const dialog = useModal(part !== null);
  const [guides, setGuides] = useState(false);
  /** The page as it stood when the screen opened, so Cancel can put it back. */
  const held = useRef<BookPart | null>(null);
  const openOn = part?.id ?? null;
  useEffect(() => {
    held.current = openOn ? (partsOf(file).find((one) => one.id === openOn) ?? null) : null;
    // Only when the screen opens on a different page (§9n).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOn]);

  return (
    <dialog ref={dialog} className="designed-page-dialog" aria-label={part ? PART_INFO[part.kind].name : 'Back matter'} onClose={onClose}>
      {part ? (
        <Body
          file={file}
          part={part}
          laying={laying}
          guides={guides}
          onGuides={setGuides}
          onUpdate={onUpdate}
          onPickPhoto={onPickPhoto}
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
  onPickPhoto,
  onTurn,
  onCancel,
  onClose,
}: {
  file: ProjectFile;
  part: BookPart;
  laying: Laying | null;
  guides: boolean;
  onGuides(on: boolean): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPickPhoto(partId: string): void;
  onTurn(partId: string): void;
  onCancel(): void;
  onClose(): void;
}) {
  const settings = bookSettingsOf(file);
  const base = proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), settings.size);
  const style = partStyleOf(part, base);
  const sink = backSinkOf(style);
  const changes = partChanges(part, base);
  const partId = part.id;
  const info = PART_INFO[part.kind];
  const status = backMatterStatus(part);

  const write = (patch: Partial<PartStyle>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      return updatePart(current, partId, { style: { ...partStyleOf(now, base), ...patch } });
    });

  const writeAbout = (patch: Record<string, unknown>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      const was = (now.about ?? {}) as Record<string, unknown>;
      return updatePart(current, partId, { about: { ...was, ...patch } });
    });

  /**
   * The back-matter pages this book **has**, so ‹ › steps through them rather
   * than through the seven the handoff names — a navigator that offered a
   * page the book does not carry would be one that lies.
   */
  const pages = useMemo(() => partsOf(file).filter((one) => isBackMatterPage(one.kind)), [file]);
  const at = pages.findIndex((one) => one.id === partId);

  /**
   * **A page turned to opens at its top.** Driving the room found the
   * navigator keeping the column's scroll, so pressing › off the foot of the
   * acknowledgements landed on the author's page halfway down its first
   * section — which on the screen is indistinguishable from the turn not
   * having worked.
   */
  const fields = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // `scrollTop` rather than `scrollTo`: a test's document has no layout
    // and no method, and this is a property every element has.
    if (fields.current) fields.current.scrollTop = 0;
  }, [partId]);

  return (
    <>
      <header className="dp-head">
        <div className="dp-title">
          <strong>{info.name}</strong>
          <span className="muted small">Back matter · {info.note}</span>
        </div>
        <div className="dp-nav">
          <button type="button" className="ghost" aria-label="The page before" disabled={at <= 0} onClick={() => onTurn(pages[at - 1]!.id)}>
            ‹
          </button>
          <span className="muted small">
            Back matter · {at + 1} of {pages.length}
          </span>
          <button
            type="button"
            className="ghost"
            aria-label="The page after"
            disabled={at < 0 || at >= pages.length - 1}
            onClick={() => onTurn(pages[at + 1]!.id)}
          >
            ›
          </button>
        </div>
        <button type="button" className="ghost dp-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="dp-body">
        <div className="dp-fields" ref={fields}>
          <Card
            file={file}
            part={part}
            onUpdate={onUpdate}
            onWriteAbout={writeAbout}
            onPickPhoto={() => onPickPhoto(partId)}
          />

          <section className="dp-card">
            <h3>
              <span className="dp-num">2</span> Heading
            </h3>
            <label className="field">
              <span>Heading text</span>
              <input
                aria-label="Heading text"
                placeholder={info.name}
                value={part.title}
                onChange={(event) => onUpdate((current) => updatePart(current, partId, { title: event.target.value }))}
              />
            </label>
            {/* **Absent on a page that flows** (§7a's own predicate): the
                contents and the index run to as many pages as they need, so
                there is no single block on a page to place — the same reason
                the template and the drop are absent there. */}
            {partPlacement(part.kind) === 'flows' ? (
              <p className="muted small">This page runs to as many pages as it needs, so there is no depth to set it at.</p>
            ) : (
              <div className="dp-row">
                <span className="dp-row-label">Sink</span>
                <div className="dp-seg" role="group" aria-label="Sink">
                  {BACK_SINKS.map((one) => (
                    <button
                      key={one.id}
                      type="button"
                      className={sink === one.id ? 'on' : ''}
                      aria-pressed={sink === one.id}
                      onClick={() => write(sinkPatch(one.id))}
                    >
                      {one.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="dp-row">
              <span className="dp-row-label">Alignment</span>
              <div className="dp-seg" role="group" aria-label="Alignment">
                {ALIGNS.map((one) => (
                  <button key={one.id} type="button" className={style.align === one.id ? 'on' : ''} aria-pressed={style.align === one.id} onClick={() => write({ align: one.id })}>
                    {one.label}
                  </button>
                ))}
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
            <button
              type="button"
              className="dp-switch"
              role="switch"
              aria-checked={style.rule}
              aria-label="Rule under the heading"
              onClick={() => write({ rule: !style.rule })}
            >
              <span className={style.rule ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                <span />
              </span>
              Rule under the heading
            </button>
          </section>

          <section className="dp-card">
            <h3>
              <span className="dp-num">3</span> Page style
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
                <span>Text size</span>
                <div className="dp-step">
                  <button type="button" className="raised small" aria-label="Smaller text" onClick={() => write({ line: { ...style.line, size: Math.max(8, style.line.size - 0.5) } })}>
                    −
                  </button>
                  <input
                    type="number"
                    aria-label="Text size in points"
                    min={8}
                    max={14}
                    step={0.5}
                    value={style.line.size}
                    onChange={(event) => write({ line: { ...style.line, size: Math.min(14, Math.max(8, Number(event.target.value) || style.line.size)) } })}
                  />
                  <button type="button" className="raised small" aria-label="Larger text" onClick={() => write({ line: { ...style.line, size: Math.min(14, style.line.size + 0.5) } })}>
                    +
                  </button>
                </div>
              </div>
            </div>
            <button type="button" className="dp-switch" role="switch" aria-checked={style.folio} aria-label="Page numbers" onClick={() => write({ folio: !style.folio })}>
              <span className={style.folio ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                <span />
              </span>
              Page numbers
            </button>
            <button
              type="button"
              className="dp-switch"
              role="switch"
              aria-checked={style.recto}
              aria-label="Start on a right-hand page"
              onClick={() => write({ recto: !style.recto })}
            >
              <span className={style.recto ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                <span />
              </span>
              Start on a right-hand page
            </button>
          </section>
        </div>

        <div className="dp-preview">
          <div className="dp-preview-head">
            <span className="dp-label">Preview</span>
            {/* What the page **is**, read off its own style rather than said
                twice: the chip is the switch's answer, not a second one. */}
            <span className="dp-chip">{style.recto ? 'Right-hand page' : 'Either side'}</span>
            <button type="button" className={guides ? 'dp-chip dp-chip-on' : 'dp-chip'} aria-pressed={guides} onClick={() => onGuides(!guides)}>
              Guides
            </button>
          </div>
          <Sheet laying={laying} partId={partId} guides={guides} drop={style.drop} />
        </div>
      </div>

      <footer className="dp-foot">
        <span className={status.warn ? 'dp-status dp-status-warn' : 'dp-status dp-status-on'}>
          {status.text}
          {changes > 0 ? `${status.text ? ' · ' : ''}${changes} change${changes === 1 ? '' : 's'} from the back-matter style` : ''}
        </span>
        <span className="dp-spacer" />
        {/* It clears the **style** and never the words, which falls out of
            the two being different fields rather than out of a rule. */}
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

/** Section 1: the only part of the screen that is this page's own. */
function Card({
  file,
  part,
  onUpdate,
  onWriteAbout,
  onPickPhoto,
}: {
  file: ProjectFile;
  part: BookPart;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onWriteAbout(patch: Record<string, unknown>): void;
  onPickPhoto(): void;
}) {
  const partId = part.id;

  if (part.kind === 'acknowledgements') {
    const own = acknowledgementsOf(part);
    return (
      <section className="dp-card">
        <h3>
          <span className="dp-num">1</span> Your thanks
          <span className="muted small dp-tally">{wordsIn(part.text)} words</span>
        </h3>
        <p className="muted small">Write it here or paste it in. A blank line starts a new paragraph.</p>
        <textarea
          className="dp-serif-input"
          aria-label="Acknowledgements text"
          rows={10}
          value={part.text}
          onChange={(event) => onUpdate((current) => updatePart(current, partId, { text: event.target.value }))}
        />
        {/* **A field of its own rather than a last paragraph** (§17): the
            page sets it apart — ranged right and in italic — and a writer who
            typed it as a paragraph would have no way to say so. */}
        <button
          type="button"
          className="dp-switch"
          role="switch"
          aria-checked={own.signOff}
          aria-label="Sign-off line"
          onClick={() => onWriteAbout({ signOff: !own.signOff })}
        >
          <span className={own.signOff ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
            <span />
          </span>
          Sign-off line
        </button>
        {own.signOff ? (
          <input aria-label="Sign-off line text" placeholder="— Initials" value={own.signOffText} onChange={(event) => onWriteAbout({ signOffText: event.target.value })} />
        ) : null}
      </section>
    );
  }

  if (part.kind === 'about_the_author') {
    const own = aboutAuthorOf(part);
    const links = AUTHOR_LINKS.map((kind) => own.links.find((one) => one.kind === kind) ?? { kind, shows: false, text: '' });
    const writeLink = (kind: (typeof AUTHOR_LINKS)[number], patch: { shows?: boolean; text?: string }) =>
      onWriteAbout({ links: links.map((one) => (one.kind === kind ? { ...one, ...patch } : one)) });
    return (
      <section className="dp-card">
        <h3>
          <span className="dp-num">1</span> About you
          <span className="muted small dp-tally">{wordsIn(part.text)} words</span>
        </h3>
        <div className="dp-slot">
          <div>
            <span className="dp-label">Author photo</span>
            <p className="muted small">JPG, PNG or PDF, at least 1200 px on the short side for print.</p>
          </div>
          <button type="button" className="raised small" onClick={onPickPhoto}>
            {own.photoAssetId ? 'Another…' : 'Choose…'}
          </button>
        </div>
        {/* **Absent rather than greyed until there is a photograph**: where
            it goes and what shape it is are questions about a picture, and
            with none chosen they are questions about nothing. */}
        {own.photoAssetId ? (
          <>
            <div className="dp-row">
              <span className="dp-row-label">Photo</span>
              <div className="dp-seg" role="group" aria-label="Where the photo goes">
                {AUTHOR_PHOTO_PLACES.map((one) => (
                  <button key={one} type="button" className={own.place === one ? 'on' : ''} aria-pressed={own.place === one} onClick={() => onWriteAbout({ place: one })}>
                    {one === 'above' ? 'Above' : one === 'beside' ? 'Beside the text' : 'None'}
                  </button>
                ))}
              </div>
            </div>
            {own.place === 'none' ? null : (
              <div className="dp-row">
                <span className="dp-row-label">Shape</span>
                <div className="dp-seg" role="group" aria-label="The photo’s shape">
                  {AUTHOR_PHOTO_SHAPES.map((one) => (
                    <button key={one} type="button" className={own.shape === one ? 'on' : ''} aria-pressed={own.shape === one} onClick={() => onWriteAbout({ shape: one })}>
                      {one === 'square' ? 'Square' : one === 'rounded' ? 'Rounded' : 'Circle'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
        {/* The name is the **book's** where the page does not say otherwise
            (§16d's one value, two doors), so the placeholder is who the book
            says wrote it. */}
        <label className="field">
          <span>Name</span>
          <input aria-label="Name" placeholder={authorNameOf(file, part)} value={own.name} onChange={(event) => onWriteAbout({ name: event.target.value })} />
        </label>
        {/* **The biography is the page's words** — `part.text`, which every
            prose part carries and the printer already sets — rather than a
            field beside them: a second place for what this page says would
            strand whatever an author had already typed here. */}
        <label className="field">
          <span>Biography</span>
          <textarea
            className="dp-serif-input"
            aria-label="Biography"
            rows={5}
            value={part.text}
            onChange={(event) => onUpdate((current) => updatePart(current, partId, { text: event.target.value }))}
          />
        </label>
        <span className="dp-label">Links</span>
        {links.map((one) => (
          <div className="dp-element-pair" key={one.kind}>
            <button
              type="button"
              className="dp-switch dp-link-switch"
              role="switch"
              aria-checked={one.shows}
              aria-label={`Show the ${AUTHOR_LINK_WORDS[one.kind].toLowerCase()}`}
              onClick={() => writeLink(one.kind, { shows: !one.shows })}
            >
              <span className={one.shows ? 'dp-switch-track on' : 'dp-switch-track'} aria-hidden="true">
                <span />
              </span>
              {AUTHOR_LINK_WORDS[one.kind]}
            </button>
            <input aria-label={AUTHOR_LINK_WORDS[one.kind]} value={one.text} onChange={(event) => writeLink(one.kind, { text: event.target.value })} />
          </div>
        ))}
      </section>
    );
  }

  // The other five are stages of their own (§17's build order). Until each
  // has its section, the page is its words — said, rather than left blank.
  return (
    <section className="dp-card">
      <h3>
        <span className="dp-num">1</span> {PART_INFO[part.kind].name}
      </h3>
      <p className="muted small">This page’s own controls are still being built. Its words are set here, and the heading and page style below are the page’s.</p>
      <textarea
        className="dp-serif-input"
        aria-label="The page’s words"
        rows={10}
        value={part.text}
        onChange={(event) => onUpdate((current) => updatePart(current, partId, { text: event.target.value }))}
      />
    </section>
  );
}

/**
 * The page itself, drawn by the **same renderer the book prints with** — the
 * designed-page screen's own `Sheet`, rendered here rather than written
 * again, two copies being two answers to what the page looks like. The sink
 * is what the guide line marks, being the one thing a writer cannot
 * otherwise see themselves setting.
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
