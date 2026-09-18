import { describe, expect, it } from 'vitest';
import {
  addBeat,
  addMarker,
  addPart,
  addUnit,
  bookBlocks,
  createProjectFile,
  defaultParts,
  halfOf,
  mayAdd,
  movePart,
  opensOnLeaf,
  paragraphsOf,
  partsOf,
  removePart,
  setChapterPage,
  tracksInOrder,
  unitsInStoryOrder,
  updateBeat,
  updatePart,
  type ProjectFile,
} from '../index.js';

/**
 * The plan of the book (addendum 20 §5): the parts, and the whole book as a
 * sequence of blocks with every rule the laying needs.
 */

const novel = () => createProjectFile({ title: 'The Lamp', format: 'novel' });

/** Two chapters, each of one paragraph, with a chapter marker on each. */
const chaptered = (): { file: ProjectFile; markers: string[] } => {
  let file = novel();
  const track = tracksInOrder(file)[0]!;
  const first = unitsInStoryOrder(file)[0]!;
  const second = addUnit(file, { trackId: track.id, title: 'The Return', index: 1 });
  file = second.file;
  const markers: string[] = [];
  for (const [index, unit] of [first, second.unit].entries()) {
    const marked = addMarker(file, { unitId: unit.id, kind: 'chapter', title: index === 0 ? 'The Lamp' : 'The Return' });
    file = marked.file;
    markers.push(marked.marker.id as string);
    const beat = addBeat(file, { unitId: unit.id, title: 'b' });
    file = updateBeat(beat.file, beat.beat.id, {
      manuscript: {
        elements: [
          { id: `p-${index}-a` as never, type: 'paragraph', text: `Paragraph one of chapter ${index + 1}.`, characterId: null, attributes: {} },
          { id: `p-${index}-b` as never, type: 'paragraph', text: `Paragraph two of chapter ${index + 1}.`, characterId: null, attributes: {} },
        ],
      },
    });
  }
  return { file, markers };
};

describe('the parts', () => {
  it('start as the parts nearly every book has, with fixed ids', () => {
    expect(defaultParts().map((part) => part.kind)).toEqual([
      'half_title',
      'title_page',
      'copyright',
      'contents',
      'about_the_author',
    ]);
    expect(partsOf(novel()).map((part) => part.id)).toContain('default:contents');
  });

  it('add to the end of their own half, and refuse a second of a once-only kind', () => {
    const { file } = chaptered();
    const withDedication = addPart(file, 'dedication', { text: 'For M.' });
    expect(withDedication.partId).not.toBeNull();
    const kinds = partsOf(withDedication.file).map((part) => part.kind);
    // After the front matter, before the back.
    expect(kinds.indexOf('dedication')).toBe(kinds.indexOf('contents') + 1);
    expect(kinds.indexOf('dedication')).toBeLessThan(kinds.indexOf('about_the_author'));

    const twice = addPart(withDedication.file, 'contents');
    expect(twice.partId).toBeNull();
    expect(mayAdd(withDedication.file, 'contents')).toBe(false);
    expect(mayAdd(withDedication.file, 'preface')).toBe(true);
  });

  it('move within a half and never across the story', () => {
    const { file } = chaptered();
    const kinds = (next: ProjectFile) => partsOf(next).map((part) => part.kind);
    // The dedication cannot fall behind the story by pressing ↓.
    const added = addPart(file, 'dedication').file;
    const down = movePart(added, partsOf(added).find((part) => part.kind === 'dedication')!.id, 1);
    expect(kinds(down)).toEqual(kinds(added));
    // But it can rise above the contents.
    const up = movePart(added, partsOf(added).find((part) => part.kind === 'dedication')!.id, -1);
    expect(kinds(up).indexOf('dedication')).toBe(kinds(up).indexOf('contents') - 1);
  });

  it('can be edited and removed', () => {
    const { file } = chaptered();
    const about = partsOf(file).find((part) => part.kind === 'about_the_author')!;
    const edited = updatePart(file, about.id, { text: 'Lives in Hull.' });
    expect(partsOf(edited).find((part) => part.id === about.id)?.text).toBe('Lives in Hull.');
    const gone = removePart(edited, about.id);
    expect(partsOf(gone).some((part) => part.kind === 'about_the_author')).toBe(false);
  });

  it('puts a plate in the story when it is anchored to a chapter, and at the back otherwise', () => {
    const { file, markers } = chaptered();
    const anchored = addPart(file, 'plate', { beforeMarkerId: markers[1]! });
    const loose = addPart(anchored.file, 'plate');
    const parts = partsOf(loose.file);
    expect(halfOf(parts.find((part) => part.id === anchored.partId)!)).toBe('body');
    expect(halfOf(parts.find((part) => part.id === loose.partId)!)).toBe('back');
  });

  it('reads paragraphs off a text part by its blank lines', () => {
    expect(paragraphsOf('One.\n\nTwo.\n\n\nThree.')).toEqual(['One.', 'Two.', 'Three.']);
    expect(paragraphsOf('  ')).toEqual([]);
  });
});

describe('the blocks', () => {
  it('run front matter, then the story with its chapter openings, then the back', () => {
    const { file } = chaptered();
    const blocks = bookBlocks(file);
    const kinds = blocks.map((block) => block.kind);
    expect(kinds.slice(0, 4)).toEqual(['half_title', 'title_page', 'copyright', 'contents']);
    expect(kinds.filter((kind) => kind === 'chapter_opening')).toHaveLength(2);
    expect(kinds.filter((kind) => kind === 'paragraph')).toHaveLength(4);
    expect(kinds.at(-1)).toBe('part_opening');
    // Roman across the front, arabic from the first chapter.
    expect(blocks[0]?.numbering).toBe('roman');
    expect(blocks.find((block) => block.kind === 'chapter_opening')?.numbering).toBe('arabic');
  });

  it('opens each chapter on a recto by default, and on a page when the book says so', () => {
    const { file } = chaptered();
    const opening = bookBlocks(file).find((block) => block.kind === 'chapter_opening')!;
    expect(opening.starts).toBe('recto');
    expect(opening.chapterTitle).toBe('The Lamp');
    expect(opening.chapter?.label).toBe('Chapter 1');
  });

  it('opens above the first paragraph unless the chapter page carries a device, a summary or an epigraph', () => {
    const { file, markers } = chaptered();
    const plain = bookBlocks(file).find((block) => block.kind === 'chapter_opening')!;
    expect(plain.leaf).toBe(false);
    expect(plain.display).toBe(false);
    expect(plain.keepWithNext).toBe(true);

    const withEpigraph = setChapterPage(file, markers[0]! as never, { epigraph: 'Light is the thing.' });
    const leaf = bookBlocks(withEpigraph).find((block) => block.kind === 'chapter_opening')!;
    expect(opensOnLeaf(leaf.chapter!)).toBe(true);
    expect(leaf.leaf).toBe(true);
    expect(leaf.display).toBe(true);
  });

  it('marks the chapter’s first paragraph, and carries the chapter title for the running head', () => {
    const { file } = chaptered();
    const paragraphs = bookBlocks(file).filter((block) => block.kind === 'paragraph');
    expect(paragraphs.map((block) => block.opensChapter)).toEqual([true, false, true, false]);
    expect(paragraphs[2]?.chapterTitle).toBe('The Return');
  });

  it('puts a plate before the chapter it is anchored to', () => {
    const { file, markers } = chaptered();
    const withPlate = addPart(file, 'plate', { beforeMarkerId: markers[1]!, caption: 'The harbour' }).file;
    const kinds = bookBlocks(withPlate).map((block) => block.kind);
    const plate = kinds.indexOf('plate');
    expect(kinds[plate + 1]).toBe('chapter_opening');
    expect(kinds.slice(0, plate).filter((kind) => kind === 'chapter_opening')).toHaveLength(1);
  });

  it('turns a text part into an opening and its paragraphs', () => {
    const { file } = chaptered();
    const about = partsOf(file).find((part) => part.kind === 'about_the_author')!;
    const edited = updatePart(file, about.id, { text: 'Lives in Hull.\n\nWrites at night.' });
    const blocks = bookBlocks(edited).filter((block) => block.partId === about.id);
    expect(blocks.map((block) => block.kind)).toEqual(['part_opening', 'paragraph', 'paragraph']);
    expect(blocks[0]?.starts).toBe('recto');
    expect(blocks[0]?.title).toBe('About the author');
    expect(blocks[1]?.text).toBe('Lives in Hull.');
  });
});
