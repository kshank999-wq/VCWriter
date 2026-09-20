import { describe, expect, it } from 'vitest';
import {
  addUnit,
  appendImportedStory,
  beginStory,
  buildProjectFromImport,
  contentsDivisions,
  createProjectFile,
  defaultMarkerNumbering,
  describeCollection,
  isCollection,
  markerNoun,
  moveChapterBlock,
  nounsFor,
  opensChapter,
  placedMarkers,
  storiesOf,
  summarise,
  unitsInStoryOrder,
  unplacedSections,
  type ImportedScript,
} from '../index.js';

/**
 * A collection of stories (addendum 22): a story is a marker over its
 * sections, and nothing new is stored.
 */

const story = (title: string, paragraphs: string[], headings: string[] = []): ImportedScript =>
  summarise({
    title,
    author: '',
    scenes:
      headings.length === 0
        ? [{ heading: '', elements: paragraphs.map((text) => ({ type: 'paragraph' as const, text })) }]
        : headings.map((heading, index) => ({
            heading,
            elements: [{ type: 'paragraph' as const, text: paragraphs[index] ?? '' }],
          })),
    warnings: [],
    source: 'docx',
  });

describe('the collection format', () => {
  it('is the short-story format, named for what it holds', () => {
    expect(isCollection('short_story')).toBe(true);
    expect(isCollection('novel')).toBe(false);
    expect(nounsFor('short_story').work).toBe('Collection');
    expect(nounsFor('short_story').unit).toBe('Section');
  });

  it('calls a story nothing before its number, and numbers none by default', () => {
    expect(markerNoun('chapter', 'short_story')).toBe('');
    expect(markerNoun('chapter', 'novel')).toBe('Chapter');
    expect(markerNoun('chapter')).toBe('Chapter');
    expect(defaultMarkerNumbering('short_story')).toBe('none');
  });

  it('gives a story no label, so its page carries its title once', () => {
    const file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const placed = placedMarkers(file);
    expect(placed).toHaveLength(1);
    expect(placed[0]?.label).toBe('');
    expect(placed[0]?.marker.title).toBe('The Road');
    // A numbered collection still numbers plainly: "3", never "Story 3".
    const numbered = { ...file, settings: { ...file.settings, markerNumbering: 'numeric' as const } };
    expect(placedMarkers(numbered)[0]?.label).toBe('1');
  });
});

describe('stories in a collection', () => {
  it('begins a story on a section of its own at the end, with its marker', () => {
    const fresh = createProjectFile({ title: 'Tales', format: 'short_story' });
    const begun = beginStory(fresh, { title: 'The Road' });
    const order = unitsInStoryOrder(begun.file);
    expect(order).toHaveLength(2);
    expect(order[1]?.id).toBe(begun.unitId);
    expect(begun.file.markers.find((marker) => marker.id === begun.markerId)?.unitId).toBe(begun.unitId);
    // The opening section the project was made with belongs to no story yet.
    expect(unplacedSections(begun.file).map((unit) => unit.id)).toEqual([order[0]?.id]);
  });

  it('reads each story as its marker and the sections it spans, counted every time', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    const first = beginStory(file, { title: 'The Road' });
    file = addUnit(first.file, { trackId: file.tracks[0]!.id, title: 'II' }).file;
    const second = beginStory(file, { title: 'The Harbour' });
    file = second.file;

    const stories = storiesOf(file);
    expect(stories.map((one) => one.placed.marker.title)).toEqual(['The Road', 'The Harbour']);
    expect(stories[0]?.sections.map((unit) => unit.title)).toEqual(['', 'II']);
    expect(stories[1]?.sections).toHaveLength(1);
    expect(storiesOf(createProjectFile({ title: 'N', format: 'novel' }))).toEqual([]);
    expect(describeCollection(file)).toBe('2 stories · 3 sections · 0 words');
  });

  it('moves a story as a block, before another or to the end, its sections keeping their order', () => {
    let file = createProjectFile({ title: 'Tales', format: 'short_story' });
    const road = beginStory(file, { title: 'The Road' });
    file = addUnit(road.file, { trackId: file.tracks[0]!.id, title: 'Road II' }).file;
    const harbour = beginStory(file, { title: 'The Harbour' });
    const lamp = beginStory(harbour.file, { title: 'The Lamp' });
    file = lamp.file;
    const titles = (one: ProjectFile) => storiesOf(one).map((story) => [story.placed.marker.title, story.sections.map((unit) => unit.title)]);
    expect(titles(file)).toEqual([['The Road', ['', 'Road II']], ['The Harbour', ['']], ['The Lamp', ['']]]);

    const lampFirst = moveChapterBlock(file, lamp.markerId, road.markerId);
    expect(titles(lampFirst)).toEqual([['The Lamp', ['']], ['The Road', ['', 'Road II']], ['The Harbour', ['']]]);
    // Only the units that moved were touched.
    expect(lampFirst.units.filter((unit) => unit.orderKey !== file.units.find((was) => was.id === unit.id)?.orderKey)).toHaveLength(1);

    const roadLast = moveChapterBlock(file, road.markerId, null);
    expect(titles(roadLast)).toEqual([['The Harbour', ['']], ['The Lamp', ['']], ['The Road', ['', 'Road II']]]);
    expect(moveChapterBlock(file, road.markerId, road.markerId)).toBe(file);
    // The opening section, which no story owns, stays where it was.
    expect(unitsInStoryOrder(roadLast)[0]?.id).toBe(unitsInStoryOrder(file)[0]?.id);
  });

  it('adds an imported document as one story after the last, its headings as sections', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const added = appendImportedStory(file, story('The Harbour', ['Rain on the water.', 'Nobody came.'], ['I', 'II']));
    expect(added).not.toBeNull();
    file = added!.file;

    const stories = storiesOf(file);
    expect(stories.map((one) => one.placed.marker.title)).toEqual(['The Road', 'The Harbour']);
    expect(stories[1]?.sections.map((unit) => unit.title)).toEqual(['I', 'II']);
    expect(added!.sections).toBe(2);
    expect(added!.words).toBe(6);
    // A section in a story carries no "Chapter 2" of its own, and the
    // document's headings made sections rather than stories.
    expect(stories[1]?.sections.every((unit) => unit.sequenceLabel === '')).toBe(true);
    expect(file.markers).toHaveLength(2);
    // The story lands after everything already there.
    const order = unitsInStoryOrder(file);
    expect(order.at(-1)?.title).toBe('II');
    // And nothing that was there changed.
    expect(stories[0]?.sections).toHaveLength(1);
  });

  it('falls back to the file\'s name for an untitled story, and refuses an empty one', () => {
    const file = createProjectFile({ title: 'Tales', format: 'short_story' });
    const added = appendImportedStory(file, story('', ['Words.']), { title: 'harbour' });
    expect(added?.file.markers[0]?.title).toBe('harbour');
    const nothing = summarise({ title: '', author: '', scenes: [], warnings: [], source: 'text' });
    expect(appendImportedStory(file, nothing)).toBeNull();
  });

  it('lists the stories on the contents page, as a novel lists its chapters', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    file = beginStory(file, { title: 'The Harbour' }).file;
    expect(contentsDivisions(file).map((placed) => placed.marker.title)).toEqual(['The Road', 'The Harbour']);
  });
});

describe('a section head in a Word document', () => {
  it('is a bare numeral alone on its line', () => {
    const base = {
      text: '',
      plain: '',
      styleId: '',
      styleName: '',
      outline: null,
      align: 'center' as const,
      indentLeft: 0,
      firstLine: 0,
      face: null,
      size: null,
      caps: false,
      pageBreakBefore: false,
      list: false,
      pictures: [],
    };
    expect(opensChapter({ ...base, plain: 'II', text: 'II' })).toBe(true);
    expect(opensChapter({ ...base, plain: '3.', text: '3.' })).toBe(true);
    // Wherever it stands, since addendum 21 §10: a manuscript sets its labels left as often as centred.
    expect(opensChapter({ ...base, plain: 'II', text: 'II', align: 'left' })).toBe(true);
    expect(opensChapter({ ...base, plain: 'I am here.', text: 'I am here.' })).toBe(false);
  });
});

describe('importing one story or many (addendum 22 §2)', () => {
  it('reads a document as one story by default: one marker named by its first heading, the rest kept as headings in the words', () => {
    const script = story('', ['Rain on the water.', 'Nobody came.', 'Then the lamp.'], ['The Road', 'Rain', 'Night']);
    const built = buildProjectFromImport(script, { format: 'short_story', title: 'harbour.docx' });
    const stories = storiesOf(built.file);
    expect(stories).toHaveLength(1);
    expect(stories[0]?.placed.marker.title).toBe('The Road');
    expect(stories[0]?.sections).toHaveLength(3);
    // The first heading is the story's title and is not repeated; the later ones stay as headings.
    const texts = built.file.beats.flatMap((beat) => beat.manuscript.elements.map((element) => `${element.type}:${element.text}`));
    expect(texts).not.toContain('heading:The Road');
    expect(texts).toContain('heading:Rain');
    expect(texts).toContain('heading:Night');
    expect(texts).toContain('paragraph:Nobody came.');
  });

  it('reads a document as a collection when asked: a story per heading, nothing kept as a heading', () => {
    const script = story('Tales', ['Rain on the water.', 'Nobody came.', 'Then the lamp.'], ['The Road', 'Rain', 'Night']);
    const built = buildProjectFromImport(script, { format: 'short_story', stories: 'many' });
    expect(storiesOf(built.file).map((one) => one.placed.marker.title)).toEqual(['The Road', 'Rain', 'Night']);
    const texts = built.file.beats.flatMap((beat) => beat.manuscript.elements.map((element) => element.type));
    expect(texts).not.toContain('heading');
  });

  it('names a story with no heading after the project, and leaves a novel alone', () => {
    const plain = buildProjectFromImport(story('', ['Words.']), { format: 'short_story', title: 'The Lamp' });
    expect(storiesOf(plain.file).map((one) => one.placed.marker.title)).toEqual(['The Lamp']);
    const novel = buildProjectFromImport(story('N', ['a', 'b'], ['Chapter One: Dawn', 'Chapter Two']), { format: 'novel', stories: 'one' });
    expect(novel.file.markers.map((marker) => marker.title)).toEqual(['Dawn', '']);
  });

  it('keeps an appended story’s later headings in its words', () => {
    let file = beginStory(createProjectFile({ title: 'Tales', format: 'short_story' }), { title: 'The Road' }).file;
    const added = appendImportedStory(file, story('', ['One.', 'Two.'], ['The Harbour', 'Later']));
    file = added!.file;
    expect(storiesOf(file).map((one) => one.placed.marker.title)).toEqual(['The Road', 'The Harbour']);
    const texts = file.beats.flatMap((beat) => beat.manuscript.elements.map((element) => `${element.type}:${element.text}`));
    expect(texts).toContain('heading:Later');
    expect(texts).not.toContain('heading:The Harbour');
  });
});
