import { describe, expect, it } from 'vitest';
import {
  LINE_ALIGNS,
  addPart,
  bookBlocks,
  bookNames,
  bookSettingsOf,
  chapterPageStyleOf,
  createProjectFile,
  geometryOf,
  layPages,
  lineStyleSchema,
  lineStyleVars,
  partStyleOf,
  partsOf,
  renderBookPage,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **The body text is a line of type too** (addendum 20 §18, from Ken: *in any
 * of the dialog boxes that you can add text, right now only the headings can
 * be stylized, but the body text needs to be able to be stylized, centered,
 * justified right, left, change the font, change the size, also*).
 *
 * Measured before a line was written: a prose part's paragraphs took
 * `--bk-align`, the book's own, and the page's `align` reached its **heading**
 * and stopped there — so a biography could not be centred, a dedication's
 * attribution could not be ranged right, and nothing on any of those pages
 * could be justified at all. The size was the one thing a back-matter page's
 * words could be given.
 */

const novel = (): ProjectFile => createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });

const withPart = (kind: 'about_the_author' | 'dedication', text: string) => {
  const made = addPart(novel(), kind);
  const part = partsOf(made.file).find((one) => one.kind === kind)!;
  return { file: updatePart(made.file, part.id, { text }), partId: part.id };
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, 1]));
  const settings = bookSettingsOf(file);
  return { blocks, settings, laid: layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file)) };
};

/**
 * The markup of the **paragraph** a part's words are set in, which is what
 * this is about — the page's heading carries the page's own alignment, and
 * reading the whole sheet would find that and call it the body's.
 */
const wordsOf = (file: ProjectFile, partId: string): string =>
  (inkFor(file, partId).match(/<p class="bk-p[^>]*>/g) ?? []).join(' ');

/** The markup of the page a part's words are on, which is what prints. */
const inkFor = (file: ProjectFile, partId: string): string => {
  const { blocks, settings, laid } = lay(file);
  const page = laid.pages.find((one) => one.pieces.some((piece) => blocks.find((b) => b.id === piece.blockId)?.partId === partId))!;
  return renderBookPage(page, new Map(blocks.map((one) => [one.id, one])), {
    settings,
    geometry: geometryOf(settings, 40),
    chapterStyle: chapterPageStyleOf(file),
    paragraphStyle: 'indented',
    names: bookNames(file),
    titlePage: { title: '', author: '', imprint: '', lines: [] },
    contents: [],
    index: null,
    pictures: new Map(),
  } as never);
};

describe('a line of type says where it stands and what it is set in', () => {
  it('says neither until somebody asks, so nothing already printed moves', () => {
    /**
     * **Null is what makes it safe.** A line nobody has ranged or re-faced
     * emits no `text-align` and no `font-family` of its own, so the markup of
     * a book made before this is byte for byte what it was — which is why the
     * whole suite passed with two whole-object assertions edited and no print
     * assertion touched at all.
     */
    const line = lineStyleSchema.parse({ size: 11 });
    expect(line.align).toBeNull();
    expect(line.face).toBeNull();
    const vars = lineStyleVars('--pt-line', line);
    expect(vars['--pt-line-align']).toBeUndefined();
    expect(vars['--pt-line-face']).toBeUndefined();
    // And everything it always said, unchanged.
    expect(vars['--pt-line-size']).toBe('11pt');
  });

  it('draws them once they are asked for, and an imported font resolves', () => {
    const vars = lineStyleVars('--pt-line', lineStyleSchema.parse({ align: 'justify', face: 'georgia' }));
    expect(vars['--pt-line-align']).toBe('justify');
    expect(vars['--pt-line-face']).toMatch(/Georgia/);
    // `faceStackOf` is the one resolver and it reads `font:<id>` (§6b), which
    // is why the record is a string rather than a list of named faces.
    const own = lineStyleVars('--pt-line', lineStyleSchema.parse({ face: 'font:abc' }), [
      { id: 'abc', family: 'Sabon', serif: true, data: '' } as never,
    ]);
    expect(own['--pt-line-face']).toMatch(/Sabon/);
  });

  it('offers justified, which a page’s own alignment cannot', () => {
    /**
     * **Justification is a line of running text's and never a page's.** A
     * page's alignment ranges a block that has been placed on it — a title, a
     * dedication, a heading — and nothing in a book justifies one of those.
     */
    expect([...LINE_ALIGNS]).toEqual(['left', 'center', 'right', 'justify']);
    const page = partStyleOf({ kind: 'dedication', style: {} });
    expect(['left', 'center', 'right']).toContain(page.align);
  });
});

describe('the words of a prose page', () => {
  it('took the book’s alignment and now take their own', () => {
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    // Before: no alignment of its own at all, so the book's rule stands.
    expect(wordsOf(file, partId)).not.toMatch(/text-align/);

    const part = partsOf(file).find((one) => one.id === partId)!;
    const centred = updatePart(file, partId, {
      style: { ...partStyleOf(part), line: { ...partStyleOf(part).line, align: 'center' } },
    });
    expect(wordsOf(centred, partId)).toMatch(/text-align:center/);
  });

  it('may be justified, and set in a face the heading is not', () => {
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    const part = partsOf(file).find((one) => one.id === partId)!;
    const style = partStyleOf(part);
    const set = updatePart(file, partId, {
      style: { ...style, face: 'garamond', line: { ...style.line, align: 'justify', face: 'gill_sans' } },
    });
    const ink = wordsOf(set, partId);
    expect(ink).toMatch(/text-align:justify/);
    // The words take their own face; the page's is still the page's.
    expect(ink).toMatch(/font-family:'Gill Sans'/);
  });

  it('keeps the page’s face where the words name none', () => {
    const { file, partId } = withPart('about_the_author', 'She writes at night.');
    const part = partsOf(file).find((one) => one.id === partId)!;
    const style = partStyleOf(part);
    const set = updatePart(file, partId, { style: { ...style, face: 'garamond' } });
    expect(wordsOf(set, partId)).toMatch(/font-family:Garamond/);
  });
});

describe('the lines under a dedication’s words', () => {
  it('carry a style of their own, which no screen could reach', () => {
    /**
     * On a dedication everything the dialog offered wrote `title` — the first
     * line — and every line after it took the schema's defaults with nothing
     * able to reach them. The record held the answer all along; what was
     * missing was that the words after the first are a line of type too.
     */
    const { file, partId } = withPart('dedication', 'For Mara.\n— and for the lighthouse');
    const part = partsOf(file).find((one) => one.id === partId)!;
    const style = partStyleOf(part);
    const set = updatePart(file, partId, {
      style: { ...style, line: { ...style.line, align: 'right', size: 9 } },
    });
    const vars = partStyleOf(partsOf(set).find((one) => one.id === partId)!);
    expect(vars.line.align).toBe('right');
    expect(vars.line.size).toBe(9);
    // And the page's own alignment is untouched by it: two questions, two
    // answers, which is what the stylesheet's fallback chain says.
    expect(vars.align).toBe(partStyleOf(part).align);
  });
});
