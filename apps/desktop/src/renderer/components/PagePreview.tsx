import { useMemo, useState } from 'react';
import { Paper } from './Paper';
import {
  hasChapterPages,
  paginateProject,
  paginateUnit,
  type ProjectFile,
  type StructuralUnitId,
} from '@vcwriter/domain';

interface PagePreviewProps {
  file: ProjectFile;
  /** When set, previews just this scene/chapter instead of the whole project. */
  unitId?: StructuralUnitId | null;
  includeBeatTitles: boolean;
  onToggleBeatTitles(next: boolean): void;
  /** Whether a printing carries the leaves between chapters (§11). */
  includeChapterPages: boolean;
  onToggleChapterPages(next: boolean): void;
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
  unitId,
  includeBeatTitles,
  onToggleBeatTitles,
  includeChapterPages,
  onToggleChapterPages,
  onExportPdf,
  onPrint,
  busy,
  message,
}: PagePreviewProps) {
  const [scope, setScope] = useState<'project' | 'unit'>(unitId ? 'unit' : 'project');

  const pages = useMemo(
    () =>
      scope === 'unit' && unitId
        ? paginateUnit(file, unitId)
        : paginateProject(file, { includeBeatTitles, includeChapterPages }),
    [file, scope, unitId, includeBeatTitles, includeChapterPages],
  );
  const chapters = hasChapterPages(file.project.format);

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
            Whole {file.project.format === 'novel' ? 'manuscript' : 'script'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === 'unit'}
            className={scope === 'unit' ? 'tab selected' : 'tab'}
            disabled={!unitId}
            onClick={() => setScope('unit')}
          >
            This scene
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

        <div className="preview-actions">
          <button type="button" onClick={onPrint} disabled={busy}>
            Print…
          </button>
          <button type="button" className="primary" onClick={onExportPdf} disabled={busy}>
            {busy ? 'Working…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {message ? <p className="notice preview-message">{message}</p> : null}

      <Paper pages={pages} />
    </div>
  );
}
