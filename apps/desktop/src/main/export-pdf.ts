import { BrowserWindow, dialog, type BrowserWindow as BrowserWindowType } from 'electron';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  parseProjectFile,
  renderPrintDocumentHtml,
  suggestedExportFileName,
  type PrintOptions,
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

export interface ExportPdfInput {
  file: unknown;
  options?: PrintOptions;
  /** Skips the save dialog; used by tests and future batch export. */
  targetPath?: string;
}

export interface ExportPdfResult {
  path: string;
  pageCount: number;
}

export const exportProjectPdf = async (
  input: ExportPdfInput,
  parent: BrowserWindowType | null,
): Promise<ExportPdfResult | null> => {
  const project = parseProjectFile(input.file);
  const html = renderPrintDocumentHtml(project, input.options ?? {});

  let targetPath = input.targetPath;
  if (!targetPath) {
    const choice = parent
      ? await dialog.showSaveDialog(parent, {
          defaultPath: suggestedExportFileName(project),
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        })
      : await dialog.showSaveDialog({
          defaultPath: suggestedExportFileName(project),
          filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
    if (choice.canceled || !choice.filePath) return null;
    targetPath = choice.filePath;
  }

  const pdf = await withDocumentWindow(html, (window) => window.webContents.printToPDF(PAGE_SETUP));
  await writeFile(targetPath, pdf);

  return { path: targetPath, pageCount: html.split('class="page').length - 1 };
};

export const printProject = async (input: { file: unknown; options?: PrintOptions }): Promise<boolean> => {
  const project = parseProjectFile(input.file);
  const html = renderPrintDocumentHtml(project, input.options ?? {});

  return withDocumentWindow(
    html,
    (window) =>
      new Promise<boolean>((resolve, reject) => {
        window.webContents.print({ silent: false, printBackground: false }, (success, failureReason) => {
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
