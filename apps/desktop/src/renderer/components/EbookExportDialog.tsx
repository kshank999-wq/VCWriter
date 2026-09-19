import { useMemo, useState } from 'react';
import {
  EBOOK_RULES,
  EBOOK_TARGETS,
  bookSettingsOf,
  ebookOf,
  ebookReport,
  epubBytes,
  preflightEbook,
  safeName,
  setBookSettings,
  type EbookSettings,
  type EbookTarget,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

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
 */

interface EbookExportDialogProps {
  open: boolean;
  file: ProjectFile;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

type Done = { folder: string; files: { name: string; bytes: number }[] };

export function EbookExportDialog({ open, file, onClose, onUpdate }: EbookExportDialogProps) {
  const dialog = useModal(open);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);

  const settings = bookSettingsOf(file);
  const own = settings.ebook;
  const target = (EBOOK_TARGETS as readonly string[]).includes(own.target) ? (own.target as EbookTarget) : 'universal';
  const rules = EBOOK_RULES[target];

  const write = (patch: Partial<EbookSettings>) => {
    setDone(null);
    onUpdate((current) => {
      const book = bookSettingsOf(current);
      return setBookSettings(current, { ebook: { ...book.ebook, ...patch } });
    });
  };

  // Built afresh from the book whenever it changes: what is checked is what
  // would be written.
  const pkg = useMemo(() => (open ? ebookOf(file, { target }) : null), [file, target, open]);
  const report = useMemo(() => (pkg ? preflightEbook(pkg) : null), [pkg]);
  const pictures = file.assets.filter((asset) => asset.kind === 'image' && asset.data.length > 0);

  const exportNow = async () => {
    if (!pkg || !report || report.blocking) return;
    setBusy(true);
    setError(null);
    try {
      const epub = await epubBytes(pkg);
      const files: { name: string; bytes: Uint8Array; mediaType: string }[] = [
        { name: pkg.fileName, bytes: epub, mediaType: 'application/epub+zip' },
      ];
      if (pkg.cover && rules.requiresSeparateCover) {
        files.push({ name: pkg.cover.fileName, bytes: pkg.cover.data, mediaType: pkg.cover.mediaType });
      }
      const encoder = new TextEncoder();
      const listed = files.map((one) => ({ name: one.name, bytes: one.bytes.length }));
      files.push({
        name: `${safeName(pkg.metadata.title)}-export-report.txt`,
        bytes: encoder.encode(ebookReport(pkg, report, listed)),
        mediaType: 'text/plain',
      });
      files.push({
        name: 'metadata.json',
        bytes: encoder.encode(JSON.stringify({ ...pkg.metadata, target: rules.id }, null, 2)),
        mediaType: 'application/json',
      });
      const result = await window.vcwriter.saveExport({ folderName: `${pkg.metadata.title} - eBook Export`, files });
      if (!result.ok) {
        setError(result.error ?? 'The eBook could not be written.');
      } else if (result.data) {
        setDone({ folder: result.data.folder, files: files.map((one) => ({ name: one.name, bytes: one.bytes.length })) });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The eBook could not be written.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setDone(null);
    setError(null);
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

  return (
    <dialog ref={dialog} className="track-dialog ebook-dialog" aria-label="Export as an eBook" onClose={close}>
      {open && pkg && report ? (
        <>
          <header className="track-dialog-title">
            <span className="bar-title">Export as an eBook</span>
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
                <h4>At {rules.name}</h4>
                <ul className="ebook-checklist">
                  {rules.checklist.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
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
                <p className="muted small">{rules.about} One reflowable EPUB 3.3 is made whichever store is chosen; the store decides what is checked.</p>

                <h4>The book</h4>
                <p className="muted small">
                  {pkg.metadata.title}
                  {pkg.metadata.authors.length > 0 ? ` — ${pkg.metadata.authors.join(', ')}` : ''} · {pkg.sections.filter((section) => section.kind === 'chapter' || section.kind === 'body').length}{' '}
                  {pkg.sections.filter((section) => section.kind === 'chapter').length === 1 ? 'chapter' : 'chapters'} · {pkg.images.length}{' '}
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
