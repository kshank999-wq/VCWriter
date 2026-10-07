import { describe, expect, it } from 'vitest';
import {
  HEAD_ARRANGEMENTS,
  bookSettingsOf,
  createProjectFile,
  describeHeadTops,
  headArrangementOf,
  headTextFor,
  sayArrangement,
  setBookSettings,
  type BookSettings,
  type ProjectFile,
} from '../index.js';

/**
 * **Along the top of the pages** (addendum 20 §7b, from Ken: *there needs to
 * be another category called chapter or story title… right now, if you add a
 * book title, it adds it to both sides of the page for some reason. There's
 * no way to determine the title on one side or the other*).
 *
 * The pair that decides the two tops has existed since §7a and the category he
 * asks for is one of its five values, named in the format's own noun. What is
 * tested here is the half that was missing: the pair said **once** as a named
 * arrangement, which arrangement is in force **read back rather than stored**,
 * and the sentence that says what the two tops will actually print — the one
 * thing that can show a writer why both of them read the same words.
 */

const settingsOf = (patch: Partial<BookSettings>, format: ProjectFile['project']['format'] = 'short_story'): BookSettings =>
  bookSettingsOf(setBookSettings(createProjectFile({ title: 'The Harbour', format }), patch));

const heads = (verso: string, recto: string): Partial<BookSettings> => ({
  runningHeads: { verso, recto, versoText: '', rectoText: '', place: 'centre' } as BookSettings['runningHeads'],
});

const NAMES = { title: 'Harbour Tales', author: 'K. Shank' };

describe('the two tops as one named arrangement', () => {
  it('is read back off the pair, never stored', () => {
    // The book's own default is the classic novel convention.
    expect(headArrangementOf(settingsOf({}))?.id).toBe('author_division');
    expect(headArrangementOf(settingsOf(heads('title', 'chapter')))?.id).toBe('title_division');
    expect(headArrangementOf(settingsOf(heads('chapter', 'chapter')))?.id).toBe('division_both');
    expect(headArrangementOf(settingsOf(heads('none', 'none')))?.id).toBe('none');
  });

  it('answers with nothing where the sides were set on their own', () => {
    // `bookPresetOf`'s rule: the nearest one would be a claim about a book
    // nobody set, and a writer who set a side by hand has not chosen a list.
    expect(headArrangementOf(settingsOf(heads('custom', 'chapter')))).toBeNull();
    expect(headArrangementOf(settingsOf(heads('author', 'author')))).toBeNull();
  });

  it('writes the same two fields the pair writes, so there is one answer', () => {
    const one = HEAD_ARRANGEMENTS.find((entry) => entry.id === 'title_division')!;
    const settings = settingsOf(heads(one.verso, one.recto));
    expect(headTextFor('verso', settings, NAMES, 'The Harbour')).toBe('Harbour Tales');
    expect(headTextFor('recto', settings, NAMES, 'The Harbour')).toBe('The Harbour');
  });

  it('names each arrangement in the format’s own noun, naming nothing itself', () => {
    const one = HEAD_ARRANGEMENTS.find((entry) => entry.id === 'title_division')!;
    expect(sayArrangement(one, 'short_story')).toBe('The book’s title on the left, the story’s title on the right');
    expect(sayArrangement(one, 'novel')).toBe('The book’s title on the left, the chapter’s title on the right');
    expect(sayArrangement(one, 'series')).toBe('The book’s title on the left, the episode’s title on the right');
    // A pair that is the same on both sides is said once rather than twice.
    expect(sayArrangement(HEAD_ARRANGEMENTS.find((entry) => entry.id === 'division_both')!, 'short_story')).toBe('The story’s title on both');
    expect(sayArrangement(HEAD_ARRANGEMENTS.find((entry) => entry.id === 'none')!, 'novel')).toBe('Nothing along the top');
  });
});

describe('what the two tops will actually print', () => {
  it('names the words rather than the category, which is what makes it checkable', () => {
    const settings = settingsOf(heads('title', 'chapter'));
    expect(describeHeadTops(settings, NAMES, 'The Harbour', 'short_story')).toBe(
      '“Harbour Tales” on the left, “The Harbour” on the right.',
    );
  });

  /**
   * **His own case.** A collection of one story, imported from a file, is
   * named after that file and so is its story — so both tops print the same
   * words and nothing on the screen said which of them was the story's. That
   * is the whole of *it adds it to both sides of the page for some reason*:
   * not a fault, and unreadable as anything else until it is said.
   */
  it('says so where both tops read the same words', () => {
    const settings = settingsOf(heads('title', 'chapter'));
    const same = { title: 'The Harbour', author: '' };
    expect(describeHeadTops(settings, same, 'The Harbour', 'short_story')).toBe(
      '“The Harbour” on the left, “The Harbour” on the right. Both tops read the same words.',
    );
  });

  it('calls an empty side nothing, and no head at all nothing on either page', () => {
    // The default on a book with no author typed: the left top is blank, which
    // is the state a writer meets and the reason they reach for the title.
    expect(describeHeadTops(settingsOf({}), { title: 'Harbour Tales', author: '' }, 'The Harbour', 'short_story')).toBe(
      'Nothing on the left, “The Harbour” on the right.',
    );
    expect(describeHeadTops(settingsOf(heads('none', 'none')), NAMES, 'The Harbour', 'novel')).toBe(
      'Nothing is printed along the top of either page.',
    );
  });

  it('names the category where the book has no division to read yet', () => {
    // Inventing a title would be worse than saying which title it will be.
    const settings = settingsOf(heads('title', 'chapter'));
    expect(describeHeadTops(settings, NAMES, '', 'short_story')).toBe('“Harbour Tales” on the left, each story’s own title on the right.');
    expect(describeHeadTops(settings, NAMES, '', 'instructional')).toBe('“Harbour Tales” on the left, each chapter’s own title on the right.');
  });
});
