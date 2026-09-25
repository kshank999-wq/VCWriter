import { describe, expect, it } from 'vitest';
import {
  TITLE_TEMPLATES,
  TITLE_TEMPLATE_WORDS,
  bookBlocks,
  createProjectFile,
  partStyleOf,
  partsOf,
  publisherOf,
  setBookSettings,
  setCopyright,
  titlePageContent,
  titlePageFieldsOf,
  titlePageShown,
  titleTemplateOf,
  titleTemplatePatch,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * **The book's title page** (addendum 20 §16, from Ken's handoff).
 *
 * What these pin is the three decisions: the publisher and the edition are
 * read from the copyright page rather than typed twice, an element switched
 * off is not an element left empty, and the arrangement is a **pair** of
 * heights read back rather than a stored word.
 */

const book = (): ProjectFile => createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });

const titlePart = (file: ProjectFile) => partsOf(file).find((one) => one.kind === 'title_page')!;
const copyrightPart = (file: ProjectFile) => partsOf(file).find((one) => one.kind === 'copyright')!;

/** The publisher typed where a book types it: on the copyright page. */
const withHouse = (file: ProjectFile): ProjectFile => {
  const part = copyrightPart(file);
  return updatePart(file, part.id, {
    copyright: setCopyright(part, file, {
      ...(part.copyright as never),
      publisher: 'Lamplight Books',
      publisherPlace: 'Hull, England',
      edition: 'Second Edition',
    } as never).copyright,
  });
};

describe('the title page’s elements', () => {
  it('reads the publisher, its place and the edition from the copyright page', () => {
    const file = withHouse(book());
    expect(publisherOf(file, partsOf(file))).toEqual({
      name: 'Lamplight Books',
      place: 'Hull, England',
      edition: 'Second Edition',
    });
  });

  it('falls back to the book’s own imprint where the copyright page names no publisher', () => {
    const file = setBookSettings(book(), { imprint: 'Shank & Co' });
    expect(publisherOf(file, partsOf(file)).name).toBe('Shank & Co');
  });

  it('prints an element that is on and says nothing about one that is off', () => {
    let file = withHouse(book());
    const part = titlePart(file);
    // The edition starts off — *only if not the first* — so the words are
    // there and the page does not say them.
    expect(titlePageContent(file, part, partsOf(file)).edition).toBe('');
    file = updatePart(file, part.id, { titlePage: { shows: { edition: true } } });
    expect(titlePageContent(file, titlePart(file), partsOf(file)).edition).toBe('Second Edition');
    // And switching it back off keeps the words on the copyright page: the
    // two are different intentions, so one never edits the other.
    file = updatePart(file, part.id, { titlePage: { shows: { edition: false } } });
    expect(titlePageContent(file, titlePart(file), partsOf(file)).edition).toBe('');
    expect(publisherOf(file, partsOf(file)).edition).toBe('Second Edition');
  });

  it('words the contributor’s line in the domain, by the role', () => {
    let file = book();
    const part = titlePart(file);
    file = updatePart(file, part.id, {
      titlePage: { contributor: 'Jane Doe', contributorRole: 'translator', shows: { contributor: true } },
    });
    expect(titlePageContent(file, titlePart(file), partsOf(file)).contributor).toBe('Translated by Jane Doe');
    file = updatePart(file, part.id, {
      titlePage: { contributor: 'Jane Doe', contributorRole: 'editor', shows: { contributor: true } },
    });
    expect(titlePageContent(file, titlePart(file), partsOf(file)).contributor).toBe('Edited by Jane Doe');
  });

  it('says nothing for an element switched on with nothing in it', () => {
    const file = book();
    const said = titlePageContent(file, titlePart(file), partsOf(file));
    // Location is on by default and prints nothing until a city is typed,
    // which is why turning it on by default is safe.
    expect(titlePageFieldsOf(titlePart(file)).shows.location).toBe(true);
    expect(said.location).toBe('');
  });

  it('counts the two required and whatever is shown', () => {
    let file = book();
    expect(titlePageShown(titlePart(file))).toBe(5);
    file = updatePart(file, titlePart(file).id, {
      titlePage: { shows: { subtitle: true, contributor: true, edition: true, publisher: true, location: true } },
    });
    expect(titlePageShown(titlePart(file))).toBe(7);
  });
});

describe('where the title and the author sit', () => {
  it('reads the arrangement off the pair of heights, never a stored word', () => {
    let file = book();
    // A page nobody has arranged reads as one of the three rather than as
    // custom, which is §9n's argument about the half title.
    expect(titleTemplateOf(partStyleOf(titlePart(file)))).toBe('stacked');
    file = updatePart(file, titlePart(file).id, { style: titleTemplatePatch('classic') });
    expect(titleTemplateOf(partStyleOf(titlePart(file)))).toBe('classic');
    // One height moved by hand and it is nobody's arrangement.
    file = updatePart(file, titlePart(file).id, { style: { ...partStyleOf(titlePart(file)), drop: 31 } });
    expect(titleTemplateOf(partStyleOf(titlePart(file)))).toBeNull();
  });

  it('asks the pair, because one height does not name an arrangement', () => {
    // Classic and Stacked disagree only about the author, so a reading that
    // asked the title's height alone would call them the same thing.
    expect(TITLE_TEMPLATE_WORDS.classic.drop).not.toBe(TITLE_TEMPLATE_WORDS.stacked.drop);
    expect(titleTemplateOf({ drop: 30, authorDrop: null })).toBeNull();
    expect(titleTemplateOf({ drop: 30, authorDrop: 52 })).toBe('classic');
  });

  it('offers no template that ranges the page, the alignment being its own control', () => {
    // The handoff's fourth — *Flush left* — is Classic's heights ranged left,
    // which is the conflation §9n took out. Keeping it would mean choosing a
    // template moved the page across as well as down.
    expect(TITLE_TEMPLATES).toEqual(['classic', 'stacked', 'high']);
    const ranged = { ...partStyleOf(titlePart(book())), ...titleTemplatePatch('classic'), align: 'left' as const };
    expect(titleTemplateOf(ranged)).toBe('classic');
  });
});

describe('the printed page', () => {
  const blockFor = (file: ProjectFile) => bookBlocks(file).find((one) => one.kind === 'title_page')!;

  it('hands the printer what the page says, already resolved', () => {
    const file = withHouse(book());
    const block = blockFor(file);
    expect(block.titlePage?.publisher).toBe('Lamplight Books');
    expect(block.titlePage?.location).toBe('Hull, England');
    // Off, so the printer is handed nothing rather than being asked to decide.
    expect(block.titlePage?.edition).toBe('');
  });

  it('stands the author in its own group only where it has a height of its own', () => {
    let file = book();
    expect(blockFor(file).partStyle?.authorDrop).toBeNull();
    file = updatePart(file, titlePart(file).id, { style: titleTemplatePatch('classic') });
    expect(blockFor(file).partStyle?.authorDrop).toBe(52);
  });
});
