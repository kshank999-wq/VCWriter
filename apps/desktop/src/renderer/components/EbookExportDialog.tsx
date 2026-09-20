import { useEffect, useMemo, useState } from 'react';
import {
  EBOOK_RULES,
  EBOOK_TARGETS,
  bookFigures,
  bookSettingsOf,
  ebookOf,
  ebookReportHtml,
  epubBytes,
  fixedEbookOf,
  markFigureDecorative,
  packagedCheck,
  preflightEbook,
  setBookSettings,
  updateGraphic,
  type EbookSettings,
  type EbookTarget,
  type LaidForEbook,
  type PreflightFinding,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { EbookPreview } from './EbookPreview';

/**
 * Export ▸ eBook (addendum 23 §7).
 *
 * The screen is the preflight: the package is built from the book every
 * time something changes, checked against the chosen store's rules, and
 * what the store would say is shown before anything is written. Errors
 * hold the button; warnings do not. The fields are the book's own metadata
 * and are saved as they are typed, so the next export says the same as this
 * one. When the files are written, the panel says where and what to do at
 * the store.
 *
 * Phases 3 and 4 (§9–§11) grew it three ways: **Preview** shows the
 * package's own files at the size of a device; **Layout** offers the
 * fixed-layout book, read off the pages the room laid, where the room has
 * laid them; and **Pictures** is where a description is typed or a figure
 * marked decorative, since the preflight's warning about one is otherwise a
 * warning with nowhere to act. After writing, the check on the packaged
 * bytes is reported, and Kindle Previewer is offered where it is installed.
 */

interface EbookExportDialogProps {
  open: boolean;
  file: ProjectFile;
  /** The book as the Layout room laid it, for the fixed-layout export. Null before the room has measured. */
  laid?: LaidForEbook | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

type Done = { folder: string; files: { name: string; bytes: number }[]; epubPath: string | null; packaged: PreflightFinding[] };
type Previewer = { installed: boolean; path: string | null } | null;

export function EbookExportDialog({ open, file, laid = null, onClose, onUpdate }: EbookExportDialogProps) {
  const dialog = useModal(open);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'settings' | 'preview'>('settings');
  const [previewer, setPreviewer] = useState<Previewer>(null);
  const [opened, setOpened] = useState<string | null>(null);

  const settings = bookSettingsOf(file);
  const own = settings.ebook;
  const target = (EBOOK_TARGETS as readonly string[]).includes(own.target) ? (own.target as EbookTarget) : 'universal';
  const rules = EBOOK_RULES[target];
  const layout = own.layout === 'fixed' && laid ? 'fixed' : 'reflowable';

  const write = (patch: Partial<EbookSettings>) => {
    setDone(null);
    onUpdate((current) => {
      const book = bookSettingsOf(current);
      return setBookSettings(current, { ebook: { ...book.ebook, ...patch } });
    });
  };

  // Kindle Previewer is looked for once per opening: it is a fact about the
  // computer, and the bridge is absent where there is no computer to look on.
  useEffect(() => {
    if (!open) return;
    const ask = window.vcwriter.kindlePreviewer;
    if (!ask) {
      setPreviewer({ installed: false, path: null });
      return;
    }
    void ask().then((result) => setPreviewer(result.ok && result.data ? result.data : { installed: false, path: null }));
  }, [open]);

  // Built afresh from the book whenever it changes: what is checked is what
  // would be written.
  const pkg = useMemo(() => {
    if (!open) return null;
    return layout === 'fixed' && laid ? fixedEbookOf(file, laid, { target }) : ebookOf(file, { target });
  }, [file, target, open, layout, laid]);
  const report = useMemo(() => (pkg ? preflightEbook(pkg) : null), [pkg]);
  const pictures = file.assets.filter((asset) => asset.kind === 'image' && asset.data.length > 0);
  const figures = useMemo(() => bookFigures(file), [file]);

  const exportNow = async () => {
    if (!pkg || !report || report.blocking) return;
    setBusy(true);
    setError(null);
    try {
      const epub = await epubBytes(pkg);
      const packaged = packagedCheck(epub, pkg);
      const files: { name: string; bytes: Uint8Array; mediaType: string }[] = [
        { name: pkg.fileName, bytes: epub, mediaType: 'application/epub+zip' },
      ];
      if (pkg.cover && rules.requiresSeparateCover) {
        files.push({ name: pkg.cover.fileName, bytes: pkg.cover.data, mediaType: pkg.cover.mediaType });
      }
      const encoder = new TextEncoder();
      const listed = files.map((one) => ({ name: one.name, bytes: one.bytes.length }));
      files.push({
        name: 'export-report.html',
        bytes: encoder.encode(ebookReportHtml(pkg, report, listed, packaged)),
        mediaType: 'text/html',
      });
      files.push({
        name: 'metadata.json',
        bytes: encoder.encode(JSON.stringify({ ...pkg.metadata, target: rules.id, layout: pkg.layout }, null, 2)),
        mediaType: 'application/json',
      });
      const result = await window.vcwriter.saveExport({ folderName: `${pkg.metadata.title} - eBook Export`, files });
      if (!result.ok) {
        setError(result.error ?? 'The eBook could not be written.');
      } else if (result.data) {
        const epubPath = result.data.paths.find((path) => path.endsWith('.epub')) ?? null;
        setDone({ folder: result.data.folder, files: files.map((one) => ({ name: one.name, bytes: one.bytes.length })), epubPath, packaged });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The eBook could not be written.');
    } finally {
      setBusy(false);
    }
  };

  const openPreviewer = async () => {
    const opener = window.vcwriter.openInKindlePreviewer;
    if (!opener || !done?.epubPath) return;
    const result = await opener(done.epubPath);
    setOpened(result.ok ? 'Opened in Kindle Previewer.' : (result.error ?? 'Kindle Previewer could not be opened.'));
  };

  const close = () => {
    setDone(null);
    setError(null);
    setOpened(null);
    setView('settings');
    onClose();
  };

  const field = (label: string, key: keyof EbookSettings, placeholder = '', long = false) => (
    <label className="field" key={key}>
      {label}
      {long ? (
        <textarea aria-label={label} rows={3} value={String(own[key] ?? '')} placeholder={placeholder} onChange={(event) => write({ [key]: event.target.value } as Partial<EbookSettings>)} />
      ) : (
        <input aria-label={label} value={String(own[key] ?? '')} placeholder={placeholder} onChange={(event) => write({ [key]: event.target.value } as Partial<EbookSettings>)} />
      )}
    </label>
  );

  const group = (severity: 'error' | 'warning' | 'info', heading: string) => {
    const own_ = report?.findings.filter((finding) => finding.severity === severity) ?? [];
    if (own_.length === 0) return null;
    return (
      <div className={`ebook-findings ebook-${severity}`} key={severity}>
        <h4>{heading}</h4>
        <ul>
          {own_.map((finding) => (
            <li key={finding.text}>{finding.text}</li>
          ))}
        </ul>
      </div>
    );
  };

  const owed = pkg?.images.filter((image) => image.needsDescription).length ?? 0;
  const chapters = pkg?.sections.filter((section) => section.kind === 'chapter').length ?? 0;
  const bodyCount = pkg?.sections.filter((section) => section.kind === 'chapter' || section.kind === 'body').length ?? 0;

  return (
    <dialog ref={dialog} className="track-dialog ebook-dialog" aria-label="Export as an eBook" onClose={close}>
      {open && pkg && report ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Export as an eBook</span>
            {done ? null : (
              <span className="ebook-views" role="tablist">
                <button type="button" role="tab" aria-selected={view === 'settings'} className={view === 'settings' ? 'tool active' : 'tool'} onClick={() => setView('settings')}>
                  The book
                </button>
                <button type="button" role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'tool active' : 'tool'} onClick={() => setView('preview')}>
                  Preview
                </button>
              </span>
            )}
            <button type="button" className="ghost" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="page-setup-body ebook-body">
            {done ? (
              <div className="ebook-done">
                <h4>Written to {done.folder}</h4>
                <ul className="import-list">
                  {done.files.map((one) => (
                    <li key={one.name}>
                      <span>{one.name}</span>
                      <span className="muted">{(one.bytes / 1024).toFixed(one.bytes < 100 * 1024 ? 1 : 0)} KB</span>
                    </li>
                  ))}
                </ul>
                <ul className={done.packaged.some((finding) => finding.severity === 'error') ? 'ebook-packaged ebook-error' : 'ebook-packaged'}>
                  {done.packaged.map((finding) => (
                    <li key={finding.text}>{finding.text}</li>
                  ))}
                </ul>
                <h4>At {rules.name}</h4>
                <ul className="ebook-checklist">
                  {rules.checklist.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
                {rules.id === 'kindle' || previewer?.installed ? (
                  <p className="ebook-previewer">
                    {previewer?.installed && done.epubPath && window.vcwriter.openInKindlePreviewer ? (
                      <button type="button" className="tool" onClick={() => void openPreviewer()}>
                        Open in Kindle Previewer
                      </button>
                    ) : (
                      <span className="muted small">
                        KDP recommends checking the book in Kindle Previewer before uploading; it is not installed on this computer, or this is the browser.
                      </span>
                    )}
                    {opened ? <span className="muted small"> {opened}</span> : null}
                  </p>
                ) : null}
              </div>
            ) : view === 'preview' ? (
              <EbookPreview pkg={pkg} />
            ) : (
              <>
                <label className="field">
                  Where it is going
                  <select aria-label="Store" value={target} onChange={(event) => write({ target: event.target.value })}>
                    {EBOOK_TARGETS.map((one) => (
                      <option key={one} value={one}>
                        {EBOOK_RULES[one].name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="muted small">{rules.about} One EPUB 3.3 is made whichever store is chosen; the store decides what is checked.</p>

                <fieldset className="ebook-layout">
                  <legend>Layout</legend>
                  <label>
                    <input type="radio" name="ebook-layout" aria-label="Reflowable" checked={layout === 'reflowable'} onChange={() => write({ layout: 'reflowable' })} />
                    Reflowable — the reader sets the page and the type size; what every store expects of a novel.
                  </label>
                  <label>
                    <input type="radio" name="ebook-layout" aria-label="Fixed layout" disabled={!laid} checked={layout === 'fixed'} onChange={() => write({ layout: 'fixed' })} />
                    Fixed layout — every page as the Layout room laid it, for an illustrated book.{laid ? '' : ' Available once the room has laid the pages.'}
                  </label>
                </fieldset>

                <h4>The book</h4>
                <p className="muted small">
                  {pkg.metadata.title}
                  {pkg.metadata.authors.length > 0 ? ` — ${pkg.metadata.authors.join(', ')}` : ''} ·{' '}
                  {pkg.layout === 'fixed' && pkg.pages ? `${pkg.pages.count} pages as laid` : `${bodyCount} ${chapters === 1 ? 'chapter' : 'chapters'}`} · {pkg.images.length}{' '}
                  {pkg.images.length === 1 ? 'picture' : 'pictures'}
                </p>
                <div className="ebook-fields">
                  {field('Language', 'language', 'en-US')}
                  {field('eBook ISBN', 'isbn', 'optional')}
                  {field('Publisher', 'publisher', settings.imprint || 'optional')}
                  {field('Publication date', 'published', 'YYYY-MM-DD')}
                  {field('Series', 'seriesName', 'optional')}
                  {field('Number in series', 'seriesNumber', '')}
                </div>
                {field('Description', 'description', file.project.synopsis || file.project.logline || 'For the store’s listing', true)}
                {field('Rights', 'rights', `Copyright © ${pkg.metadata.authors.join(', ')}. All rights reserved.`)}
                <label className="field">
                  Cover
                  <select aria-label="Cover" value={own.coverAssetId ?? ''} onChange={(event) => write({ coverAssetId: event.target.value || null })}>
                    <option value="">{file.project.posterAssetId ? 'The project’s key art' : 'None'}</option>
                    {pictures.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name || 'picture'} — {asset.width} × {asset.height}
                      </option>
                    ))}
                  </select>
                </label>

                {pkg.images.length > 0 ? (
                  <>
                    <h4>Pictures</h4>
                    <p className="muted small">
                      {owed === 0
                        ? 'Every picture is described for a reader who cannot see it, or marked decorative.'
                        : `${owed} ${owed === 1 ? 'picture needs' : 'pictures need'} a description for a reader who cannot see ${owed === 1 ? 'it' : 'them'}. A description is the picture’s, in the library; decorative is the figure’s.`}
                    </p>
                    <ul className="ebook-pictures">
                      {pkg.images.map((image) => {
                        const uses = image.assetId ? figures.filter((figure) => figure.assetId === image.assetId) : [];
                        return (
                          <li key={image.id} className={image.needsDescription ? 'owed' : ''}>
                            <span className="ebook-picture-name">{image.name}</span>
                            {image.assetId ? (
                              <input
                                aria-label={`Description of ${image.name}`}
                                placeholder="What a reader who cannot see it should know"
                                value={file.assets.find((asset) => asset.id === image.assetId)?.altText ?? ''}
                                onChange={(event) => onUpdate((current) => updateGraphic(current, image.assetId as never, { altText: event.target.value }))}
                              />
                            ) : (
                              <span className="muted small">{image.alt || 'no description'}</span>
                            )}
                            {uses.map((figure) => (
                              <label key={figure.elementId} className="ebook-decorative">
                                <input
                                  type="checkbox"
                                  aria-label={`Decorative: ${figure.caption || image.name} in ${figure.chapterTitle}`}
                                  checked={figure.decorative}
                                  onChange={(event) => onUpdate((current) => markFigureDecorative(current, figure.elementId, event.target.checked))}
                                />
                                Decorative{uses.length > 1 ? ` in ${figure.chapterTitle}` : ''}
                              </label>
                            ))}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}

                <h4>Preflight</h4>
                <p className="muted small">
                  {report.errors === 0 && report.warnings === 0
                    ? 'Nothing stands in the way.'
                    : `${report.errors} ${report.errors === 1 ? 'error' : 'errors'}, ${report.warnings} ${report.warnings === 1 ? 'warning' : 'warnings'}.${
                        report.blocking ? ' The errors have to be fixed before the book is written.' : ''
                      }`}
                </p>
                {group('error', 'Would be refused')}
                {group('warning', 'Worth a look')}
                {group('info', 'Done on the way')}
              </>
            )}
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={close}>
              {done ? 'Done' : 'Cancel'}
            </button>
            {done ? null : (
              <button type="button" className="primary" disabled={busy || report.blocking} onClick={() => void exportNow()}>
                {busy ? 'Writing…' : `Write the eBook`}
              </button>
            )}
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
