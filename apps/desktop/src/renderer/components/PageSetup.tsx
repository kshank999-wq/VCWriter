import type { ReactNode } from 'react';
import {
  hasBookIndex,
  hasCastPage,
  hasChapterPages,
  hasContentsPage,
  type ParagraphStyle,
  type ProjectFile,
  type ScriptFormat,
  type SectionNumbering,
  describeNumbering,
  isInstructional,
  isProseFormat,
  nounsFor,
  numbersDivisions,
  scriptFormatOf,
  scriptFormatsFor,
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
  /** A play's cast page, after the title page (addendum 38 §4). */
  includeCastPage: boolean;
  includeChapterPages: boolean;
  /** The list at the front of a season's stack (§17). */
  includeContentsPage: boolean;
  /** Whether the back-of-book index prints (addendum 10). */
  includeBookIndex: boolean;
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
  includeCastPage: true,
  includeChapterPages: true,
  includeContentsPage: true,
  includeBookIndex: true,
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
  /** Open the cast page's own screen (addendum 38 §4); a play's alone. */
  onEditCastPage?(): void;
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
  /** Whether the acts break the script into pages of their own (§6.5). */
  onActBreaks(on: boolean): void;
  /**
   * Whether a book numbers its divisions 1, 1.1, 1.2 (addendum 16 §15).
   *
   * A document setting like the two above, and *whether* is the whole of it:
   * the figures themselves are counted from where each division falls, so
   * there is nothing else here to set.
   */
  onSectionNumbering(next: SectionNumbering): void;
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
  onEditCastPage,
  onParagraphStyle,
  onScriptFormat,
  onActBreaks,
  onSectionNumbering,
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
  const indexable = hasBookIndex(file.project.format);
  const prose = isProseFormat(file.project.format);
  // The fifth copy of "chapter or scene?" this sweep found, written out inline
  // half a dozen times in this one file. All of it reads the table now (§14).
  const nouns = nounsFor(file.project.format);
  // Only a book that is built as a numbered outline is offered it at all:
  // absent rather than greyed, everywhere.
  const numberable = isInstructional(file.project.format);
  const paragraphStyle = file.settings.paragraphStyle;
  // **The resolved reading, not the stored value** (addendum 37): a play
  // carrying `us` was never offered a stage preset, so what is lit is the
  // one the page is actually set in.
  const scriptFormat = scriptFormatOf(file.project.format, file.settings.scriptFormat);
  const set = (patch: Partial<PrintSetup>) => onSetup({ ...setup, ...patch });

  return (
    <dialog ref={dialog} className="track-dialog page-setup" aria-label="Page setup" onClose={onClose}>
      {open ? (
        <>
          <header className="track-dialog-title">
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

            {/* A play's cast page (addendum 38 §4): absent where the format
                prints none, `hasChapterPages`' rule for the leaf below. */}
            {hasCastPage(file.project.format) ? (
              <Check
                label="Print the cast page"
                on={setup.includeCastPage}
                onChange={(includeCastPage) => set({ includeCastPage })}
              >
                Cast page
                {onEditCastPage ? (
                  <button
                    type="button"
                    className="ghost small"
                    onClick={(event) => {
                      event.preventDefault();
                      onEditCastPage();
                    }}
                  >
                    Who is in it…
                  </button>
                ) : null}
              </Check>
            ) : null}

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

            {indexable ? (
              <Check
                label="Index"
                on={setup.includeBookIndex}
                onChange={(includeBookIndex) => set({ includeBookIndex })}
              >
                The index at the back — the page numbers are worked out every
                time, so they follow the writing
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
              label={`${nouns.unit} headings`}
              on={setup.includeSceneHeadings}
              onChange={(includeSceneHeadings) => set({ includeSceneHeadings })}
            >
              {nouns.unit} headings
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
                {/* **The list is the format's and the copy is the screen's**
                    (addendum 37, from Ken: *when you select stage play, you
                    need a dropdown or some type of preference that can select
                    the proper formatting for you*). `scriptFormatsFor` says
                    which house styles this format is set in — the seven stage
                    presets on a play, the four screen ones elsewhere, absent
                    rather than renamed — and `SCRIPT_FORMAT_WORDS` says what
                    each is called and shows the page it makes. A second list
                    of ids written out here would be a second answer about
                    what a play may be set in. */}
                <div className="paragraph-style" role="radiogroup" aria-label="Script format">
                  {scriptFormatsFor(file.project.format).map((id) => (
                    <Style
                      key={id}
                      group="script-format"
                      label={SCRIPT_FORMAT_WORDS[id].label}
                      on={scriptFormat === id}
                      onChange={() => onScriptFormat(id)}
                      sample={SCRIPT_FORMAT_WORDS[id].sample}
                    >
                      {SCRIPT_FORMAT_WORDS[id].says}
                    </Style>
                  ))}
                </div>

                {/* §6.5: a network episode breaks for the commercials; a
                    feature and a streaming script do not. */}
                <Check
                  label="Act breaks"
                  on={file.settings.actBreaks ?? false}
                  onChange={onActBreaks}
                >
                  Each act on a page of its own, named at the head and closed with END OF — a network
                  episode, not a feature or a streaming one
                </Check>
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

            {/* Addendum 16 §15: a textbook's structure *is* its numbering,
                so the only question is whether this book is built that way.
                There is no field for a number here or anywhere, and the
                sentence under the control says so rather than leaving
                somebody to hunt for one. */}
            {numberable ? (
              <>
                <h4>Numbering</h4>
                <Check
                  label={`${nouns.unitPlural} are numbered`}
                  on={numbersDivisions(file)}
                  onChange={(on) => onSectionNumbering(on ? 'decimal' : 'none')}
                >
                  {`${nouns.unitPlural} and ${nouns.subPlural.toLowerCase()} are numbered`}
                </Check>
                <p className="muted small">{describeNumbering(file)}</p>
              </>
            ) : null}

            {/* §5.3, §19: none of this is the writing. It is what the writer
                keeps beside it, and it prints only for a copy they are
                reading themselves. */}
            <h4>Notes to yourself</h4>
            <p className="muted small">
              A reference copy, not the delivered draft. None of this is the manuscript.
            </p>

            <Check
              label={`${nouns.sub} titles`}
              on={setup.includeBeatTitles}
              onChange={(includeBeatTitles) => set({ includeBeatTitles })}
            >
              {nouns.sub} titles
            </Check>

            <Check
              label={`${nouns.unit} summary`}
              on={setup.includeSceneSummary}
              onChange={(includeSceneSummary) => set({ includeSceneSummary })}
            >
              Each {nouns.unit.toLowerCase()}’s summary
            </Check>

            <Check
              label={`Links in the ${nouns.unit.toLowerCase()}`}
              on={setup.includeSceneLinks}
              onChange={(includeSceneLinks) => set({ includeSceneLinks })}
            >
              What each {nouns.unit.toLowerCase()} is linked to
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
/**
 * What each house style is called, and the page it makes (addendum 37).
 *
 * **Copy rather than a reading**: which formats a project may be set in is a
 * rule and lives in the domain (`scriptFormatsFor`); what they are *called*
 * is this screen's, and a sample is a picture of a page rather than a fact
 * about one — the samples are hand-set to read at a glance, as the four screen
 * ones have been since they were written.
 *
 * The stage presets' wording keeps Ken's spec's own caveats rather than
 * paraphrasing them away: they are recommendations, a theatre's or
 * publisher's own instructions override them, the BBC sample is dated, and
 * there is no Europe-wide convention.
 */
const SCRIPT_FORMAT_WORDS: Record<ScriptFormat, { label: string; says: string; sample: readonly string[] }> = {
  us: {
    label: 'US single-camera',
    says: 'US Letter, and what Final Draft opens on: the cue out at 3.7", the speech a narrow column down the middle. Laid out for reading, and for the page-a-minute rule.',
    sample: ['INT. DINER - DAY', '', 'The bell rings.', '', '       SARAH', '    (whispering)', '  You came.'],
  },
  us_multi: {
    label: 'US multi-camera',
    says: 'The traditional sitcom, shot on a stage: the speech double spaced so the cast can write between the lines, and everything not spoken in capitals. Half an hour runs forty-odd pages.',
    sample: ['INT. DINER - DAY', '', 'THE BELL RINGS.', '', '     SARAH', '  You came.', '', '  I did not think you would.'],
  },
  bbc: {
    label: 'BBC drama',
    says: 'A4, the cue in at 2.5" with the speech a wide block directly under it, and a double blank line at every change of setting.',
    sample: ['INT. DINER - DAY', '', 'The bell rings.', '', '', '  SARAH', '  You came, and I did not', '  think you would.'],
  },
  bbc_taped: {
    label: 'BBC taped',
    says: 'The studio layout: the cue out in the left margin beside the speech rather than above it, leaving the whole right of the page clear for the crew’s camera cues.',
    sample: ['INT. DINER - DAY', '', 'The bell rings.', '', '', 'SARAH   You came, and I', '        did not think you', '        would.'],
  },
  stage_us_modern: {
    label: 'US modern play',
    says: 'The Dramatists Guild’s modern sample. The cue centred over the speech, the speech across the full column, and the stage directions in a narrower region to the right.',
    sample: ['ACT ONE', '', '      SARAH', 'You came, and I did not think', 'you would.', '', '        She does not move.'],
  },
  stage_us_traditional: {
    label: 'US traditional play',
    says: 'The older American arrangement: the same centred cue over a narrower speech, with the stage directions set apart as their own indented block.',
    sample: ['ACT ONE', '', '      SARAH', '  You came, and I did not', '  think you would.', '', '    She does not move.'],
  },
  stage_us_publisher: {
    label: 'US publisher reading copy',
    says: 'A Samuel French-inspired reading copy: compact, the cue set in from the left rather than centred. A house style and not an acceptance rule — a publisher’s own instructions come first.',
    sample: ['ACT ONE', '', '          SARAH', 'You came, and I did not think', 'you would.', '', '   She does not move.'],
  },
  stage_uk_bbc: {
    label: 'UK BBC stage',
    says: 'A4, from the BBC Writersroom stage sample of 2004 — an older sample rather than current UK submission rules. The cue at the left with the speech beginning on the same line, and the directions in capitals to the right.',
    sample: ['ACT I SCENE 1', '', 'THE BELL RINGS.', '', 'SARAH   You came, and I did', '        not think you would.', '', '            SHE DOES NOT MOVE.'],
  },
  stage_uk_contemporary: {
    label: 'UK contemporary play',
    says: 'A4, the common side-by-side arrangement rather than the only one: the name at the left with the spoken text in a column beside it, and the speech in ordinary case.',
    sample: ['Scene One', '', 'The bell rings.', '', 'SARAH You came, and I did', '      not think you would.', '', '      She does not move.'],
  },
  stage_eu_continental: {
    label: 'Continental reading copy',
    says: 'A4. There is no single Europe-wide convention, so this is a configurable reading copy and nothing more: the role label at the left with the speech as a block beside it.',
    sample: ['Scene One', '', 'The bell rings.', '', 'SARAH', '  You came, and I did not', '  think you would.', '', '  She does not move.'],
  },
  stage_us_musical: {
    label: 'US musical',
    says: 'The modern play with a song in it: the number’s title centred, and the lyrics in capitals in a narrower column inside the speech so the sung words stand apart from the spoken. A starting point — a licensing house’s own instructions come first.',
    sample: ['#3 — OUT OF THE RAIN', '', '      SARAH', '     OUT OF THE RAIN', '     AND INTO THE LIGHT', 'You hear it too?', '', '        They waltz to the door.'],
  },
};

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

