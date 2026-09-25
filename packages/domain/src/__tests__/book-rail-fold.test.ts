import { describe, expect, it } from 'vitest';
import { rowHasUnder, visibleRows, type BookPageRow, type BookRow } from '../index.js';

/**
 * **What a fold hides** (addendum 20 §9o, from Ken: *when you collapse a
 * story, it only collapses the first chapter. It needs to collapse the entire
 * story until the next one… it still shows the opening page even when you
 * collapse it*).
 *
 * Both halves of that were one fault: the fold hid a row's **pages** and
 * never asked about **depth**, which §9a settled is the only thing
 * containment is. These pin the rule rather than the symptom — a closed
 * division hides every row under it, whatever is under it, however deep.
 */

const row = (id: string, kind: BookRow['kind'], depth: number, title = id): BookRow =>
  ({ id, kind, depth, title, half: 'body', label: '', placed: null, draggable: true }) as unknown as BookRow;

/** Ken's book: three stories, three chapters each. */
const threeStories = (): BookRow[] => [
  row('half', 'part', 0, 'Half title'),
  row('s1', 'chapter', 0, 'Story 1'),
  row('s1c1', 'section', 1, 'I.'),
  row('s1c2', 'section', 1, 'II.'),
  row('s1c3', 'section', 1, 'III.'),
  row('s2', 'chapter', 0, 'Story 2'),
  row('s2c1', 'section', 1, 'I.'),
  row('s2c2', 'section', 1, 'II.'),
  row('s2c3', 'section', 1, 'III.'),
  row('s3', 'chapter', 0, 'Story 3'),
  row('s3c1', 'section', 1, 'I.'),
  row('back', 'part', 0, 'About the author'),
];

const names = (rows: readonly BookRow[]): string[] => rows.map((one) => one.id);

describe('collapsing a story', () => {
  it('hides the whole story, not only its first chapter', () => {
    // The report, exactly: a story of three chapters closed to twelve rows.
    const shut = visibleRows(threeStories(), []);
    expect(names(shut)).toEqual(['half', 's1', 's2', 's3', 'back']);
  });

  it('hides it up to the next story and no further', () => {
    // Opening story 1 and 3 and leaving 2 shut: the boundary is the next row
    // at the closed row's own level, which is the next story.
    const shown = visibleRows(threeStories(), ['s1', 's3']);
    expect(names(shown)).toEqual(['half', 's1', 's1c1', 's1c2', 's1c3', 's2', 's3', 's3c1', 'back']);
  });

  it('leaves the back matter alone, a part being nobody’s child', () => {
    const shown = visibleRows(threeStories(), []);
    expect(shown.at(-1)!.id).toBe('back');
  });

  it('opens one story without opening its neighbours', () => {
    const shown = visibleRows(threeStories(), ['s2']);
    expect(names(shown)).toEqual(['half', 's1', 's2', 's2c1', 's2c2', 's2c3', 's3', 'back']);
  });
});

describe('a picture under a chapter', () => {
  const withPicture = (): BookRow[] => [
    row('s1', 'chapter', 0, 'Story 1'),
    row('s1c1', 'section', 1, 'I.'),
    row('pic', 'picture', 2, 'The lamp'),
    row('s2', 'chapter', 0, 'Story 2'),
  ];

  it('goes when its chapter closes', () => {
    expect(names(visibleRows(withPicture(), ['s1']))).toEqual(['s1', 's1c1', 's2']);
  });

  it('goes when the story above it closes, being deeper still', () => {
    // The rule is depth rather than one level of nesting, so a closed story
    // takes everything under it however far down it sits.
    expect(names(visibleRows(withPicture(), ['s1c1']))).toEqual(['s1', 's2']);
  });

  it('comes back when both are open', () => {
    expect(names(visibleRows(withPicture(), ['s1', 's1c1']))).toEqual(['s1', 's1c1', 'pic', 's2']);
  });
});

describe('the arrow', () => {
  const page = (id: string): BookPageRow => ({ id } as unknown as BookPageRow);

  it('is there where a row has pages of its own', () => {
    const rows = threeStories();
    const folds = new Map([['s2c1', [page('p1')]]]);
    expect(rowHasUnder(rows, folds, rows.find((one) => one.id === 's2c1')!)).toBe(true);
  });

  it('is there where a row has rows under it but no page of its own', () => {
    // A story's opening page belongs to its first chapter, so the story row
    // often owns no page at all — and still has three chapters to show.
    const rows = threeStories();
    expect(rowHasUnder(rows, new Map(), rows.find((one) => one.id === 's1')!)).toBe(true);
  });

  it('is absent where there is neither, rather than opening onto nothing', () => {
    const rows = threeStories();
    expect(rowHasUnder(rows, new Map(), rows.find((one) => one.id === 's3c1')!)).toBe(false);
  });

  it('is never on a part or a picture, which hold nothing', () => {
    const rows = threeStories();
    expect(rowHasUnder(rows, new Map(), rows[0]!)).toBe(false);
  });
});
