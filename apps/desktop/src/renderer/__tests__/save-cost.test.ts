import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProjectFile, type ProjectFile } from '@vcwriter/domain';
import { createBrowserBridge } from '../browser-bridge';

/**
 * **What a save reads** (addendum 20 §9am, from Ken: *it crashed again — I
 * think we need to expand the memory of the page. Everything was working
 * well… I had added a bunch of pictures and I have all five stories in now*).
 *
 * A picture is a data URL of up to five megabytes, and the assets are the
 * whole of a project's weight. Measured in the real preview on five stories,
 * the document serialised to **6 MB with one picture in it and 82 MB with
 * fourteen** — and an autosave was stringifying, encoding and SHA-256ing
 * every byte of that on the main thread **every five seconds**, 836 ms at a
 * time, purely to answer *has anything changed*. Nothing was retained: the
 * settled heap stayed flat, so what took the tab down was the churn, and the
 * page's memory was never the fault. The room was spending it.
 *
 * The fix is §9ag's argument one layer down — **a mutation rebuilds one
 * collection and shares the rest**, so where the assets are the identical
 * array their digest is the one worked out last time. The bytes are read when
 * a picture arrives and never again.
 *
 * What these pin is both halves, and the second is the one that could go
 * wrong quietly: the cost, which reads exactly like the fix not being there,
 * and the **faithfulness** — a hash that stopped noticing a changed picture
 * would be a picture that never reached the disk, which is work lost.
 */

/** A picture big enough that reading it is unmistakable in the figures. */
const PICTURE = `data:image/png;base64,${'A'.repeat(2 * 1024 * 1024)}`;
/** Asset ids are uuids, and the store parses what it reads back. */
const PLATE_ONE = '11111111-1111-4111-8111-111111111111';
const PLATE_TWO = '22222222-2222-4222-8222-222222222222';

const withAsset = (file: ProjectFile, id: string, data: string): ProjectFile =>
  ({
    ...file,
    assets: [
      ...file.assets,
      {
        id,
        projectId: file.project.id,
        kind: 'image',
        name: 'Plate',
        data,
        width: 400,
        height: 300,
        altText: '',
        caption: '',
        createdAt: file.project.createdAt,
        updatedAt: file.project.createdAt,
      },
    ],
  }) as ProjectFile;

/** How many characters `JSON.stringify` is handed while `run` happens. */
const serialised = async (run: () => Promise<void>): Promise<number> => {
  const real = JSON.stringify;
  let chars = 0;
  (JSON as { stringify: typeof JSON.stringify }).stringify = ((...args: Parameters<typeof JSON.stringify>) => {
    const text = real.apply(JSON, args);
    if (typeof text === 'string') chars += text.length;
    return text;
  }) as typeof JSON.stringify;
  try {
    await run();
  } finally {
    (JSON as { stringify: typeof JSON.stringify }).stringify = real;
  }
  return chars;
};

describe('a save with pictures in the book', () => {
  it('reads the pictures once and never again', async () => {
    const bridge = createBrowserBridge();
    const made = await bridge.createProject({ title: 'Harbour Tales', format: 'short_story' });
    const path = made.data!.path;
    const illustrated = withAsset(made.data!.file, PLATE_ONE, PICTURE);

    // The first save after a picture arrives hashes its bytes, which is the
    // one time it must: there is nothing to compare them against yet.
    let hash = made.data!.contentHash;
    const first = await serialised(async () => {
      const saved = await bridge.saveProject({ path, file: illustrated, previousHash: hash });
      hash = saved.data!.contentHash;
    });
    expect(first).toBeGreaterThan(PICTURE.length);

    // Every save after it, with the pictures untouched, reads none of them —
    // which is the whole of the fix, and the fault it replaces.
    const next = { ...illustrated, project: { ...illustrated.project, logline: 'A harbour at first light' } };
    const after = await serialised(async () => {
      await bridge.saveProject({ path, file: next, previousHash: hash });
    });
    expect(after).toBeLessThan(PICTURE.length / 4);
  });

  /**
   * **It is still a hash of the pictures.** The digest is reused on reference
   * identity alone, so a changed collection is hashed again — without which
   * a replaced picture would read as no change and never be written.
   */
  it('still notices a picture that changed', async () => {
    const bridge = createBrowserBridge();
    const made = await bridge.createProject({ title: 'In For A Pound', format: 'short_story' });
    const path = made.data!.path;

    const one = withAsset(made.data!.file, PLATE_ONE, PICTURE);
    const saved = await bridge.saveProject({ path, file: one, previousHash: made.data!.contentHash });
    expect(saved.data?.written).toBe(true);

    // Saved again untouched: nothing is written, so the short-circuit the
    // hash exists for still fires.
    const again = await bridge.saveProject({ path, file: one, previousHash: saved.data!.contentHash });
    expect(again.data).toEqual({ contentHash: saved.data!.contentHash, written: false });

    // A second picture, and then the same id carrying other bytes: both are
    // a changed collection, and both are written.
    const two = withAsset(one, PLATE_TWO, PICTURE);
    const grown = await bridge.saveProject({ path, file: two, previousHash: saved.data!.contentHash });
    expect(grown.data?.written).toBe(true);
    expect(grown.data?.contentHash).not.toBe(saved.data?.contentHash);

    const swapped = { ...two, assets: two.assets.map((one) => ({ ...one, data: `${PICTURE}B` })) } as ProjectFile;
    const rewritten = await bridge.saveProject({ path, file: swapped, previousHash: grown.data!.contentHash });
    expect(rewritten.data?.written).toBe(true);
    expect(rewritten.data?.contentHash).not.toBe(grown.data?.contentHash);
  });

  it('still notices a change that is nothing to do with the pictures', async () => {
    const bridge = createBrowserBridge();
    const made = await bridge.createProject({ title: 'Falling', format: 'short_story' });
    const path = made.data!.path;
    const illustrated = withAsset(made.data!.file, PLATE_ONE, PICTURE);
    const saved = await bridge.saveProject({ path, file: illustrated, previousHash: made.data!.contentHash });

    const renamed = { ...illustrated, project: { ...illustrated.project, title: 'Falling, revised' } };
    const next = await bridge.saveProject({ path, file: renamed, previousHash: saved.data!.contentHash });
    expect(next.data?.written).toBe(true);
    const reopened = await bridge.openProjectAtPath(path);
    // The reason, rather than `expected undefined`, if the store ever refuses.
    expect(reopened.error ?? null).toBeNull();
    expect(reopened.data?.file.project.title).toBe('Falling, revised');
  });
});

/**
 * **No surface builds a laid page's markup in its render body** (§9am).
 *
 * `renderBookPage` returns the picture's data URL inline — 6 MB for one
 * illustration, measured on the real spread — and four surfaces called it
 * straight out of a render: the spread, the part's preview, the designed
 * page's and the back matter's, the last three being dialogs that save as you
 * type. `SheetInk` is the one component that memoises it, so the next surface
 * that draws a page gets this without being told.
 *
 * Asserted off the source, in `late-module`'s shape, because it fails by
 * being **absent**: a page drawn the old way looks exactly like a page drawn
 * the new way, and only the allocations differ.
 */
describe('drawing a laid page', () => {
  const root = join(__dirname, '..');
  const files = ['components/LayoutWindow.tsx', 'components/DesignedPageDialog.tsx', 'components/BackMatterDialog.tsx'];

  it('goes through the one memoised component rather than innerHTML', () => {
    for (const name of files) {
      const source = readFileSync(join(root, name), 'utf8');
      expect(source, `${name} should not build a page's markup itself`).not.toMatch(/renderBookPage/);
      if (source.includes('layout-sheet')) expect(source, `${name} should draw pages with SheetInk`).toMatch(/SheetInk/);
    }
  });

  it('memoises on what the markup is a function of, and nothing else', () => {
    const source = readFileSync(join(root, 'components/SheetInk.tsx'), 'utf8');
    expect(source).toMatch(/memo\(/);
    expect(source).toMatch(/useMemo\(\(\) => renderBookPage\(page, blocks, context\), \[page, blocks, context\]\)/);
  });
});
