import { describe, expect, it } from 'vitest';
import {
  addItem,
  castName,
  castRowName,
  createOutline,
  createProjectFile,
  describeOutlineCase,
  findOutline,
  outlineCaseOf,
  promoteRow,
  setOutlineCase,
  type OutlineItemId,
  type ProjectFile,
} from '../index.js';

/**
 * How the Outliner's rows are named (addendum 19 §10).
 *
 * The claim under all of it: **the case is the words rather than how they are
 * drawn**, so what the outline says, what the timeline says and what the book
 * prints cannot disagree. The assertions that matter are the ones where a
 * word is left exactly as the writer typed it, and the one where a promoted
 * row's chapter is renamed with it.
 */

const book = () => {
  let file: ProjectFile = createProjectFile({ title: 'Teaching Arithmetic', format: 'instructional' });
  const made = createOutline(file, { name: 'The book' });
  file = made.file;
  const outlineId = made.outline.id;
  const put = (parentId: OutlineItemId | null, kind: string, title: string) => {
    const next = addItem(file, outlineId, { parentId, kind, title });
    file = next.file;
    return next.itemId!;
  };
  const chapter = put(null, 'chapter', 'mathematics and its parts');
  const section = put(chapter, 'scene', 'long division and remainders');
  put(section, 'beat', 'why the remainder confuses students');
  return { file, outlineId, chapter, section };
};

describe('casting a name', () => {
  it('sets a title with the small words down and the ends up', () => {
    expect(castName('long division and remainders', 'title')).toBe('Long Division and Remainders');
    expect(castName('the shape of a story', 'title')).toBe('The Shape of a Story');
    // The last word is always up, even where it is a small one.
    expect(castName('what the numbers are for', 'title')).toBe('What the Numbers Are For');
  });

  it('sets a sentence with the first word up and the rest down', () => {
    expect(castName('Long Division And Remainders', 'sentence')).toBe('Long division and remainders');
    expect(castName('the shape of a story', 'sentence')).toBe('The shape of a story');
  });

  /**
   * The rule that keeps it safe, and the reason the old `text-transform` had
   * to go rather than become a setting: a capital is something the writer
   * said, and nothing here can tell an abbreviation from shouting.
   */
  it('leaves a word in capitals exactly as typed', () => {
    expect(castName('working with PDF files', 'title')).toBe('Working with PDF Files');
    expect(castName('what NASA knew', 'sentence')).toBe('What NASA knew');
    // The pronoun survives for the same reason, being a word in capitals.
    expect(castName('what I learned', 'sentence')).toBe('What I learned');
  });

  it('leaves a word with a capital inside it exactly as typed', () => {
    expect(castName('the iPhone and the classroom', 'title')).toBe('The iPhone and the Classroom');
    expect(castName('McDonald and the others', 'sentence')).toBe('McDonald and the others');
  });

  it('casts the parts of a hyphenated word', () => {
    expect(castName('self-raising flour', 'title')).toBe('Self-Raising Flour');
    expect(castName('state-of-the-art teaching', 'title')).toBe('State-of-the-Art Teaching');
    expect(castName('Self-Raising Flour', 'sentence')).toBe('Self-raising flour');
  });

  /**
   * A chapter named with a colon is the commonest title there is, and the
   * part after one is a subtitle with a first word of its own — which a
   * sentence has not got, so this is the one place the two cases part.
   */
  it('starts a new title after a colon, and not a new sentence', () => {
    expect(castName('division: the long way', 'title')).toBe('Division: The Long Way');
    expect(castName('Division: The Long Way', 'sentence')).toBe('Division: the long way');
  });

  it('keeps the writer’s own spacing and punctuation', () => {
    expect(castName('  division:  the long way  ', 'title')).toBe('  Division:  The Long Way  ');
    expect(castName('', 'title')).toBe('');
  });

  /** As typed is the default, and it is not a transform at all. */
  it('changes nothing at all when nothing was asked for', () => {
    expect(castName('MATHEMATICS and its parts', 'as_typed')).toBe('MATHEMATICS and its parts');
    expect(outlineCaseOf(createProjectFile({ title: 'x', format: 'instructional' }))).toBe('as_typed');
  });
});

describe('choosing the case', () => {
  it('names what is already there, rather than only what is typed next', () => {
    const made = book();
    const set = setOutlineCase(made.file, 'title');

    const outline = findOutline(set, made.outlineId)!;
    expect(outline.items.map((item) => item.title)).toEqual([
      'Mathematics and Its Parts',
      'Long Division and Remainders',
      'Why the Remainder Confuses Students',
    ]);
    expect(outlineCaseOf(set)).toBe('title');
  });

  it('says how many rows it would rename before it is pressed', () => {
    const made = book();
    expect(describeOutlineCase(made.file, 'title')).toContain('3 rows are renamed');
    expect(describeOutlineCase(made.file, 'as_typed')).toContain('exactly as they are typed');

    const set = setOutlineCase(made.file, 'title');
    // Asked again, with the work already done, it says so rather than
    // offering to do it twice.
    expect(describeOutlineCase(set, 'title')).toContain('Nothing in the outline reads differently');
  });

  /**
   * The point of casting the words rather than drawing them: a promoted row
   * **is** the chapter, so its page, the contents and the running head read
   * what the outline reads.
   */
  it('renames the chapter a promoted row is', () => {
    const made = book();
    const promoted = promoteRow(made.file, made.outlineId, made.chapter);
    expect(promoted.markerId).not.toBeNull();

    const set = setOutlineCase(promoted.file, 'title');
    const marker = set.markers.find((one) => one.id === promoted.markerId)!;
    expect(marker.title).toBe('Mathematics and Its Parts');
  });

  /**
   * The fault driving it found, and the reason the reach is a pair.
   *
   * Under sentence case a note reading *Pair with the Hans Gruber example*
   * came back as *hans gruber* — and nothing can tell a surname from an
   * ordinary word, so a writer putting the capitals back would have had them
   * taken off again every time they left the box. Lowering belongs to the act
   * that asks for it and to nothing else.
   */
  it('never takes a capital off a row the writer is merely leaving', () => {
    const made = book();
    let file = setOutlineCase(made.file, 'sentence');
    const note = addItem(file, made.outlineId, {
      parentId: made.section,
      kind: 'note',
      title: 'pair with the Hans Gruber example',
    });
    file = note.file;

    const left = castRowName(file, made.outlineId, note.itemId!);
    const row = findOutline(left, made.outlineId)!.items.find((item) => item.id === note.itemId)!;
    expect(row.title).toBe('Pair with the Hans Gruber example');
  });

  it('goes back to the words when it is set to as typed', () => {
    const made = book();
    const set = setOutlineCase(made.file, 'title');
    const off = setOutlineCase(set, 'as_typed');
    // Nothing is un-cast — the words are the words now — but nothing further
    // is touched either, which is what the default has to mean.
    expect(outlineCaseOf(off)).toBe('as_typed');
    expect(findOutline(off, made.outlineId)!.items[0]!.title).toBe('Mathematics and Its Parts');
  });
});
