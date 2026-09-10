import type { ReactNode } from 'react';
import {
  hasChapterPages,
  hasContentsPage,
  type ParagraphStyle,
  type ProjectFile,
  type ScriptFormat,
} from '@vcwriter/domain';
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
  /** The list at the front of a season's stack (§17). */
  includeContentsPage: boolean;
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
  includeContentsPage: true,
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
  /**
   * How a prose manuscript sets its paragraphs (§6.4). It belongs to the
   * document rather than to one printing, which is why it is not part of
   * `PrintSetup` — but this is where a writer comes looking for it.
   */
  onParagraphStyle(next: ParagraphStyle): void;
  /**
   * Which house the script is set in (spec §6.5). A project setting, not a
   * machine one: it changes the geometry and so the page count, and two
   * people opening the same script must be looking at the same thing.
   */
  onScriptFormat(next: ScriptFormat): void;
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
  onParagraphStyle,
  onScriptFormat,
  pages,
  onPrint,
  onExportPdf,
  busy,
}: PageSetupProps) {
  const dialog = useModal(open);
  const leaves = hasChapterPages(file.project.format);
  // Offered only where there is more than one division to list: a season's
  // episodes or a book's chapters, and nothing where there would be nothing
  // to print.
  const contents = hasContentsPage(file);
  const prose = file.project.format === 'novel' || file.project.format === 'short_story';
  const paragraphStyle = file.settings.paragraphStyle;
  const scriptFormat = file.settings.scriptFormat ?? 'us';
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

            {contents ? (
              <Check
                label="Contents page"
                on={setup.includeContentsPage}
                onChange={(includeContentsPage) => set({ includeContentsPage })}
              >
                {prose
                  ? 'Contents — the chapters and the page each opens on'
                  : 'Contents — what is in the stack, at the front of it'}
              </Check>
            ) : null}

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

            {/* §6.4: the two ways a prose page marks a new paragraph. One or
                the other — a page that carries both says it twice. */}
            {prose ? (
              <>
                <h4>Paragraphs</h4>
                <div className="paragraph-style" role="radiogroup" aria-label="Paragraph style">
                  <Style
                    label="Indented"
                    on={paragraphStyle !== 'blocked'}
                    onChange={() => onParagraphStyle('indented')}
                    sample={['    The lamp went out.', 'She did not', 'move for a long time.', '    Then she did.']}
                  >
                    Standard manuscript format: paragraphs run on, each new one indented five spaces.
                  </Style>
                  <Style
                    label="Blocked"
                    on={paragraphStyle === 'blocked'}
                    onChange={() => onParagraphStyle('blocked')}
                    sample={['The lamp went out.', 'She did not', 'move for a long time.', '', 'Then she did.']}
                  >
                    No indent; a space between paragraphs instead. How most people read on a screen.
                  </Style>
                </div>
              </>
            ) : null}

            {/* §6.5: the two houses a script is set in. Same twelve-point
                Courier, laid out for two different jobs. */}
            {prose ? null : (
              <>
                <h4>Script format</h4>
                <div className="paragraph-style" role="radiogroup" aria-label="Script format">
                  <Style
                    group="script-format"
                    label="US studio"
                    on={scriptFormat !== 'bbc'}
                    onChange={() => onScriptFormat('us')}
                    sample={['INT. DINER - DAY', '', 'The bell rings.', '', '       SARAH', '    (whispering)', '  You came.']}
                  >
                    US Letter, and what Final Draft opens on: the cue out at 3.7", the speech a narrow
                    column down the middle. Laid out for reading, and for the page-a-minute rule.
                  </Style>
                  <Style
                    group="script-format"
                    label="BBC"
                    on={scriptFormat === 'bbc'}
                    onChange={() => onScriptFormat('bbc')}
                    sample={['INT. DINER - DAY', '', 'The bell rings.', '', '', '  SARAH', '  You came, and I did not', '  think you would.']}
                  >
                    A4, the cue in at 2.5" with the speech a wide block directly under it, and a double
                    blank line at every change of setting. The layout that left the margins for the crew.
                  </Style>
                </div>
              </>
            )}

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

/**
 * One way of setting a paragraph, shown rather than described: four lines of
 * type set the way this choice sets them. A writer picking between an indent
 * and a space is picking a look, so the look is what is on the button.
 */
function Style({
  group = 'paragraph-style',
  label,
  on,
  onChange,
  sample,
  children,
}: {
  /** Which set of choices this one belongs to; one radio group per set. */
  group?: string;
  label: string;
  on: boolean;
  onChange(): void;
  sample: readonly string[];
  children: ReactNode;
}) {
  return (
    <label className={on ? 'paragraph-choice chosen' : 'paragraph-choice'}>
      <input type="radio" name={group} aria-label={label} checked={on} onChange={onChange} />
      <span className="paragraph-sample" aria-hidden="true">
        {sample.map((line, index) => (
          <span key={index} className={line.length === 0 ? 'sample-line blank' : 'sample-line'}>
            {line.replace(/ /g, ' ')}
          </span>
        ))}
      </span>
      <span className="paragraph-words">
        <strong>{label}</strong>
        {children}
      </span>
    </label>
  );
}

