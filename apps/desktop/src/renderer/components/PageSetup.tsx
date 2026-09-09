import type { ReactNode } from 'react';
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
  /** The sluglines. On: a script without them is a read-through, not a draft. */
  includeSceneHeadings: boolean;
  /** Numbered in the margins, as a shooting script is. Off until production. */
  includeSceneNumbers: boolean;
  /** The page number, top right from page two. */
  includePageNumbers: boolean;
  /** An annotated reference copy: the beats' internal labels, printed (§5.3). */
  includeBeatTitles: boolean;
  /** Each scene's summary, under its heading. */
  includeSceneSummary: boolean;
  /** What each scene is linked to: setups, payoffs, research, characters. */
  includeSceneLinks: boolean;
  /** The day and time it was printed. Off: it is not part of the document. */
  includePrintedAt: boolean;
  /** Diagonal marking for a draft sent out for notes. Empty for none. */
  watermark: string;
}

/**
 * What a printing carries before anyone changes it: the manuscript, its
 * title page, its page numbers, and nothing else. Everything that is a note
 * about the writing rather than the writing is off.
 */
export const DEFAULT_PRINT_SETUP: PrintSetup = {
  includeTitlePage: true,
  includeChapterPages: true,
  includeSceneHeadings: true,
  includeSceneNumbers: false,
  includePageNumbers: true,
  includeBeatTitles: false,
  includeSceneSummary: false,
  includeSceneLinks: false,
  includePrintedAt: false,
  watermark: '',
};

interface PageSetupProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  setup: PrintSetup;
  onSetup(next: PrintSetup): void;
  /** Open the title page's own screen, where what it says is decided. */
  onEditTitlePage(): void;
  pages: number;
  onPrint(): void;
  onExportPdf(): void;
  busy: boolean;
}

export function PageSetup({
  file,
  open,
  onClose,
  setup,
  onSetup,
  onEditTitlePage,
  pages,
  onPrint,
  onExportPdf,
  busy,
}: PageSetupProps) {
  const dialog = useModal(open);
  const leaves = hasChapterPages(file.project.format);
  const prose = file.project.format === 'novel' || file.project.format === 'short_story';
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
            <h4>The document</h4>
            <Check
              label="Print the title page"
              on={setup.includeTitlePage}
              onChange={(includeTitlePage) => set({ includeTitlePage })}
            >
              Title page
              {/* What it says is its own screen: a title page is a page of
                  the document, not a checkbox's worth of settings. */}
              <button
                type="button"
                className="ghost small"
                onClick={(event) => {
                  event.preventDefault();
                  onEditTitlePage();
                }}
              >
                What it says…
              </button>
            </Check>

            {leaves ? (
              <Check
                label="Chapter pages"
                on={setup.includeChapterPages}
                onChange={(includeChapterPages) => set({ includeChapterPages })}
              >
                The page each chapter opens with
              </Check>
            ) : null}

            <Check
              label="Scene headings"
              on={setup.includeSceneHeadings}
              onChange={(includeSceneHeadings) => set({ includeSceneHeadings })}
            >
              {prose ? 'Chapter headings' : 'Scene headings'}
            </Check>

            <Check
              label="Page numbers"
              on={setup.includePageNumbers}
              onChange={(includePageNumbers) => set({ includePageNumbers })}
            >
              Page numbers, from page two
            </Check>

            {prose ? null : (
              <Check
                label="Scene numbers"
                on={setup.includeSceneNumbers}
                onChange={(includeSceneNumbers) => set({ includeSceneNumbers })}
              >
                Scene numbers, in the margins — a shooting script, not a draft
              </Check>
            )}

            {/* §5.3, §19: none of this is the writing. It is what the writer
                keeps beside it, and it prints only for a copy they are
                reading themselves. */}
            <h4>Notes to yourself</h4>
            <p className="muted small">
              A reference copy, not the delivered draft. None of this is the manuscript.
            </p>

            <Check
              label="Beat titles"
              on={setup.includeBeatTitles}
              onChange={(includeBeatTitles) => set({ includeBeatTitles })}
            >
              Beat titles
            </Check>

            <Check
              label="Scene summary"
              on={setup.includeSceneSummary}
              onChange={(includeSceneSummary) => set({ includeSceneSummary })}
            >
              {prose ? 'Each chapter’s summary' : 'Each scene’s summary'}
            </Check>

            <Check
              label="Links in the scene"
              on={setup.includeSceneLinks}
              onChange={(includeSceneLinks) => set({ includeSceneLinks })}
            >
              What each {prose ? 'chapter' : 'scene'} is linked to
            </Check>

            <Check
              label="Date and time"
              on={setup.includePrintedAt}
              onChange={(includePrintedAt) => set({ includePrintedAt })}
            >
              The day and time it was printed
            </Check>

            <h4>Marking</h4>
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

/** One switch. The label is what a screen reader hears; the child is what prints. */
function Check({
  label,
  on,
  onChange,
  children,
}: {
  label: string;
  on: boolean;
  onChange(next: boolean): void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" aria-label={label} checked={on} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

