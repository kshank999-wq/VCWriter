import { useMemo, useState } from 'react';
import { Paper } from './Paper';
import {
  chapterPageStyleOf,
  hasBookIndex,
  hasChapterPages,
  nounsFor,
  outlinesOf,
  paginateProject,
  paginateUnit,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { scriptWordFor } from '../panes';

interface PagePreviewProps {
  file: ProjectFile;
  /** Go to the Write page, where the manuscript is written. */
  onWrite?(): void;
  /** When set, previews just this scene/chapter instead of the whole project. */
  unitId?: StructuralUnitId | null;
  includeBeatTitles: boolean;
  onToggleBeatTitles(next: boolean): void;
  /** Whether a printing carries the leaves between chapters (§11). */
  includeChapterPages: boolean;
  onToggleChapterPages(next: boolean): void;
  /**
   * Whether the front pages print: the document's, and the one each episode
   * opens with (§6.1, §17). Read-only here — it is set in Page setup with the
   * rest of what a printing carries — but the preview has to honour it, or it
   * is not showing the pages that will print.
   */
  includeTitlePage: boolean;
  /** And the list at the front of a season's stack (§17), for the same reason. */
  includeContentsPage: boolean;
  /** Whether the back-of-book index prints (addendum 10). */
  includeBookIndex: boolean;
  onToggleBookIndex(next: boolean): void;
  /** The rest of what a printing carries lives in Page setup (§13). */
  onPageSetup?(): void;
  onExportPdf(): void;
  onPrint(): void;
  busy: boolean;
  message: string | null;
}

/**
 * Formatted print preview (spec §6).
 *
 * The pages here come from the same paginator the PDF export uses, so what is
 * on screen is what will be printed — right down to where `(MORE)` falls. It
 * renders the laid-out lines rather than re-flowing the manuscript in CSS,
 * because a preview that breaks pages differently from the export is worse
 * than no preview.
 */
export function PagePreview({
  file,
  onWrite,
  unitId,
  includeBeatTitles,
  onToggleBeatTitles,
  includeChapterPages,
  onToggleChapterPages,
  includeTitlePage,
  includeContentsPage,
  includeBookIndex,
  onToggleBookIndex,
  onPageSetup,
  onExportPdf,
  onPrint,
  busy,
  message,
}: PagePreviewProps) {
  // Always the whole manuscript first (from Ken: *even though there's stuff
  // written, it doesn't show anything*): opening on the selected section
  // showed a blank page whenever that one section was still empty.
  const [scope, setScope] = useState<'project' | 'unit'>('project');

  const pages = useMemo(
    () =>
      scope === 'unit' && unitId
        ? paginateUnit(file, unitId)
        : paginateProject(file, {
            includeBeatTitles,
            includeChapterPages,
            includeTitlePage,
            includeContentsPage,
            includeBookIndex,
          }),
    [
      file,
      scope,
      unitId,
      includeBeatTitles,
      includeChapterPages,
      includeTitlePage,
      includeContentsPage,
      includeBookIndex,
    ],
  );
  const nouns = nounsFor(file.project.format);
  const scriptWord = scriptWordFor(file.project.format);
  /** Words in the manuscript, the part that prints, and in plans that do not. */
  const written = useMemo(() => {
    const inScript = new Set(file.units.filter((unit) => unit.inScript).map((unit) => unit.id as string));
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    const manuscript = file.beats
      .filter((beat) => beat.inScript && inScript.has(beat.unitId as string))
      .reduce((sum, beat) => sum + beat.manuscript.elements.reduce((n, element) => n + words(element.text), 0), 0);
    const selected = unitId
      ? file.beats.filter((beat) => beat.unitId === unitId).reduce((sum, beat) => sum + beat.manuscript.elements.reduce((n, element) => n + words(element.text), 0), 0)
      : 0;
    const plans = outlinesOf(file).reduce(
      (sum, outline) => sum + outline.items.filter((item) => !item.boundUnitId && !item.boundBeatId).reduce((n, item) => n + words(item.body), 0),
      0,
    );
    return { manuscript, selected, plans };
  }, [file, unitId]);
  const chapters = hasChapterPages(file.project.format);
  // A book has an index; a script does not, so the control is not there to
  // puzzle over — the same rule the chapter-pages switch beside it follows.
  const indexable = hasBookIndex(file.project.format);

  return (
    <div className="preview">
      <div className="preview-toolbar">
        <div className="tabs" role="tablist" aria-label="Preview scope">
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'project'}
            className={scope === 'project' ? 'tab selected' : 'tab'}
            onClick={() => setScope('project')}
          >
            Whole {scriptWordFor(file.project.format)}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'unit'}
            className={scope === 'unit' ? 'tab selected' : 'tab'}
            disabled={!unitId}
            onClick={() => setScope('unit')}
          >
            {/* The noun table's word: a book says section, a script scene. */}
            This {nounsFor(file.project.format).unit.toLowerCase()}
          </button>
        </div>

        <span className="muted">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>

        {/* Off by default: beat titles are authoring metadata, and printing
            them is an explicit choice for a reference copy (§5.3). */}
        <label className="toggle" title="Print an annotated reference copy">
          <input
            type="checkbox"
            checked={includeBeatTitles}
            disabled={scope === 'unit'}
            onChange={(event) => onToggleBeatTitles(event.target.checked)}
          />
          Show beat titles
        </label>

        {/* A book's leaves between chapters. A script has none, so the
            control is not there to puzzle over (§11). */}
        {chapters ? (
          <label className="toggle" title="Print the page each chapter opens with">
            <input
              type="checkbox"
              checked={includeChapterPages}
              disabled={scope === 'unit'}
              onChange={(event) => onToggleChapterPages(event.target.checked)}
            />
            Chapter pages
          </label>
        ) : null}

        {/* The back of the book (addendum 10). Its page numbers are worked
            out from this very pagination, so what is drawn here is what
            prints. */}
        {indexable ? (
          <label className="toggle" title="Print the index at the back of the book">
            <input
              type="checkbox"
              checked={includeBookIndex}
              disabled={scope === 'unit'}
              onChange={(event) => onToggleBookIndex(event.target.checked)}
            />
            Index
          </label>
        ) : null}

        <div className="preview-actions">
          {onPageSetup ? (
            <button type="button" className="ghost" onClick={onPageSetup}>
              Page setup…
            </button>
          ) : null}
          <button type="button" onClick={onPrint} disabled={busy}>
            Print…
          </button>
          <button type="button" className="primary" onClick={onExportPdf} disabled={busy}>
            {busy ? 'Working…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <p className="muted small preview-purpose">
        The {scriptWord} as it will print: the same pages as Print and Export PDF, made from what is written on the Write page.
      </p>

      {message ? <p className="notice preview-message">{message}</p> : null}

      {scope === 'project' && written.manuscript === 0 ? (
        <div className="notice preview-empty" role="status">
          <p>
            <strong>Nothing to print yet.</strong> The {scriptWord} has no writing in it: the pages here come from the text on the Write page.
          </p>
          {written.plans > 0 ? (
            <p className="muted small">
              The Outliner has {written.plans} {written.plans === 1 ? 'word' : 'words'} of notes that are not in the {scriptWord} yet. Notes are
              plans; put a row on the track and write it on the Write page to see it here.
            </p>
          ) : null}
          {onWrite ? (
            <button type="button" onClick={onWrite}>
              Go to Write
            </button>
          ) : null}
        </div>
      ) : scope === 'unit' && written.selected === 0 ? (
        <div className="notice preview-empty" role="status">
          <p>
            This {nouns.unit.toLowerCase()} has nothing written in it yet.
            {written.manuscript > 0 ? ` The whole ${scriptWord} has ${written.manuscript} words.` : ''}
          </p>
          <button type="button" onClick={() => setScope('project')}>
            Show the whole {scriptWord}
          </button>
        </div>
      ) : null}

      <Paper pages={pages} chapterStyle={chapterPageStyleOf(file)} />
    </div>
  );
}
