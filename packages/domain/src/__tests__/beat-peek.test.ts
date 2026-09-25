import { describe, expect, it } from 'vitest';
import {
  PEEK_OPENING_WORDS,
  addBeat,
  beatPeek,
  beatsForUnit,
  createProjectFile,
  describePeek,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
} from '../index.js';

/**
 * **The beat under the pointer** (addendum 02 §4c, from Ken).
 *
 * What these pin is the three decisions: the description is never cut, the
 * writing stands in where there is none and says so, and everything on the
 * card is a reading — so no surface can hold a second answer.
 */

const book = (): ProjectFile => createProjectFile({ title: 'Villain’s Tales', format: 'novel', author: 'M. Shank' });

const firstUnit = (file: ProjectFile) => unitsInStoryOrder(file)[0]!;

const withBeat = (patch: Parameters<typeof updateBeat>[2]): { file: ProjectFile; beatId: string } => {
  const start = book();
  const unit = firstUnit(start);
  const standing = beatsForUnit(start, unit.id)[0];
  const file = standing ? start : addBeat(start, unit.id, {}).file;
  const beat = beatsForUnit(file, unit.id)[0]!;
  return { file: updateBeat(file, beat.id, patch), beatId: beat.id as string };
};

const words = (many: number, word = 'lamp') => new Array(many).fill(word).join(' ');

describe('what a hover says about a beat', () => {
  it('hands over the whole description, however long it runs', () => {
    // The point of the card: a writer who reads half a sentence still has to
    // open the beat, which is the trip it exists to save.
    const long = `${words(120, 'She')} ends here.`;
    const { file, beatId } = withBeat({ title: 'The light goes out', summary: long });
    const peek = beatPeek(file, beatId)!;
    expect(peek.summary).toBe(long);
    expect(peek.summary.endsWith('ends here.')).toBe(true);
    expect(peek.standsIn).toBe(false);
  });

  it('lets the writing stand in where nothing is described, and says so', () => {
    const { file, beatId } = withBeat({
      title: 'After the storm',
      summary: '   ',
      manuscript: { elements: [{ id: 'e1', type: 'action', text: words(200), attributes: {} }] } as never,
    });
    const peek = beatPeek(file, beatId)!;
    expect(peek.summary).toBe('');
    expect(peek.standsIn).toBe(true);
    // Cut, because it is context rather than the answer — and marked as cut.
    // The mark rides on the last word rather than standing as one of its own.
    expect(peek.opening.split(/\s+/).length).toBe(PEEK_OPENING_WORDS);
    expect(peek.opening.endsWith('…')).toBe(true);
  });

  it('says neither where there is neither, rather than drawing a blank card', () => {
    const { file, beatId } = withBeat({ summary: '', manuscript: { elements: [] } as never });
    const peek = beatPeek(file, beatId)!;
    expect(peek.summary).toBe('');
    expect(peek.opening).toBe('');
    expect(peek.standsIn).toBe(false);
  });

  it('names the beat, or says it has no name, in the format’s own word', () => {
    const { file, beatId } = withBeat({ title: '  ' });
    // A novel's beat is a passage, so no card anywhere says *beat* on one.
    expect(beatPeek(file, beatId)!.title).toBe('Untitled passage');
    expect(beatPeek(file, beatId)!.noun).toBe('Passage');
  });

  it('places a beat met out of context, which is what a board or a search gives', () => {
    const { file, beatId } = withBeat({ title: 'The light goes out', summary: 'She climbs.' });
    const peek = beatPeek(file, beatId)!;
    expect(peek.at).toBe(1);
    expect(peek.of).toBeGreaterThan(0);
    const said = describePeek(peek);
    expect(said).toContain(`Passage 1 of ${peek.of}`);
    expect(said).toContain(`in ${peek.scene}`);
    expect(said).toContain(peek.status);
  });

  it('says a beat held out of the manuscript is held out', () => {
    const { file, beatId } = withBeat({ inScript: false });
    expect(beatPeek(file, beatId)!.inScript).toBe(false);
    expect(describePeek(beatPeek(file, beatId)!)).toContain('not in the manuscript');
  });

  it('shows nothing at all for writing that has gone', () => {
    // A row pointing at a beat that was cut draws no card rather than a card
    // about nothing.
    expect(beatPeek(book(), 'no-such-beat')).toBeNull();
  });
});
