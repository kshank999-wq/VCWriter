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
  /** Anything the fields have no room for, printed under them. */
  more: z.string().default(''),
});
export type CopyrightPage = z.infer<typeof copyrightPageSchema>;

export const RIGHTS_RESERVED = 'All rights reserved.';

export const FICTION_DISCLAIMER =
  'This is a work of fiction. Names, characters, places and incidents are the product of the author’s imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events or locales is entirely coincidental.';

export const BARCODE_INCHES = { min: 0.75, max: 4, default: 2 } as const;

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

  say(bookNames(file).title);
  say(copyrightNotice(page, file));
  say(page.rights);

  const publisher = [page.publisher, page.publisherPlace].map((one) => one.trim()).filter((one) => one.length > 0);
  if (publisher.length > 0) say(publisher.join(', '));
  // The address's own line, so a long URL never runs into the city.
  if (publisher.length > 0) say(page.publisherUrl, false);
  else say(page.publisherUrl);

  for (const [at, number] of page.numbers.entries()) {
    const format = number.format.trim();
    const digits = number.number.trim();
    if (digits.length === 0) continue;
    say(format.length > 0 ? `ISBN ${digits} (${format})` : `ISBN ${digits}`, at === 0);
  }

  say(page.edition);
  say(page.disclaimer);
  say(page.credits);
  say(page.printedIn);
  say(page.more);
  say(numberLine(page.printing));
  return out;
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
