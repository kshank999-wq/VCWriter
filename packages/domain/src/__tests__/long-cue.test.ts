import { describe, expect, it } from 'vitest';
import {
  BBC_TAPED_LAYOUT,
  STAGE_UK_BBC_LAYOUT,
  STAGE_UK_CONTEMPORARY_LAYOUT,
  manuscriptElementSchema,
  paginateElements,
  type ManuscriptElementType,
  type PageLayoutSpec,
} from '../index.js';

/**
 * **The long cue** (addendum 38 §6, the spec's §9 acceptance test): where the
 * cue sits in the margin beside its speech, a name too long for the margin
 * drops onto its own line rather than pushing the speech out of its column.
 */

let next = 0;
const el = (type: ManuscriptElementType, text: string) =>
  manuscriptElementSchema.parse({
    id: `00000000-0000-4000-8000-${String((next += 1)).padStart(12, '0')}`,
    type,
    text,
  });

const linesOf = (layout: PageLayoutSpec, cue: string, words = 'You came.') =>
  (paginateElements([el('action', 'The bell rings.'), el('character', cue), el('dialogue', words)], layout)[0]
    ?.lines ?? []
  ).map((line) => ({ type: line.type, text: line.text, indent: line.indent }));

describe('a cue beside its speech', () => {
  it('stays beside it when the name fits the margin', () => {
    const lines = linesOf(STAGE_UK_BBC_LAYOUT, 'Sarah');
    const speech = lines.at(-1)!;
    expect(speech.text).toBe('SARAH'.padEnd(16) + 'You came.');
    expect(lines.filter((line) => line.type === 'character')).toHaveLength(0);
  });

  it('drops onto its own line when the name would run into the speech', () => {
    const cue = 'The Second Gravedigger';
    const lines = linesOf(STAGE_UK_BBC_LAYOUT, cue);
    const at = lines.findIndex((line) => line.type === 'character');
    expect(lines[at]).toEqual({ type: 'character', text: cue.toUpperCase(), indent: 0 });
    // The speech is straight under it, in its own column, with no blank.
    expect(lines[at + 1]).toEqual({ type: 'dialogue', text: 'You came.', indent: 16 });
  });

  it('drops a name exactly as wide as the margin, which would leave no space after it', () => {
    const margin = STAGE_UK_CONTEMPORARY_LAYOUT.indent['dialogue'] ?? 0;
    const lines = linesOf(STAGE_UK_CONTEMPORARY_LAYOUT, 'X'.repeat(margin));
    expect(lines.some((line) => line.type === 'character')).toBe(true);
    // One shorter leaves the one space, and stays beside.
    const fits = linesOf(STAGE_UK_CONTEMPORARY_LAYOUT, 'X'.repeat(margin - 1));
    expect(fits.some((line) => line.type === 'character')).toBe(false);
  });

  it('reaches BBC taped too, the layout it was built for', () => {
    const lines = linesOf(BBC_TAPED_LAYOUT, 'Detective Inspector Harrington');
    expect(lines.some((line) => line.type === 'character')).toBe(true);
  });

  it('keeps the dropped cue with its speech at the foot of a page', () => {
    const filler = Array.from({ length: 52 }, (_, at) => el('action', `Line ${at}.`));
    const pages = paginateElements(
      [...filler, el('character', 'The Second Gravedigger'), el('dialogue', 'One.\nTwo.\nThree.')],
      STAGE_UK_BBC_LAYOUT,
    );
    const last = pages.at(-1)!;
    const cueAt = last.lines.findIndex((line) => line.type === 'character');
    expect(cueAt).toBeGreaterThanOrEqual(0);
    expect(last.lines[cueAt + 1]?.type).toBe('dialogue');
    // Not stranded at the foot of the page before.
    expect(pages.at(-2)?.lines.some((line) => line.type === 'character')).toBe(false);
  });
});
