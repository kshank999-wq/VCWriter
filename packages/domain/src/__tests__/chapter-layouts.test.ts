import { describe, expect, it } from 'vitest';
import {
  CHAPTER_LAYOUTS,
  CHAPTER_SINKS,
  GRAPHIC_SIZES,
  addMarker,
  addUnit,
  chapterLayout,
  chaptersOverriding,
  chapterPageStyleOf,
  createProjectFile,
  describeApplyToAll,
  firstLineOf,
  graphicSizeOf,
  layoutOf,
  setChapterLayout,
  setChapterPageStyle,
  setFirstLine,
  sinkInches,
  sinkOf,
  type ProjectFile,
} from '../index.js';

/**
 * The chapter opening layout (addendum 20 §14, from Ken's own handoff). The
 * two things worth pinning are that **an existing book reads as the layout it
 * already is** and that **the named steps are read back rather than stored**.
 */

/** A novel of two chapters. */
const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });
  file = addMarker(file, { unitId: file.units[0]!.id, kind: 'chapter', title: 'The Road' }).file;
  const two = addUnit(file, { trackId: file.tracks[0]!.id, title: 'Second' });
  file = addMarker(two.file, { unitId: two.unit.id, kind: 'chapter', title: 'The Lane' }).file;
  return file;
};

describe('the layouts are data', () => {
  it('gives every layout a slot list, so a new one is an entry and no code', () => {
    for (const layout of CHAPTER_LAYOUTS) {
      expect(layout.slots.length).toBeGreaterThan(0);
      expect(layout.name.length).toBeGreaterThan(0);
      // A layout that says where a graphic goes must have a slot for it, or
      // the print would walk a list with nowhere to put the picture.
      if (layout.graphic) expect(layout.slots).toContain('graphic');
      else expect(layout.slots).not.toContain('graphic');
    }
  });

  it('keeps a page of art apart from a bleeding header', () => {
    // Two different things, and the book has drawn the first since
    // `full_page`: a band across the top is not a picture that is the page.
    expect(chapterLayout('full').graphic).toBe('bleed');
    expect(chapterLayout('art').graphic).toBe('page');
    expect(chapterLayout('art').slots).toEqual(['graphic']);
    expect(chapterLayout('full').slots).toContain('title');
  });

  it('shows the number alone where the layout says so', () => {
    expect(chapterLayout('bignum').hideTitle).toBe(true);
    expect(chapterLayout('bignum').slots).not.toContain('title');
    expect(chapterLayout('bignum').numberScale).toBe('display');
  });
});

describe('the older spelling', () => {
  it('reads a book that only ever stored where its graphic goes', () => {
    const file = novel();
    // Nothing has set a layout: the template is the answer, so the book
    // draws exactly as it did.
    expect(chapterPageStyleOf(file).layout).toBeNull();
    expect(layoutOf(file, null)).toBe('mid');
    expect(layoutOf(setChapterPageStyle(file, { template: 'graphic_bottom' }), null)).toBe('bottom');
    expect(layoutOf(setChapterPageStyle(file, { template: 'full_page' }), null)).toBe('art');
  });

  it('lets a chapter’s own template beat the book’s, as it always did', () => {
    let file = setChapterPageStyle(novel(), { template: 'graphic_top' });
    const marker = file.markers[0]!;
    file = { ...file, markers: file.markers.map((one) => (one.id === marker.id ? { ...one, page: { ...(one.page ?? {}), template: 'graphic_bottom' } } : one)) };
    expect(layoutOf(file, file.markers[0]!)).toBe('bottom');
    expect(layoutOf(file, file.markers[1]!)).toBe('top');
  });

  it('clears the template when a layout is set, so the two cannot disagree', () => {
    const file = setChapterLayout(setChapterPageStyle(novel(), { template: 'graphic_bottom' }), null, 'left');
    expect(chapterPageStyleOf(file).layout).toBe('left');
    expect(layoutOf(file, null)).toBe('left');
    for (const marker of file.markers) expect((marker.page as { layout?: unknown } | undefined)?.layout ?? null).toBeNull();
  });
});

describe('this chapter, or every chapter', () => {
  it('gives one chapter its own layout without touching the others', () => {
    const before = novel();
    const file = setChapterLayout(before, before.markers[0]!.id, 'epi');
    expect(layoutOf(file, file.markers[0]!)).toBe('epi');
    // The other chapter, and the book itself, are untouched.
    expect(layoutOf(file, file.markers[1]!)).toBe('mid');
    expect(layoutOf(file, null)).toBe('mid');
  });

  it('says what applying to every opener would clear, before it is pressed', () => {
    const plain = novel();
    expect(chaptersOverriding(plain)).toHaveLength(0);
    expect(describeApplyToAll(plain, 'classic')).toMatch(/None of them is set on its own/);

    const one = setChapterLayout(plain, plain.markers[0]!.id, 'epi');
    expect(chaptersOverriding(one)).toHaveLength(1);
    expect(describeApplyToAll(one, 'classic')).toMatch(/One chapter is set on their own, and that goes/);

    // And applying to all really does clear it.
    const all = setChapterLayout(one, null, 'classic');
    expect(chaptersOverriding(all)).toHaveLength(0);
    expect(layoutOf(all, all.markers[0]!)).toBe('classic');
  });
});

describe('the named steps are read back', () => {
  it('turns a sink into inches, and inches back into a sink', () => {
    const page = 9;
    for (const step of CHAPTER_SINKS) {
      const inches = sinkInches(step.id, page);
      expect(sinkOf(inches, page)).toBe(step.id);
    }
    // A depth the writer typed is none of the three, rather than the nearest
    // one — a button lit over a page that prints something else is a lie.
    expect(sinkOf(1.5, page)).toBeNull();
  });

  it('lands a sink on a sixteenth, so a drop can be said as a fraction', () => {
    for (const step of CHAPTER_SINKS) expect((sinkInches(step.id, 9) * 16) % 1).toBe(0);
  });

  it('reads a graphic width back as S, M, L, or none of them', () => {
    for (const size of GRAPHIC_SIZES) expect(graphicSizeOf(size.share)).toBe(size.id);
    expect(graphicSizeOf(33)).toBeNull();
  });
});

describe('the first line', () => {
  it('starts as what every book has always printed', () => {
    expect(firstLineOf(novel())).toBe('plain');
  });

  it('is the book’s and not a chapter’s', () => {
    const file = setFirstLine(novel(), 'drop_cap');
    expect(firstLineOf(file)).toBe('drop_cap');
    // There is nowhere on a chapter's page to disagree with it.
    for (const marker of file.markers) expect(marker.page).not.toHaveProperty('firstLine');
  });
});
