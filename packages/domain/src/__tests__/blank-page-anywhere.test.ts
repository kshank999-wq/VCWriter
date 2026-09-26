import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  blankOffer,
  blankSpot,
  bookBlocks,
  bookNames,
  bookPageRows,
  bookSettingsOf,
  createProjectFile,
  geometryOf,
  layPages,
  pagePlace,
  partBlankOffer,
  partsOf,
  setBlankPage,
  setChapterBlank,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **A blank page wherever you want, and one on a chapter page's back**
 * (addendum 20 §9r, from Ken: *the chapter page we have a blank on the back,
 * and you should be able to enter a blank page wherever you want*, then
 * *tried to put a blank page on the chapter one page and it wouldn't allow
 * me*).
 *
 * *Wherever* was the whole of the ask and the whole of the gap: the act hung
 * on a manuscript element, so it was offered on a page of the story and
 * absent on every page of the front and back matter.
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

/** A collection like Ken's: stories, each divided into chapters by numerals. */
const collection = (): ProjectFile => {
  let file = createProjectFile({ title: 'Villain’s Tales', format: 'short_story', author: 'M. Shank' });
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
          elements: [head(chapter), ...[1, 2, 3].map((n) => para(`${title} ${chapter} para ${n}. ${'word '.repeat(70)}`))],
        } as never,
      });
    }
    file = addMarker(file, { kind: 'chapter', unitId: ids[0] as never, title }).file;
  };
  story('In For A Pound', ['I.', 'II.']);
  story('Simple Pleasures', ['I.']);
  return addPart(file, 'appendix', { title: 'Appendix' }).file;
};

const lay = (file: ProjectFile) => {
  const blocks = bookBlocks(file);
  const measured = new Map(blocks.map((block) => [block.id, block.kind === 'paragraph' ? 9 : 4]));
  const settings = bookSettingsOf(file);
  const laid = layPages(blocks, measured, geometryOf(settings, 40), settings, bookNames(file));
  return { blocks, laid, rows: bookPageRows(laid.pages, blocks) };
};

/** What stands on each page, so a blank leaf is visible where it falls. */
const shape = (file: ProjectFile): string[] => {
  const { blocks, laid } = lay(file);
  const byId = new Map(blocks.map((block) => [block.id, block]));
  return laid.pages.map((page) => page.pieces.map((piece) => byId.get(piece.blockId)?.kind).join('+') || 'left-blank');
};

/** Where a blank asked for on this sheet would go, as the room reads it. */
const spotOn = (file: ProjectFile, sheet: number): string | null => {
  const { blocks, laid, rows } = lay(file);
  return blankSpot(pagePlace(laid.pages, blocks, sheet), rows.find((one) => one.sheet === sheet)!);
};

/** What the room would offer on this sheet — the act, or the reason there is none. */
const offerOn = (file: ProjectFile, sheet: number) => {
  const { blocks, laid, rows } = lay(file);
  return blankOffer(
    pagePlace(laid.pages, blocks, sheet),
    rows.find((one) => one.sheet === sheet)!,
    rows.find((one) => one.sheet === sheet - 1) ?? null,
  );
};

describe('where a blank page may be entered', () => {
  it('is offered on every page of the front and back matter, which had none', () => {
    // The gap exactly: a writer could not put a leaf between the title page
    // and the copyright page, or before an appendix.
    const file = collection();
    const { rows } = lay(file);
    const parts = rows.filter((row) => row.partId !== null);
    expect(parts.length).toBeGreaterThan(2);
    for (const row of parts) expect(spotOn(file, row.sheet)).toBeTruthy();
  });

  it('is offered on the page a chapter opens on', () => {
    // Ken's *it wouldn't allow me*.
    const file = collection();
    const { rows } = lay(file);
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    expect(spotOn(file, opens.sheet)).toBeTruthy();
  });

  it('is not offered on a leaf the cutter left, which is nobody’s to move', () => {
    // §9i's rule: a blank the recto convention produced is not the writer's
    // leaf, and the page's own screen says which of the three reasons it is.
    const file = collection();
    const { rows } = lay(file);
    const left = rows.find((row) => row.says === 'Blank' && !row.blankFor);
    expect(left).toBeTruthy();
    expect(spotOn(file, left!.sheet)).toBeNull();
  });
});

describe('a blank page in the front matter', () => {
  it('goes in before that page and moves it on', () => {
    const file = collection();
    const { rows } = lay(file);
    const copyright = rows.find((row) => row.partId !== null && row.sheet > 3)!;
    const before = shape(file);
    const after = shape(setBlankPage(file, spotOn(file, copyright.sheet)!, true));
    // A leaf the writer put in stands where that page stood.
    expect(after[copyright.sheet - 1]).toBe('blank');
    expect(after.length).toBeGreaterThan(before.length);
  });

  it('can be taken away again from the leaf it made', () => {
    const file = collection();
    const { rows } = lay(file);
    const part = rows.find((row) => row.partId !== null && row.sheet > 3)!;
    const spot = spotOn(file, part.sheet)!;
    const with_ = setBlankPage(file, spot, true);
    // The leaf it made says which page asked for it, which is the only place
    // it can be found again.
    const made = lay(with_).rows.find((row) => row.blankFor === spot);
    expect(made).toBeTruthy();
    expect(shape(setBlankPage(with_, made!.blankFor as string, false))).toEqual(shape(file));
  });
});

describe('a blank page on a chapter’s page', () => {
  it('goes before the chapter opens rather than splitting the chapter', () => {
    // §9p's fault found again: hung on the chapter's first element it lands
    // between the numeral and the words.
    const file = collection();
    const { rows } = lay(file);
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    const after = shape(setBlankPage(file, spotOn(file, opens.sheet)!, true));
    const at = after.findIndex((one) => one.startsWith('chapter_opening'));
    expect(after[at - 1]).toBe('blank');
  });

  it('is the chapter’s own answer, not its first paragraph’s', () => {
    const file = collection();
    const { rows, blocks, laid } = lay(file);
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    const place = pagePlace(laid.pages, blocks, opens.sheet);
    // The marker rather than the element under it — the order in `blankSpot`
    // is the whole of the fix.
    expect(spotOn(file, opens.sheet)).toBe(place.opensMarkerId);
    expect(place.opensMarkerId).not.toBe(place.elementId);
  });
});

describe('a blank on the back of a chapter page', () => {
  it('puts the leaf behind the page the chapter opens on', () => {
    const file = collection();
    const { rows, blocks, laid } = lay(file);
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    const marker = pagePlace(laid.pages, blocks, opens.sheet).opensMarkerId!;
    const after = shape(setChapterBlank(file, marker, 'back', true));
    const at = after.findIndex((one) => one.startsWith('chapter_opening'));
    expect(after[at + 1]).toBe('blank');
  });

  it('is offered where the opening stands alone on its page', () => {
    // Read from the laid page rather than from the block's display flag: a
    // chapter page carrying nothing but its title stands alone whether or not
    // it was given a device, and Ken's stories are exactly that shape.
    const file = collection();
    const { rows, blocks, laid } = lay(file);
    const opens = rows.find((row) => row.says === 'Chapter opens')!;
    const place = pagePlace(laid.pages, blocks, opens.sheet);
    expect(place.opensAlone).toBe(true);
  });

  it('is not offered on a page that carries the chapter’s first words too', () => {
    const file = collection();
    const { rows, blocks, laid } = lay(file);
    const withText = rows.find((row) => {
      const page = laid.pages.find((one) => one.sheet === row.sheet)!;
      return page.pieces.length > 1;
    })!;
    expect(pagePlace(laid.pages, blocks, withText.sheet).opensAlone).toBe(false);
  });
});

describe('a page that already has a leaf in front of it', () => {
  /**
   * The one thing measuring the act caught. A blank block takes the **next**
   * page, and a chapter opening on a right-hand page has already left the
   * verso in front of it empty — so a leaf asked for there fills the cutter's
   * gap and **the book does not grow**. The behaviour is right; a press that
   * looks exactly like the fault Ken reported is not.
   */
  const withLeaf = (): { file: ProjectFile; sheet: number } => {
    const file = collection();
    const { rows } = lay(file);
    const opens = rows.filter((row) => row.says === 'Chapter opens');
    const after = opens.find((row) => rows.find((one) => one.sheet === row.sheet - 1)?.blank === true);
    return { file, sheet: (after ?? opens[0]!).sheet };
  };

  it('refuses in a sentence rather than filling the gap invisibly', () => {
    const { file, sheet } = withLeaf();
    const before = lay(file).rows.find((one) => one.sheet === sheet - 1);
    expect(before?.blank).toBe(true);
    const offer = offerOn(file, sheet);
    expect(offer.spot).toBeNull();
    expect(offer.act).toBeNull();
    expect(offer.refusal).toMatch(/already blank/);
  });

  it('would have grown the book by nothing, which is why it is refused', () => {
    // Pinned so the refusal is not later "fixed" by removing it: the act
    // really does change no page, and the sentence is the whole of the answer.
    const { file, sheet } = withLeaf();
    const spot = spotOn(file, sheet)!;
    expect(shape(setBlankPage(file, spot, true))).toHaveLength(shape(file).length);
  });

  it('still offers it where the page in front carries writing', () => {
    const file = collection();
    const { rows } = lay(file);
    const plain = rows.find(
      (row) => row.partId !== null && rows.find((one) => one.sheet === row.sheet - 1)?.blank === false,
    )!;
    const offer = offerOn(file, plain.sheet);
    expect(offer.act).toBe('Put a blank page here…');
    expect(offer.refusal).toBeNull();
  });

  it('says the same of a part, where the two other screens reach the field', () => {
    // The inspector's panel and the designed page's dialog set `blankBefore`
    // on the part rather than through a page, and a screen that toggled it
    // blind would absorb the cutter's leaf silently — which is what this was
    // written to stop. Three surfaces, one answer.
    const file = collection();
    const { rows } = lay(file);
    const title = partsOf(file).find((part) => part.kind === 'title_page')!;
    const opens = rows.find((row) => row.partId === title.id)!;
    expect(rows.find((row) => row.sheet === opens.sheet - 1)?.blank).toBe(true);
    const offer = partBlankOffer(rows, title);
    expect(offer.act).toBeNull();
    expect(offer.refusal).toMatch(/already blank/);
  });

  it('offers a part its leaf where nothing stands in front of it', () => {
    const file = collection();
    const { rows } = lay(file);
    const free = partsOf(file).find((part) => {
      const opens = rows.find((row) => row.partId === part.id);
      return opens !== undefined && rows.find((row) => row.sheet === opens.sheet - 1)?.blank === false;
    })!;
    expect(partBlankOffer(rows, free).act).toBe('Put a blank page before this one');
  });

  it('never refuses a part taking its own leaf away again', () => {
    const file = collection();
    const part = partsOf(file)[0]!;
    expect(partBlankOffer(lay(file).rows, { ...part, blankBefore: true }).act).toBe(
      'Take the blank page before this one away',
    );
  });

  it('never refuses taking away the leaf a writer put in', () => {
    // It is the only place that leaf can be found again (§9i), and the page
    // in front of a blank may itself be blank.
    const file = collection();
    const { rows } = lay(file);
    const part = rows.find((row) => row.partId !== null && row.sheet > 3)!;
    const with_ = setBlankPage(file, spotOn(file, part.sheet)!, true);
    const made = lay(with_).rows.find((row) => row.blankFor !== null)!;
    expect(offerOn(with_, made.sheet).act).toBe('Take this blank page away');
  });
});

describe('a book nobody has asked anything of', () => {
  it('is laid exactly as it was', () => {
    const file = collection();
    expect(shape(file).filter((one) => one === 'blank')).toHaveLength(0);
    expect(partsOf(file).every((part) => part.blankBefore === false)).toBe(true);
  });
});
