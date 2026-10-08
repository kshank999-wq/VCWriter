import { describe, expect, it } from 'vitest';
import {
  addPart,
  bookBlocks,
  bookSettingsOf,
  chapterPageStyleOf,
  createProjectFile,
  geometryOf,
  partHasStyle,
  partModeOf,
  partPlacement,
  partsOf,
  renderBookPage,
  updatePart,
  type BookPart,
  type ProjectFile,
} from '../index.js';

/**
 * **A designed page as a piece of art** (addendum 20 §9y, from Ken: *so I add
 * a table of contents. And instead of the table of contents, I want a contents
 * page that is a full page piece of artwork. But when I go to import it, it
 * doesn't change*).
 *
 * It did not change. *Import full page art…* is offered wherever a page prints
 * type of its own — `partHasStyle`, every kind but a plate — while only the
 * four whose placement is a `block` ever read `part.assetId`. So on a contents
 * page the import was taken, the button changed its words, and the page went
 * on printing its entries: a gate that **accepts what the printer never
 * learned to draw**, which says nothing at all where a refusal would have said
 * something.
 */

const book = (): ProjectFile => createProjectFile({ title: 'Harbour Tales', format: 'short_story', author: 'K. Shank' });

const partOfKind = (file: ProjectFile, kind: BookPart['kind']): BookPart =>
  partsOf(file).find((one) => one.kind === kind)!;

/** The blocks a part contributes, found by its id. */
const blocksOfPart = (file: ProjectFile, partId: string) =>
  bookBlocks(file).filter((block) => block.partId === partId);

const withArt = (file: ProjectFile, kind: BookPart['kind']): { file: ProjectFile; id: string } => {
  const part = partOfKind(file, kind);
  return { file: updatePart(file, part.id, { assetId: 'pic-1' }), id: part.id };
};

describe('a contents page made of artwork', () => {
  it('prints the picture instead of the entries', () => {
    const { file, id } = withArt(book(), 'contents');
    const blocks = blocksOfPart(file, id);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.kind).toBe('plate');
    expect(blocks[0]!.assetId).toBe('pic-1');
    expect(blocks[0]!.display).toBe(true);
    // No entries anywhere in the book: the page is the picture.
    expect(bookBlocks(file).some((block) => block.kind === 'contents')).toBe(false);
  });

  it('keeps the side the page would have taken', () => {
    // A contents page is a recto and a copyright page a verso, whether it
    // carries entries or a picture — the art replaces the page, not its place.
    const contents = withArt(book(), 'contents');
    expect(blocksOfPart(contents.file, contents.id)[0]!.starts).toBe('recto');
    const copyright = withArt(book(), 'copyright');
    expect(blocksOfPart(copyright.file, copyright.id)[0]!.starts).toBe('verso');
  });

  it('is a mode rather than a deletion: taking the picture off brings the page back', () => {
    const { file, id } = withArt(book(), 'contents');
    const back = updatePart(file, id, { assetId: null });
    expect(blocksOfPart(back, id)[0]!.kind).toBe('contents');
    expect(partModeOf(partOfKind(back, 'contents'))).toBe('text');
  });

  it('reads as art on the screen and on the page alike', () => {
    const { file } = withArt(book(), 'contents');
    expect(partModeOf(partOfKind(file, 'contents'))).toBe('art');
  });

  it('draws the picture edge to edge, with nothing set over it', () => {
    const { file, id } = withArt(book(), 'contents');
    const block = blocksOfPart(file, id)[0]!;
    const settings = bookSettingsOf(file);
    const drawn = renderBookPage(
      {
        sheet: 5,
        blank: false,
        display: true,
        folio: '',
        counted: 'v',
        running: '',
        pieces: [{ blockId: block.id, from: 0, to: 1 }],
      } as never,
      new Map([[block.id, block]]) as never,
      {
        settings,
        geometry: geometryOf(settings, 'short_story', 40),
        chapterStyle: chapterPageStyleOf(file),
        paragraphStyle: 'indented' as const,
        pictures: new Map([['pic-1', { id: 'pic-1', data: 'data:image/png;base64,AA', altText: 'A harbour at dusk' }]]),
        names: { title: 'Harbour Tales', author: 'K. Shank', imprint: '' },
        titlePage: { title: '', author: '', imprint: '', lines: [] },
        contents: [],
        index: null,
      } as never,
    );
    expect(drawn).toContain('bk-plate-art');
    expect(drawn).toContain('A harbour at dusk');
    // Nothing of the contents page's own furniture is set over it.
    expect(drawn).not.toContain('bk-contents');
  });
});

describe('the four that already drew their own art', () => {
  it('are left exactly as they were, so no existing book moves', () => {
    // The half title and the title page have carried `assetId` on their own
    // blocks since §8; moving them onto a plate would have changed the markup
    // of every book already set that way.
    for (const kind of ['half_title', 'title_page'] as const) {
      const { file, id } = withArt(book(), kind);
      expect(blocksOfPart(file, id)[0]!.kind).toBe(kind);
      expect(blocksOfPart(file, id)[0]!.assetId).toBe('pic-1');
    }
  });

  it('are exactly the kinds whose placement is a block', () => {
    // So there is no second list of kinds to keep in step with the printer.
    const made = addPart(addPart(book(), 'dedication').file, 'epigraph').file;
    for (const part of partsOf(made)) {
      if (!partHasStyle(part.kind)) continue;
      const art = updatePart(made, part.id, { assetId: 'pic-1' });
      const kind = blocksOfPart(art, part.id)[0]!.kind;
      expect(kind === 'plate').toBe(partPlacement(part.kind) !== 'block');
    }
  });
});
