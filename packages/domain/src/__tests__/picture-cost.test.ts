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

  it('says which page it came out on when that is not the page pressed', () => {
    /**
     * **Measured in the real room** (§9au): a chapter's opening spends 221 px
     * of a 694 px page before a word is set, and a picture across the measure
     * wants 495 px where about 350 are left — so the cutter moves it to the
     * next page and the book does not change length. Both of §9at's clauses
     * were true of that and neither said the one thing the writer could see.
     */
    expect(
      sayPictureCost({ place: 'measure', pages: 0, runsRound: false, chosen: '1', landed: '2', room: 17, wants: 25, span: 1 }),
    ).toBe('It stands on page 2, not page 1: it takes 25 lines and 17 are left there. Narrow it to about 68% and it comes back. The book is the length it was.');
  });

  it('says nothing about where it stands when it stands where it was put', () => {
    // The ordinary case, and the one that must stay quiet: a sentence about
    // the page would be noise on every picture that landed correctly.
    const put = sayPictureCost({ place: 'measure', pages: 0, runsRound: false, chosen: '4', landed: '4', room: 30, wants: 6, span: 1 });
    expect(put).toBe('The words stand above it and below it, never beside it. The book is the length it was.');
    expect(put).not.toMatch(/stands on page/);
  });

  it('scales the way out by the width it has now, not by the whole measure', () => {
    // The height follows the width, so a picture already at 80% that must
    // give up a third of its lines wants about 53% — not 68%.
    expect(
      sayPictureCost({ place: 'left', pages: 0, runsRound: true, chosen: '3', landed: '4', room: 17, wants: 25, span: 0.8 }),
    ).toMatch(/Narrow it to about 54% and it comes back\./);
  });

  it('names no width where the page has no room at all', () => {
    // A number here would be *narrow it to 0%*, which is not a width and not
    // a way out; what a writer can do is move it, and the sentence says why.
    const full = sayPictureCost({ place: 'measure', pages: 1, runsRound: false, chosen: '9', landed: '10', room: 0, wants: 20, span: 1 });
    expect(full).toBe('It stands on page 10, not page 9: there is no room left on that page. The book is 1 page longer.');
  });

  it('says where it stands without the numbers where the room cannot count them', () => {
    expect(sayPictureCost({ place: 'measure', pages: 0, runsRound: false, chosen: 'ii', landed: 'iii' })).toBe(
      'It stands on page iii, not page ii: it does not fit in the room left there. The book is the length it was.',
    );
  });

  it('leaves a graphic over the page alone, which moves nothing and lands nowhere else', () => {
    // It takes no room in the flow, so it cannot be moved by the cutter and a
    // landing clause about it would be about something that cannot happen.
    expect(
      sayPictureCost({ place: 'free', pages: 0, runsRound: false, chosen: '1', landed: '2', room: 3, wants: 9, span: 1 }),
    ).toBe('Nothing moves: it stands over the page and the words are exactly where they were.');
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
