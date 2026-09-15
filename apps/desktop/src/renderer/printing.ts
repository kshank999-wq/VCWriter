import { useCallback, useMemo, useState } from 'react';
import type { PageStamp, PrintOptions, ProjectFile } from '@vcwriter/domain';
import type { PrintSetup } from './components/PageSetup';
import type { VcWriterApi } from '../preload/index';

/** Which document a print or an export is asking for. The bridge decides. */
export type PrintKind = NonNullable<Parameters<VcWriterApi['print']>[0]['kind']>;

/**
 * Printing, in the one place that knows how (addendum 02 §13).
 *
 * It lives here rather than inside the workspace because a room on a second
 * monitor prints too: the Outliner taken to the other screen still offers
 * **Print…** and **PDF…**, and a window that could do less than the panel it
 * came out of would be a reason not to move it.
 *
 * What a printing carries is `printOptions` — assembled from the page setup,
 * which is a per-machine preference every window reads, so the two windows
 * cannot disagree about what comes out of the printer.
 */
export const printOptionsFrom = (setup: PrintSetup, stamp?: PageStamp | null): PrintOptions => ({
  includeBeatTitles: setup.includeBeatTitles,
  includeChapterPages: setup.includeChapterPages,
  includeTitlePage: setup.includeTitlePage,
  includeSceneHeadings: setup.includeSceneHeadings,
  includeSceneNumbers: setup.includeSceneNumbers,
  includePageNumbers: setup.includePageNumbers,
  includeSceneSummary: setup.includeSceneSummary,
  includeSceneLinks: setup.includeSceneLinks,
  includePrintedAt: setup.includePrintedAt,
  ...(setup.watermark ? { watermark: setup.watermark } : {}),
  // Whose draft this is, in the corner of every page (addendum 07 §6.1).
  // Absent on the master and on every script printed outside a room: the
  // master is clean and a contribution is signed (§6.3).
  ...(stamp ? { stamp } : {}),
});

export interface Printing {
  print(kind?: PrintKind, outlineId?: string): Promise<void>;
  exportPdf(kind?: PrintKind, outlineId?: string): Promise<void>;
  busy: boolean;
  message: string | null;
  setMessage(message: string | null): void;
}

export const usePrinting = (options: {
  file: ProjectFile | null;
  setup: PrintSetup;
  stamp?: PageStamp | null;
  /**
   * Flush the document to disk before printing. The workspace owns the file
   * and gives one; a room in a window of its own has none, and does not need
   * one — **what is printed is the document in hand rather than the one on
   * disk**, and the two windows hold the same document over the link. The
   * flush is so the saved file matches what was just printed, which is the
   * workspace's business either way.
   */
  flush?: () => Promise<unknown>;
}): Printing => {
  const { file, setup, stamp = null, flush } = options;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const printOptions = useMemo(() => printOptionsFrom(setup, stamp), [setup, stamp]);

  const exportPdf = useCallback(
    async (kind: PrintKind = 'script', outlineId?: string) => {
      if (!file) return;
      setBusy(true);
      setMessage(null);
      // Flush first: the export reads the project it is handed, and a writer who
      // just typed a line expects it in the PDF.
      await flush?.();
      const result = await window.vcwriter.exportPdf({ file, options: printOptions, kind, outlineId });
      setBusy(false);
      if (!result.ok) {
        setMessage(result.error ?? 'The PDF could not be created');
        return;
      }
      if (!result.data) {
        setMessage(null);
        return;
      }
      // A document the browser paginates as it lays it out cannot say how many
      // pages it came to until it has, so it says where it went instead.
      setMessage(
        result.data.pageCount > 0
          ? `Exported ${result.data.pageCount} pages to ${result.data.path}`
          : `Exported to ${result.data.path}`,
      );
    },
    [file, printOptions, flush],
  );

  const print = useCallback(
    async (kind: PrintKind = 'script', outlineId?: string) => {
      if (!file) return;
      setBusy(true);
      setMessage(null);
      await flush?.();
      const result = await window.vcwriter.print({ file, options: printOptions, kind, outlineId });
      setBusy(false);
      if (!result.ok) setMessage(result.error ?? 'The document could not be printed');
    },
    [file, printOptions, flush],
  );

  return { print, exportPdf, busy, message, setMessage };
};
