import { describe, expect, it } from 'vitest';
import {
  CHAPTER_TEXT_LIMIT,
  acceptSummary,
  addBeat,
  addMarker,
  addUnit,
  chapterTextFor,
  chapterTextIsCut,
  createProjectFile,
  discardSummary,
  moveUnit,
  offerSummary,
  summaryRefusal,
  unitsInStoryOrder,
  updateBeat,
  type ProjectFile,
  type StoryMarkerId,
} from '../index.js';

/**
 * A suggested chapter summary (addendum 19 §7).
 *
 * Two claims: the reading is **the chapter's sections and nothing else**, and
 * **a suggestion can never reach the author's summary** — kept the way the
 * learning aids keep it, by writing to a field of its own.
 */

const paragraph = (text: string) => ({
  id: crypto.randomUUID(),
  type: 'paragraph' as const,
  text,
  characterId: null,
  attributes: {},
});

/** A textbook: two chapters, the first over two sections, each with a paragraph. */
const textbook = () => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Optics', format: 'instructional' });
  const trackId = file.tracks[0]!.id;
  file = { ...file, units: [], beats: [] };
  const put = (title: string, words: string[]) => {
    const made = addUnit(file, { trackId, title });
    file = made.file;
    for (const text of words) {
      const beat = addBeat(file, { unitId: made.unit.id, title: `${title}: part` });
      file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [paragraph(text)] } });
    }
    return made.unit;
  };
  const light = put('Light', ['Light travels in straight lines.', 'It bends where it meets glass.']);
  put('Lenses', ['A lens bends it on purpose.']);
  const waves = put('Waves', ['Light is also a wave.']);
  const one = addMarker(file, { unitId: light.id, kind: 'chapter', title: 'Geometric optics' });
  const two = addMarker(one.file, { unitId: waves.id, kind: 'chapter', title: 'Wave optics' });
  file = two.file;
  return { file, one: one.marker.id, two: two.marker.id };
};

describe('what a generation is given to read', () => {
  it('is every section the chapter covers, in order, and nothing of the next chapter', () => {
    const { file, one, two } = textbook();
    const text = chapterTextFor(file, one);
    expect(text).toContain('Light travels in straight lines.');
    expect(text).toContain('It bends where it meets glass.');
    expect(text).toContain('A lens bends it on purpose.');
    expect(text).not.toContain('Light is also a wave.');
    // Under their titles, so the reading knows where one section ends.
    expect(text.indexOf('Light')).toBeLessThan(text.indexOf('Lenses'));
    expect(chapterTextFor(file, two)).toContain('Light is also a wave.');
  });

  it('follows the markers, so a section moved into the chapter is read', () => {
    const { file, one } = textbook();
    const waves = unitsInStoryOrder(file)[2]!;
    // Waves dragged above Lenses: it is chapter one's now, and its marker
    // moves with it, so chapter one starts there — the reading follows.
    const moved = moveUnit(file, { unitId: waves.id, toTrackId: waves.trackId, index: 1 });
    expect(chapterTextFor(moved, one)).not.toContain('Light is also a wave.');
    // Chapter two's marker on Waves now sits inside what was chapter one, and
    // Lenses falls under it.
    expect(chapterTextFor(moved, one)).not.toContain('A lens bends it on purpose.');
  });

  it('refuses a chapter with nothing written under it, in a sentence', () => {
    const { file, one } = textbook();
    expect(summaryRefusal(file, one)).toBeNull();
    let empty = createProjectFile({ title: 'Empty', format: 'instructional' });
    const marked = addMarker(empty, { unitId: empty.units[0]!.id, kind: 'chapter', title: 'One' });
    empty = marked.file;
    expect(summaryRefusal(empty, marked.marker.id)).toContain('nothing to summarise');
    expect(summaryRefusal(empty, 'nope' as unknown as StoryMarkerId)).toContain('no such chapter');
  });

  it('is cut at the route’s cap on a paragraph boundary, and says so', () => {
    let { file, one } = textbook();
    const beat = file.beats[0]!;
    const long = Array.from({ length: 60 }, (_, index) => paragraph(`Paragraph ${index}. ${'Light. '.repeat(200)}`));
    file = updateBeat(file, beat.id, { manuscript: { elements: long } });
    expect(chapterTextIsCut(file, one)).toBe(true);
    const text = chapterTextFor(file, one);
    expect(text.length).toBeLessThanOrEqual(CHAPTER_TEXT_LIMIT);
    expect(text.endsWith('.')).toBe(true);
  });
});

describe('a suggestion can never reach the author’s summary', () => {
  it('lands in its own field, and stays there however often it is asked', () => {
    const { file, one } = textbook();
    let next = { ...file, markers: file.markers.map((m) => (m.id === one ? { ...m, page: { ...m.page, summary: 'Mine.' } } : m)) };
    for (let times = 0; times < 100; times += 1) next = offerSummary(next, one, `Offer ${times}.`);
    const page = next.markers.find((m) => m.id === one)!.page;
    expect(page.summary).toBe('Mine.');
    expect(page.suggestedSummary).toBe('Offer 99.');
    expect(page.suggestedAt).not.toBeNull();
  });

  it('is taken only by accepting, which hands back what it replaced', () => {
    const { file, one } = textbook();
    let next = { ...file, markers: file.markers.map((m) => (m.id === one ? { ...m, page: { ...m.page, summary: 'Mine.' } } : m)) };
    next = offerSummary(next, one, 'The machine’s.');
    const taken = acceptSummary(next, one);
    const page = taken.file.markers.find((m) => m.id === one)!.page;
    expect(page.summary).toBe('The machine’s.');
    expect(page.suggestedSummary).toBe('');
    expect(taken.replaced).toBe('Mine.');
  });

  it('refuses to accept nothing, rather than blanking the summary', () => {
    const { file, one } = textbook();
    const next = { ...file, markers: file.markers.map((m) => (m.id === one ? { ...m, page: { ...m.page, summary: 'Mine.' } } : m)) };
    const taken = acceptSummary(next, one);
    expect(taken.replaced).toBeNull();
    expect(taken.file.markers.find((m) => m.id === one)!.page.summary).toBe('Mine.');
  });

  it('can be thrown away without touching the summary', () => {
    const { file, one } = textbook();
    const offered = offerSummary(file, one, 'The machine’s.');
    const page = discardSummary(offered, one).markers.find((m) => m.id === one)!.page;
    expect(page.suggestedSummary).toBe('');
    expect(page.summary).toBe('');
  });
});
