import { useEffect, useMemo, useRef, useState } from 'react';
import {
  barcodeResolution,
  bookSettingsOf,
  savedCopyrightPreset,
  setBookSettings,
  BARCODE_INCHES,
  COPYRIGHT_ELEMENTS,
  COPYRIGHT_PRESETS,
  FICTION_DISCLAIMER,
  NUMBER_FORMATS,
  RIGHTS_RESERVED,
  addBookNumber,
  applyCopyrightPreset,
  beginCopyright,
  bookFaceOf,
  copyrightElement,
  copyrightLines,
  copyrightOf,
  copyrightOrder,
  copyrightPlaceholders,
  copyrightShows,
  isbnLooksRight,
  moveCopyrightElement,
  partStyleOf,
  partsOf,
  placeCopyrightElement,
  presetOf,
  removeBookNumber,
  setBookNumber,
  setCopyright,
  showCopyrightElement,
  updatePart,
  type BookPart,
  type CopyrightPage,
  type CopyrightPreset,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * **The copyright page** (addendum 20 §15, from Ken's own handoff, the
 * companion to the chapter opening one): each element its own box, switched on
 * or off, edited and reordered, starting from one of four standard orders,
 * with the page drawn beside it.
 *
 * What shapes the screen beyond the handoff's drawing:
 *
 * **Turning an element off keeps its words.** The switch and an empty field
 * are two different intentions — *I have no Library of Congress number* and
 * *I have one and this book does not print it* — so a struck-through row still
 * holds what was typed, and switching it back gives it back.
 *
 * **The alignment and the type size are the page's existing style.** They were
 * already `partStyleOf`'s (§7a), so they write there rather than to a second
 * pair of fields; the section says so.
 *
 * **The preset is read back.** Move one element and the header says *Custom*,
 * because a preset that has stopped describing the page is worse than none.
 */

export interface CopyrightPageDialogProps {
  file: ProjectFile;
  part: BookPart | null;
  onUpdate(change: (file: ProjectFile) => ProjectFile): void;
  onClose(): void;
  /** Choose the barcode picture, which the room's own file dialog does. */
  onPickBarcode(partId: string): void;
  /** A barcode dragged in from the desktop, which is how one arrives (§15b). */
  onDropBarcode(partId: string, picked: File): void;
}

export function CopyrightPageDialog({ file, part, onUpdate, onClose, onPickBarcode, onDropBarcode }: CopyrightPageDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** A file is over the barcode's box, so it says it will take one. */
  const [dropping, setDropping] = useState(false);
  const [said, setSaid] = useState('');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (part && !node.open) node.showModal();
    if (!part && node.open) node.close();
  }, [part]);

  const page = useMemo(() => (part ? (copyrightOf(part) ?? beginCopyright(part, file)) : null), [part, file]);
  const style = part ? partStyleOf(part) : null;

  if (!part || !page || !style) {
    return <dialog ref={ref} className="copyright-dialog" aria-label="Copyright page" onClose={onClose} />;
  }

  const write = (next: CopyrightPage) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === part.id);
      if (!now) return current;
      return updatePart(current, part.id, { copyright: setCopyright(now, current, next).copyright });
    });
  const patch = (fields: Partial<CopyrightPage>) => write({ ...page, ...fields });
  const writeStyle = (fields: Partial<typeof style>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === part.id);
      if (!now) return current;
      return updatePart(current, part.id, { style: { ...partStyleOf(now), ...fields } });
    });

  const order = copyrightOrder(page);
  /* The four the program ships and whatever the writer has kept (§15b),
     read as one list: a saved order is the same shape as a built-in, so
     nothing below is told they are different. */
  const saved = (bookSettingsOf(file).copyrightPresets ?? []) as CopyrightPreset[];
  const preset = presetOf(page, style.align, saved);
  // The page as it will print, from the one reading the book itself asks.
  const lines = copyrightLines({ ...part, copyright: page } as BookPart, file);
  const owed = copyrightPlaceholders({ ...part, copyright: page } as BookPart, file);
  const shown = order.filter((id) => copyrightShows(page, id)).length;
  const barcode = page.barcodeAssetId ? file.assets.find((one) => (one.id as string) === page.barcodeAssetId) : undefined;

  /** The first line an element contributes, for the row's summary. */
  const summaryOf = (id: string): string => {
    const element = copyrightElement(id);
    if (!element) return '';
    if (element.kind === 'barcode') return barcode ? barcode.name : 'No picture yet — nothing prints';
    if (element.kind === 'numbers') {
      const set = page.numbers.filter((one) => one.number.trim().length > 0).length;
      return set === 0 ? 'None yet' : `${set} number${set === 1 ? '' : 's'}`;
    }
    // What is there, and what is owed said as such — a bracket invented here
    // would be a placeholder the counter at the foot cannot see.
    if (id === 'notice') {
      const holder = page.holder.trim() || file.project.author.trim();
      return [page.year.trim() || 'no year yet', holder || 'nobody named yet'].join(' · ');
    }
    if (id === 'publisher') return [page.publisher, page.publisherPlace].filter(Boolean).join(', ') || '(empty)';
    const field = element.field;
    const text = field ? String(page[field] ?? '') : '';
    return text.split('\n')[0]?.trim() || '(empty)';
  };

  const move = (id: string, by: -1 | 1) => {
    const name = copyrightElement(id)?.name ?? id;
    const to = order.indexOf(id) + by;
    write(moveCopyrightElement(page, id, by));
    setSaid(`${name} moved to ${to + 1} of ${order.length}`);
  };

  const pill = (on: boolean) => (on ? 'chl-pill on' : 'chl-pill');

  return (
    <dialog
      ref={ref}
      className="copyright-dialog"
      aria-label="Copyright page"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="chl-head">
        <div className="chl-head-words">
          <h2>Copyright page</h2>
          <p className="muted small">
            The back of the title page · {shown} of {order.length} shown
          </p>
        </div>
        <button type="button" className="ghost chl-x" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="cr-body">
        <div className="cr-side">
          <section className="chl-section">
            <h3>Standard orders</h3>
            <div className="cr-presets">
              {[...COPYRIGHT_PRESETS, ...saved].map((one) => (
                <button
                  key={one.id}
                  type="button"
                  className={one.id === preset?.id ? 'chl-thumb on' : 'chl-thumb'}
                  aria-pressed={one.id === preset?.id}
                  onClick={() => {
                    write(applyCopyrightPreset(page, one));
                    writeStyle({ align: one.align });
                  }}
                >
                  <PresetThumb preset={one} />
                  <span>{one.name}</span>
                  {/* A writer's own can be forgotten; the four cannot, being
                      the standards rather than somebody's choice. */}
                  {one.id.startsWith('own:') ? (
                    <span
                      className="cr-preset-x"
                      role="button"
                      tabIndex={0}
                      aria-label={`Forget ${one.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdate((current) => setBookSettings(current, {
                          copyrightPresets: (bookSettingsOf(current).copyrightPresets ?? []).filter((kept) => kept.id !== one.id),
                        }));
                      }}
                    >
                      ×
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {/* Choosing one replaces the order, what is hidden and where the
                block sits — and **keeps every word**, so it is a rearrangement
                rather than a reset. */}
            <p className="muted small">Your words are kept; only the order and what shows change.</p>
          </section>

          <section className="chl-section">
            <h3>Where on the page</h3>
            <div className="chl-pills">
              {(['top', 'middle', 'bottom'] as const).map((one) => (
                <button
                  key={one}
                  type="button"
                  className={pill(page.position === one)}
                  aria-pressed={page.position === one}
                  onClick={() => patch({ position: one })}
                >
                  {one === 'top' ? 'Top' : one === 'middle' ? 'Middle' : 'Foot'}
                </button>
              ))}
            </div>
          </section>

          {/* The alignment and the size are the page's own style (§7a), so
              they are set here and stored there — never a second pair of
              fields that could disagree with Book settings. */}
          <section className="chl-section">
            <h3>Alignment</h3>
            <div className="chl-pills">
              {(['left', 'center', 'right'] as const).map((one) => (
                <button
                  key={one}
                  type="button"
                  className={pill(style.align === one)}
                  aria-pressed={style.align === one}
                  onClick={() => writeStyle({ align: one })}
                >
                  {one === 'left' ? 'Left' : one === 'center' ? 'Centred' : 'Right'}
                </button>
              ))}
            </div>
          </section>

          <section className="chl-section">
            <h3>Type size</h3>
            <div className="chl-pills">
              {[8, 9, 10].map((size) => (
                <button
                  key={size}
                  type="button"
                  className={pill(style.title.size === size)}
                  aria-pressed={style.title.size === size}
                  onClick={() => writeStyle({ title: { ...style.title, size } })}
                >
                  {size} pt
                </button>
              ))}
            </div>
            <p className="muted small">This page’s own type, set here and in Book settings alike.</p>
          </section>
        </div>

        <div className="cr-list-side">
          <div className="chl-section-head">
            <h3>Elements</h3>
            <span className="muted small">{preset ? `${preset.name} order` : 'Custom order'}</span>
          </div>
          <ul className="cr-list">
            {order.map((id, at) => {
              const element = copyrightElement(id);
              if (!element) return null;
              const on = copyrightShows(page, id);
              const isOpen = open === id;
              return (
                <li
                  key={id}
                  className={`cr-card${isOpen ? ' open' : ''}${over === id ? ' drop-before' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    setDragging(id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragging || dragging === id) return;
                    event.preventDefault();
                    setOver(id);
                  }}
                  onDragLeave={() => setOver((current) => (current === id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragging && dragging !== id) write(placeCopyrightElement(page, dragging, id));
                    setDragging(null);
                    setOver(null);
                  }}
                >
                  <div className="cr-card-head">
                    <span className="cr-grip" aria-hidden="true">
                      ⠿
                    </span>
                    <button
                      type="button"
                      className="cr-name"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : id)}
                    >
                      <span className={on ? 'cr-title' : 'cr-title off'}>{element.name}</span>
                      <span className="muted small cr-summary">{summaryOf(id)}</span>
                    </button>
                    {element.required ? (
                      <span className="cr-required">Required</span>
                    ) : (
                      <button
                        type="button"
                        className={on ? 'cr-switch on' : 'cr-switch'}
                        role="switch"
                        aria-checked={on}
                        aria-label={`Show ${element.name}`}
                        onClick={() => write(showCopyrightElement(page, id, !on))}
                      >
                        <span />
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost cr-move"
                      aria-label={`Move ${element.name} up`}
                      disabled={at === 0}
                      onClick={() => move(id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="ghost cr-move"
                      aria-label={`Move ${element.name} down`}
                      disabled={at === order.length - 1}
                      onClick={() => move(id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                  {isOpen ? (
                    <div className="cr-card-body">
                      <ElementFields
                        id={id}
                        page={page}
                        file={file}
                        barcodeName={barcode?.name ?? null}
                        barcodePicture={
                          barcode
                            ? {
                                data: barcode.data,
                                width: barcode.width,
                                height: barcode.height,
                                // A vector has no pixels to count, and the
                                // data URI is what says which it is.
                                vector: /^data:image\/svg\+xml/i.test(barcode.data),
                              }
                            : null
                        }
                        dropping={dropping}
                        onDropping={setDropping}
                        onDropBarcode={(picked) => onDropBarcode(part.id, picked)}
                        onPatch={patch}
                        onPickBarcode={() => onPickBarcode(part.id)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="cr-preview">
          <div className="chl-section-head">
            <h3>Preview</h3>
            <span className="muted small">the back of the title page</span>
          </div>
          <div className="chl-sheet-well">
            <div className={`cr-sheet cr-at-${page.position} cr-align-${style.align}`}>
              {lines.map((line, index) => (
                <p key={index} className={line.apart ? undefined : 'cr-run'}>
                  {line.text}
                </p>
              ))}
              {copyrightShows(page, 'barcode') && barcode ? (
                <img className="cr-barcode" src={barcode.data} alt={barcode.altText || 'Barcode'} style={{ width: `${(page.barcodeInches / 6) * 100}%` }} />
              ) : copyrightShows(page, 'barcode') ? (
                // A dashed box on the screen only. Nothing is printed where
                // there is no picture — an empty rectangle would show up in
                // the finished book.
                <span className="cr-barcode-empty">ISBN barcode</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="chl-foot">
        <span className={owed > 0 ? 'cr-owed' : 'cr-ready'}>
          {owed > 0
            ? `${owed} thing${owed === 1 ? '' : 's'} still to fill in`
            : 'Nothing left to fill in'}
        </span>
        <span className="chl-spacer" />
        {/* Keeping this order to use again (§15b, the handoff's *Save as
            preset…*). It saves the **arrangement** and never the words: an
            order is a house style and a copyright notice is one book's. */}
        <button
          type="button"
          className="raised small"
          onClick={() => {
            const named = window.prompt('Call this order what?');
            const name = (named ?? '').trim();
            if (name.length === 0) return;
            const made = savedCopyrightPreset(page, style.align, name);
            onUpdate((current) => {
              const kept = (bookSettingsOf(current).copyrightPresets ?? []).filter((one) => one.id !== made.id);
              // The stored shape is the readable one made mutable: a preset
              // is handed round read-only and written down as plain arrays.
              return setBookSettings(current, {
                copyrightPresets: [...kept, { ...made, order: [...made.order], hidden: [...made.hidden] }],
              });
            });
            setSaid(`${name} saved as an order you can use again`);
          }}
        >
          Save as preset…
        </button>
        <span className="muted small">Every change is kept as you make it.</span>
      </div>
      <p aria-live="polite" className="visually-hidden">
        {said}
      </p>
    </dialog>
  );
}

/** What opens inside an element's box: its own field, the numbers, or the picture. */
function ElementFields({
  id,
  page,
  file,
  barcodeName,
  barcodePicture,
  dropping,
  onDropping,
  onDropBarcode,
  onPatch,
  onPickBarcode,
}: {
  id: string;
  page: CopyrightPage;
  file: ProjectFile;
  barcodeName: string | null;
  /** The picture itself, for the thumbnail and for counting its dots (§15b). */
  barcodePicture: { data: string; width: number; height: number; vector: boolean } | null;
  dropping: boolean;
  onDropping(on: boolean): void;
  onDropBarcode(file: File): void;
  onPatch(fields: Partial<CopyrightPage>): void;
  onPickBarcode(): void;
}) {
  if (id === 'notice') {
    return (
      <div className="cr-two">
        <label className="field">
          <span>Year</span>
          <input type="text" value={page.year} placeholder="2026" onChange={(event) => onPatch({ year: event.target.value })} />
        </label>
        <label className="field">
          <span>Holder</span>
          <input
            type="text"
            value={page.holder}
            placeholder={file.project.author || 'The author'}
            onChange={(event) => onPatch({ holder: event.target.value })}
          />
        </label>
      </div>
    );
  }
  if (id === 'publisher') {
    return (
      <div className="cr-two">
        <label className="field">
          <span>Imprint</span>
          <input type="text" value={page.publisher} onChange={(event) => onPatch({ publisher: event.target.value })} />
        </label>
        <label className="field">
          <span>Place</span>
          <input
            type="text"
            value={page.publisherPlace}
            onChange={(event) => onPatch({ publisherPlace: event.target.value })}
          />
        </label>
      </div>
    );
  }
  if (id === 'edition') {
    return (
      <>
        <label className="field">
          <span>Edition</span>
          <input type="text" value={page.edition} placeholder="First Edition" onChange={(event) => onPatch({ edition: event.target.value })} />
        </label>
        <label className="field">
          <span>Which printing this is</span>
          <select
            value={page.printing === null ? '' : String(page.printing)}
            onChange={(event) => onPatch({ printing: event.target.value === '' ? null : Number(event.target.value) })}
          >
            <option value="">No number line</option>
            {Array.from({ length: 10 }, (unused, at) => at + 1).map((one) => (
              <option key={one} value={one}>
                {one === 1 ? 'First printing' : `Printing ${one}`}
              </option>
            ))}
          </select>
        </label>
        {/* The line itself is worked out and there is nowhere to type one:
            typing it by hand is how a second printing claims to be the
            first (§9k). */}
        <p className="muted small">The number line is worked out from this.</p>
      </>
    );
  }
  if (id === 'isbn') {
    return (
      <>
        {page.numbers.map((number, at) => {
          const right = isbnLooksRight(number.number);
          return (
            <div className="cr-isbn" key={at}>
              <label className="field">
                <span className="visually-hidden">Format</span>
                <input
                  type="text"
                  list="cr-number-formats"
                  aria-label={`Format of number ${at + 1}`}
                  value={number.format}
                  placeholder="Paperback"
                  onChange={(event) => onPatch(setBookNumber(page, at, { format: event.target.value }))}
                />
              </label>
              <label className="field">
                <span className="visually-hidden">Number</span>
                <input
                  type="text"
                  aria-label={`Number ${at + 1}`}
                  aria-invalid={right === false}
                  className={right === false ? 'cr-wrong' : undefined}
                  value={number.number}
                  placeholder="978-0-000-00000-0"
                  onChange={(event) => onPatch(setBookNumber(page, at, { number: event.target.value }))}
                />
              </label>
              <button type="button" className="ghost small" aria-label={`Remove number ${at + 1}`} onClick={() => onPatch(removeBookNumber(page, at))}>
                ×
              </button>
              {/* Said under the row rather than as a red box: an ISBN with a
                  wrong check digit is a typo worth catching, and an empty one
                  is a number the writer has not got yet. */}
              {right === false ? <p className="cr-owed small">That check digit does not match — an ISBN-13 has thirteen digits.</p> : null}
            </div>
          );
        })}
        <datalist id="cr-number-formats">
          {NUMBER_FORMATS.map((one) => (
            <option key={one} value={one} />
          ))}
        </datalist>
        <button type="button" className="small" onClick={() => onPatch(addBookNumber(page))}>
          + Another number
        </button>
      </>
    );
  }
  if (id === 'barcode') {
    /**
     * How finely it will print at the width it is placed (§15b). A reading,
     * so narrowing the barcode clears the warning by itself — the same
     * picture is fine at 1.5in and too coarse at 3in, and a warning stored
     * when the file arrived would be about a size that has since changed.
     */
    const sharpness = barcodeResolution(
      barcodePicture ? { width: barcodePicture.width, height: barcodePicture.height, vector: barcodePicture.vector } : null,
      page.barcodeInches,
    );
    return (
      <div
        className={dropping ? 'cr-barcode-box cr-dropping' : 'cr-barcode-box'}
        /* A file dragged in from the desktop, which is how a printer's
           barcode actually arrives (§15b). Browse… does the same thing for
           anybody not dragging. */
        onDragOver={(event) => {
          if (Array.from(event.dataTransfer.types).includes('Files')) {
            event.preventDefault();
            onDropping(true);
          }
        }}
        onDragLeave={() => onDropping(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDropping(false);
          const picked = event.dataTransfer.files[0];
          if (picked) onDropBarcode(picked);
        }}
      >
        {barcodeName ? (
          <>
            {/* The picture itself, not its file name: the writer is checking
                that the right barcode is on the page. */}
            {barcodePicture ? <img className="cr-barcode-thumb" src={barcodePicture.data} alt={barcodeName} /> : null}
            <p className="muted small">{barcodeName}</p>
            <div className="chl-pills">
              <button type="button" className="small" onClick={onPickBarcode}>
                Another picture…
              </button>
              <button type="button" className="ghost small" onClick={() => onPatch({ barcodeAssetId: null })}>
                Take it out
              </button>
            </div>
            <label className="field">
              <span>Width, {page.barcodeInches.toFixed(2)} in</span>
              <input
                type="range"
                aria-label="Barcode width in inches"
                min={BARCODE_INCHES.min}
                max={BARCODE_INCHES.max}
                step={0.05}
                value={page.barcodeInches}
                onChange={(event) => onPatch({ barcodeInches: Number(event.target.value) })}
              />
            </label>
            {sharpness.warning ? (
              <p className="cr-coarse small">{sharpness.warning}</p>
            ) : sharpness.dpi !== null ? (
              <p className="muted small">{sharpness.dpi} dpi at this width — fine for a printer.</p>
            ) : (
              <p className="muted small">A vector picture, so it is sharp at any width.</p>
            )}
          </>
        ) : (
          <>
            <p className="cr-drop-here small">Drag a barcode picture here</p>
            <button type="button" className="raised small" onClick={onPickBarcode}>
              Browse…
            </button>
            {/* What a barcode encodes — the retail price as well as the
                number — is not something the book knows, so this is a box for
                one rather than one the program draws (§9k). */}
            <p className="muted small">
              A picture from your printer or retailer. The book does not draw one, because a retail barcode carries the
              price as well as the number.
            </p>
          </>
        )}
      </div>
    );
  }
  const element = copyrightElement(id);
  const field = element?.field;
  if (!field) return null;
  const value = String(page[field] ?? '');
  const usual = id === 'rights' ? RIGHTS_RESERVED : id === 'disclaimer' ? FICTION_DISCLAIMER : null;
  return (
    <>
      <label className="field">
        <span className="visually-hidden">{element?.name}</span>
        <textarea
          aria-label={element?.name}
          rows={id === 'disclaimer' || id === 'rights' ? 4 : 2}
          value={value}
          onChange={(event) => onPatch({ [field]: event.target.value } as Partial<CopyrightPage>)}
        />
      </label>
      {usual && value.trim() !== usual ? (
        <button type="button" className="ghost small" onClick={() => onPatch({ [field]: usual } as Partial<CopyrightPage>)}>
          Use the usual wording
        </button>
      ) : null}
    </>
  );
}

/** A preset as a small page: where the block sits and how it is aligned. */
function PresetThumb({ preset }: { preset: CopyrightPreset }) {
  return (
    <span className={`cr-thumb at-${preset.position} align-${preset.align}`} aria-hidden="true">
      {[38, 30, 40, 36, 28].map((width, at) => (
        <span key={at} style={{ width }} />
      ))}
      <span className="cr-thumb-code" />
      {[24, 32].map((width, at) => (
        <span key={`b${at}`} style={{ width }} />
      ))}
    </span>
  );
}
