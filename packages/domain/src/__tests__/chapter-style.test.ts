import { describe, expect, it } from 'vitest';
import {
  addMarker,
  addUnit,
  chapterChoices,
  chapterPageStyleOf,
  chapterPagesEverywhere,
  chapterStyleAttr,
  chapterStyleVars,
  createProjectFile,
  moveUnit,
  paginateProject,
  setChapterLineStyle,
  setChapterPage,
  setChapterPageStyle,
  unitsInStoryOrder,
  type ProjectFile,
} from '../index.js';

/**
 * The chapter page's typography (addendum 02 §12a).
 *
 * The claims worth defending: **the look belongs to the book and the words
 * belong to the chapter**, and **the number is worked out rather than typed**
 * — so moving a chapter renumbers the page it opens with, and there is nowhere
 * to disagree with that.
 */

/** A book of several chapters, each on its own scene. */
const book = (chapters: string[], format: 'novel' | 'screenplay' = 'novel') => {
  let file: ProjectFile = createProjectFile({ title: 'The Drowned Bell', format });
  const trackId = file.tracks[0]!.id;
  const markerIds: string[] = [];
  for (const name of chapters) {
    const scene = addUnit(file, { trackId, title: name });
    const made = addMarker(scene.file, { unitId: scene.unit.id, kind: 'chapter', title: name });
    file = made.file;
    markerIds.push(made.marker.id as string);
  }
  return { file, markerIds };
};

describe('the book’s chapter-page style', () => {
  it('starts somewhere a book would start', () => {
    const { file } = book(['One']);
    const style = chapterPageStyleOf(file);

    expect(style.face).toBe('manuscript');
    expect(style.number.case).toBe('capitals');
    expect(style.epigraph.italic).toBe(true);
    expect(style.dropInches).toBeCloseTo(2.5);
  });

  it('is one look for the whole book, not one per chapter', () => {
    // The same rule the numbering follows: a reader who turns to chapter nine
    // and finds its heading in another face has found a mistake.
    const { file } = book(['One', 'Two']);
    const styled = setChapterPageStyle(file, { face: 'serif' });

    expect(chapterPageStyleOf(styled).face).toBe('serif');
    // Nothing about it is on a marker, so there is nowhere to disagree.
    for (const marker of styled.markers) {
      expect(Object.keys(marker.page)).not.toContain('face');
    }
  });

  it('patches one line without restating the others', () => {
    const { file } = book(['One']);
    const styled = setChapterLineStyle(file, 'title', { size: 22, bold: true });
    const style = chapterPageStyleOf(styled);

    expect(style.title.size).toBe(22);
    expect(style.title.bold).toBe(true);
    // Untouched, rather than reset to the schema's default.
    expect(style.number.case).toBe('capitals');
    expect(style.epigraph.italic).toBe(true);
  });

  it('refuses a size no page could set', () => {
    const { file } = book(['One']);
    expect(() => setChapterLineStyle(file, 'title', { size: 400 })).toThrow();
  });
});

describe('the style as CSS', () => {
  it('gives small caps as a variant rather than by changing the letters', () => {
    // A heading whose characters have been upper-cased can never be set any
    // other way, and the writer typed a title rather than a shout.
    const { file } = book(['One']);
    const vars = chapterStyleVars(chapterPageStyleOf(setChapterLineStyle(file, 'title', { case: 'small_caps' })));

    expect(vars['--chapter-title-variant']).toBe('small-caps');
    expect(vars['--chapter-title-case']).toBe('none');
  });

  it('reads as capitals only when the writer asked for capitals', () => {
    const { file } = book(['One']);
    const vars = chapterStyleVars(chapterPageStyleOf(setChapterLineStyle(file, 'title', { case: 'capitals' })));

    expect(vars['--chapter-title-case']).toBe('uppercase');
    expect(vars['--chapter-title-variant']).toBe('normal');
  });

  it('is one function, so the printed attribute says what the preview does', () => {
    const { file } = book(['One']);
    const style = chapterPageStyleOf(setChapterPageStyle(file, { face: 'serif', rule: true }));
    const attr = chapterStyleAttr(style);

    for (const [name, value] of Object.entries(chapterStyleVars(style))) {
      expect(attr).toContain(`${name}:${value}`);
    }
  });
});

describe('giving every chapter a page', () => {
  it('turns them all on at once and leaves their words alone', () => {
    const { file, markerIds } = book(['One', 'Two', 'Three']);
    const named = setChapterPage(file, markerIds[1]! as never, { epigraph: 'The bell was never rung.' });
    const all = chapterPagesEverywhere(named, true);

    expect(all.markers.every((marker) => marker.page.include)).toBe(true);
    expect(all.markers.find((marker) => (marker.id as string) === markerIds[1])!.page.epigraph).toBe(
      'The bell was never rung.',
    );
  });

  it('does nothing at all in a format with no chapter pages', () => {
    const { file } = book(['One', 'Two'], 'screenplay');
    expect(chapterPagesEverywhere(file, true)).toBe(file);
  });
});

describe('the number on the page', () => {
  it('is worked out from where the chapter falls, never typed', () => {
    const { file, markerIds } = book(['One', 'Two', 'Three']);
    const choices = chapterChoices(chapterPagesEverywhere(file, true));

    expect(choices.map((one) => one.label)).toEqual(['Chapter 1', 'Chapter 2', 'Chapter 3']);
    expect(choices.every((one) => one.hasPage)).toBe(true);
    expect(choices[2]!.markerId as string).toBe(markerIds[2]);
  });

  it('follows the chapter when the story is reordered', () => {
    const { file, markerIds } = book(['One', 'Two', 'Three']);
    const all = chapterPagesEverywhere(file, true);
    // Move the last scene to the front: its chapter is chapter one now, and
    // the leaf it opens with says so with nothing run.
    const last = unitsInStoryOrder(all).at(-1)!;
    const moved = moveUnit(all, { unitId: last.id, toTrackId: last.trackId, index: 0 });

    const choices = chapterChoices(moved);
    expect(choices[0]!.markerId as string).toBe(markerIds[2]);
    expect(choices[0]!.label).toBe('Chapter 1');
    // And the one that was first is now chapter two, which is the whole point.
    expect(choices.find((one) => (one.markerId as string) === markerIds[0])!.label).toBe('Chapter 2');
  });

  it('reaches the printed leaf', () => {
    const { file } = book(['One', 'Two']);
    const pages = paginateProject(chapterPagesEverywhere(file, true));
    const leaves = pages.filter((page) => page.chapter);

    expect(leaves.map((page) => page.chapter!.label)).toEqual(['Chapter 1', 'Chapter 2']);
  });
});
