import { hasChapterPages, type ProjectFile } from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * What a printing carries (addendum 02 §13).
 *
 * These used to be scattered: a beat-titles checkbox on the Preview page, a
 * chapter-pages one beside it, nothing at all for a title page or a
 * watermark. They are one dialog now, opened from **File → Page setup**, and
 * the Preview, the print and the PDF export all read the same answer — so
 * what is on screen is what comes out of the printer, which is the only
 * thing a page setup is for.
 */
export interface PrintSetup {
  includeTitlePage: boolean;
  includeChapterPages: boolean;
  /** An annotated reference copy: the beats' internal labels, printed (§5.3). */
  includeBeatTitles: boolean;
  /** Diagonal marking for a draft sent out for notes. Empty for none. */
  watermark: string;
}

export const DEFAULT_PRINT_SETUP: PrintSetup = {
  includeTitlePage: true,
  includeChapterPages: true,
  includeBeatTitles: false,
  watermark: '',
};

interface PageSetupProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  setup: PrintSetup;
  onSetup(next: PrintSetup): void;
  pages: number;
  onPrint(): void;
  onExportPdf(): void;
  busy: boolean;
}

export function PageSetup({ file, open, onClose, setup, onSetup, pages, onPrint, onExportPdf, busy }: PageSetupProps) {
  const dialog = useModal(open);
  const leaves = hasChapterPages(file.project.format);
  const set = (patch: Partial<PrintSetup>) => onSetup({ ...setup, ...patch });

  return (
    <dialog ref={dialog} className="lane-dialog page-setup" aria-label="Page setup" onClose={onClose}>
      {open ? (
        <>
          <header className="lane-dialog-title">
            <span className="bar-title">Page setup</span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <h4>What prints</h4>
            <label className="check">
              <input
                type="checkbox"
                aria-label="Title page"
                checked={setup.includeTitlePage}
                onChange={(event) => set({ includeTitlePage: event.target.checked })}
              />
              <span>Title page</span>
            </label>

            {leaves ? (
              <label className="check">
                <input
                  type="checkbox"
                  aria-label="Chapter pages"
                  checked={setup.includeChapterPages}
                  onChange={(event) => set({ includeChapterPages: event.target.checked })}
                />
                <span>The page each chapter opens with</span>
              </label>
            ) : null}

            {/* §5.3: a beat's internal title is authoring metadata. Printing
                it is a deliberate choice for a reference copy, never the
                delivered manuscript, so it says so. */}
            <label className="check">
              <input
                type="checkbox"
                aria-label="Beat titles"
                checked={setup.includeBeatTitles}
                onChange={(event) => set({ includeBeatTitles: event.target.checked })}
              />
              <span>Beat titles — an annotated reference copy, not the delivered draft</span>
            </label>

            <label className="field">
              Watermark
              <input
                aria-label="Watermark"
                placeholder="Nothing, or DRAFT — NOT FOR CIRCULATION"
                value={setup.watermark}
                onChange={(event) => set({ watermark: event.target.value })}
              />
            </label>

            <p className="muted">
              {pages} {pages === 1 ? 'page' : 'pages'} as this stands. The Preview page shows the same pages this will
              print.
            </p>
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Done
            </button>
            <button type="button" onClick={onPrint} disabled={busy}>
              Print…
            </button>
            <button type="button" className="primary" onClick={onExportPdf} disabled={busy}>
              {busy ? 'Working…' : 'Export PDF'}
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
