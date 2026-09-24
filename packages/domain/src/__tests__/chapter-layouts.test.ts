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
  chapterLayoutOf,
  setChapterLayout,
  setChapterPageStyle,
  setFirstLine,
  sinkInches,
  sinkOf,
  bookSettingsOf,
  geometryOf,
  renderBookPage,
  type ChapterLayoutId,
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
    expect(chapterLayoutOf(file, null)).toBe('mid');
    expect(chapterLayoutOf(setChapterPageStyle(file, { template: 'graphic_bottom' }), null)).toBe('bottom');
    expect(chapterLayoutOf(setChapterPageStyle(file, { template: 'full_page' }), null)).toBe('art');
  });

  it('lets a chapter’s own template beat the book’s, as it always did', () => {
    let file = setChapterPageStyle(novel(), { template: 'graphic_top' });
    const marker = file.markers[0]!;
    file = { ...file, markers: file.markers.map((one) => (one.id === marker.id ? { ...one, page: { ...(one.page ?? {}), template: 'graphic_bottom' } } : one)) };
    expect(chapterLayoutOf(file, file.markers[0]!)).toBe('bottom');
    expect(chapterLayoutOf(file, file.markers[1]!)).toBe('top');
  });

  it('clears the template when a layout is set, so the two cannot disagree', () => {
    const file = setChapterLayout(setChapterPageStyle(novel(), { template: 'graphic_bottom' }), null, 'left');
    expect(chapterPageStyleOf(file).layout).toBe('left');
    expect(chapterLayoutOf(file, null)).toBe('left');
    for (const marker of file.markers) expect((marker.page as { layout?: unknown } | undefined)?.layout ?? null).toBeNull();
  });
});

describe('this chapter, or every chapter', () => {
  it('gives one chapter its own layout without touching the others', () => {
    const before = novel();
    const file = setChapterLayout(before, before.markers[0]!.id, 'epi');
    expect(chapterLayoutOf(file, file.markers[0]!)).toBe('epi');
    // The other chapter, and the book itself, are untouched.
    expect(chapterLayoutOf(file, file.markers[1]!)).toBe('mid');
    expect(chapterLayoutOf(file, null)).toBe('mid');
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
    expect(chapterLayoutOf(all, all.markers[0]!)).toBe('classic');
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

/**
 * What the print draws (§14). The slot walk is what makes *adding a layout
 * needs only an entry* true, so these pin the pieces rather than the CSS.
 */
describe('the print walks the slots', () => {
  const chapter = {
    label: 'IV',
    title: 'The Letter',
    epigraph: 'A line that sets the tone.',
    summary: '',
    image: { dataUrl: 'data:image/png;base64,AA', name: 'Device', width: 45 },
    align: 'center' as const,
    template: 'graphic_middle' as const,
  };
  const book = createProjectFile({ title: 'X', format: 'novel' });
  const settings = bookSettingsOf(book);
  const context = {
    settings,
    geometry: geometryOf(settings, 'novel', 200),
    chapterStyle: chapterPageStyleOf(book),
    paragraphStyle: 'indented' as const,
    pictures: new Map(),
    names: { title: 'X', author: 'A', imprint: '' },
    titlePage: { title: '', author: '', imprint: '', lines: [] },
    contents: [],
    index: null,
  } as never;
  const leaf = (layout: ChapterLayoutId) =>
    renderBookPage(
      { sheet: 1, blank: false, display: true, folio: '', counted: '1', running: '', pieces: [{ blockId: 'c1', from: 0, to: 1 }] } as never,
      new Map([['c1', { id: 'c1', kind: 'chapter_opening', leaf: true, chapter: { ...chapter, layout }, spans: [], text: '' }]]) as never,
      context,
    );

  it('puts the device over the heading, under it, or at the foot', () => {
    const top = leaf('top');
    const bottom = leaf('bottom');
    expect(top.indexOf('bk-chapter-device')).toBeLessThan(top.indexOf('bk-chapter-head'));
    expect(bottom.indexOf('bk-chapter-device')).toBeGreaterThan(bottom.indexOf('bk-chapter-head'));
  });

  it('keeps the number and the name in one heading block, as they always were', () => {
    // The four older layouts must emit byte for byte what they did, which is
    // why the walk puts the whole head where it meets the number slot.
    expect(leaf('mid')).toContain('<div class="bk-chapter-head"><p class="bk-chapter-label">IV</p><p class="bk-chapter-title">The Letter</p></div>');
  });

  it('prints an epigraph the writer typed under every layout, not only the epigraph one', () => {
    // A layout that dropped it would lose their words for a reason nobody
    // asked for; what `epi` changes is how it is set, never whether.
    for (const id of ['classic', 'top', 'mid', 'bottom', 'left'] as ChapterLayoutId[]) {
      expect(leaf(id)).toContain('A line that sets the tone.');
      expect(leaf(id)).not.toContain('bk-epigraph-apart');
    }
    expect(leaf('epi')).toContain('bk-epigraph-apart');
  });

  it('shows the number alone on a numeral-only page', () => {
    expect(leaf('bignum')).toContain('IV');
    expect(leaf('bignum')).not.toContain('The Letter');
  });

  it('sets a rule between the number and the name on a flush-left opening', () => {
    const left = leaf('left');
    expect(left.indexOf('bk-chapter-slot-rule')).toBeGreaterThan(left.indexOf('bk-chapter-label'));
    expect(left.indexOf('bk-chapter-slot-rule')).toBeLessThan(left.indexOf('bk-chapter-title'));
    expect(leaf('classic')).not.toContain('bk-chapter-slot-rule');
  });
});

describe('the chapter’s first line', () => {
  const book = createProjectFile({ title: 'X', format: 'novel' });
  const settings = bookSettingsOf(book);
  const para = (text: string) => ({ id: 'p1', kind: 'paragraph', text, spans: [], opensChapter: true });
  const set = (firstLine: 'drop_cap' | 'lead_in' | 'plain', text: string, spans: unknown[] = []) =>
    renderBookPage(
      { sheet: 1, blank: false, folio: '1', counted: '1', running: '', pieces: [{ blockId: 'p1', from: 0, to: 9 }] } as never,
      new Map([['p1', { ...para(text), spans }]]) as never,
      {
        settings,
        geometry: geometryOf(settings, 'novel', 200),
        chapterStyle: { ...chapterPageStyleOf(book), firstLine },
        paragraphStyle: 'indented' as const,
        pictures: new Map(),
        names: { title: 'X', author: 'A', imprint: '' },
        titlePage: { title: '', author: '', imprint: '', lines: [] },
        contents: [],
        index: null,
      } as never,
    );

  it('floats the first letter, and the rest of the words are untouched', () => {
    const out = set('drop_cap', 'The rain had not let up for three days.');
    expect(out).toContain('<span class="bk-drop-cap">T</span>he rain had not let up');
  });

  it('takes the quotation mark with the letter, so the quote is not the cap', () => {
    expect(set('drop_cap', '“The rain had stopped.”')).toContain('<span class="bk-drop-cap">“T</span>he rain');
  });

  it('sets the opening words in small capitals, five of them', () => {
    const out = set('lead_in', 'The rain had not let up for three days.');
    expect(out).toContain('<span class="bk-lead-in">The rain had not let</span> up for three days.');
  });

  it('keeps the marking on what is left after the cut', () => {
    // A chapter opening on an italic phrase keeps it italic past the cap.
    const spans = [{ text: 'The rain', italic: true }, { text: ' had stopped.' }];
    const out = set('drop_cap', 'The rain had stopped.', spans);
    expect(out).toContain('<span class="bk-drop-cap">T</span><i>he rain</i> had stopped.');
  });

  it('does nothing at all where the book asks for neither', () => {
    const out = set('plain', 'The rain had not let up for three days.');
    expect(out).not.toContain('bk-drop-cap');
    expect(out).not.toContain('bk-lead-in');
    expect(out).toContain('The rain had not let up for three days.');
  });
});
