import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookRows,
  bookSettingsOf,
  createProjectFile,
  divisionStart,
  geometryOf,
  layPages,
  pageRemoval,
  pagesUnder,
  removeBookPage,
  startDivision,
  storiesOf,
  unclaimedUnits,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A break you can make, and writing that is listed** (addendum 20 §9ab, from
 * Ken in three messages about one press):
 *
 * > And now we're back where we started, to where I took away the blank pages
 * > trying to put in a story page. And now the story is still there, but it
 * > now no longer shows up in the left menu bar.
 *
 * > And it no longer shows up in the tab to the right but the story is still
 * > there — each story needs to be held together, not merged with other
 * > stories.
 *
 * > In the menu, there's no way to add a chapter page, which might solve the
 * > problem.
 *
 * **Measured before a line was written.** The × on a story's own page answers
 * *the story break goes, its sections stay where they are, not a word is cut*
 * — which is honest, and §9x put that × on every page deliberately. What
 * nothing asked is whether anything could put the break **back**: not the
 * Layout rail, not the Add menu, and not the Stories rail, whose *+ New
 * story* makes a new empty section at the end and is a different act. So one
 * press took a story out of both rails with no way to the state before it.
 *
 * And it was **invisible**, which is why he could not describe it as a loss:
 * every reading that lists the book reads the markers, so sections ahead of
 * the first break had no row, while `pagesUnder` held their pages for the
 * **next** division — one story's pages listed under another's name.
 */

const para = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

const head = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'heading' as const,
  text,
  characterId: null,
  attributes: {},
});

/** Ken's book: a collection of stories, each divided into chapters. */
const collection = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'K. Shank' });
  const track = file.tracks[0]!.id;
  const story = (title: string, chapters: string[]) => {
    const ids: string[] = [];
    for (const chapter of chapters) {
      const made = addUnit(file, { trackId: track, title: chapter });
      file = made.file;
      ids.push(made.unit.id as string);
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title} ${chapter}` });
      file = updateBeat(beat.file, beat.beat.id, {
        manuscript: {
          elements: [head(chapter), ...[1, 2, 3].map((n) => para(`${title} ${chapter} para ${n}. ${'word '.repeat(80)}`))],
        } as never,
      });
    }
    file = addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title }).file;
  };
  story('In For A Pound', ['I.', 'II.']);
  story('Simple Pleasures', ['I.']);
  return addPart(file, 'contents', {}).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/** The press he made: the × on the first story's own page. */
const brokenByThatPress = (file: ProjectFile): ProjectFile => {
  const rows = lay(file).rows;
  const open = rows.find((row) => row.says === 'Chapter opens')!;
  return removeBookPage(file, open, pageRemoval(file, rows, open.sheet));
};

describe('the writing a division no longer claims', () => {
  it('is listed, rather than filed under the story that follows it', () => {
    const file = brokenByThatPress(collection());
    const rail = bookRows(file);
    const orphans = unclaimedUnits(file);
    expect(orphans.map((unit) => unit.title)).toContain('I.');
    expect(orphans.map((unit) => unit.title)).toContain('II.');
    // A row each, at depth 0: they are inside nothing, and that is the whole
    // fact about them.
    for (const unit of orphans) {
      const row = rail.find((one) => one.id === (unit.id as string));
      expect(row).toBeTruthy();
      expect(row!.depth).toBe(0);
    }
  });

  it('keeps its own pages rather than lending them to the next story', () => {
    const file = brokenByThatPress(collection());
    const { rows } = lay(file);
    const rail = bookRows(file);
    const under = pagesUnder(rail, rows);
    const second = rail.find((row) => row.kind === 'chapter')!;
    const orphan = unclaimedUnits(file).find((unit) => unit.title === 'I.')!;
    expect((under.get(orphan.id as string) ?? []).length).toBeGreaterThan(0);
    // Simple Pleasures keeps only what is written in it — which before §9ab
    // was its own pages and the whole of In For A Pound's as well.
    const held = under.get(second.id) ?? [];
    for (const page of held) expect(page.markerId).toBe(second.id);
  });

  it('says nothing at all about a book that was never divided', () => {
    // The rule answers only where the book has divisions. A novel nobody has
    // broken into chapters is the story, and listing every section as
    // unclaimed would invent a complaint about a book that is fine.
    let plain = createProjectFile({ title: 'The Lamp', format: 'novel' });
    const beat = addBeat(plain, { unitId: unitsInStoryOrder(plain)[0]!.id, title: 'b' });
    plain = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [para('Words.')] } as never });
    expect(unclaimedUnits(plain)).toHaveLength(0);
  });
});

describe('starting a division', () => {
  it('is offered on the page that writing opens on, and says what it would gather', () => {
    const file = brokenByThatPress(collection());
    const orphan = unclaimedUnits(file).find((unit) => unit.title === 'I.')!;
    const offer = divisionStart(file, orphan.id);
    expect(offer.refusal).toBeNull();
    expect(offer.act).toBe('Start a story here…');
    // The format's own noun, and the count read the way `divisionSpan` reads
    // it — before the marker exists.
    expect(offer.comfort).toMatch(/2 sections/);
    expect(offer.comfort).toMatch(/one story/);
    expect(offer.comfort).toMatch(/Not a word is cut/);
  });

  it('puts the story back, with its sections under it', () => {
    const file = brokenByThatPress(collection());
    const orphan = unclaimedUnits(file).find((unit) => unit.title === 'I.')!;
    expect(storiesOf(file)).toHaveLength(1);
    const back = startDivision(file, orphan.id, 'In For A Pound');
    expect(storiesOf(back)).toHaveLength(2);
    const rail = bookRows(back);
    const story = rail.find((row) => row.kind === 'chapter' && row.title === 'In For A Pound');
    expect(story).toBeTruthy();
    // Its sections are under it again rather than standing loose.
    expect(rail.filter((row) => row.kind === 'section' && row.depth === 1).length).toBeGreaterThan(1);
    expect(unclaimedUnits(back).map((unit) => unit.title)).not.toContain('I.');
  });

  it('is the act the × can be taken back with, and not a word moves either way', () => {
    /**
     * The pair is the point: §9x's × and this are inverses, so a writer who
     * presses one can press the other. What neither touches is the writing.
     */
    const file = collection();
    const words = () => (one: ProjectFile) => one.beats.flatMap((beat) => beat.manuscript.elements).length;
    const before = words()(file);
    const broken = brokenByThatPress(file);
    expect(words()(broken)).toBe(before);
    const orphan = unclaimedUnits(broken).find((unit) => unit.title === 'I.')!;
    const back = startDivision(broken, orphan.id, 'In For A Pound');
    expect(words()(back)).toBe(before);
    expect(storiesOf(back).length).toBe(storiesOf(file).length);
  });

  it('refuses where a page opens no section, and where one already begins', () => {
    const file = brokenByThatPress(collection());
    expect(divisionStart(file, null).refusal).toMatch(/begins where a section begins/);
    const standing = storiesOf(file)[0]!;
    expect(divisionStart(file, standing.placed.marker.unitId as never).refusal).toMatch(/already begins/);
  });

  it('refuses the same things again in the act, so a caller cannot skip the reading', () => {
    const file = brokenByThatPress(collection());
    const standing = storiesOf(file)[0]!;
    expect(startDivision(file, standing.placed.marker.unitId as never)).toBe(file);
  });
});
