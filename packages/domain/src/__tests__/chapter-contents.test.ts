import { describe, expect, it } from 'vitest';
import {
  addUnit,
  chapterContents,
  chapterContentsHeading,
  chapterLeafContent,
  chapterPageStyleOf,
  chapterStyleVars,
  createProjectFile,
  defaultContentsHeading,
  describeChapterContents,
  moveUnit,
  placedMarkers,
  setChapterPageStyle,
  startDivision,
  unitsInStoryOrder,
  updateUnit,
  type ProjectFile,
  type StoryMarkerId,
} from '../index.js';
import { CHAPTER_LAYOUTS, CHAPTER_SLOTS } from '../chapter-layouts.js';
import { CHAPTER_STYLES } from '../print-book.js';

/**
 * **What the chapter covers, read off the book** (addendum 36, from Ken: *for
 * the instructional book, there can be for each chapter a title page that
 * allows you to outline what's in the chapter and add text such as what
 * you'll be covering*).
 *
 * The *add text* half shipped with addendum 19 §7 — `page.summary`, a box on
 * the chapter page's own dialog. What was missing is the outline: the
 * chapter's own sections, listed on the page that opens it.
 */

/** A textbook with one chapter over three named sections. */
const book = (): { file: ProjectFile; chapter: StoryMarkerId } => {
  let file = createProjectFile({ title: 'Mathematics', format: 'instructional' });
  const seed = file.units[0]!;
  const track = file.tracks[0]!.id;
  file = updateUnit(file, seed.id, { title: 'What light is' });
  for (const title of ['Reflection', 'Refraction']) {
    file = addUnit(file, { trackId: track, title }).file;
  }
  file = startDivision(file, seed.id, 'Light');
  return { file, chapter: placedMarkers(file)[0]!.marker.id };
};

const said = (file: ProjectFile, chapter: StoryMarkerId): string[] =>
  chapterContents(file, chapter).map((line) => `${line.number} ${line.title}`);

describe('a chapter opening lists its own sections', () => {
  it('reads the sections under the chapter, with the numbers the book prints', () => {
    const { file, chapter } = book();
    expect(chapterContents(file, chapter)).toEqual([
      { number: '1.1', title: 'What light is' },
      { number: '1.2', title: 'Reflection' },
      { number: '1.3', title: 'Refraction' },
    ]);
  });

  it('renumbers itself when a section moves, with nothing run', () => {
    const { file, chapter } = book();
    const order = unitsInStoryOrder(file);
    // The last section dragged up one. The list is a reading, so it comes
    // back in the book's new order under its new numbers.
    const moved = moveUnit(file, { unitId: order[2]!.id, toTrackId: order[2]!.trackId, index: 1 });
    expect(said(moved, chapter)).toEqual(['1.1 What light is', '1.2 Refraction', '1.3 Reflection']);
  });

  it('drops a section dragged out of the chapter altogether', () => {
    const { file, chapter } = book();
    const order = unitsInStoryOrder(file);
    // Above the chapter's own first section is outside the chapter — the
    // span is `divisionSpan`'s, and a unit before the first chapter carries
    // no number at all (addendum 19 §6). So the opening stops listing it,
    // which is the half a stored list could never get right.
    const out = moveUnit(file, { unitId: order[2]!.id, toTrackId: order[2]!.trackId, index: 0 });
    expect(said(out, chapter)).toEqual(['1.1 What light is', '1.2 Reflection']);
  });

  it('renames a line by renaming the section, there being no second record', () => {
    const { file, chapter } = book();
    const renamed = updateUnit(file, unitsInStoryOrder(file)[1]!.id, { title: 'Mirrors' });
    expect(chapterContents(renamed, chapter)[1]).toEqual({ number: '1.2', title: 'Mirrors' });
  });

  it('lists nothing where the book does not number its sections', () => {
    // `structureNumbers` is empty off an instructional book and where the
    // numbering is switched off — the same answer the contents page gives.
    const { file, chapter } = book();
    const off: ProjectFile = { ...file, settings: { ...file.settings, sectionNumbering: 'none' } };
    expect(chapterContents(off, chapter)).toEqual([]);
    expect(describeChapterContents(off, chapter)).toContain('does not number');
  });
});

describe('what goes on the page', () => {
  it('carries nothing until the book asks for a list', () => {
    const { file, chapter } = book();
    const placed = placedMarkers(file).find((one) => one.marker.id === chapter)!;
    // Off by default, so a book already set is laid exactly as it was.
    expect(chapterPageStyleOf(file).showContents).toBe(false);
    expect(chapterLeafContent(file, placed).contents).toEqual([]);

    const asked = setChapterPageStyle(file, { showContents: true });
    const after = placedMarkers(asked).find((one) => one.marker.id === chapter)!;
    expect(chapterLeafContent(asked, after).contents).toHaveLength(3);
  });

  it('says what a tick would put on the page, naming the sections rather than counting them', () => {
    const { file, chapter } = book();
    const sentence = describeChapterContents(file, chapter);
    expect(sentence).toContain('1.1 What light is');
    expect(sentence).toContain('1.3 Refraction');
  });

  it('is the book’s decision and not one page’s', () => {
    // `firstLine`'s own rule: a convention, so there is no per-chapter field
    // to disagree with it — a book where chapter four alone lists what it
    // covers has a mistake in it rather than a design.
    const { file } = book();
    const page = file.markers[0]!.page as unknown as Record<string, unknown>;
    expect(page).not.toHaveProperty('showContents');
    expect(page).not.toHaveProperty('contents');
  });
});

describe('the words over the list', () => {
  it('are the format’s own where nobody has typed any', () => {
    // §3 refused a heading because *In this chapter* would be words this
    // program wrote into somebody's book. Ken overruled it, and the words are
    // his: a box he types in, with the format's own as the default rather
    // than as the only answer. Nothing names a unit itself.
    const { file } = book();
    expect(defaultContentsHeading('instructional')).toBe('In this chapter');
    expect(chapterContentsHeading(file)).toBe('In this chapter');
  });

  it('are the writer’s the moment they type any', () => {
    const { file } = book();
    const typed = setChapterPageStyle(file, { contentsWords: 'What you will cover' });
    expect(chapterContentsHeading(typed)).toBe('What you will cover');
    // And clearing the box gives the default back rather than a blank line:
    // `settings.titlePage`'s shape, so there are not two ways to say nothing.
    expect(chapterContentsHeading(setChapterPageStyle(typed, { contentsWords: '   ' }))).toBe('In this chapter');
  });

  it('take the page’s alignment, which is the chapter title’s', () => {
    // From Ken: *make the heading alignment match the chapter title*. A
    // heading is a label like the title above it, where the summary below it
    // is reading matter and a centred paragraph is wrong — so the line
    // carries no alignment of its own and the stylesheet falls back to the
    // page's rather than to a direction it chose.
    const { file } = book();
    expect(chapterPageStyleOf(file).contentsHead.align).toBeNull();
    const vars = chapterStyleVars(chapterPageStyleOf(file));
    expect(vars['--chapter-contentsHead-align']).toBeUndefined();
    expect(CHAPTER_STYLES).toContain('var(--chapter-contentsHead-align, inherit)');
    // And the entries keep their own left, a list of numbered rows being a
    // list rather than a line of type over one.
    expect(CHAPTER_STYLES).toContain('var(--chapter-contents-align, left)');
  });

  it('come off altogether at a tick, and the typing survives it', () => {
    // §9 named a bare list as deliberately absent because an empty box that
    // printed nothing and an empty box that printed *In this chapter* are two
    // states that look alike. A tick is not that, so the reason is answered
    // rather than overruled.
    const { file, chapter } = book();
    const typed = setChapterPageStyle(file, {
      showContents: true,
      contentsWords: 'What you will cover',
    });
    const bare = setChapterPageStyle(typed, { showContentsHead: false });
    expect(chapterContentsHeading(bare)).toBe('');

    // The list is untouched: it is the heading that goes, not the contents.
    const placed = placedMarkers(bare).find((one) => one.marker.id === chapter)!;
    expect(chapterLeafContent(bare, placed).contents).toHaveLength(3);
    expect(chapterLeafContent(bare, placed).contentsHeading).toBe('');

    // Switching it back is one press rather than a retype.
    expect(chapterContentsHeading(setChapterPageStyle(bare, { showContentsHead: true }))).toBe(
      'What you will cover',
    );
  });

  it('are on by default, so no page already set moves', () => {
    const { file } = book();
    expect(chapterPageStyleOf(file).showContentsHead).toBe(true);
  });

  it('ride on the page with the list', () => {
    const { file, chapter } = book();
    const asked = setChapterPageStyle(file, { showContents: true, contentsWords: 'What you will cover' });
    const placed = placedMarkers(asked).find((one) => one.marker.id === chapter)!;
    expect(chapterLeafContent(asked, placed).contentsHeading).toBe('What you will cover');
  });
});

describe('every layout that has a body carries the slot', () => {
  it('stands under the summary and above the body', () => {
    expect(CHAPTER_SLOTS).toContain('contents');
    for (const layout of CHAPTER_LAYOUTS) {
      if (!layout.slots.includes('body')) continue;
      const at = layout.slots.indexOf('contents');
      expect(at, `${layout.id} carries the slot`).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(layout.slots.indexOf('summary'));
      expect(at).toBeLessThan(layout.slots.indexOf('body'));
    }
  });

  it('leaves a page of art alone, the picture being the page', () => {
    const art = CHAPTER_LAYOUTS.find((one) => one.id === 'art')!;
    expect(art.slots).toEqual(['graphic']);
  });
});
