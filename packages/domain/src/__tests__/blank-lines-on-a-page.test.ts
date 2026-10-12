import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addPart,
  bookBlocks,
  bookNames,
  bookSettingsOf,
  BOOK_STYLES,
  createProjectFile,
  ebookCss,
  ebookOf,
  geometryOf,
  layPages,
  partsOf,
  renderBookPage,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A line the writer left blank is a blank line** (addendum 20 §9as, from
 * Ken):
 *
 * > Something else in the function of when you go to design a page or any
 * > pages where you can add text, when you skip a line, it doesn't skip a
 * > line. Like if you hit enter and enter again, it should move the text down.
 *
 * **Measured in a browser before a line was written**, on his own shape — a
 * line, two Enters, another line: the markup was right and every empty
 * paragraph came back **nought pixels high**, `.bk-words p` being `margin: 0`
 * with no content to make a line box, so the lines sat seventeen pixels apart
 * however many times he pressed Enter. The eBook had the same decision in the
 * opposite shape and **dropped the blank line outright**, so one intention was
 * lost two different ways.
 *
 * What is pinned here is what each of them emits, because the height itself is
 * a browser's answer and these tests have no layout: the gap is a paragraph of
 * its own, named, and each stylesheet gives that name a line box.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as never,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** Exactly what Ken types: a line, Enter, Enter, a line, then a wider gap. */
const WORDS = 'FIRST LINE\n\nSECOND after one blank\n\n\nTHIRD after two blanks';

const book = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const first = unitsInStoryOrder(file)[0]!;
  const beat = addBeat(file, { unitId: first.id, title: 'One' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [para('Words. '.repeat(40))] } as never,
  });
  return addPart(file, 'dedication', { text: WORDS }).file;
};

const pageMarkup = (file: ProjectFile): string => {
  const blocks = bookBlocks(file);
  const settings = bookSettingsOf(file);
  const geometry = geometryOf(settings, 20);
  const laid = layPages(blocks, new Map(blocks.map((one) => [one.id, 1])), geometry, settings, bookNames(file));
  const part = partsOf(file).find((one) => one.kind === 'dedication')!;
  const block = blocks.find((one) => one.partId === part.id && one.kind === 'part_opening')!;
  const page = laid.pages.find((one) => one.pieces.some((piece) => piece.blockId === block.id))!;
  return renderBookPage(page, new Map(blocks.map((one) => [one.id, one])), {
    settings,
    geometry,
    names: bookNames(file),
    titlePage: file.settings.titlePage ?? ({} as never),
    pictures: new Map(),
    index: [],
    contents: [],
  });
};

describe('a blank line on a designed page', () => {
  it('is a paragraph of its own in the printed book, named so the sheet can give it height', () => {
    const html = pageMarkup(book());
    // One blank line, then two: three gaps in all, in the writer's own order.
    expect(html.match(/bk-words-gap/g) ?? []).toHaveLength(3);
    expect(html).toContain('<p class="bk-words-gap"></p>');
    // And the words are still the words, in order, around them.
    const order = [...html.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map((one) => one[1]);
    expect(order).toEqual(['FIRST LINE', '', 'SECOND after one blank', '', '', 'THIRD after two blanks']);
  });

  it('carries no character of its own into the writer’s words', () => {
    /**
     * **Generated content rather than a space.** A zero-width space written
     * into the markup would be in the book's text, in a search and in the
     * eBook's own text, for a line that is supposed to be nothing at all — so
     * the gap paragraph is empty and the stylesheet makes the line box.
     */
    const html = pageMarkup(book());
    expect(html).not.toContain('&nbsp;');
    expect(html).not.toContain('​');
    expect(BOOK_STYLES).toContain('.bk-words p.bk-words-gap::before');
  });

  it('travels to the eBook, where it used to be dropped outright', () => {
    const file = book();
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    const section = pkg.sections.find((one) => /dedication/i.test(one.title) || /dedication/i.test(one.id))!;
    const entry = pkg.entries.find((one) => one.path === `OEBPS/${section.href}`)!;
    const html = entry.data as string;
    expect(html.match(/<p class="gap">/g) ?? []).toHaveLength(3);
    expect(ebookCss(file)).toContain('p.gap::before');
  });

  it('drops a blank line at the very top or foot, which is the edge of a page', () => {
    /**
     * Air above the first words of a reflowable section is the reading
     * system's to decide, and a trailing blank is nothing at all — so what
     * travels is the gap **between** two lines the writer wrote.
     */
    let file = createProjectFile({ title: 'Edges', format: 'novel', author: 'K' });
    const first = unitsInStoryOrder(file)[0]!;
    const beat = addBeat(file, { unitId: first.id, title: 'One' });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para('Words. '.repeat(40))] } as never });
    file = addPart(file, 'dedication', { text: '\n\nOnly this.\n\n' }).file;
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    const section = pkg.sections.find((one) => /dedication/i.test(one.title) || /dedication/i.test(one.id))!;
    const html = pkg.entries.find((one) => one.path === `OEBPS/${section.href}`)!.data as string;
    expect(html).not.toContain('<p class="gap">');
    expect(html).toContain('Only this.');
  });
});
