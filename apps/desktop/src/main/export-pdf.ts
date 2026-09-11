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
  renderPrintDocumentHtml,
  renderSheetDocumentHtml,
  suggestedBoardFileName,
  suggestedExportFileName,
  suggestedGridFileName,
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

/**
 * The board is landscape (addendum 05 §4c): a strip of shots reads across.
 * The document's own `@page` rule says so, but `printToPDF` takes the paper
 * from here, so it has to be told as well or the pages come out portrait with
 * a landscape layout squeezed onto them.
 */
const setupFor = (landscape: boolean) => ({ ...PAGE_SETUP, landscape });

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
 * tab as a document (addendum 04 §8). They are renderings of one project
 * rather than separate projects.
 */
export type PrintKind = 'script' | 'sheet' | 'board' | 'grid';

export interface ExportPdfInput {
  file: unknown;
  options?: PrintOptions;
  kind?: PrintKind;
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
const documentFor = (project: ProjectFile, kind: PrintKind, options: PrintOptions) => {
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
const pageCountOf = (pdf: Buffer, html: string, paged: boolean): number => {
  if (paged) return html.split('class="page').length - 1;
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
  const { html, name, paged, landscape } = documentFor(project, input.kind ?? 'script', input.options ?? {});

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

  const pdf = await withDocumentWindow(html, (window) => window.webContents.printToPDF(setupFor(landscape)));
  await writeFile(targetPath, pdf);

  return { path: targetPath, pageCount: pageCountOf(pdf, html, paged) };
};

export const printProject = async (input: {
  file: unknown;
  options?: PrintOptions;
  kind?: PrintKind;
}): Promise<boolean> => {
  const project = parseProjectFile(input.file);
  const { html, landscape } = documentFor(project, input.kind ?? 'script', input.options ?? {});

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
