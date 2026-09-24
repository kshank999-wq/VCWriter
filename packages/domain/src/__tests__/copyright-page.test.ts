import { describe, expect, it } from 'vitest';
import {
  addBookNumber,
  addMarker,
  addPart,
  beginCopyright,
  bookBlocks,
  bookRows,
  applyCopyrightPreset,
  copyrightLines,
  copyrightNotice,
  copyrightOf,
  copyrightOrder,
  copyrightPlaceholders,
  isbnLooksRight,
  moveCopyrightElement,
  placeCopyrightElement,
  presetOf,
  showCopyrightElement,
  COPYRIGHT_PRESETS,
  createProjectFile,
  describeCopyright,
  numberLine,
  partToHalf,
  partsOf,
  removeBookNumber,
  setBookNumber,
  setCopyright,
  unitsInStoryOrder,
  updatePart,
  FICTION_DISCLAIMER,
  RIGHTS_RESERVED,
  type ProjectFile,
} from '../index.js';

/**
 * The copyright page's own fields (addendum 20 §9k, from Ken: *with the
 * copyright page in particular, we need to have a special pop-up dialog box
 * that is for the copyright information*), and the book's three areas.
 */

const book = (): ProjectFile => createProjectFile({ title: 'The Lamp', format: 'novel', author: 'M. Shank' });

const copyrightPart = (file: ProjectFile) => partsOf(file).find((part) => part.kind === 'copyright')!;

/** Write a patch onto the copyright page and hand the whole file back. */
const write = (file: ProjectFile, patch: Parameters<typeof setCopyright>[2]): ProjectFile => {
  const part = copyrightPart(file);
  return updatePart(file, part.id, { copyright: setCopyright(part, file, patch).copyright });
};

describe('a page nobody has set', () => {
  /**
   * The record is null until a writer opens the dialog, and that is
   * load-bearing rather than tidy: every book made before this prints the
   * free text it always printed, so nothing moves on the page.
   */
  it('prints the words it always printed, and says so', () => {
    let file = book();
    file = updatePart(file, copyrightPart(file).id, { text: 'Copyright © 2019 Somebody\n\nAll rights reserved.' });
    const part = copyrightPart(file);
    expect(copyrightOf(part)).toBeNull();
    expect(copyrightLines(part, file).map((line) => line.text)).toEqual([
      'Copyright © 2019 Somebody',
      'All rights reserved.',
    ]);
    expect(describeCopyright(part, file)).toMatch(/Nothing is set yet/);
    // And the block the printer reads carries those same words.
    const block = bookBlocks(file).find((one) => one.kind === 'copyright')!;
    expect(block.text).toContain('Copyright © 2019 Somebody');
  });
});

describe('the fields', () => {
  it('start from what the book already knows, and carry the old words over', () => {
    let file = book();
    file = updatePart(file, copyrightPart(file).id, { text: 'Set in Caslon.' });
    const page = beginCopyright(copyrightPart(file), file);
    expect(page.holder).toBe('M. Shank');
    expect(page.rights).toBe(RIGHTS_RESERVED);
    expect(page.year).toMatch(/^\d{4}$/);
    // Nothing a writer typed before is lost by starting to use the fields.
    expect(page.more).toBe('Set in Caslon.');
  });

  /** A field with nothing in it prints nothing: no blank *ISBN:* line. */
  it('print only what is there, in the order a copyright page is set', () => {
    let file = book();
    file = write(file, { year: '2026', holder: 'Jane Doe' });
    file = write(file, { publisher: 'Lamplight Books', publisherPlace: 'Hull', edition: 'First Edition' });
    const lines = copyrightLines(copyrightPart(file), file).map((line) => line.text);
    expect(lines).toEqual([
      'The Lamp',
      'Copyright © 2026 Jane Doe',
      RIGHTS_RESERVED,
      'Lamplight Books, Hull',
      'First Edition',
    ]);
    // Nothing empty leaves a gap behind it.
    expect(lines.some((line) => line.trim().length === 0)).toBe(false);
    expect(copyrightNotice(copyrightOf(copyrightPart(file))!, file)).toBe('Copyright © 2026 Jane Doe');
  });

  it('carry a number per format, because a paperback and an eBook are different books', () => {
    let file = write(book(), {});
    let page = copyrightOf(copyrightPart(file))!;
    page = addBookNumber(page, 'Paperback');
    page = setBookNumber(page, 0, { number: '978-1-234-56789-0' });
    page = addBookNumber(page, 'eBook');
    page = setBookNumber(page, 1, { number: '978-1-234-56789-7' });
    file = updatePart(file, copyrightPart(file).id, { copyright: page });

    const lines = copyrightLines(copyrightPart(file), file).map((line) => line.text);
    expect(lines).toContain('ISBN 978-1-234-56789-0 (Paperback)');
    expect(lines).toContain('ISBN 978-1-234-56789-7 (eBook)');

    // One with no number at all is not a line.
    const empty = removeBookNumber(addBookNumber(page, 'Audiobook'), 0);
    file = updatePart(file, copyrightPart(file).id, { copyright: empty });
    expect(copyrightLines(copyrightPart(file), file).map((line) => line.text)).not.toContain('ISBN  (Audiobook)');
  });

  it('says what is still missing rather than hiding it', () => {
    const file = write(book(), { holder: '', year: '' });
    expect(describeCopyright(copyrightPart(file), file)).toMatch(/Still without .*a number/);
  });
});

/**
 * The number line is **worked out** and there is nowhere to type it: a writer
 * says which printing this is, and the convention every printer reads follows.
 * Typing it by hand is how a second printing claims to be the first.
 */
describe('the number line', () => {
  it('drops a digit for each printing, and prints none where there is none', () => {
    expect(numberLine(1)).toBe('10 9 8 7 6 5 4 3 2 1');
    expect(numberLine(2)).toBe('10 9 8 7 6 5 4 3 2');
    expect(numberLine(10)).toBe('10');
    expect(numberLine(null)).toBe('');
    // The lowest digit is the printing, which is the whole of what it says.
    for (const printing of [1, 3, 7]) {
      const digits = numberLine(printing).split(' ').map(Number);
      expect(Math.min(...digits)).toBe(printing);
      expect(Math.max(...digits)).toBe(10);
    }
  });

  it('rides with the edition, which is where a book prints it (§15)', () => {
    // It used to stand last, under everything. A book sets it under the
    // edition statement — which is what the handoff's element is called,
    // *Edition & number line* — so it moves with it when the order changes.
    const file = write(book(), { printing: 3, edition: 'First Edition', printedIn: 'Printed in the United States of America' });
    const lines = copyrightLines(copyrightPart(file), file).map((line) => line.text);
    expect(lines.indexOf('10 9 8 7 6 5 4 3')).toBe(lines.indexOf('First Edition') + 1);
  });
});

describe('the barcode', () => {
  /**
   * From Ken: *a graphic box at the bottom right-hand corner of the page for a
   * barcode, in case there is no jacket on the actual book — for example, if
   * the book is made of leather.*
   */
  it('rides on the copyright block for the printer, with the width the writer set', () => {
    let file = write(book(), { barcodeAssetId: 'asset-1', barcodeInches: 2.25 });
    let block = bookBlocks(file).find((one) => one.kind === 'copyright')!;
    expect(block.assetId).toBe('asset-1');
    expect(block.barcodeInches).toBe(2.25);

    // Taken off, nothing is left behind for the printer to draw.
    file = write(file, { barcodeAssetId: null });
    block = bookBlocks(file).find((one) => one.kind === 'copyright')!;
    expect(block.assetId).toBeNull();
  });

  it('is not what the disclaimer button writes, and the usual wording is one string', () => {
    const file = write(book(), { disclaimer: FICTION_DISCLAIMER });
    expect(copyrightLines(copyrightPart(file), file).map((line) => line.text)).toContain(FICTION_DISCLAIMER);
  });
});

/**
 * The book's three areas (§9k, from Ken: *those items from the list that are
 * front matter will automatically populate that area*).
 */
describe('the areas', () => {
  it('are read off each row and never stored', () => {
    const plain = book();
    const file = addMarker(plain, { unitId: unitsInStoryOrder(plain)[0]!.id, kind: 'chapter', title: 'The Road' }).file;
    const rows = bookRows(file);
    const halves = rows.map((row) => row.half);
    // Front matter, then the story, then the back — and never back again.
    expect(halves.indexOf('body')).toBeGreaterThan(halves.lastIndexOf('front'));
    expect(halves.indexOf('back')).toBeGreaterThan(halves.lastIndexOf('body'));
    expect(rows.find((row) => row.title === 'Copyright')?.half).toBe('front');
    expect(rows.find((row) => row.title === 'About the author')?.half).toBe('back');
  });

  /**
   * An art page is the one kind that belongs wherever the writer wants it.
   * Everything else is refused **in a sentence** rather than moved, because a
   * copyright page is front matter by being a copyright page.
   */
  it('take an art page dropped on them, and refuse what a page simply is', () => {
    const made = addPart(book(), 'plate', { caption: 'The harbour' });
    const moved = partToHalf(made.file, made.partId!, 'front');
    expect(moved.refusal).toBeNull();
    expect(partsOf(moved.file).find((part) => part.id === made.partId)?.inFront).toBe(true);

    const refused = partToHalf(moved.file, copyrightPart(moved.file).id, 'back');
    expect(refused.refusal).toMatch(/belongs in the front matter/);
    expect(refused.file).toBe(moved.file);
  });
});

/**
 * §15, from Ken's *Copyright Page dialog* handoff: the order is the writer's,
 * from four standard ones, with each element switched on or off.
 */
describe('the order is the writer’s', () => {
  const full = (): ProjectFile =>
    write(book(), {
      disclaimer: FICTION_DISCLAIMER,
      lccn: '2026901234',
      permissions: 'Lines from “The Lamp” used by permission.',
      printedIn: 'Printed in the United States of America',
      edition: 'First Edition',
    });

  it('prints in the order a book made before this printed in, with nothing moved', () => {
    const file = full();
    const page = copyrightOf(copyrightPart(file))!;
    // Nothing stored, so the trade order stands and the page is unchanged.
    expect(page.order).toEqual([]);
    expect(copyrightOrder(page)[0]).toBe('disclaimer');
    const lines = copyrightLines(copyrightPart(file), file).map((one) => one.text);
    expect(lines.indexOf(FICTION_DISCLAIMER)).toBeLessThan(lines.findIndex((one) => one.startsWith('Copyright')));
  });

  it('moves an element, and the page follows', () => {
    let file = full();
    const page = copyrightOf(copyrightPart(file))!;
    file = write(file, moveCopyrightElement(page, 'notice', -1));
    const lines = copyrightLines(copyrightPart(file), file).map((one) => one.text);
    expect(lines.findIndex((one) => one.startsWith('Copyright'))).toBeLessThan(lines.indexOf(FICTION_DISCLAIMER));
  });

  it('keeps an element’s words when it is switched off', () => {
    let file = full();
    const page = copyrightOf(copyrightPart(file))!;
    file = write(file, showCopyrightElement(page, 'lccn', false));
    const off = copyrightOf(copyrightPart(file))!;
    // Off the page…
    expect(copyrightLines(copyrightPart(file), file).some((one) => one.text.includes('2026901234'))).toBe(false);
    // …and the words still there, which is what makes it different from
    // clearing the field.
    expect(off.lccn).toBe('2026901234');
    file = write(file, showCopyrightElement(off, 'lccn', true));
    expect(copyrightLines(copyrightPart(file), file).some((one) => one.text.includes('2026901234'))).toBe(true);
  });

  it('refuses to hide the two a book may not print without', () => {
    const page = copyrightOf(copyrightPart(full()))!;
    for (const id of ['notice', 'rights']) {
      expect(showCopyrightElement(page, id, false).hidden).not.toContain(id);
      // They can still be reordered, which is the handoff's first criterion.
      expect(copyrightOrder(moveCopyrightElement(page, id, 1)).indexOf(id)).toBe(copyrightOrder(page).indexOf(id) + 1);
    }
  });

  it('reads back which standard order is in force, and says Custom for anything else', () => {
    const page = copyrightOf(copyrightPart(full()))!;
    expect(presetOf(page, 'left')?.id).toBe('trade');
    // The same order centred is the other preset, which is the only thing
    // that tells them apart.
    expect(presetOf(page, 'center')?.id).toBe('centered');
    const legal = applyCopyrightPreset(page, COPYRIGHT_PRESETS.find((one) => one.id === 'legal')!);
    expect(presetOf(legal, 'left')?.id).toBe('legal');
    // Move one element and it stops describing the page.
    expect(presetOf(moveCopyrightElement(legal, 'lccn', -1), 'left')).toBeNull();
  });

  it('takes a preset’s order, what it hides and where the block sits', () => {
    const page = copyrightOf(copyrightPart(full()))!;
    const minimal = applyCopyrightPreset(page, COPYRIGHT_PRESETS.find((one) => one.id === 'minimal')!);
    expect(minimal.position).toBe('middle');
    expect(minimal.hidden).toContain('lccn');
    // And it keeps the writer's words — switching preset is not a reset.
    expect(minimal.lccn).toBe('2026901234');
    expect(minimal.disclaimer).toBe(FICTION_DISCLAIMER);
  });

  it('drops an element before another, which is the drag', () => {
    const page = copyrightOf(copyrightPart(full()))!;
    const moved = placeCopyrightElement(page, 'printed', 'disclaimer');
    expect(copyrightOrder(moved)[0]).toBe('printed');
    expect(copyrightOrder(moved)).toHaveLength(copyrightOrder(page).length);
  });
});

describe('what is still to fill in', () => {
  it('counts the placeholders across what the page will print', () => {
    let file = write(book(), { credits: 'Cover design by [NAME]\nInterior design by [NAME]' });
    expect(copyrightPlaceholders(copyrightPart(file), file)).toBe(2);
    // An element switched off is not going to print, so it is not owed.
    const page = copyrightOf(copyrightPart(file))!;
    file = write(file, showCopyrightElement(page, 'credits', false));
    expect(copyrightPlaceholders(copyrightPart(file), file)).toBe(0);
  });

  it('counts a book number set to show with nothing in it', () => {
    const file = write(book(), { numbers: [{ format: 'Paperback', number: '' }] });
    expect(copyrightPlaceholders(copyrightPart(file), file)).toBe(1);
  });
});

describe('a book number', () => {
  it('checks the ISBN-13 sum, and says nothing about an empty box', () => {
    // An empty box is a number the writer has not got yet, not a mistake.
    expect(isbnLooksRight('')).toBeNull();
    expect(isbnLooksRight('   ')).toBeNull();
    expect(isbnLooksRight('978-0-306-40615-7')).toBe(true);
    expect(isbnLooksRight('9780306406157')).toBe(true);
    expect(isbnLooksRight('9780306406158')).toBe(false);
    expect(isbnLooksRight('not a number')).toBe(false);
  });
});

describe('a notice with nobody in it', () => {
  it('is owed, because a copyright notice without a holder is not one', () => {
    // It still *prints* — Copyright © 2026 — which is exactly why the footer
    // has to say it is unfinished rather than reading as ready.
    const file = write(createProjectFile({ title: 'The Lamp', format: 'novel' }), { holder: '', year: '2026' });
    expect(copyrightPlaceholders(copyrightPart(file), file)).toBe(1);
    const named = write(file, { holder: 'M. Shank' });
    expect(copyrightPlaceholders(copyrightPart(named), named)).toBe(0);
  });
});
