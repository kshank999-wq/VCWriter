import { describe, expect, it } from 'vitest';
import {
  BACK_MATTER_ORDER,
  BACK_SINKS,
  aboutAuthorOf,
  acknowledgementsOf,
  addPart,
  authorLinksShown,
  authorNameOf,
  backMatterStatus,
  backSinkOf,
  bookBlocks,
  createProjectFile,
  isBackMatterPage,
  partStyleOf,
  partsOf,
  proseStyleBase,
  chapterPageStyleSchema,
  bookSettingsOf,
  sinkDrop,
  sinkPatch,
  updatePart,
  wordsIn,
  type BookPart,
  type ProjectFile,
} from '../index.js';

/**
 * **The back matter** (addendum 20 §17, from Ken's handoff for seven pages).
 *
 * What these pin is the four decisions the build rests on: the biography is
 * the page's words rather than a field beside them, the sink is named but
 * **starts at the head** so no existing page moves, the photograph and the
 * sign-off really reach the printed page, and every page that flows has no
 * sink to set.
 */

const book = (): ProjectFile => createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });

/** The page, made or found: a book may already carry one of some kinds. */
const withPage = (kind: BookPart['kind'], input: Partial<BookPart> = {}): { file: ProjectFile; part: BookPart } => {
  const start = book();
  const standing = partsOf(start).find((one) => one.kind === kind);
  if (standing) {
    const file = updatePart(start, standing.id, input as never);
    return { file, part: partsOf(file).find((one) => one.id === standing.id)! };
  }
  const made = addPart(start, kind, input as never);
  return { file: made.file, part: partsOf(made.file).find((one) => one.id === made.partId)! };
};

/** The style as the printer resolves it: the book's own, then the kind's. */
const styleOf = (file: ProjectFile, part: BookPart) =>
  partStyleOf(part, proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), bookSettingsOf(file).size));

const markup = (file: ProjectFile, partId: string): string =>
  bookBlocks(file)
    .filter((block) => block.partId === partId)
    .map((block) => `${block.kind}|${block.role ?? ''}|${block.text}`)
    .join('\n');

describe('which pages the screen serves', () => {
  it('names seven, in the order a book puts them', () => {
    expect(BACK_MATTER_ORDER).toEqual([
      'acknowledgements',
      'appendix',
      'glossary',
      'bibliography',
      'index',
      'about_the_author',
      'reader_extra',
    ]);
    expect(BACK_MATTER_ORDER.every((kind) => isBackMatterPage(kind))).toBe(true);
  });

  it('is not the front matter', () => {
    expect(isBackMatterPage('half_title')).toBe(false);
    expect(isBackMatterPage('title_page')).toBe(false);
    expect(isBackMatterPage('copyright')).toBe(false);
    expect(isBackMatterPage('contents')).toBe(false);
  });
});

describe('the sink', () => {
  it('offers a fourth step the handoff does not name, and it is the default', () => {
    // A prose part has stored `drop` and never read it, so the day the sink
    // became a control was the day it could move an existing foreword. *At
    // the head* is where every one of them already sits.
    expect(BACK_SINKS.map((one) => one.id)).toEqual(['head', 'shallow', 'standard', 'deep']);
    expect(sinkDrop('head')).toBe(0);
    const { file, part } = withPage('acknowledgements');
    expect(styleOf(file, part).drop).toBe(0);
    expect(backSinkOf(styleOf(file, part))).toBe('head');
  });

  it('is read back rather than stored, so a depth set by hand lights nothing', () => {
    expect(backSinkOf({ drop: sinkDrop('standard') })).toBe('standard');
    expect(backSinkOf({ drop: 17 })).toBeNull();
  });

  it('leaves a page at the head carrying no style at all', () => {
    // §7a's rule: only what differs from the book is drawn, so the markup of
    // a page nobody has set is byte for byte what it always was.
    const { file, part } = withPage('acknowledgements', { title: 'Acknowledgements', text: 'Thank you.' } as never);
    const opening = bookBlocks(file).find((block) => block.partId === part.id && block.kind === 'part_opening')!;
    expect(opening.partStyle).toBeUndefined();
  });

  it('draws the heading at its depth once a page asks for one', () => {
    const { file, part } = withPage('acknowledgements', { title: 'Acknowledgements', text: 'Thank you.' } as never);
    const sunk = updatePart(file, part.id, { style: sinkPatch('deep') });
    const opening = bookBlocks(sunk).find((block) => block.partId === part.id && block.kind === 'part_opening')!;
    expect(opening.partStyle?.drop).toBe(sinkDrop('deep'));
  });
});

describe('the page that prints its number, and the side it opens on', () => {
  it('takes a right-hand page until it is told otherwise', () => {
    const { file, part } = withPage('glossary', { title: 'Glossary', text: 'A word.' } as never);
    const opening = bookBlocks(file).find((block) => block.partId === part.id && block.kind === 'part_opening')!;
    expect(opening.starts).toBe('recto');
    expect(opening.folio).toBe(true);
  });

  it('opens on either side, and prints no number, where the page says so', () => {
    const { file, part } = withPage('glossary', { title: 'Glossary', text: 'A word.' } as never);
    const set = updatePart(file, part.id, { style: { recto: false, folio: false } });
    const blocks = bookBlocks(set).filter((block) => block.partId === part.id);
    expect(blocks[0]!.starts).toBe('page');
    expect(blocks.every((block) => block.folio === false)).toBe(true);
  });
});

describe('the acknowledgements', () => {
  it('keeps the sign-off’s words when it is switched off, and prints nothing', () => {
    // §15's rule: an element turned off is not an element left empty.
    const { file, part } = withPage('acknowledgements', { title: 'Acknowledgements', text: 'Thank you.' } as never);
    const signed = updatePart(file, part.id, { about: { signOff: true, signOffText: '— M. S.' } });
    expect(markup(signed, part.id)).toContain('paragraph|sign_off|— M. S.');

    const hidden = updatePart(signed, part.id, { about: { signOff: false, signOffText: '— M. S.' } });
    expect(markup(hidden, part.id)).not.toContain('sign_off');
    expect(acknowledgementsOf(partsOf(hidden).find((one) => one.id === part.id)!).signOffText).toBe('— M. S.');
  });

  it('says whether the thanks run past a page, from the words themselves', () => {
    const { file, part } = withPage('acknowledgements', { text: 'Thank you.' } as never);
    expect(backMatterStatus(partsOf(file).find((one) => one.id === part.id)!).warn).toBe(false);
    const long = updatePart(file, part.id, { text: new Array(500).fill('thanks').join(' ') });
    const status = backMatterStatus(partsOf(long).find((one) => one.id === part.id)!);
    expect(status.warn).toBe(true);
    expect(status.text).toContain('500 words');
  });
});

describe('about the author', () => {
  it('is the book’s author until the page names somebody else', () => {
    const { file, part } = withPage('about_the_author');
    expect(authorNameOf(file, part)).toBe('M. Shank');
    const named = updatePart(file, part.id, { about: { name: 'Marion Shank' } });
    expect(authorNameOf(named, partsOf(named).find((one) => one.id === part.id)!)).toBe('Marion Shank');
  });

  it('has no field for the biography, the page’s words being the biography', () => {
    // One value with one door (§16d). A `bio` beside `text` would strand
    // whatever an author had already typed on the page.
    const { file, part } = withPage('about_the_author', { text: 'She writes at night.' } as never);
    expect(aboutAuthorOf(part)).not.toHaveProperty('bio');
    expect(markup(file, part.id)).toContain('paragraph||She writes at night.');
    expect(backMatterStatus(partsOf(file).find((one) => one.id === part.id)!).text).toContain(`${wordsIn('She writes at night.')} words`);
  });

  it('prints only the links that have words, and only the ones shown', () => {
    const { file, part } = withPage('about_the_author', { text: 'She writes at night.' } as never);
    const linked = updatePart(file, part.id, {
      about: {
        links: [
          { kind: 'website', shows: true, text: 'shank.example' },
          { kind: 'newsletter', shows: false, text: 'letters.example' },
          { kind: 'social', shows: true, text: '' },
        ],
      },
    });
    const now = partsOf(linked).find((one) => one.id === part.id)!;
    expect(authorLinksShown(now)).toEqual(['shank.example']);
    const said = markup(linked, part.id);
    expect(said).toContain('paragraph|author_link|shank.example');
    expect(said).not.toContain('letters.example');
  });

  it('puts the photograph above the words, or cuts it in beside them, or neither', () => {
    const { file, part } = withPage('about_the_author', { text: 'She writes at night.' } as never);
    const above = updatePart(file, part.id, { about: { photoAssetId: 'photo-1', place: 'above', shape: 'circle' } });
    const figure = bookBlocks(above).find((block) => block.partId === part.id && block.kind === 'figure');
    expect(figure?.assetId).toBe('photo-1');
    expect(figure?.photoShape).toBe('circle');

    const beside = updatePart(file, part.id, { about: { photoAssetId: 'photo-1', place: 'beside', shape: 'square' } });
    const paragraph = bookBlocks(beside).find((block) => block.partId === part.id && block.kind === 'paragraph')!;
    expect(paragraph.inset?.assetId).toBe('photo-1');
    expect(paragraph.photoShape).toBe('square');
    expect(bookBlocks(beside).some((block) => block.partId === part.id && block.kind === 'figure')).toBe(false);

    const none = updatePart(file, part.id, { about: { photoAssetId: 'photo-1', place: 'none' } });
    expect(bookBlocks(none).some((block) => block.partId === part.id && block.kind === 'figure')).toBe(false);
    expect(bookBlocks(none).find((block) => block.partId === part.id && block.kind === 'paragraph')?.inset).toBeUndefined();
  });
});
