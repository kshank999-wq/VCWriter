import { useEffect, useMemo, useState } from 'react';
import {
  ADDABLE_KINDS,
  BOOK_FACES,
  BOOK_STYLES,
  FACE_NAMES,
  FACE_NOTES,
  FOLIO_PLACES,
  OPENINGS,
  PART_INFO,
  TRIM_PRESETS,
  addPart,
  bookMetrics,
  bookVars,
  contentsDivisions,
  describeGeometry,
  graphicsInOrder,
  halfOf,
  mayAdd,
  measureWarning,
  movePart,
  partTitle,
  partsOf,
  removePart,
  renderBookHtml,
  renderBookPage,
  setBookSettings,
  trimPresetOf,
  updatePart,
  type BookPage,
  type BookPart,
  type BookSettings,
  type PartKind,
  type ProjectFile,
  isCollection,
} from '@vcwriter/domain';
import { PopOutButton } from './PopOutButton';
import { usePreference } from '../use-split';
import { useBookLaying, type Laying } from '../book-typeset';

/**
 * The Layout room (addendum 20 §9): the parts down the left, the spreads in
 * the middle, the inspector on the right.
 *
 * Nothing here edits a word of the manuscript, stores a page number or a
 * margin it worked out, or reorders the story (§10). What it writes is the
 * book's settings and the book's parts; what it draws is what `layPages`
 * decided from what the browser measured (§4).
 */

interface LayoutWindowProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Take the room to a window of its own (addendum 02 §8). Absent in one. */
  onPopOut?(): void;
  /** File ▸ Chapter page…, where the chapter opening is set. Absent in a window of its own. */
  onOpenChapterPage?(): void;
}

const FOLIO_WORDS: Record<(typeof FOLIO_PLACES)[number], string> = {
  foot_outside: 'Foot, outside corner',
  foot_centre: 'Foot, centred',
  head_outside: 'Head, outside corner',
};

const OPENING_WORDS: Record<(typeof OPENINGS)[number], string> = {
  none: 'Nothing special',
  small_caps: 'First words in small capitals',
  drop_cap: 'A drop capital',
};

/** The spread a sheet is on: the first leaf stands alone, then pairs. */
const spreadOfSheet = (sheet: number): number => (sheet <= 1 ? 0 : Math.floor(sheet / 2));

export function LayoutWindow({ file, open, onClose, onUpdate, onPopOut, onOpenChapterPage }: LayoutWindowProps) {
  const { laying, box } = useBookLaying(file, open);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [spread, setSpread] = useState(0);
  const [zoom, setZoom] = usePreference('layout.zoom', 0.55);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parts = useMemo(() => partsOf(file), [file]);
  const selected = parts.find((part) => part.id === selectedPartId) ?? null;
  const divisions = useMemo(() => contentsDivisions(file), [file]);

  const pages = laying?.laid.pages ?? [];
  const spreadCount = Math.max(1, Math.ceil((pages.length + 1) / 2));
  useEffect(() => {
    if (spread >= spreadCount) setSpread(Math.max(0, spreadCount - 1));
  }, [spread, spreadCount]);

  // ← and → turn the pages.
  useEffect(() => {
    if (!open) return undefined;
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowRight') setSpread((current) => Math.min(spreadCount - 1, current + 1));
      if (event.key === 'ArrowLeft') setSpread((current) => Math.max(0, current - 1));
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [open, spreadCount]);

  if (!open) return null;

  const settings = laying?.settings;
  const write = (patch: Partial<BookSettings>) => onUpdate((current) => setBookSettings(current, patch));

  /** The page a part first appears on, so choosing it turns to it. */
  const goToPart = (partId: string) => {
    if (!laying) return;
    const blocks = new Map(laying.blocks.map((block) => [block.id, block]));
    const page = laying.laid.pages.find((candidate) =>
      candidate.pieces.some((piece) => {
        const block = blocks.get(piece.blockId);
        return block !== undefined && (block.id === partId || block.partId === partId);
      }),
    );
    if (page) setSpread(spreadOfSheet(page.sheet));
  };

  const exportBook = async () => {
    if (!laying) return;
    setBusy(true);
    setMessage(null);
    const html = renderBookHtml(laying.laid.pages, laying.blocks, laying.context, file.project.title);
    const { trim } = laying.geometry;
    const result = await window.vcwriter.exportPdf({
      file,
      kind: 'book',
      html,
      paper: { width: trim.width, height: trim.height },
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? 'The book could not be exported');
      return;
    }
    if (result.data) {
      setMessage(
        result.data.pageCount > 0
          ? `Exported ${result.data.pageCount} pages to ${result.data.path}`
          : `Exported to ${result.data.path}`,
      );
    }
  };

  const chapterCount = divisions.length;

  return (
    <div className="layout-room" role="dialog" aria-label="Layout">
      <style>{BOOK_STYLES}</style>
      {/* The measuring box (§4): the browser sets each block here, out of
          sight, and the domain reads the count of lines back. */}
      <div ref={box} className="bk-measure" aria-hidden="true" />

      <header className="sculptor-bar">
        <h2>Layout</h2>
        <span className="muted small">{file.project.title}</span>
        <span className="toolbar-spacer" />
        {laying ? (
          <span className="muted small layout-count">
            {laying.laid.pages.length} {laying.laid.pages.length === 1 ? 'page' : 'pages'} · {laying.laid.arabic} in the
            story
          </span>
        ) : null}
        <button
          type="button"
          className="tool"
          disabled={!laying || busy}
          title="The book as a PDF at the trim size, every page as it stands here"
          onClick={() => void exportBook()}
        >
          {busy ? 'Exporting…' : 'Export the book…'}
        </button>
        {onPopOut ? <PopOutButton what="the Layout room" onPopOut={onPopOut} /> : null}
        <button type="button" className="ghost" onClick={onClose} aria-label="Close the Layout room">
          ×
        </button>
      </header>

      <div className="layout-body">
        <aside className="layout-rail">
          <h3>Front matter</h3>
          <ul className="layout-parts">
            {parts
              .filter((part) => halfOf(part) === 'front')
              .map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  selected={part.id === selectedPartId}
                  onSelect={() => {
                    setSelectedPartId(part.id);
                    goToPart(part.id);
                  }}
                />
              ))}
          </ul>
          <h3>The story</h3>
          <ul className="layout-parts layout-story">
            {divisions.length === 0 ? (
              <li className="muted small">No chapters yet: the story runs as one.</li>
            ) : (
              divisions.map((placed) => {
                const at = laying?.laid.where.get(placed.marker.id as string);
                return (
                  <li key={placed.marker.id as string}>
                    <button
                      type="button"
                      className="ghost layout-part"
                      title="A chapter of the manuscript. Its order is the story's, set in the Outliner and on the tracks."
                      onClick={() => {
                        setSelectedPartId(null);
                        goToPart(placed.marker.id as string);
                      }}
                    >
                      <span>{placed.label}</span>
                      <span className="muted">{placed.marker.title.trim() || ''}</span>
                      <span className="muted layout-page-no">{at && at.numbering === 'arabic' ? at.number : ''}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <h3>Back matter</h3>
          <ul className="layout-parts">
            {parts
              .filter((part) => halfOf(part) === 'back')
              .map((part) => (
                <PartRow
                  key={part.id}
                  part={part}
                  selected={part.id === selectedPartId}
                  onSelect={() => {
                    setSelectedPartId(part.id);
                    goToPart(part.id);
                  }}
                />
              ))}
          </ul>
          <label className="field">
            <span>Add a part</span>
            <select
              aria-label="Add a part"
              value=""
              onChange={(event) => {
                const kind = event.target.value as PartKind;
                if (!kind) return;
                onUpdate((current) => {
                  const made = addPart(current, kind);
                  if (made.partId) setSelectedPartId(made.partId);
                  return made.file;
                });
              }}
            >
              <option value="">Choose one…</option>
              {ADDABLE_KINDS.filter((kind) => mayAdd(file, kind)).map((kind) => (
                <option key={kind} value={kind}>
                  {PART_INFO[kind].name} — {PART_INFO[kind].note}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            The story is the manuscript in story order, {chapterCount}{' '}
            {isCollection(file.project.format) ? (chapterCount === 1 ? 'story' : 'stories') : chapterCount === 1 ? 'chapter' : 'chapters'};
            nothing here reorders it.
          </p>
        </aside>

        <div className="layout-stage">
          {laying ? (
            <Spreads laying={laying} spread={spread} zoom={zoom} />
          ) : (
            <p className="muted empty-state">Setting the book…</p>
          )}
          <div className="layout-foot">
            <button
              type="button"
              className="ghost"
              aria-label="Previous spread"
              disabled={spread === 0}
              onClick={() => setSpread((current) => Math.max(0, current - 1))}
            >
              ←
            </button>
            <input
              type="range"
              aria-label="Which spread"
              min={0}
              max={Math.max(0, spreadCount - 1)}
              value={Math.min(spread, spreadCount - 1)}
              onChange={(event) => setSpread(Number(event.target.value))}
            />
            <button
              type="button"
              className="ghost"
              aria-label="Next spread"
              disabled={spread >= spreadCount - 1}
              onClick={() => setSpread((current) => Math.min(spreadCount - 1, current + 1))}
            >
              →
            </button>
            <span className="muted small">{describeSpread(pages, spread)}</span>
            <label className="zoom">
              <span className="muted">Zoom</span>
              <input
                type="range"
                min={25}
                max={120}
                step={5}
                value={Math.round(zoom * 100)}
                aria-label="Page zoom"
                onChange={(event) => setZoom(Number(event.target.value) / 100)}
              />
            </label>
            {message ? <span className="small layout-message">{message}</span> : null}
          </div>
        </div>

        <aside className="layout-inspector">
          {selected ? (
            <PartFields file={file} part={selected} onUpdate={onUpdate} onDone={() => setSelectedPartId(null)} />
          ) : null}
          {settings && laying ? (
            <>
              <TrimSection laying={laying} write={write} />
              <TypeSection settings={settings} write={write} />
              <FurnitureSection settings={settings} write={write} />
              <section className="layout-section">
                <h3>{isCollection(file.project.format) ? 'Story openings' : 'Chapter openings'}</h3>
                <p className="muted small">
                  The number, the name, the face and the drop are set once for the book in{' '}
                  <em>File ▸ Chapter page…</em>. A chapter page carrying a device, a summary or an epigraph opens on a
                  leaf of its own; one carrying only its number and name opens above its first paragraph.
                </p>
                {onOpenChapterPage ? (
                  <button type="button" className="ghost small" onClick={onOpenChapterPage}>
                    Chapter page…
                  </button>
                ) : null}
              </section>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const describeSpread = (pages: BookPage[], spread: number): string => {
  if (pages.length === 0) return '';
  if (spread === 0) return `Sheet 1 of ${pages.length}`;
  const left = pages[spread * 2 - 1];
  const right = pages[spread * 2];
  const say = (page: BookPage | undefined) => (page ? page.folio || (page.blank ? 'blank' : '—') : '');
  return `Sheets ${spread * 2}–${Math.min(spread * 2 + 1, pages.length)} of ${pages.length} · ${say(left)} · ${say(right)}`;
};

function PartRow({ part, selected, onSelect }: { part: BookPart; selected: boolean; onSelect(): void }) {
  const info = PART_INFO[part.kind];
  return (
    <li>
      <button
        type="button"
        className={selected ? 'ghost layout-part selected' : 'ghost layout-part'}
        aria-pressed={selected}
        title={info.note}
        onClick={onSelect}
      >
        <span>{partTitle(part)}</span>
        <span className="muted">{info.carries === 'reading' ? 'read' : info.carries === 'plate' ? 'picture' : ''}</span>
      </button>
    </li>
  );
}

/** The two facing pages, drawn from the same markup the PDF prints (§4). */
function Spreads({ laying, spread, zoom }: { laying: Laying; spread: number; zoom: number }) {
  const { pageWidthPx, pageHeightPx } = bookMetrics(laying.geometry);
  const blocks = useMemo(() => new Map(laying.blocks.map((block) => [block.id, block])), [laying.blocks]);
  const pages = laying.laid.pages;
  const left = spread === 0 ? null : pages[spread * 2 - 1] ?? null;
  const right = spread === 0 ? pages[0] ?? null : pages[spread * 2] ?? null;
  const vars = {
    ...bookVars(laying.context),
    '--bk-page-width': `${pageWidthPx}px`,
    '--bk-page-height': `${pageHeightPx}px`,
  } as React.CSSProperties;
  const draw = (page: BookPage | null, key: string) =>
    page ? (
      <div
        key={key}
        className="layout-sheet"
        // The page's own markup, from the one builder the export reads too;
        // every string in it was escaped there.
        dangerouslySetInnerHTML={{ __html: renderBookPage(page, blocks, laying.context) }}
      />
    ) : (
      <div key={key} className="layout-sheet layout-no-sheet" style={{ width: pageWidthPx, height: pageHeightPx }} />
    );
  return (
    <div className="layout-spreads">
      <div
        className="layout-spread-box"
        style={{ width: pageWidthPx * 2 * zoom + 24, height: pageHeightPx * zoom + 24 }}
      >
        <div className="layout-spread" style={{ ...vars, transform: `scale(${zoom})` }}>
          {draw(left, 'left')}
          {draw(right, 'right')}
        </div>
      </div>
    </div>
  );
}

function TrimSection({ laying, write }: { laying: Laying; write(patch: Partial<BookSettings>): void }) {
  const { settings, geometry } = laying;
  const preset = trimPresetOf(geometry.trim);
  const [custom, setCustom] = useState(preset === null);
  const warning = measureWarning(geometry);
  const margin = (edge: keyof BookSettings['margins'], label: string) => {
    const typed = settings.margins[edge];
    return (
      <label className="field layout-margin" key={edge}>
        <span>
          {label} <span className="muted">{typed === null ? 'worked out' : 'typed'}</span>
        </span>
        <span className="layout-margin-row">
          <input
            type="number"
            step={0.0625}
            min={0}
            max={4}
            aria-label={`${label} margin in inches`}
            placeholder={geometry.margins[edge].toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}
            value={typed ?? ''}
            onChange={(event) => {
              const value = event.target.value.trim();
              write({ margins: { ...settings.margins, [edge]: value === '' ? null : Number(value) } });
            }}
          />
          {typed !== null ? (
            <button
              type="button"
              className="ghost small"
              title="Work it out from the trim again"
              aria-label={`Work out the ${label.toLowerCase()} margin again`}
              onClick={() => write({ margins: { ...settings.margins, [edge]: null } })}
            >
              ×
            </button>
          ) : null}
        </span>
      </label>
    );
  };
  return (
    <section className="layout-section">
      <h3>Trim &amp; margins</h3>
      <label className="field">
        <span>Trim size</span>
        <select
          aria-label="Trim size"
          value={custom ? 'custom' : preset?.id ?? 'custom'}
          onChange={(event) => {
            const chosen = TRIM_PRESETS.find((one) => one.id === event.target.value);
            if (!chosen) {
              setCustom(true);
              return;
            }
            setCustom(false);
            write({ trim: { width: chosen.width, height: chosen.height } });
          }}
        >
          {TRIM_PRESETS.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name} — {one.note}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </label>
      {custom ? (
        <div className="layout-two">
          <label className="field">
            <span>Width, in</span>
            <input
              type="number"
              step={0.125}
              min={3}
              max={14}
              aria-label="Trim width in inches"
              value={geometry.trim.width}
              onChange={(event) => write({ trim: { ...geometry.trim, width: Number(event.target.value) || geometry.trim.width } })}
            />
          </label>
          <label className="field">
            <span>Height, in</span>
            <input
              type="number"
              step={0.125}
              min={4}
              max={20}
              aria-label="Trim height in inches"
              value={geometry.trim.height}
              onChange={(event) => write({ trim: { ...geometry.trim, height: Number(event.target.value) || geometry.trim.height } })}
            />
          </label>
        </div>
      ) : null}
      <div className="layout-two">
        {margin('inside', 'Inside')}
        {margin('outside', 'Outside')}
        {margin('top', 'Top')}
        {margin('bottom', 'Bottom')}
      </div>
      <p className="small layout-geometry">{describeGeometry(geometry, settings.face)}</p>
      {warning ? <p className="small layout-warning">{warning}</p> : null}
    </section>
  );
}

function TypeSection({ settings, write }: { settings: BookSettings; write(patch: Partial<BookSettings>): void }) {
  return (
    <section className="layout-section">
      <h3>Type</h3>
      <label className="field">
        <span>Face</span>
        <select aria-label="Body face" value={settings.face} onChange={(event) => write({ face: event.target.value as BookSettings['face'] })}>
          {BOOK_FACES.map((face) => (
            <option key={face} value={face}>
              {FACE_NAMES[face]} — {FACE_NOTES[face]}
            </option>
          ))}
        </select>
      </label>
      <div className="layout-two">
        <label className="field">
          <span>Size, pt</span>
          <input
            type="number"
            step={0.5}
            min={8}
            max={14}
            aria-label="Body size in points"
            value={settings.size}
            onChange={(event) => write({ size: Number(event.target.value) || settings.size })}
          />
        </label>
        <label className="field">
          <span>
            Leading, pt <span className="muted">{settings.leading === null ? 'proposed' : 'typed'}</span>
          </span>
          <span className="layout-margin-row">
            <input
              type="number"
              step={0.5}
              min={8}
              max={30}
              aria-label="Leading in points"
              placeholder={String(Math.round(settings.size * 1.35 * 2) / 2)}
              value={settings.leading ?? ''}
              onChange={(event) => {
                const value = event.target.value.trim();
                write({ leading: value === '' ? null : Number(value) });
              }}
            />
            {settings.leading !== null ? (
              <button type="button" className="ghost small" aria-label="Propose the leading again" onClick={() => write({ leading: null })}>
                ×
              </button>
            ) : null}
          </span>
        </label>
      </div>
      <label className="field">
        <span>A chapter’s first paragraph</span>
        <select aria-label="Chapter opening paragraph" value={settings.opening} onChange={(event) => write({ opening: event.target.value as BookSettings['opening'] })}>
          {OPENINGS.map((opening) => (
            <option key={opening} value={opening}>
              {OPENING_WORDS[opening]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Scene break ornament</span>
        <span className="layout-margin-row">
          <input
            aria-label="Scene break ornament"
            placeholder="a blank line"
            value={settings.ornament}
            onChange={(event) => write({ ornament: event.target.value })}
          />
          {['❦', '✦', '* * *', '~'].map((glyph) => (
            <button key={glyph} type="button" className="ghost small" onClick={() => write({ ornament: glyph })}>
              {glyph}
            </button>
          ))}
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.justify} onChange={(event) => write({ justify: event.target.checked })} /> Justify
        the lines
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.hyphenate} onChange={(event) => write({ hyphenate: event.target.checked })} />{' '}
        Hyphenate
      </label>
    </section>
  );
}

function FurnitureSection({ settings, write }: { settings: BookSettings; write(patch: Partial<BookSettings>): void }) {
  return (
    <section className="layout-section">
      <h3>Running heads &amp; page numbers</h3>
      <div className="layout-two">
        <label className="field">
          <span>Left-hand pages carry</span>
          <select
            aria-label="Verso running head"
            value={settings.runningHeads.verso}
            onChange={(event) => write({ runningHeads: { ...settings.runningHeads, verso: event.target.value as BookSettings['runningHeads']['verso'] } })}
          >
            <option value="author">The author</option>
            <option value="title">The book’s title</option>
            <option value="none">Nothing</option>
          </select>
        </label>
        <label className="field">
          <span>Right-hand pages carry</span>
          <select
            aria-label="Recto running head"
            value={settings.runningHeads.recto}
            onChange={(event) => write({ runningHeads: { ...settings.runningHeads, recto: event.target.value as BookSettings['runningHeads']['recto'] } })}
          >
            <option value="chapter">The chapter’s title</option>
            <option value="title">The book’s title</option>
            <option value="none">Nothing</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Page number</span>
        <select aria-label="Page number place" value={settings.folio} onChange={(event) => write({ folio: event.target.value as BookSettings['folio'] })}>
          {FOLIO_PLACES.map((place) => (
            <option key={place} value={place}>
              {FOLIO_WORDS[place]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.folioOnOpening} onChange={(event) => write({ folioOnOpening: event.target.checked })} />{' '}
        A chapter opening shows its number
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.chaptersOpenRecto} onChange={(event) => write({ chaptersOpenRecto: event.target.checked })} />{' '}
        Every chapter opens on a right-hand page
      </label>
      <label className="field">
        <span>Publisher, on the title page</span>
        <input aria-label="Publisher" value={settings.imprint} onChange={(event) => write({ imprint: event.target.value })} />
      </label>
      <p className="muted small">
        The words in the running heads are read from the book and the chapters; nothing about them is typed here.
      </p>
    </section>
  );
}

function PartFields({
  file,
  part,
  onUpdate,
  onDone,
}: {
  file: ProjectFile;
  part: BookPart;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onDone(): void;
}) {
  const info = PART_INFO[part.kind];
  const library = graphicsInOrder(file);
  const chapters = contentsDivisions(file);
  const [asking, setAsking] = useState(false);
  const patch = (fields: Partial<Omit<BookPart, 'id' | 'kind'>>) => onUpdate((current) => updatePart(current, part.id, fields));
  return (
    <section className="layout-section layout-part-fields">
      <h3>{info.name}</h3>
      <p className="muted small">{info.note}.</p>
      {part.kind !== 'half_title' && part.kind !== 'title_page' ? (
        <label className="field">
          <span>Heading</span>
          <input aria-label="The part's heading" placeholder={info.name} value={part.title} onChange={(event) => patch({ title: event.target.value })} />
        </label>
      ) : null}
      {info.carries === 'text' ? (
        <label className="field">
          <span>Text</span>
          <textarea
            aria-label="The part's text"
            rows={part.kind === 'dedication' || part.kind === 'epigraph' || part.kind === 'copyright' ? 6 : 14}
            placeholder={part.kind === 'copyright' ? `Copyright © ${file.project.author}` : 'A blank line between paragraphs.'}
            value={part.text}
            onChange={(event) => patch({ text: event.target.value })}
          />
        </label>
      ) : null}
      {info.carries === 'reading' ? (
        <p className="muted small">Read from the book every time; there is nothing to type on it.</p>
      ) : null}
      {info.carries === 'plate' ? (
        <>
          <label className="field">
            <span>Picture, from the library</span>
            <select aria-label="Plate picture" value={part.assetId ?? ''} onChange={(event) => patch({ assetId: event.target.value || null })}>
              <option value="">Choose one…</option>
              {library.map((asset) => (
                <option key={asset.id as string} value={asset.id as string}>
                  {asset.name || asset.caption || 'Untitled'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Caption</span>
            <input aria-label="Plate caption" value={part.caption} onChange={(event) => patch({ caption: event.target.value })} />
          </label>
          <label className="field">
            <span>Where</span>
            <select aria-label="Plate place" value={part.beforeMarkerId ?? ''} onChange={(event) => patch({ beforeMarkerId: event.target.value || null })}>
              <option value="">At the back</option>
              {chapters.map((placed) => (
                <option key={placed.marker.id as string} value={placed.marker.id as string}>
                  Before {placed.label}
                  {placed.marker.title.trim() ? ` — ${placed.marker.title}` : ''}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <div className="layout-part-tools">
        <button type="button" className="ghost small" aria-label="Move the part up" onClick={() => onUpdate((current) => movePart(current, part.id, -1))}>
          ↑
        </button>
        <button type="button" className="ghost small" aria-label="Move the part down" onClick={() => onUpdate((current) => movePart(current, part.id, 1))}>
          ↓
        </button>
        {asking ? (
          <span className="layout-ask">
            <span className="small">Remove {partTitle(part)}?</span>
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onUpdate((current) => removePart(current, part.id));
                onDone();
              }}
            >
              Remove
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="ghost small" onClick={() => setAsking(true)}>
            Remove…
          </button>
        )}
        <span className="toolbar-spacer" />
        <button type="button" className="ghost small" onClick={onDone}>
          Done
        </button>
      </div>
    </section>
  );
}
