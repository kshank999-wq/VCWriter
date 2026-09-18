import { BrowserWindow, dialog, type BrowserWindow as BrowserWindowType } from 'electron';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  parseProjectFile,
  renderBoardDocumentHtml,
  renderGridDocumentHtml,
  renderOneSheetHtml,
  renderNarrativeReportHtml,
  renderOutlineDocumentHtml,
  renderPrintDocumentHtml,
  renderSheetDocumentHtml,
  suggestedBoardFileName,
  suggestedBookFileName,
  suggestedExportFileName,
  suggestedGridFileName,
  suggestedNarrativeFileName,
  suggestedOneSheetFileName,
  suggestedOutlineFileName,
  suggestedSheetFileName,
  type PrintOptions,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * Print and PDF export (spec §6).
 *
 * The document HTML is generated here, in the main process, from a re-validated
 * project — the renderer never hands raw HTML to a window that will be printed.
 * The offscreen window that renders it runs with node integration off, context
 * isolation on and sandboxing, because printing is the one place where content
 * from the manuscript is loaded as markup.
 *
 * It prints through Chromium's own layout engine, so the PDF matches the
 * on-screen preview: both read the page geometry from `@vcwriter/domain`.
 */

const PAGE_SETUP = {
  pageSize: 'Letter' as const,
  printBackground: false,
  // Margins live in the document's @page rule, so the printer must not add more.
  margins: { marginType: 'none' } as const,
};

/** The paper a document asks for: a trim, in inches (addendum 20 §4). */
export interface Paper {
  width: number;
  height: number;
}

/**
 * The board is landscape (addendum 05 §4c): a strip of shots reads across.
 * The document's own `@page` rule says so, but `printToPDF` takes the paper
 * from here, so it has to be told as well or the pages come out portrait with
 * a landscape layout squeezed onto them. A book names its own paper — the
 * trim — which `printToPDF` takes in inches.
 */
const setupFor = (landscape: boolean, paper?: Paper) => ({
  ...PAGE_SETUP,
  landscape,
  ...(paper ? { pageSize: { width: paper.width, height: paper.height } } : {}),
});

const withDocumentWindow = async <T>(
  html: string,
  action: (window: BrowserWindowType) => Promise<T>,
): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'vcwriter-print-'));
  const documentPath = join(directory, 'document.html');
  await writeFile(documentPath, html, 'utf8');

  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // The document is static markup; nothing in it needs to run.
      javascript: false,
    },
  });

  try {
    await window.loadURL(pathToFileURL(documentPath).toString());
    return await action(window);
  } finally {
    window.destroy();
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
};

/**
 * Which document is being printed.
 *
 * `script` is the manuscript, hand-paginated. In a short-form project the
 * document is the **sheet**, and beside it there is a **board** — the frames
 * on their own, for a wall (addendum 05 §8). The **grid** is the Story Grid
 * tab as a document (addendum 04 §8), and the **outline** is the Outliner's
 * tree as one (addendum 06 §12, stage 9). They are renderings of one project
 * rather than separate projects.
 */
export type PrintKind = 'script' | 'sheet' | 'board' | 'grid' | 'outline' | 'one-sheet' | 'narrative' | 'book';

export interface ExportPdfInput {
  file: unknown;
  options?: PrintOptions;
  kind?: PrintKind;
  /** Which outline, when there is more than one. Left out, it is the first. */
  outlineId?: string;
  /**
   * The **book**, already drawn (addendum 20 §4). The one document whose
   * markup arrives from the renderer rather than being built here: its pages
   * exist only where the type was measured. The window it prints in still
   * runs with scripts off, node off and the sandbox on, as every document
   * does — and the book is only ever printed, never shown.
   */
  html?: string;
  /** The book's paper: the trim, in inches. */
  paper?: Paper;
  /** Skips the save dialog; used by tests and future batch export. */
  targetPath?: string;
}

/**
 * The document, and what to call the file it is saved as.
 *
 * Short form prints its sheet whatever the caller asked for, because a
 * commercial has no script to print instead — asking for one is asking for
 * the document this project has.
 */
const documentFor = (
  project: ProjectFile,
  kind: PrintKind,
  options: PrintOptions,
  outlineId?: string,
  drawn?: { html?: string; paper?: Paper },
) => {
  // The book (addendum 20): drawn by the renderer at the trim, printed here
  // on paper that size. A page is a `.bk-page`, one per leaf.
  if (kind === 'book') {
    return {
      html: drawn?.html ?? '',
      name: suggestedBookFileName(project.project.title),
      paged: true,
      landscape: false,
      paper: drawn?.paper,
      pageClass: 'bk-page',
    };
  }
  // §18's reports, one after another (addendum 18 stage 9). Not paged as a
  // manuscript is: it is a set of tables, and breaking it on script pages
  // would cut them for a geometry it does not have.
  if (kind === 'narrative') {
    return {
      html: renderNarrativeReportHtml(project, options),
      name: suggestedNarrativeFileName(project),
      paged: false,
      landscape: false,
    };
  }
  if (kind === 'outline') {
    return {
      html: renderOutlineDocumentHtml(project, outlineId ?? null, options),
      name: suggestedOutlineFileName(project, outlineId ?? null),
      paged: false,
      landscape: false,
    };
  }
  // The project's own one page (master spec §4). Assembled from the fields
  // every time rather than kept, so there is nothing here to go stale.
  if (kind === 'one-sheet') {
    return {
      html: renderOneSheetHtml(project),
      name: suggestedOneSheetFileName(project),
      paged: false,
      landscape: false,
    };
  }
  if (kind === 'grid') {
    return {
      html: renderGridDocumentHtml(project, options),
      name: suggestedGridFileName(project),
      paged: false,
      landscape: true,
    };
  }
  const sheetish = kind === 'sheet' || project.project.format === 'short_form';
  if (kind === 'board') {
    return {
      html: renderBoardDocumentHtml(project, options),
      name: suggestedBoardFileName(project),
      paged: false,
      landscape: true,
    };
  }
  if (sheetish) {
    return {
      html: renderSheetDocumentHtml(project, options),
      name: suggestedSheetFileName(project),
      paged: false,
      landscape: false,
    };
  }
  return {
    html: renderPrintDocumentHtml(project, options),
    name: suggestedExportFileName(project),
    paged: true,
    landscape: false,
  };
};

/**
 * How many pages came out.
 *
 * A hand-paginated script says so in its own markup — one section per page.
 * A sheet is paginated by the browser, so the only place the answer exists is
 * the PDF itself: count its page objects rather than guess.
 */
const pageCountOf = (pdf: Buffer, html: string, paged: boolean, pageClass = 'page'): number => {
  if (paged) return html.split(`class="${pageClass}`).length - 1;
  const matches = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
};

export interface ExportPdfResult {
  path: string;
  pageCount: number;
}

export const exportProjectPdf = async (
  input: ExportPdfInput,
  parent: BrowserWindowType | null,
): Promise<ExportPdfResult | null> => {
  const project = parseProjectFile(input.file);
  const { html, name, paged, landscape, paper, pageClass } = documentFor(
    project,
    input.kind ?? 'script',
    input.options ?? {},
    input.outlineId,
    { html: input.html, paper: input.paper },
  );

  let targetPath = input.targetPath;
  if (!targetPath) {
    const choice = parent
      ? await dialog.showSaveDialog(parent, {
          defaultPath: name,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
      : await dialog.showSaveDialog({
          defaultPath: name,
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
    if (choice.canceled || !choice.filePath) return null;
    targetPath = choice.filePath;
  }

  const pdf = await withDocumentWindow(html, (window) => window.webContents.printToPDF(setupFor(landscape, paper)));
  await writeFile(targetPath, pdf);

  return { path: targetPath, pageCount: pageCountOf(pdf, html, paged, pageClass) };
};

export const printProject = async (input: {
  file: unknown;
  options?: PrintOptions;
  kind?: PrintKind;
  outlineId?: string;
  html?: string;
  paper?: Paper;
}): Promise<boolean> => {
  const project = parseProjectFile(input.file);
  const { html, landscape } = documentFor(project, input.kind ?? 'script', input.options ?? {}, input.outlineId, {
    html: input.html,
    paper: input.paper,
  });

  return withDocumentWindow(
    html,
    (window) =>
      new Promise<boolean>((resolve, reject) => {
        window.webContents.print({ silent: false, printBackground: false, landscape }, (success, failureReason) => {
          // A cancelled print dialog is an ordinary outcome, not an error.
          if (!success && failureReason && failureReason !== 'cancelled') {
            reject(new Error(failureReason));
            return;
          }
          resolve(success);
        });
      }),
  );
};
