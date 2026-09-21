import { describe, expect, it } from 'vitest';
import {
  addGraphic,
  addMarker,
  addUnit,
  chapterChoices,
  chapterLeafContent,
  isFullPageArt,
  chapterPageStyleOf,
  chapterPagesEverywhere,
  chapterStyleAttr,
  chapterStyleVars,
  createProjectFile,
  moveUnit,
  paginateProject,
  placedMarkers,
  removeGraphic,
  renderPrintDocumentHtml,
  setChapterLineStyle,
  setChapterPage,
  setChapterPageStyle,
  templateOf,
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

/**
 * The chapter page for a book (addendum 19 §7): a summary that is not the
 * epigraph, a template that is the book's with one chapter allowed to differ,
 * and a picture from the library rather than a second copy of it.
 */
describe('the page for a book', () => {
  const textbook = () => {
    let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
    const trackId = file.tracks[0]!.id;
    const markerIds: string[] = [];
    for (const name of ['Geometric optics', 'Wave optics']) {
      const scene = addUnit(file, { trackId, title: name });
      const made = addMarker(scene.file, { unitId: scene.unit.id, kind: 'chapter', title: name });
      file = made.file;
      markerIds.push(made.marker.id as string);
    }
    return { file: chapterPagesEverywhere(file, true), markerIds };
  };
  const leafOf = (file: ProjectFile, markerId: string) =>
    chapterLeafContent(file, placedMarkers(file).find((one) => (one.marker.id as string) === markerId)!);

  it('draws every page the way it always has until a template is chosen', () => {
    const { file, markerIds } = textbook();
    expect(chapterPageStyleOf(file).template).toBe('graphic_middle');
    expect(leafOf(file, markerIds[0]!).template).toBe('graphic_middle');
  });

  it('is the book’s template, with one chapter allowed its own', () => {
    const { file, markerIds } = textbook();
    const top = setChapterPageStyle(file, { template: 'graphic_top' });
    expect(leafOf(top, markerIds[0]!).template).toBe('graphic_top');
    expect(leafOf(top, markerIds[1]!).template).toBe('graphic_top');

    const one = setChapterPage(top, markerIds[1]! as never, { template: 'graphic_bottom' });
    expect(templateOf(one, one.markers[1]!)).toBe('graphic_bottom');
    expect(leafOf(one, markerIds[0]!).template).toBe('graphic_top');
    // Back to the book's is a word, not a copy of the book's value.
    const back = setChapterPage(one, markerIds[1]! as never, { template: 'book' });
    expect(leafOf(back, markerIds[1]!).template).toBe('graphic_top');
  });

  it('keeps the summary apart from the epigraph, and prints it in the reading face', () => {
    const { file, markerIds } = textbook();
    const said = setChapterPage(file, markerIds[0]! as never, {
      epigraph: 'Let there be light.',
      summary: 'How light travels, bends and reflects, and what a lens does with it.',
    });
    const leaf = leafOf(said, markerIds[0]!);
    expect(leaf.epigraph).toBe('Let there be light.');
    expect(leaf.summary).toContain('what a lens does');

    const html = renderPrintDocumentHtml(said);
    expect(html).toContain('class="chapter-summary"');
    expect(html).toContain('class="chapter-epigraph"');
    // The summary's face is the manuscript's, whatever the heading wears.
    const vars = chapterStyleVars(chapterPageStyleOf(setChapterPageStyle(said, { face: 'serif' })));
    expect(vars['--chapter-summary-face']).toContain('Courier');
    expect(vars['--chapter-face']).not.toContain('Courier');
  });

  it('orders the page by the template', () => {
    const { file, markerIds } = textbook();
    let next = setChapterPage(file, markerIds[0]! as never, {
      summary: 'The summary.',
      image: { dataUrl: 'data:image/png;base64,AAAA', name: 'device', width: 40 },
    });
    // Read from the page itself, past the stylesheet that names every class first.
    const order = (html: string) => {
      const body = html.slice(html.indexOf('class="chapter-block"'));
      return ['chapter-device', 'chapter-head', 'chapter-summary']
        .map((mark) => [mark, body.indexOf(mark)] as const)
        .sort((a, b) => a[1] - b[1])
        .map(([mark]) => mark);
    };
    expect(order(renderPrintDocumentHtml(next))).toEqual(['chapter-head', 'chapter-device', 'chapter-summary']);
    next = setChapterPageStyle(next, { template: 'graphic_top' });
    expect(order(renderPrintDocumentHtml(next))).toEqual(['chapter-device', 'chapter-head', 'chapter-summary']);
    next = setChapterPageStyle(next, { template: 'graphic_bottom' });
    expect(order(renderPrintDocumentHtml(next))).toEqual(['chapter-head', 'chapter-summary', 'chapter-device']);
  });

  it('draws full-page art as the page, edge to edge, with nothing set over it', () => {
    const { file, markerIds } = textbook();
    const art = { dataUrl: 'data:image/png;base64,ART0', name: 'Chapter one, painted', width: 100 };
    const painted = setChapterPage(file, markerIds[0]! as never, { template: 'full_page', image: art, summary: 'Never printed on the art.' });
    const leaf = leafOf(painted, markerIds[0]!);
    expect(leaf.template).toBe('full_page');
    expect(isFullPageArt(leaf)).toBe(true);
    const html = renderPrintDocumentHtml(painted);
    const page = html.slice(html.indexOf('class="page chapter-page chapter-art-page'));
    expect(page).toContain('class="chapter-art"');
    expect(page).toContain('alt="Chapter one, painted"');
    // No heading, no summary, no block: the art is the page.
    const section = page.slice(0, page.indexOf('</section>'));
    expect(section).not.toContain('chapter-block');
    expect(section).not.toContain('class="chapter-summary"');
    // The other chapter, following the book, is untouched.
    expect(leafOf(painted, markerIds[1]!).template).toBe('graphic_middle');
    // The template without a picture yet draws as the middle one rather than as an empty page.
    const bare = setChapterPage(file, markerIds[0]! as never, { template: 'full_page', summary: 'The summary.' });
    expect(isFullPageArt(leafOf(bare, markerIds[0]!))).toBe(false);
    expect(renderPrintDocumentHtml(bare)).toContain('class="chapter-block"');
  });

  it('takes the picture from the library by id, so a replaced diagram is replaced here too', () => {
    const { file, markerIds } = textbook();
    const added = addGraphic(file, { name: 'Snell', data: 'data:image/png;base64,AAAA', altText: 'A ray bending' });
    const chosen = setChapterPage(added.file, markerIds[0]! as never, { assetId: added.asset.id, graphicWidth: 60 });
    const leaf = leafOf(chosen, markerIds[0]!);
    expect(leaf.image).toEqual({ dataUrl: 'data:image/png;base64,AAAA', name: 'A ray bending', width: 60 });
    // One picture in the file: the page holds the id and nothing else.
    expect(chosen.markers[0]!.page.image).toBeNull();

    // The picture gone from the library draws nothing rather than a broken plate.
    const gone = removeGraphic(chosen, added.asset.id);
    expect(leafOf(gone, markerIds[0]!).image).toBeNull();
    // And the printed page carries the library's picture.
    expect(renderPrintDocumentHtml(chosen)).toContain('alt="A ray bending"');
  });
});
