import { z } from 'zod';
import type { BookPart } from './entities/book.js';
import { bookNames } from './book-layout.js';
import type { ProjectFile } from './project-file.js';

/**
 * The copyright page (addendum 20 §9k, from Ken: *with the copyright page in
 * particular, we need to have a special pop-up dialog box that is for the
 * copyright information, that allows you to put all the information
 * attached*).
 *
 * It was the one page in the front matter whose content was a **block of free
 * text**. Everything else there either comes from a reading (the contents, the
 * index) or is one thing said once (a dedication, an epigraph) — but a
 * copyright page is a dozen separate facts in a settled order, and asking a
 * writer to type them in the right order, in the right words, with the right
 * punctuation, is asking them to know a convention the program already knows.
 *
 * Three decisions carry it.
 *
 * **The fields are the page, and a field with nothing in it prints nothing.**
 * There is no blank *ISBN:* line on a book without one, and no separator left
 * behind — `copyrightLines` builds only what is there, which is what makes
 * the whole record safe to leave mostly empty.
 *
 * **The number line is worked out and there is nowhere to type it.** A writer
 * says which printing this is; `numberLine` writes `10 9 8 7 6 5 4 3 2 1` for
 * the first and drops a digit for each one after, which is the convention
 * every printer reads. Typing it by hand is how a second printing ends up
 * claiming to be the first — the fifth time this project has made a fact
 * about the work a reading rather than a column.
 *
 * **An untouched page is untouched.** The record is `null` until a writer
 * opens the dialog and sets something, and until then the page prints the free
 * text it always printed. So no existing book moves, which is `partStyleOf`'s
 * rule (§7a) pointed at content rather than at type.
 *
 * ---
 *
 * **§15 is the order being the writer's** (from Ken's *Copyright Page dialog*
 * handoff, the companion to the chapter opening one). The audit paid again:
 * **ten of the handoff's twelve elements were already fields here**, and the
 * two that were not (permissions, the Library of Congress number) had been
 * going into `more`. What was missing is not the content but **the sequence**
 * — `copyrightLines` walked a hard-coded run of `say(…)` calls, so a writer
 * who wanted the notice above the disclaimer could not have it.
 *
 * Three more decisions.
 *
 * **An element turned off is not an element left empty.** The two look alike
 * on the printed page and mean different things: *I have no Library of
 * Congress number* and *I have one and this book does not print it*. So
 * `hidden` is its own field and turning something off **keeps its words**,
 * which is the graveyard's `archived`-is-not-`deletedAt` argument pointed at
 * a page.
 *
 * **Which preset is in force is read back, never stored.** `presetOf` compares
 * the order, the hidden set, the position and the alignment against the four,
 * and answers `null` for anything else — so a writer who moves one element
 * reads *Custom* rather than a preset that has stopped describing the page.
 * `bookPresetOf`'s rule, and the handoff asks for exactly it.
 *
 * **Two of the handoff's controls are settings that already exist.** Its
 * alignment and its type size are the part's own `LineStyle` (§7a), so they
 * are edited through that rather than copied here — a second control for
 * either would be a second answer about how the page is set.
 */

/** One of the book's numbers: the format it identifies, and the number itself. */
export const bookNumberSchema = z.object({
  /** Paperback, Hardcover, eBook, Audiobook — the writer's word, not an enum. */
  format: z.string().default(''),
  number: z.string().default(''),
});
export type BookNumber = z.infer<typeof bookNumberSchema>;

export const copyrightPageSchema = z.object({
  /** The year of first publication. Empty means the year the project was made. */
  year: z.string().default(''),
  /** The copyright holder. Empty means the book's author. */
  holder: z.string().default(''),
  /** The reservation of rights. Empty prints none; `RIGHTS_RESERVED` is the usual. */
  rights: z.string().default(''),
  /** A number per format (§9k): a paperback and an eBook are different books to a retailer. */
  numbers: z.array(bookNumberSchema).default([]),
  publisher: z.string().default(''),
  publisherPlace: z.string().default(''),
  publisherUrl: z.string().default(''),
  /** *First Edition*, *Second Edition, Revised*. */
  edition: z.string().default(''),
  /** The work-of-fiction notice; `FICTION_DISCLAIMER` is the usual wording. */
  disclaimer: z.string().default(''),
  /** The cover designer, the illustrator, whoever set the interior. */
  credits: z.string().default(''),
  /** *Printed in the United States of America*. */
  printedIn: z.string().default(''),
  /**
   * Which printing this is, lowest number in the line. Null prints no line at
   * all; 1 is the first printing. The line itself is derived — see above.
   */
  printing: z.number().int().min(1).max(10).nullable().default(null),
  /**
   * The barcode (§9k, from Ken: *a graphic box at the bottom right-hand
   * corner of the page for a barcode, in case there is no jacket on the actual
   * book — for example, if the book is made of leather*). A picture in the
   * graphics library, because what a barcode has to encode — the retail price
   * as well as the number — is not something the book knows.
   */
  barcodeAssetId: z.string().nullable().default(null),
  /** How wide the barcode prints, in inches. A trade EAN-13 with its add-on is about 2. */
  barcodeInches: z.number().min(0.75).max(4).default(2),
  /** Credit lines for quoted or previously published material (§15). */
  permissions: z.string().default(''),
  /** The Library of Congress Control Number (§15). */
  lccn: z.string().default(''),
  /** Anything the fields have no room for, printed under them. */
  more: z.string().default(''),
  /**
   * The elements in the order they print (§15). Empty means *the order this
   * page has always printed in*, which is `TRADE_ORDER` — so a page made
   * before there was an order reads exactly as it did and nothing is
   * migrated, `layout`/`template`'s shape a second time.
   */
  order: z.array(z.string()).default([]),
  /**
   * The elements switched off. **Not the same as empty**: turning one off
   * keeps its words, so switching it back on gives them back.
   */
  hidden: z.array(z.string()).default([]),
  /**
   * Where the block sits on the page (§15). It hung at the foot and nowhere
   * else (§7a, on the reading that a notice a third of the way down is not a
   * copyright page and that the block is long enough to be pushed off) — which
   * was right about the **default** and wrong to make it the only answer. The
   * handoff settles the worry it rested on: a block too tall for the page
   * shrinks a step and says so, rather than running off the bottom.
   */
  position: z.enum(['top', 'middle', 'bottom']).default('bottom'),
});
export type CopyrightPage = z.infer<typeof copyrightPageSchema>;

// ------------------------------------------------------------ the elements

/** What kind of thing an element is, which is what the dialog opens for it. */
export type CopyrightElementKind = 'text' | 'numbers' | 'barcode';

export interface CopyrightElement {
  id: string;
  /** What the writer calls it. */
  name: string;
  kind: CopyrightElementKind;
  /**
   * The two a book may not print without. They can be **reordered** — what is
   * refused is hiding them, which is the handoff's first acceptance criterion.
   */
  required: boolean;
  /** Which field of the record it prints, for the text ones. */
  field?: keyof CopyrightPage;
}

export const COPYRIGHT_ELEMENTS: readonly CopyrightElement[] = [
  { id: 'disclaimer', name: 'Fiction disclaimer', kind: 'text', required: false, field: 'disclaimer' },
  { id: 'notice', name: 'Copyright notice', kind: 'text', required: true },
  { id: 'rights', name: 'All rights reserved', kind: 'text', required: true, field: 'rights' },
  { id: 'permissions', name: 'Permissions', kind: 'text', required: false, field: 'permissions' },
  { id: 'publisher', name: 'Publisher', kind: 'text', required: false },
  { id: 'lccn', name: 'Library of Congress', kind: 'text', required: false, field: 'lccn' },
  { id: 'isbn', name: 'ISBNs', kind: 'numbers', required: false },
  { id: 'barcode', name: 'ISBN barcode', kind: 'barcode', required: false },
  { id: 'credits', name: 'Credits', kind: 'text', required: false, field: 'credits' },
  { id: 'website', name: 'Website', kind: 'text', required: false, field: 'publisherUrl' },
  { id: 'edition', name: 'Edition & number line', kind: 'text', required: false, field: 'edition' },
  { id: 'printed', name: 'Country of printing', kind: 'text', required: false, field: 'printedIn' },
  { id: 'more', name: 'Anything else', kind: 'text', required: false, field: 'more' },
];

export const copyrightElement = (id: string): CopyrightElement | undefined =>
  COPYRIGHT_ELEMENTS.find((one) => one.id === id);

/**
 * The order the page printed in before there was one, so a book made before
 * §15 reads unchanged. `more` comes last, as it always did — it is the
 * overflow rather than one of the handoff's twelve.
 */
export const TRADE_ORDER = [
  'disclaimer',
  'notice',
  'rights',
  'permissions',
  'publisher',
  'lccn',
  'isbn',
  'barcode',
  'credits',
  'website',
  'edition',
  'printed',
  'more',
] as const;

export interface CopyrightPreset {
  id: string;
  name: string;
  order: readonly string[];
  hidden: readonly string[];
  position: 'top' | 'middle' | 'bottom';
  align: 'left' | 'center' | 'right';
}

/** The four standard orders of the handoff, as data. */
export const COPYRIGHT_PRESETS: readonly CopyrightPreset[] = [
  { id: 'trade', name: 'Trade standard', order: TRADE_ORDER, hidden: [], position: 'bottom', align: 'left' },
  {
    id: 'legal',
    name: 'Legal first',
    order: ['notice', 'rights', 'isbn', 'barcode', 'publisher', 'edition', 'printed', 'lccn', 'disclaimer', 'permissions', 'credits', 'website', 'more'],
    hidden: [],
    position: 'top',
    align: 'left',
  },
  {
    id: 'minimal',
    name: 'Indie minimal',
    order: ['notice', 'rights', 'disclaimer', 'isbn', 'barcode', 'credits', 'website', 'edition', 'permissions', 'publisher', 'lccn', 'printed', 'more'],
    hidden: ['permissions', 'publisher', 'lccn', 'printed'],
    position: 'middle',
    align: 'center',
  },
  { id: 'centered', name: 'Centered classic', order: TRADE_ORDER, hidden: [], position: 'bottom', align: 'center' },
];

/**
 * The order in force: the writer's where they have one, the trade order
 * otherwise. Anything the record does not name is appended, so an element
 * added to `COPYRIGHT_ELEMENTS` tomorrow appears on an existing page rather
 * than vanishing from it.
 */
export const copyrightOrder = (page: CopyrightPage): string[] => {
  const known = new Set(COPYRIGHT_ELEMENTS.map((one) => one.id));
  const named = page.order.filter((id) => known.has(id));
  const seen = new Set(named);
  return [...named, ...COPYRIGHT_ELEMENTS.map((one) => one.id).filter((id) => !seen.has(id))];
};

/** Whether an element prints. The two required ones always do. */
export const copyrightShows = (page: CopyrightPage, id: string): boolean =>
  copyrightElement(id)?.required === true || !page.hidden.includes(id);

/**
 * Which preset the page is set to, or null for an order the writer has made
 * themselves. **Read back rather than stored** (§15), so moving one element
 * reads *Custom* rather than a preset that has stopped describing the page.
 */
/**
 * The orders a writer has kept, beside the four the program ships (§15b,
 * from Ken's handoff: *Save as preset…*).
 *
 * A saved one is **the same shape as a built-in**, so everything that reads
 * a preset — the tiles, `presetOf`, `applyCopyrightPreset` — takes it
 * without being told they exist. A publisher's own order is the case this
 * is for, and it is the writer's rather than the book's, so it lives beside
 * the book's settings and travels with the project.
 */
export const savedCopyrightPreset = (page: CopyrightPage, align: 'left' | 'center' | 'right', name: string): CopyrightPreset => ({
  id: `own:${name.trim().toLowerCase()}`,
  name: name.trim(),
  order: copyrightOrder(page),
  hidden: [...page.hidden].sort(),
  position: page.position,
  align,
});

/**
 * Which order is in force, over the four and the writer's own. Still a
 * **reading** — nothing stores which preset a page came from — so moving one
 * element makes the page *Custom* by itself.
 */
export const presetOf = (
  page: CopyrightPage,
  align: 'left' | 'center' | 'right',
  saved: readonly CopyrightPreset[] = [],
): CopyrightPreset | null => {
  const order = copyrightOrder(page).join(',');
  const hidden = [...page.hidden].sort().join(',');
  return (
    [...COPYRIGHT_PRESETS, ...saved].find(
      (preset) =>
        copyrightOrder({ ...page, order: [...preset.order] }).join(',') === order &&
        [...preset.hidden].sort().join(',') === hidden &&
        preset.position === page.position &&
        preset.align === align,
    ) ?? null
  );
};

/** Take a preset: the order, what is hidden and where the block sits. */
export const applyCopyrightPreset = (page: CopyrightPage, preset: CopyrightPreset): CopyrightPage =>
  copyrightPageSchema.parse({
    ...page,
    order: [...preset.order],
    hidden: [...preset.hidden],
    position: preset.position,
  });

/** Move an element one place up or down. */
export const moveCopyrightElement = (page: CopyrightPage, id: string, by: -1 | 1): CopyrightPage => {
  const order = copyrightOrder(page);
  const at = order.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return page;
  const moved = [...order];
  moved[at] = order[to]!;
  moved[to] = id;
  return copyrightPageSchema.parse({ ...page, order: moved });
};

/** Drop an element before another, which is the drag (§15). */
export const placeCopyrightElement = (page: CopyrightPage, id: string, beforeId: string | null): CopyrightPage => {
  const order = copyrightOrder(page).filter((one) => one !== id);
  const at = beforeId === null ? order.length : order.indexOf(beforeId);
  if (beforeId !== null && at < 0) return page;
  return copyrightPageSchema.parse({ ...page, order: [...order.slice(0, at), id, ...order.slice(at)] });
};

/**
 * Turn an element off, or on. **The words stay either way** — which is what
 * makes this different from clearing the field, and is why both exist.
 */
export const showCopyrightElement = (page: CopyrightPage, id: string, show: boolean): CopyrightPage => {
  if (copyrightElement(id)?.required === true) return page;
  const hidden = page.hidden.filter((one) => one !== id);
  return copyrightPageSchema.parse({ ...page, hidden: show ? hidden : [...hidden, id] });
};

export const RIGHTS_RESERVED = 'All rights reserved.';

export const FICTION_DISCLAIMER =
  'This is a work of fiction. Names, characters, places and incidents are the product of the author’s imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events or locales is entirely coincidental.';

export const BARCODE_INCHES = { min: 0.75, max: 4, default: 2 } as const;

/** What a printer wants of a raster barcode, and what the bars need to scan. */
export const BARCODE_DPI = 300;

/**
 * How finely the barcode will print, at the width it is placed (§15b, from
 * Ken's handoff: *warn if a raster image comes in under 300 dpi at its
 * placed size*).
 *
 * It is a **reading**, and that is the whole of why it is worth having: the
 * same picture is fine at 1.5in and too coarse at 3in, so a warning stored
 * when the file arrived would be about a size the writer has since changed.
 * Narrowing the barcode makes the warning go away by itself, which is the
 * honest fix as well as the fastest one.
 *
 * A vector file has no pixels to count and is right at any size, so it is
 * **not warned about** rather than warned about with a made-up number — the
 * caller says which it is, because what a file is, is the host's business.
 */
export interface BarcodeResolution {
  /** Dots per inch as it will print. Null where there is nothing to count. */
  dpi: number | null;
  /** Whether it is too coarse for a printer at this width. */
  coarse: boolean;
  /** What to say, or null where there is nothing to say. */
  warning: string | null;
}

export const barcodeResolution = (
  picture: { width: number; height: number; vector?: boolean } | null,
  inches: number,
): BarcodeResolution => {
  if (!picture || picture.vector === true || picture.width <= 0 || inches <= 0) {
    return { dpi: null, coarse: false, warning: null };
  }
  const dpi = Math.round(picture.width / inches);
  if (dpi >= BARCODE_DPI) return { dpi, coarse: false, warning: null };
  return {
    dpi,
    coarse: true,
    // The number, the size it is about, and the way out — a warning that
    // does not say what would fix it is one a writer can only ignore.
    warning: `${dpi} dpi at ${inches.toFixed(2)} in. A printer wants ${BARCODE_DPI}. Use a wider picture, or set it narrower than ${(picture.width / BARCODE_DPI).toFixed(2)} in.`,
  };
};

/** What a book's numbers are usually called, offered rather than enforced. */
export const NUMBER_FORMATS = ['Paperback', 'Hardcover', 'eBook', 'Audiobook', 'Large print'] as const;

/** The page as it stands, or null where the writer has never opened it. */
export const copyrightOf = (part: BookPart): CopyrightPage | null => {
  const held = (part as unknown as { copyright?: unknown }).copyright;
  if (held === undefined || held === null) return null;
  const read = copyrightPageSchema.safeParse(held);
  return read.success ? read.data : null;
};

/**
 * Start the page from what the book already knows (§9k). The holder is the
 * author, the year is this one, and the rights line is the usual — a writer
 * opening the dialog should find a correct page rather than an empty form,
 * and every one of those is theirs to change or clear.
 *
 * The free text a writer typed before is carried into `more`, so nothing they
 * wrote is lost by starting to use the fields.
 */
export const beginCopyright = (part: BookPart, file: ProjectFile): CopyrightPage =>
  copyrightPageSchema.parse({
    year: String(new Date(file.project.createdAt ?? new Date().toISOString()).getFullYear()),
    holder: bookNames(file).author,
    rights: RIGHTS_RESERVED,
    more: part.text.trim(),
  });

/**
 * The number line for a printing (§9k). The convention is a row of digits
 * whose **lowest** says which printing the copy in your hand is, so a first
 * printing shows all ten and each printing after drops the last.
 */
export const numberLine = (printing: number | null): string => {
  if (printing === null) return '';
  const lowest = Math.min(10, Math.max(1, Math.round(printing)));
  const digits: number[] = [];
  for (let at = 10; at >= lowest; at -= 1) digits.push(at);
  return digits.join(' ');
};

/** One line of the printed page: what it says, and whether it stands apart. */
export interface CopyrightLine {
  text: string;
  /** A paragraph of its own rather than a line in the block above. */
  apart: boolean;
}

/** The copyright notice as it prints: © 2026 Jane Doe. */
export const copyrightNotice = (page: CopyrightPage, file: ProjectFile): string => {
  const holder = page.holder.trim() || bookNames(file).author.trim();
  const year = page.year.trim();
  const parts = ['©', year, holder].filter((one) => one.length > 0);
  return parts.length > 1 ? `Copyright ${parts.join(' ')}` : '';
};

/**
 * The page, line by line, in the order a copyright page is set (§9k). It is
 * **the one reading** — the print, the spread and the dialog's own preview all
 * ask it, so what a writer is looking at is what the book will print.
 *
 * Nothing with nothing to say appears. That is the whole of why the record can
 * be left almost empty and still produce a page that reads correctly.
 */
export const copyrightLines = (part: BookPart, file: ProjectFile): CopyrightLine[] => {
  const page = copyrightOf(part);
  // Never used the dialog: the page is the free text it always was.
  if (!page) {
    return part.text
      .split(/\n{2,}/)
      .map((one) => one.trim())
      .filter((one) => one.length > 0)
      .map((text) => ({ text, apart: true }));
  }

  const out: CopyrightLine[] = [];
  const say = (text: string, apart = true) => {
    const trimmed = text.trim();
    if (trimmed.length > 0) out.push({ text: trimmed, apart });
  };

  // The book's own title heads the page whatever the order says: it is not
  // one of the elements a writer arranges, it is what the page is about.
  say(bookNames(file).title);

  // The writer's order (§15), where the hard-coded run of `say(…)` used to
  // be. Each element says its own piece and nothing knows where it falls.
  for (const id of copyrightOrder(page)) {
    if (!copyrightShows(page, id)) continue;
    switch (id) {
      case 'notice':
        say(copyrightNotice(page, file));
        break;
      case 'publisher': {
        const named = [page.publisher, page.publisherPlace].map((one) => one.trim()).filter((one) => one.length > 0);
        if (named.length > 0) say(named.join(', '));
        break;
      }
      case 'website':
        // Its own line under the publisher where there is one, so a long URL
        // never runs into the city.
        say(page.publisherUrl, !copyrightShows(page, 'publisher') || page.publisher.trim().length === 0);
        break;
      case 'lccn':
        if (page.lccn.trim().length > 0) say(`Library of Congress Control Number: ${page.lccn.trim()}`);
        break;
      case 'isbn':
        for (const [at, number] of page.numbers.entries()) {
          const format = number.format.trim();
          const digits = number.number.trim();
          if (digits.length === 0) continue;
          say(format.length > 0 ? `ISBN ${digits} (${format})` : `ISBN ${digits}`, at === 0);
        }
        break;
      case 'edition':
        say(page.edition);
        // The number line rides with the edition, which is where a book puts
        // it — and it is still worked out, with nowhere to type one.
        say(numberLine(page.printing), false);
        break;
      case 'barcode':
        // A picture rather than a line; `copyrightLines` says words, and the
        // print places the barcode itself.
        break;
      default: {
        const field = copyrightElement(id)?.field;
        if (field) say(String(page[field] ?? ''));
      }
    }
  }
  return out;
};

// -------------------------------------------------------- what is not filled

/** A placeholder a writer has still to fill in: `[YEAR]`, `[NAME]`. */
const PLACEHOLDER = /\[[^\]]*\]/g;

/**
 * How many placeholders are left across what the page will **print** (§15).
 *
 * Only the visible elements count, and an empty book number counts too: a
 * number set to show with nothing in it is a line the book cannot print. The
 * footer says the figure, and it never blocks anything — a writer who has not
 * got their ISBN yet still has a page.
 */
export const copyrightPlaceholders = (part: BookPart, file: ProjectFile): number => {
  const page = copyrightOf(part);
  if (!page) return (part.text.match(PLACEHOLDER) ?? []).length;
  let count = 0;
  for (const line of copyrightLines(part, file)) count += (line.text.match(PLACEHOLDER) ?? []).length;
  // An unfilled **binding** counts too, which is the handoff's own rule. A
  // notice with no holder still prints — *Copyright © 2026* — and a notice
  // with nobody in it is not a notice, so it is owed rather than silently
  // accepted.
  if (copyrightShows(page, 'notice')) {
    if (page.holder.trim().length === 0 && bookNames(file).author.trim().length === 0) count += 1;
    if (page.year.trim().length === 0) count += 1;
  }
  if (copyrightShows(page, 'isbn')) {
    count += page.numbers.filter((one) => one.number.trim().length === 0 && one.format.trim().length > 0).length;
  }
  return count;
};

/**
 * Whether a string is a well-formed ISBN-13 (§15's *checksum validation*).
 *
 * It answers **null for nothing typed** rather than false, because an empty
 * box is not a mistake — it is a book number the writer has not got yet, and
 * a red mark on it would be the program telling them off for waiting on their
 * publisher.
 */
export const isbnLooksRight = (value: string): boolean | null => {
  const digits = value.replace(/[\s-]/g, '');
  if (digits.length === 0) return null;
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let at = 0; at < 12; at += 1) sum += Number(digits[at]) * (at % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(digits[12]);
};

/** Set fields on the page, starting it from the book where there is none yet. */
export const setCopyright = (part: BookPart, file: ProjectFile, patch: Partial<CopyrightPage>): BookPart => ({
  ...part,
  ...({ copyright: copyrightPageSchema.parse({ ...(copyrightOf(part) ?? beginCopyright(part, file)), ...patch }) } as object),
});

/** A number for another format. */
export const addBookNumber = (page: CopyrightPage, format = ''): CopyrightPage => ({
  ...page,
  numbers: [...page.numbers, bookNumberSchema.parse({ format })],
});

export const setBookNumber = (page: CopyrightPage, at: number, patch: Partial<BookNumber>): CopyrightPage => ({
  ...page,
  numbers: page.numbers.map((one, index) => (index === at ? { ...one, ...patch } : one)),
});

export const removeBookNumber = (page: CopyrightPage, at: number): CopyrightPage => ({
  ...page,
  numbers: page.numbers.filter((_one, index) => index !== at),
});

/**
 * What the page says about itself, for the writer (§9k). It names what is
 * missing rather than hiding it, the one-sheet's rule (addendum 17 §3): a
 * copyright page is a page nobody proofreads until the book is printed.
 */
export const describeCopyright = (part: BookPart, file: ProjectFile): string => {
  const page = copyrightOf(part);
  if (!page) return 'Nothing is set yet. The page prints whatever words it holds.';
  const missing: string[] = [];
  if (copyrightNotice(page, file).length === 0) missing.push('the notice');
  if (page.numbers.every((one) => one.number.trim().length === 0)) missing.push('a number');
  if (page.publisher.trim().length === 0) missing.push('a publisher');
  const lines = copyrightLines(part, file).length;
  const said = `${lines} ${lines === 1 ? 'line' : 'lines'} print.`;
  return missing.length === 0 ? said : `${said} Still without ${missing.join(', ')}.`;
};
