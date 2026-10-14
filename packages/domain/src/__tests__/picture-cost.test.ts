import { describe, expect, it } from 'vitest';
import { sayPictureCost } from '../index.js';

/**
 * **What a picture is doing to the words, said before it is kept** (addendum
 * 20 §9at, from Ken: *show a preview before committing that says whether the
 * text will move, which the writer approves or not*).
 *
 * §9d settled that the book is laid **live** while a picture is dragged, which
 * is Ken's own earlier ask — *you can slide it around and watch the text move
 * around it* — and that stays. What was missing is the sentence beside it:
 * driven in the room before a line was written, drawing a box took the page
 * from 32 characters to 87 the instant the pointer went up, and the handle
 * said *2.09 × 2.33 in · 50% of the measure* and nothing whatever about the
 * paragraphs that had just moved or about the book being a page longer.
 *
 * The unit is **the length of the book**, deliberately: a paragraph pushed
 * down is on the spread in front of the writer, and a leaf added four chapters
 * on is not.
 */
describe('what a picture costs, said on the handle', () => {
  it('says nothing moves for a graphic set over the page', () => {
    // §8c's free graphic takes no room in the flow, so there is no length
    // clause at all — a page count said about it would be noise.
    expect(sayPictureCost({ place: 'free', pages: 0, runsRound: false })).toBe(
      'Nothing moves: it stands over the page and the words are exactly where they were.',
    );
  });

  it('names the pages a picture of its own added, in the plural it earns', () => {
    expect(sayPictureCost({ place: 'page', pages: 1, runsRound: false })).toBe(
      'It is a page of its own, and the words go on after it. The book is 1 page longer.',
    );
    expect(sayPictureCost({ place: 'page', pages: 2, runsRound: false })).toBe(
      'It is a page of its own, and the words go on after it. The book is 2 pages longer.',
    );
  });

  it('says the book is the length it was where it is', () => {
    /**
     * **The commonest answer and the one worth saying** (§9at). A picture
     * dropped into white the page already had costs nothing, and a writer who
     * is told so stops counting pages — which is the whole reason Ken asked
     * for the preview.
     */
    expect(sayPictureCost({ place: 'measure', pages: 0, runsRound: false })).toBe(
      'The words stand above it and below it, never beside it. The book is the length it was.',
    );
  });

  it('says a picture shorter, which a leaf standing in for a gap can be', () => {
    // §9al measured this: a picture taking a separating sheet's place leaves
    // the book shorter than it was, so the sentence has to be able to say so
    // rather than claiming nothing happened.
    expect(sayPictureCost({ place: 'page', pages: -2, runsRound: false })).toMatch(/The book is 2 pages shorter\./);
    expect(sayPictureCost({ place: 'page', pages: -1, runsRound: false })).toMatch(/The book is 1 page shorter\./);
  });

  it('tells a picture the words run round from one with nothing left to run round it', () => {
    /**
     * §8's rule is that an inset with no paragraph after it stands across the
     * measure — true since the inset was built, and the thing §9ak found a
     * writer could only discover by looking. The sentence separates the two,
     * because *cut in at the left* and *drawn full width* look like a control
     * that did not take.
     */
    expect(sayPictureCost({ place: 'left', pages: 0, runsRound: true })).toBe(
      'The words after it run round it. The book is the length it was.',
    );
    expect(sayPictureCost({ place: 'right', pages: 1, runsRound: false })).toBe(
      'Nothing follows it for the words to run round, so it stands across the measure. The book is 1 page longer.',
    );
  });
});
