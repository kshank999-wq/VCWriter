/**
 * Where an eBook is going, as data (addendum 23 §3).
 *
 * One package is built for every retailer; what differs is what each one
 * checks for and asks to be delivered beside it. Those differences are
 * **rules, not renderers** — numbers and switches read by the preflight and
 * the deliverable writer — because retailers change their limits and a
 * limit in a table is a line to edit, where a limit in a branch is a bug to
 * find. The figures are the ones each retailer published as of September
 * 2026, cited in the addendum; when one moves, this is the place.
 */

export type EbookTarget = 'universal' | 'kindle' | 'apple' | 'nook' | 'kobo' | 'google' | 'd2d' | 'ingram';

export interface EbookRules {
  id: EbookTarget;
  name: string;
  /** A sentence for the picker. */
  about: string;
  /** The package may be no bigger; null is no limit worth stating. */
  maxFileMB: number | null;
  /** The cover's shorter side, in pixels, or null. */
  coverMinShortAxis: number | null;
  /** Both sides of the cover at least this, or null. */
  coverMinEachSide: number | null;
  /** The cover's longer side at most this, or null. */
  coverMaxLongAxis: number | null;
  /** The cover file may be no bigger, in megabytes, or null. */
  coverMaxMB: number | null;
  /** No picture inside the book may have more pixels than this, or null. */
  interiorPixelLimit: number | null;
  /** The package must carry the cover as its first page. */
  requiresEmbeddedCover: boolean;
  /** A cover file is written beside the package for the retailer's upload form. */
  requiresSeparateCover: boolean;
  /** The retailer's workflow needs an ISBN. */
  requiresIsbn: boolean;
  /** An EPUB 2 table of contents is written beside the EPUB 3 one, for older readers. */
  includeNcx: boolean;
  /** What to do at the retailer once the files exist. */
  checklist: string[];
}

const rules = (input: EbookRules): EbookRules => input;

export const EBOOK_RULES: Record<EbookTarget, EbookRules> = {
  universal: rules({
    id: 'universal',
    name: 'Universal EPUB',
    about: 'One standards EPUB 3.3 that every store takes; the recommended export.',
    maxFileMB: null,
    coverMinShortAxis: 1400,
    coverMinEachSide: null,
    coverMaxLongAxis: null,
    coverMaxMB: null,
    interiorPixelLimit: null,
    requiresEmbeddedCover: false,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: true,
    checklist: ['Upload the EPUB to each store; upload the cover file where the store asks for one separately.'],
  }),
  kindle: rules({
    id: 'kindle',
    name: 'Amazon Kindle (KDP)',
    about: 'EPUB for KDP, which converts it itself; MOBI is not made.',
    maxFileMB: null,
    coverMinShortAxis: 625,
    coverMinEachSide: null,
    coverMaxLongAxis: null,
    coverMaxMB: 50,
    interiorPixelLimit: null,
    requiresEmbeddedCover: false,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: true,
    checklist: [
      'Open the EPUB in Kindle Previewer before uploading; KDP recommends it.',
      'Upload the cover file on the KDP form (ideal 2560 × 1600 px, JPEG or TIFF, RGB).',
    ],
  }),
  apple: rules({
    id: 'apple',
    name: 'Apple Books',
    about: 'EPUB 3.3 with Apple’s cover and picture limits checked.',
    maxFileMB: null,
    coverMinShortAxis: 1400,
    coverMinEachSide: null,
    coverMaxLongAxis: null,
    coverMaxMB: null,
    interiorPixelLimit: 5_600_000,
    requiresEmbeddedCover: true,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: false,
    checklist: ['Upload the EPUB and the cover in Apple Books for Authors or iTunes Producer.'],
  }),
  nook: rules({
    id: 'nook',
    name: 'Barnes & Noble Press (NOOK)',
    about: 'Reflowable EPUB with an EPUB 2 contents file for older NOOKs.',
    maxFileMB: null,
    coverMinShortAxis: null,
    coverMinEachSide: 1400,
    coverMaxLongAxis: null,
    coverMaxMB: null,
    interiorPixelLimit: null,
    requiresEmbeddedCover: false,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: true,
    checklist: ['Upload the EPUB and the cover on B&N Press.'],
  }),
  kobo: rules({
    id: 'kobo',
    name: 'Kobo Writing Life',
    about: 'EPUB under 100 MB, cover under 5 MB.',
    maxFileMB: 100,
    coverMinShortAxis: null,
    coverMinEachSide: null,
    coverMaxLongAxis: null,
    coverMaxMB: 5,
    interiorPixelLimit: null,
    requiresEmbeddedCover: false,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: true,
    checklist: ['Upload the EPUB and the cover (portrait, about 3:4) on Kobo Writing Life.'],
  }),
  google: rules({
    id: 'google',
    name: 'Google Play Books',
    about: 'EPUB 3.3 with the cover inside it; the printed PDF may go beside it.',
    maxFileMB: 2000,
    coverMinShortAxis: 640,
    coverMinEachSide: null,
    coverMaxLongAxis: 7200,
    coverMaxMB: null,
    interiorPixelLimit: null,
    requiresEmbeddedCover: true,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: true,
    checklist: [
      'Upload the EPUB on the Play Books Partner Center.',
      'To offer the printed layout too, export the book as a PDF from the Layout room and upload it beside the EPUB.',
    ],
  }),
  d2d: rules({
    id: 'd2d',
    name: 'Draft2Digital',
    about: 'A finished EPUB with the cover as its first page, and the cover beside it.',
    maxFileMB: 90,
    coverMinShortAxis: null,
    coverMinEachSide: null,
    coverMaxLongAxis: null,
    coverMaxMB: null,
    interiorPixelLimit: null,
    requiresEmbeddedCover: true,
    requiresSeparateCover: true,
    requiresIsbn: false,
    includeNcx: true,
    checklist: ['Upload the EPUB as your own file on Draft2Digital, and the cover on the cover step.'],
  }),
  ingram: rules({
    id: 'ingram',
    name: 'IngramSpark',
    about: 'EPUB under 100 MB with an eBook ISBN, and a JPEG cover beside it.',
    maxFileMB: 100,
    coverMinShortAxis: null,
    coverMinEachSide: null,
    coverMaxLongAxis: null,
    coverMaxMB: null,
    interiorPixelLimit: 5_600_000,
    requiresEmbeddedCover: true,
    requiresSeparateCover: true,
    requiresIsbn: true,
    includeNcx: true,
    checklist: ['Upload the EPUB as the interior and the JPEG as the cover on IngramSpark.'],
  }),
};

export const EBOOK_TARGETS: readonly EbookTarget[] = ['universal', 'kindle', 'apple', 'nook', 'kobo', 'google', 'd2d', 'ingram'];

export const ebookRulesFor = (target: string): EbookRules => EBOOK_RULES[(target as EbookTarget) in EBOOK_RULES ? (target as EbookTarget) : 'universal'];
