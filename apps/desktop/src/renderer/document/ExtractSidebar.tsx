import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import {
  CATEGORY_COLOURS,
  addCategory,
  addPalette,
  binsOf,
  buildExtractBundle,
  categoriesOf,
  extractsCsv,
  importExtractBundle,
  readExtractBundle,
  serializeExtractBundle,
  duplicatePalette,
  extractKindSchema,
  extractsInCategory,
  matchesExtract,
  moveCategory,
  moveExtract,
  nudgeExtract,
  palettesOf,
  removeCategory,
  removePalette,
  renamePalette,
  updateCategory,
  updateExtract,
  type Extract,
  type ExtractCategory,
  type ExtractCategoryId,
  type ExtractKind,
  type ExtractPaletteId,
  type ExtractStatus,
  type ProjectFile,
  type WpDocument,
} from '@vcwriter/domain';
import { extractIdsIn, extractTextNow } from './extensions';

/**
 * **Extract & Organize** (addendum 42 §8, the WP spec's §5): the sidebar
 * down the right of the page.
 *
 * Select a passage, press a category, and it is in that category's bin. The
 * passage stays where it was, marked. No dialog, so the twentieth capture is
 * as quick as the first. The buttons take the press on mouse-down and never
 * take focus, so the selection in the page survives the click: the WP spec's
 * *selection focus rule*, which is the whole of what makes one-click capture
 * work.
 */

export type SourceDisplay = 'normal' | 'gray' | 'hide';

const KIND_NAMES: Record<ExtractKind, string> = {
  scene: 'Scene',
  beat: 'Beat',
  character: 'Character',
  characterization: 'Characterization',
  dialogue: 'Dialogue',
  description: 'Description',
  location: 'Location',
  object: 'Object',
  plot_point: 'Plot point',
  note: 'Note',
  idea: 'Idea',
  setup: 'Setup',
  payoff: 'Payoff',
  research: 'Research',
  other: 'Other (a labelled note)',
};

const STATUS_NAMES: Record<ExtractStatus, string> = {
  unassigned: 'Unassigned',
  ready: 'Ready',
  exported: 'Exported',
  failed: 'Failed',
};

interface ExtractSidebarProps {
  file: ProjectFile;
  document: WpDocument;
  editor: Editor;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  paletteId: ExtractPaletteId | null;
  onPalette(id: ExtractPaletteId): void;
  /** Capture the selection into this category. The workspace does it, since it owns the page. */
  onCapture(category: ExtractCategory): void;
  /** Take an extract away: its record and its mark. */
  onRemove(extract: Extract): void;
  /** Select the passage an extract came from. */
  onReveal(extract: Extract): void;
  /** Open the destination picker for these (addendum 42 §10). */
  onSend(extracts: Extract[]): void;
  /** A row for it in the document's outline (addendum 42 §9). */
  onAddToOutline(extract: Extract): void;
  display: SourceDisplay;
  onDisplay(display: SourceDisplay): void;
  onClose(): void;
  readOnly: boolean;
  /** The last capture's confirmation, said once. */
  notice: string | null;
}

export function ExtractSidebar(props: ExtractSidebarProps) {
  const { file, editor, onUpdate, paletteId, onPalette, onCapture, display, onDisplay, onClose, readOnly, notice } = props;
  const palettes = palettesOf(file);
  const palette = palettes.find((one) => one.id === paletteId) ?? palettes[0] ?? null;
  const categories = palette ? categoriesOf(file, palette.id).filter((one) => one.enabled) : [];
  const hasSelection = !editor.state.selection.empty;

  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);

  return (
    <aside className="wp-extract-sidebar" aria-label="Extract and Organize">
      <header className="wp-extract-head">
        <strong>Extract &amp; Organize</strong>
        <button type="button" className="ghost" aria-label="Close Extract and Organize" onClick={onClose}>
          ×
        </button>
      </header>

      {naming !== null ? (
        <form
          className="wp-extract-row"
          onSubmit={(event) => {
            event.preventDefault();
            const made = addPalette(file, naming);
            onUpdate(() => made.file);
            onPalette(made.palette.id);
            setNaming(null);
            setEditing(true);
          }}
        >
          <input autoFocus aria-label="New palette name" placeholder="e.g. Math Instruction" value={naming} onChange={(event) => setNaming(event.target.value)} />
          <button type="submit" disabled={!naming.trim()}>
            Create
          </button>
          <button type="button" className="ghost" onClick={() => setNaming(null)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className="wp-extract-row">
          <select
            aria-label="Palette"
            value={palette?.id ?? ''}
            onChange={(event) => {
              onPalette(event.target.value as ExtractPaletteId);
              setEditing(false);
            }}
          >
            {palettes.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
          </select>
          <button type="button" className="ghost" disabled={readOnly} onClick={() => setNaming('')}>
            New…
          </button>
          <button type="button" className={editing ? 'ghost active' : 'ghost'} aria-pressed={editing} disabled={readOnly || !palette} onClick={() => setEditing(!editing)}>
            Edit
          </button>
        </div>
      )}

      {editing && palette ? (
        <PaletteEditor file={file} paletteId={palette.id} onUpdate={onUpdate} onPalette={onPalette} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="wp-extract-buttons" role="group" aria-label="Categories">
            {categories.map((category) => {
              const count = extractsInCategory(file, category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  className="wp-extract-button"
                  style={{ '--extract-color': category.color } as React.CSSProperties}
                  disabled={!hasSelection || readOnly}
                  tabIndex={-1}
                  title={hasSelection ? `Extract the selection into ${category.label}` : 'Select text first'}
                  aria-label={`Extract into ${category.label}`}
                  onMouseDown={(event) => {
                    // Before the page loses its selection (the WP spec's focus rule).
                    event.preventDefault();
                    if (hasSelection && !readOnly) onCapture(category);
                  }}
                >
                  <span className="swatch" aria-hidden />
                  <span className="label">{category.label}</span>
                  {count ? <span className="count">{count}</span> : null}
                </button>
              );
            })}
          </div>
          <p className="wp-extract-hint" role="status" aria-live="polite">
            {notice ?? (hasSelection ? 'Press a category to extract the selection.' : 'Select text first, then press a category.')}
          </p>
        </>
      )}

      <div className="wp-extract-row" role="radiogroup" aria-label="Extracted passages in the document">
        <span className="muted small">Extracted text:</span>
        {(['normal', 'gray', 'hide'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={display === mode}
            className={display === mode ? 'ghost active' : 'ghost'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onDisplay(mode)}
          >
            {mode === 'normal' ? 'Normal' : mode === 'gray' ? 'Gray' : 'Hide'}
          </button>
        ))}
      </div>

      <Bins {...props} paletteId={palette?.id ?? null} />
    </aside>
  );
}

// ------------------------------------------------------------------- bins

function Bins({ file, document, editor, onUpdate, paletteId, onRemove, onReveal, onSend, onAddToOutline, readOnly }: ExtractSidebarProps) {
  const [scope, setScope] = useState<'palette' | 'all'>('palette');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ExtractStatus | 'all'>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // An empty bin's button is already above; listing it again is clutter.
  const bins = binsOf(file, scope === 'palette' ? paletteId : null).filter((bin) => bin.extracts.length > 0);
  // Which marks are still in the page, read once per render.
  const live = useMemo(() => extractIdsIn(editor.state.doc), [editor.state.doc]);
  const everyCategory = useMemo(
    () => palettesOf(file).flatMap((one) => categoriesOf(file, one.id).filter((category) => category.enabled).map((category) => ({ category, palette: one.name }))),
    [file],
  );
  const filtering = query.trim() !== '' || status !== 'all';
  const total = bins.reduce((sum, bin) => sum + bin.extracts.length, 0);
  // What a bulk send takes: every extract the bins are showing.
  const showing = bins.flatMap((bin) => bin.extracts.filter((extract) => matchesExtract(extract, query, status)));
  const [said, setSaid] = useState<string | null>(null);

  /**
   * The bins as a portable bundle or a CSV (addendum 42 §11, WP spec §7.2):
   * what is listed, so a search or a status narrows what goes.
   */
  const save = async (as: 'bundle' | 'csv') => {
    const ids = showing.map((extract) => extract.id as string);
    const base = (document.title || file.project.title || 'Extracts').replace(/[^\w\-. ]+/g, '').trim() || 'Extracts';
    const result =
      as === 'bundle'
        ? await window.vcwriter.saveFile({
            name: `${base} extracts.json`,
            bytes: new TextEncoder().encode(serializeExtractBundle(buildExtractBundle(file, ids))),
            mediaType: 'application/json',
            kind: { name: 'VC Writer extract bundle', extension: 'json' },
          })
        : await window.vcwriter.saveFile({
            name: `${base} extracts.csv`,
            bytes: new TextEncoder().encode(extractsCsv(file, ids)),
            mediaType: 'text/csv',
            kind: { name: 'CSV', extension: 'csv' },
          });
    if (!result.ok) setSaid(result.error ?? 'The file could not be saved.');
    else if (result.data?.path) setSaid(`Saved ${result.data.path}`);
  };

  const importBundle = async (chosen: File) => {
    const read = readExtractBundle(await chosen.text());
    if (!read.ok) {
      setSaid(read.error);
      return;
    }
    const counted = importExtractBundle(file, read.bundle, document.id);
    onUpdate((current) => importExtractBundle(current, read.bundle, document.id).file);
    setSaid(
      counted.added === 0
        ? `Nothing new in ${chosen.name}: ${counted.skipped === 1 ? 'its extract is' : 'all of its extracts are'} already here.`
        : `Imported ${counted.added} ${counted.added === 1 ? 'extract' : 'extracts'} from ${chosen.name}${counted.skipped ? ` (${counted.skipped} already here)` : ''}.`,
    );
  };

  return (
    <section className="wp-bins" aria-label="Bins">
      <div className="wp-extract-row">
        <strong className="small">Bins</strong>
        <span className="muted small">{total}</span>
        <span className="spacer" />
        <select aria-label="Which bins" value={scope} onChange={(event) => setScope(event.target.value as 'palette' | 'all')}>
          <option value="palette">This palette</option>
          <option value="all">All categories</option>
        </select>
        <button
          type="button"
          className="ghost small"
          disabled={readOnly || showing.length === 0}
          title="Send every extract listed here to a project"
          onClick={() => onSend(showing)}
        >
          Send {showing.length === total ? 'all' : showing.length}…
        </button>
      </div>
      <div className="wp-extract-row">
        <input type="search" aria-label="Search extracts" placeholder="Search extracts" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as ExtractStatus | 'all')}>
          <option value="all">Any status</option>
          {(Object.keys(STATUS_NAMES) as ExtractStatus[]).map((one) => (
            <option key={one} value={one}>
              {STATUS_NAMES[one]}
            </option>
          ))}
        </select>
      </div>
      <div className="wp-extract-row wp-bins-files">
        <button type="button" className="ghost small" disabled={showing.length === 0} title="The extracts listed, with their palettes, as one file another VC Writer can import" onClick={() => void save('bundle')}>
          Export bundle
        </button>
        <button type="button" className="ghost small" disabled={showing.length === 0} title="The extracts listed, one row each, for a spreadsheet" onClick={() => void save('csv')}>
          Export CSV
        </button>
        <label className={`ghost small wp-file-button${readOnly ? ' disabled' : ''}`}>
          Import bundle…
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Import bundle"
            disabled={readOnly}
            hidden
            onChange={(event) => {
              const chosen = event.target.files?.[0];
              event.target.value = '';
              if (chosen) void importBundle(chosen);
            }}
          />
        </label>
      </div>
      {said ? (
        <p className="muted small" role="status">
          {said}
        </p>
      ) : null}
      {bins.length === 0 ? <p className="muted small">Nothing extracted{scope === 'palette' ? ' with this palette' : ''} yet.</p> : null}
      {bins.map((bin) => {
        const shown = bin.extracts.filter((extract) => matchesExtract(extract, query, status));
        if (filtering && shown.length === 0) return null;
        const expanded = open[bin.category.id] ?? (filtering || bin.extracts.length > 0);
        return (
          <div key={bin.category.id} className="wp-bin">
            <button
              type="button"
              className="wp-bin-head"
              aria-expanded={expanded}
              onClick={() => setOpen((current) => ({ ...current, [bin.category.id]: !expanded }))}
            >
              <span className="swatch" style={{ background: bin.category.color }} aria-hidden />
              <span className="label">{bin.category.label}</span>
              {bin.category.enabled ? null : <span className="muted small">(button off)</span>}
              <span className="count">{filtering ? `${shown.length} of ${bin.extracts.length}` : bin.extracts.length}</span>
            </button>
            {expanded ? (
              <ul className="wp-bin-items">
                {shown.map((extract, index) => (
                  <ExtractItem
                    key={extract.id}
                    extract={extract}
                    first={index === 0}
                    last={index === shown.length - 1}
                    inPage={live.has(extract.id)}
                    changed={(() => {
                      if (!live.has(extract.id)) return false;
                      const now = extractTextNow(editor.state.doc, extract.id);
                      return now !== null && now.trim() !== extract.textPlain.trim();
                    })()}
                    categories={everyCategory}
                    readOnly={readOnly}
                    onUpdate={onUpdate}
                    onRemove={() => onRemove(extract)}
                    onReveal={() => onReveal(extract)}
                    onSend={() => onSend([extract])}
                    onAddToOutline={() => onAddToOutline(extract)}
                    onResync={() => {
                      const now = extractTextNow(editor.state.doc, extract.id);
                      if (now !== null) onUpdate((current) => updateExtract(current, extract.id, { textPlain: now, sourceRevision: document.revision }));
                    }}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function ExtractItem({
  extract,
  first,
  last,
  inPage,
  changed,
  categories,
  readOnly,
  onUpdate,
  onRemove,
  onReveal,
  onSend,
  onAddToOutline,
  onResync,
}: {
  extract: Extract;
  first: boolean;
  last: boolean;
  inPage: boolean;
  changed: boolean;
  categories: { category: ExtractCategory; palette: string }[];
  readOnly: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onRemove(): void;
  onReveal(): void;
  onSend(): void;
  onAddToOutline(): void;
  onResync(): void;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="wp-bin-item">
      {renaming !== null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate((current) => updateExtract(current, extract.id, { title: renaming }));
            setRenaming(null);
          }}
        >
          <input autoFocus aria-label="Extract title" value={renaming} onChange={(event) => setRenaming(event.target.value)} onBlur={(event) => event.currentTarget.form?.requestSubmit()} />
        </form>
      ) : (
        <button type="button" className="wp-bin-title" title="Show where this came from" onClick={onReveal} disabled={!inPage}>
          {extract.title || 'Untitled extract'}
        </button>
      )}
      <p className="wp-bin-text">{extract.textPlain}</p>
      <div className="wp-bin-flags">
        {!inPage ? <span className="flag">Source removed</span> : null}
        {changed ? (
          <>
            <span className="flag">Source changed</span>
            <button type="button" className="ghost small" disabled={readOnly} onClick={onResync}>
              Update from source
            </button>
          </>
        ) : null}
        {extract.sentTo.map((receipt) => (
          <span key={`${receipt.projectId}-${receipt.resultId}`} className="flag sent" title={receipt.path ?? undefined}>
            Sent to {receipt.projectTitle || 'a project'} › {receipt.areaName}
          </span>
        ))}
      </div>
      <div className="wp-bin-actions">
        <button type="button" className="small" disabled={readOnly} onClick={onSend}>
          Send…
        </button>
        <button type="button" className="ghost small" disabled={readOnly} onClick={onAddToOutline}>
          Add to outline
        </button>
        <select
          aria-label="Status"
          value={extract.status}
          disabled={readOnly}
          onChange={(event) => onUpdate((current) => updateExtract(current, extract.id, { status: event.target.value as ExtractStatus }))}
        >
          {(Object.keys(STATUS_NAMES) as ExtractStatus[]).map((one) => (
            <option key={one} value={one}>
              {STATUS_NAMES[one]}
            </option>
          ))}
        </select>
        <select
          aria-label="Move to"
          value=""
          disabled={readOnly}
          onChange={(event) => {
            if (event.target.value) onUpdate((current) => moveExtract(current, extract.id, event.target.value as ExtractCategoryId));
          }}
        >
          <option value="">Move to…</option>
          {categories
            .filter((one) => one.category.id !== extract.categoryId)
            .map((one) => (
              <option key={one.category.id} value={one.category.id}>
                {one.palette} › {one.category.label}
              </option>
            ))}
        </select>
        <button type="button" className="ghost small" aria-label="Move up" disabled={readOnly || first} onClick={() => onUpdate((current) => nudgeExtract(current, extract.id, -1))}>
          ↑
        </button>
        <button type="button" className="ghost small" aria-label="Move down" disabled={readOnly || last} onClick={() => onUpdate((current) => nudgeExtract(current, extract.id, 1))}>
          ↓
        </button>
        <button type="button" className="ghost small" disabled={readOnly} onClick={() => setRenaming(extract.title)}>
          Rename
        </button>
        {confirming ? (
          <>
            <button type="button" className="ghost small danger" onClick={onRemove}>
              Delete extract
            </button>
            <button type="button" className="ghost small" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="ghost small" disabled={readOnly} onClick={() => setConfirming(true)} title="Delete this extract. The passage stays in the document.">
            Delete…
          </button>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------- palette editor

function PaletteEditor({
  file,
  paletteId,
  onUpdate,
  onPalette,
  onDone,
}: {
  file: ProjectFile;
  paletteId: ExtractPaletteId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onPalette(id: ExtractPaletteId): void;
  onDone(): void;
}) {
  const palette = file.extractPalettes.find((one) => one.id === paletteId)!;
  const categories = categoriesOf(file, paletteId).filter((one) => one.enabled);
  const [label, setLabel] = useState('');
  const [name, setName] = useState(palette.name);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="wp-palette-editor">
      <label className="wp-extract-row">
        <span className="small">Name</span>
        <input
          aria-label="Palette name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => onUpdate((current) => renamePalette(current, paletteId, name))}
        />
      </label>
      <ul className="wp-category-list" aria-label="Buttons">
        {categories.map((category, index) => (
          <li key={category.id} className="wp-category-edit">
            <input
              type="color"
              aria-label={`${category.label} colour`}
              value={/^#[0-9a-f]{6}$/i.test(category.color) ? category.color : '#8fa8c4'}
              onChange={(event) => onUpdate((current) => updateCategory(current, category.id, { color: event.target.value }))}
            />
            <input
              aria-label={`${category.label} label`}
              defaultValue={category.label}
              onBlur={(event) => onUpdate((current) => updateCategory(current, category.id, { label: event.target.value }))}
            />
            <select
              aria-label={`${category.label} goes to`}
              value={category.kind}
              title="What it becomes when sent to another module"
              onChange={(event) => onUpdate((current) => updateCategory(current, category.id, { kind: event.target.value as ExtractKind }))}
            >
              {extractKindSchema.options.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_NAMES[kind]}
                </option>
              ))}
            </select>
            <input
              aria-label={`${category.label} default shelf`}
              defaultValue={category.targetShelf ?? ''}
              placeholder="Shelf: by kind"
              title="The research shelf this button's extracts go to when sent. Left empty, the kind decides. Made in the project if it is not there."
              onBlur={(event) => onUpdate((current) => updateCategory(current, category.id, { targetShelf: event.target.value }))}
            />
            <button type="button" className="ghost small" aria-label={`Move ${category.label} up`} disabled={index === 0} onClick={() => onUpdate((current) => moveCategory(current, category.id, -1))}>
              ↑
            </button>
            <button type="button" className="ghost small" aria-label={`Move ${category.label} down`} disabled={index === categories.length - 1} onClick={() => onUpdate((current) => moveCategory(current, category.id, 1))}>
              ↓
            </button>
            <button
              type="button"
              className="ghost small"
              aria-label={`Remove ${category.label}`}
              onClick={() => {
                const result = removeCategory(file, category.id);
                onUpdate(() => result.file);
                setMessage(result.disabled ? `${category.label} has extracts, so its button is off and its bin is kept.` : `${category.label} removed.`);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form
        className="wp-extract-row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!label.trim()) return;
          onUpdate((current) => addCategory(current, paletteId, label, { color: CATEGORY_COLOURS[categories.length % CATEGORY_COLOURS.length] }).file);
          setLabel('');
        }}
      >
        <input aria-label="New button" placeholder="Add a button, e.g. Addition" value={label} onChange={(event) => setLabel(event.target.value)} />
        <button type="submit" disabled={!label.trim()}>
          Add
        </button>
      </form>
      <div className="wp-extract-row">
        <button
          type="button"
          className="ghost small"
          onClick={() => {
            const made = duplicatePalette(file, paletteId, `${palette.name} copy`);
            onUpdate(() => made.file);
            onPalette(made.palette.id);
          }}
        >
          Duplicate palette
        </button>
        {palette.builtIn ? null : (
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              const result = removePalette(file, paletteId);
              onUpdate(() => result.file);
              const next = palettesOf(result.file)[0];
              if (next) onPalette(next.id);
              onDone();
            }}
          >
            {file.extracts.some((extract) => categoriesOf(file, paletteId).some((one) => one.id === extract.categoryId)) ? 'Archive palette' : 'Delete palette'}
          </button>
        )}
        <span className="spacer" />
        <button type="button" onClick={onDone}>
          Done
        </button>
      </div>
      {message ? <p className="muted small">{message}</p> : null}
    </div>
  );
}
