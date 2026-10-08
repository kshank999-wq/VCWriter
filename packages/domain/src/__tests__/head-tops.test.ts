import { describe, expect, it } from 'vitest';
import {
  HEAD_CONTENTS,
  bookSettingsOf,
  createProjectFile,
  describeHeadTops,
  headTextFor,
  setBookSettings,
  type BookSettings,
  type ProjectFile,
} from '../index.js';

/**
 * **Which title goes on which top** (addendum 20 §7c, from Ken: *there needs
 * to be another category called chapter or story title… right now, if you add
 * a book title, it adds it to both sides of the page for some reason. There's
 * no way to determine the title on one side or the other*).
 *
 * The category he asks for has been one of §7a's five since the running heads
 * were made adjustable, and the two sides have been separate just as long —
 * what this pins is the half that was missing. The sides are **two controls**
 * (§7b's single select naming both at once was the same shape as the
 * complaint), and the sentence says **what the two tops will actually print**,
 * which is the only thing that can show a writer why both of them read the
 * same words.
 */

const settingsOf = (patch: Partial<BookSettings>, format: ProjectFile['project']['format'] = 'short_story'): BookSettings =>
  bookSettingsOf(setBookSettings(createProjectFile({ title: 'The Harbour', format }), patch));

const heads = (verso: string, recto: string): Partial<BookSettings> => ({
  runningHeads: { verso, recto, versoText: '', rectoText: '', place: 'centre' } as BookSettings['runningHeads'],
});

const NAMES = { title: 'Harbour Tales', author: 'K. Shank' };

describe('the two sides are set apart', () => {
  it('offers the same five to each side, the division’s title among them', () => {
    expect([...HEAD_CONTENTS]).toEqual(['author', 'title', 'chapter', 'custom', 'none']);
  });

  it('lets one side carry the book and the other the story', () => {
    const settings = settingsOf(heads('title', 'chapter'));
    expect(headTextFor('verso', settings, NAMES, 'The Harbour')).toBe('Harbour Tales');
    expect(headTextFor('recto', settings, NAMES, 'The Harbour')).toBe('The Harbour');
  });

  it('keeps each side’s own words apart', () => {
    const settings = settingsOf({
      runningHeads: { verso: 'custom', recto: 'custom', versoText: 'A Harbour Reader', rectoText: 'Stories', place: 'centre' },
    });
    expect(headTextFor('verso', settings, NAMES, '')).toBe('A Harbour Reader');
    expect(headTextFor('recto', settings, NAMES, '')).toBe('Stories');
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

  it('names the category in the format’s own noun where there is no division to read yet', () => {
    // Inventing a title would be worse than saying which title it will be.
    const settings = settingsOf(heads('title', 'chapter'));
    expect(describeHeadTops(settings, NAMES, '', 'short_story')).toBe('“Harbour Tales” on the left, each story’s own title on the right.');
    expect(describeHeadTops(settings, NAMES, '', 'instructional')).toBe('“Harbour Tales” on the left, each chapter’s own title on the right.');
    expect(describeHeadTops(settings, NAMES, '', 'series')).toBe('“Harbour Tales” on the left, each episode’s own title on the right.');
  });
});
