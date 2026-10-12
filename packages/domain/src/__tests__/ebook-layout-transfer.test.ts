import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  bookSettingsOf,
  chapterPageStyleOf,
  createProjectFile,
  ebookCss,
  ebookMargins,
  ebookOf,
  geometryOf,
  partStyleOf,
  partsOf,
  previewDocument,
  proseStyleBase,
  PREVIEW_DEVICES,
  setBookSettings,
  setParagraphStyle,
  trimOf,
  unitsInStoryOrder,
  updateBeat,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **The Layout room reaches the eBook** (addendum 23 §12, from Ken: *I'm
 * looking at the ebook and the formatting is all messed up compared to what
 * the layout has. The margins are right at the edge and things are skewed.
 * But the pictures aren't right to the edge. So please check the top margins.
 * And make sure that the layout transfers to the ebook*).
 *
 * Measured in a 412-pixel reading pane before a line was written: the body
 * carried **no top padding at all** and 12 pixels at the sides, the text was
 * **justified** in a book the writer had ranged left, and it was set in Times
 * New Roman in a book set in Garamond. The pictures looked better only
 * because a picture narrower than the measure sits centred — which is how he
 * could see the page had room the text was not using.
 *
 * What this pins is the **line between the page and the type**: a trim cannot
 * survive reflow and a proportion can, a point size cannot survive the
 * reader's own size and a ratio to the body can.
 */

const para = (text: string) => ({
  id: crypto.randomUUID() as never,
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const novel = (): ProjectFile => {
  let file = createProjectFile({ title: 'The Lamp', format: 'novel', author: 'K. Shank' });
  const track = file.tracks[0]!;
  const first = unitsInStoryOrder(file)[0]!;
  file = addMarker(file, { unitId: first.id, title: 'The Road', kind: 'chapter' }).file;
  const beat = addBeat(file, { unitId: first.id, title: 'one' });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [para('The lamp burned low. '.repeat(40))] } as never,
  });
  const second = addUnit(file, { trackId: track.id, title: 'The Return', index: 1 });
  file = second.file;
  file = addMarker(file, { unitId: second.unit.id, title: 'The Return', kind: 'chapter' }).file;
  const next = addBeat(file, { unitId: second.unit.id, title: 'two' });
  return updateBeat(next.file, next.beat.id, { manuscript: { elements: [para('Wind. '.repeat(40))] } as never });
};

/** A novel set the way a writer sets one, rather than at every default. */
const set = (file: ProjectFile): ProjectFile =>
  setBookSettings(file, {
    trim: { width: 5.5, height: 8.5 },
    face: 'garamond',
    size: 11,
    justify: false,
    hyphenate: true,
  });

describe('the margins, which are a proportion', () => {
  it('gives the sides the share of the page the book gives its fore-edge', () => {
    const file = set(novel());
    const settings = bookSettingsOf(file);
    const { margins } = geometryOf(settings, file.project.format, 1);
    const trim = trimOf(settings, file.project.format);
    const share = (margins.outside / trim.width) * 100;
    expect(ebookMargins(file).side).toBe(`${share.toFixed(2)}%`);
    // Measured: a tenth of the page a side, where the sheet had 3%.
    expect(share).toBeGreaterThan(9);
  });

  it('gives the head and the foot air at all, said in the body’s own type', () => {
    /**
     * **The report's own sentence** — *please check the top margins* — and it
     * was nought: `padding: 0 3%` has no vertical component, so a section
     * began hard against the top of the screen.
     *
     * The unit is ems because a percentage padding resolves against the
     * **width** even at the top (addendum 20 §9g), so a share of the height
     * said as a percentage would be a number about the wrong axis.
     */
    const file = set(novel());
    const margins = ebookMargins(file);
    expect(margins.head).toMatch(/em$/);
    expect(margins.foot).toMatch(/em$/);
    expect(Number.parseFloat(margins.head)).toBeGreaterThan(1);
    const css = ebookCss(file);
    expect(css).toContain(`padding: ${margins.head} ${margins.side} ${margins.foot}`);
  });

  it('reads the fore-edge and never the gutter, so the page count cannot reach it', () => {
    /**
     * A screen has no binding, and the inside margin is the one that walks
     * its band with how thick the book is (§3b) — so the eBook takes the
     * **outside** margin for both sides and nothing here depends on a page
     * count a reflowable book does not have.
     */
    const file = set(novel());
    const settings = bookSettingsOf(file);
    const trim = trimOf(settings, file.project.format);
    const { margins } = geometryOf(settings, file.project.format, 400);
    // The gutter at four hundred pages is wider than the fore-edge…
    expect(margins.inside).toBeGreaterThan(margins.outside);
    // …and the eBook's side is still the fore-edge.
    expect(ebookMargins(file).side).toBe(`${((margins.outside / trim.width) * 100).toFixed(2)}%`);
  });
});

describe('the switches the writer set', () => {
  it('ranges the text the way the book ranges it, rather than always justifying', () => {
    // *Things are skewed*: justified text in a book ranged left, which on a
    // narrow column is stretched word spacing.
    expect(ebookCss(set(novel()))).toContain('text-align: left');
    expect(ebookCss(setBookSettings(novel(), { justify: true }))).toContain('text-align: justify');
  });

  it('carries the hyphenation, in the spellings a reading system knows', () => {
    const on = ebookCss(setBookSettings(novel(), { hyphenate: true }));
    expect(on).toContain('hyphens: auto');
    expect(on).toContain('-epub-hyphens: auto');
    expect(ebookCss(setBookSettings(novel(), { hyphenate: false }))).toContain('hyphens: manual');
  });

  it('blocks the paragraphs where the book blocks them, rather than always indenting', () => {
    /**
     * A book setting since spec §6.4, honoured on the page by `.bk-blocked`
     * and ignored by the eBook — so a writer who set blocked paragraphs got
     * somebody else's book back.
     */
    expect(ebookCss(novel())).toContain('text-indent: 1.5em');
    const blocked = ebookCss(setParagraphStyle(novel(), 'blocked'));
    expect(blocked).toContain('text-indent: 0');
    expect(blocked).toContain('margin: 0 0 1em');
  });

  it('names the book’s face, which was the reader’s default and nothing else', () => {
    const css = ebookCss(set(novel()));
    expect(css).toMatch(/font-family: Garamond/);
    // And the body's **size** is still the reader's: nothing sets one.
    expect(css).not.toMatch(/body \{[^}]*font-size/);
  });
});

describe('the type of a designed page', () => {
  /** A foreword the writer has set: a small-caps heading and italic words. */
  const withForeword = (): { file: ProjectFile; partId: string } => {
    let file = set(addPart(novel(), 'foreword', { text: 'Before we begin.' }).file);
    const part = partsOf(file).find((one) => one.kind === 'foreword')!;
    const base = proseStyleBase(chapterPageStyleOf(file), bookSettingsOf(file).size);
    const style = partStyleOf(part, base);
    file = updatePart(file, part.id, {
      style: {
        ...style,
        title: { ...style.title, size: 22, case: 'small_caps', tracking: 12 },
        line: { ...style.line, size: 9, italic: true, align: 'right' },
      },
    });
    return { file, partId: part.id };
  };

  const sectionOf = (file: ProjectFile, match: RegExp): string => {
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    const section = pkg.sections.find((one) => match.test(one.title))!;
    const entry = pkg.entries.find((one) => one.path === `OEBPS/${section.href}`)!;
    return entry.data as string;
  };

  it('says every size as a share of the body, so the reader’s size still rules', () => {
    const { file } = withForeword();
    const html = sectionOf(file, /foreword/i);
    // 22pt in an 11pt book is twice the body, not twenty-two of anything.
    expect(html).toContain('font-size:2.000em');
    // And the words at nine point are a shade under it.
    expect(html).toContain('font-size:0.818em');
    expect(html).not.toMatch(/font-size:\d+pt/);
  });

  it('carries the case, the slope and the tracking the writer chose', () => {
    const { file } = withForeword();
    const html = sectionOf(file, /foreword/i);
    expect(html).toContain('font-variant:small-caps');
    expect(html).toContain('letter-spacing:0.12em');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('text-align:right');
  });

  it('leaves the story’s own paragraphs alone', () => {
    /**
     * The rule the whole transfer rests on, `blockStyle`'s own: a page of the
     * story carries no part style, so nothing is written onto it and it takes
     * the book's.
     */
    const { file } = withForeword();
    const chapter = sectionOf(file, /The Road/);
    expect(chapter).toContain('<p class="p first');
    expect(chapter).not.toMatch(/<p class="p[^"]*" style=/);
  });
});

describe('the preview draws the file rather than a second idea of it', () => {
  it('takes the book’s own margins onto the columns', () => {
    /**
     * The pagination is CSS columns, where a padding on the container falls
     * outside **all** of them — so the body's padding has to be lifted onto
     * the children, and the numbers lifted are the stylesheet's. It used to
     * invent 5% and shrink every picture to 90%, which is the preview
     * disagreeing with the file it exists to show.
     */
    const file = set(novel());
    const pkg = ebookOf(file, { modified: '2026-01-01T00:00:00Z' });
    const device = PREVIEW_DEVICES[0]!;
    const chapter = pkg.sections.find((one) => one.title === 'The Road')!;
    const html = previewDocument(pkg, chapter.href, device, 1)!;
    expect(pkg.margins).not.toBeNull();
    expect(html).toContain(`padding-left: ${pkg.margins!.side}`);
    expect(html).toContain(`padding-top: ${pkg.margins!.head}`);
    expect(html).not.toContain('padding-left: 5%');
    // The one cap left is the device's: a picture taller than the screen.
    expect(html).not.toContain('max-width: 90%');
    expect(html).toContain('max-height:');
  });
});

describe('what cannot travel is still said', () => {
  it('names the page as gone and the proportions as kept', () => {
    const pkg = ebookOf(set(novel()), { modified: '2026-01-01T00:00:00Z' });
    expect(pkg.log.join(' ')).toMatch(/reflowable book has no pages/);
    expect(pkg.log.join(' ')).toMatch(/proportions did/);
    expect(pkg.log.join(' ')).toMatch(/No font file was embedded/);
  });
});

describe('the stylesheet is a stylesheet', () => {
  it('closes every declaration, which is the fault only the page showed', () => {
    /**
     * **The fault of the day, caught by looking at the rendered file.** The
     * rule read `letter-spacing:0em text-align: center`, because a fragment
     * pasted into a rule was joined with `'; '` and nothing at the end — one
     * invalid declaration where there should have been two good ones, so the
     * chapter heading silently lost both its tracking and its centring and
     * opened ranged left in a book that centres its openings.
     *
     * Nothing in the suite could see it: the markup was right, the package
     * was valid, and EPUBCheck passed. So what is pinned is the **shape of
     * every rule in the sheet**, which is the one thing that would have.
     */
    const css = ebookCss(set(novel()));
    const bodies = [...css.matchAll(/\{([^}]*)\}/g)].map((one) => one[1] ?? '');
    expect(bodies.length).toBeGreaterThan(20);
    for (const body of bodies) {
      for (const declaration of body.split(';').map((one) => one.trim()).filter(Boolean)) {
        expect(declaration, `in rule { ${body.trim()} }`).toMatch(/^-?[a-z][a-z-]*\s*:\s*\S/);
        // One property per declaration: a second `name:` inside one is a
        // fragment that was pasted in without being closed.
        expect(declaration.replace(/\([^)]*\)/g, '').split(':').length, declaration).toBe(2);
      }
    }
  });
});
