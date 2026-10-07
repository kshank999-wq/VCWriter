import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { late, STALE_PAGE_REFUSAL } from '../late-module';

/**
 * A part of the program fetched when it is first needed (addendum 33 §9).
 *
 * The fault this is about could not be seen from inside one build: a chunk is
 * named by a hash of its contents, so it is only when a **second** deployment
 * replaces the first that a page already open asks for a file that is no
 * longer there. Reproduced by serving two builds in turn and pressing Import
 * in a tab opened against the older one, which answered with the browser's
 * own *Failed to fetch dynamically imported module* — a chunk name, said to
 * somebody who had just chosen a Word document.
 *
 * So there are two halves here and the second is the more important. The
 * first is that a fetch that fails is **said**. The second is that the Word
 * reader is not fetched at all: at under three kilobytes the split bought
 * nothing and cost the one failure a writer cannot act on, and **a reader
 * loaded late again would look exactly like this never having been fixed**,
 * which is why it is asserted off the source rather than left to be
 * remembered (addendum 31 §4, addendum 32 §9).
 */

const renderer = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Every renderer source, so a surface added later is covered the day it is written. */
const sources = (at: string = renderer): string[] =>
  readdirSync(at).flatMap((name) => {
    const path = join(at, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

describe('a part of the program that could not be fetched', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands back what loaded', async () => {
    await expect(late(async () => ({ readPdfLines: 'here' }))).resolves.toEqual({ readPdfLines: 'here' });
  });

  it('says what a writer can do about it instead of naming a chunk', async () => {
    const failed = late(async () => {
      throw new TypeError('Failed to fetch dynamically imported module: /preview/assets/read-pdf-CBgqmEZy.js');
    });
    await expect(failed).rejects.toThrow(STALE_PAGE_REFUSAL);
    // The browser's own wording names a file and nothing a writer can act on.
    await expect(failed).rejects.not.toThrow(/dynamically imported|assets\//);
  });

  it('names reloading the page, which is the whole of the fix', () => {
    expect(STALE_PAGE_REFUSAL).toMatch(/[Rr]eload/);
  });

  it('keeps what actually happened, where it is of use', async () => {
    const cause = new TypeError('Failed to fetch dynamically imported module');
    await late(async () => {
      throw cause;
    }).catch(() => undefined);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), cause);
  });
});

describe('what is fetched late', () => {
  const files = sources();

  it('found the renderer to read', () => {
    // A walk that found nothing would pass every assertion under it.
    expect(files.length).toBeGreaterThan(40);
  });

  it('never loads the Word reader late', () => {
    // Ken, on the deployed build: *I get an error that says failed to fetch
    // dynamically imported module. I tried to import a Word doc .docx*
    for (const path of files) {
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/import\(\s*['"][^'"]*read-docx['"]\s*\)/);
    }
  });

  it('loads what stays split through the one place that says so', () => {
    // pdf.js is a megabyte and a half, so those two stay late — and a late
    // import without `late` around it is the browser's message back on the
    // screen. `preview.tsx` fetches the application itself, on a fresh load,
    // where there is no older page to be stale.
    for (const path of files) {
      if (path.endsWith('late-module.ts') || path.endsWith('preview.tsx')) continue;
      expect(readFileSync(path, 'utf8'), path).not.toMatch(/\b(?:await|void)\s+import\(/);
    }
  });
});
