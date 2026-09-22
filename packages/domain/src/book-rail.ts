import { contentsDivisions, type PlacedMarker } from './markers.js';
import { beatsInScript } from './selectors.js';
import { removeMarker, removeUnit } from './mutations.js';
import { removeFigure } from './instructional.js';
import { chapterSpan } from './outline-binding.js';
import { isCollection } from './formats.js';
import { bookFigures, halfOf, partTitle, partsOf, removePart, type BookFigure } from './book-plan.js';
import type { BookPart } from './entities/book.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, ManuscriptElementId, StoryMarkerId } from './ids.js';

/**
 * The rail: the book as one list, in the order it is bound (§9a, from Ken —
 * *this should be simple linear workflow… we don't need to divide up front
 * matter and back matter, we should be able to just add them as a linear
 * tree*).
 *
 * The room used to draw three lists under three headings, and between every
 * chapter a second row carrying two buttons and a sentence about what the
 * chapter opened on. Ken read it back as *art page, picture, story page above
 * the first paragraph, story page, picture facing* and said nobody would work
 * it out — which is fair, because none of that says where anything is in the
 * book.
 *
 * So there is **one list and one row per thing**, in the order a reader would
 * meet them. Two rules keep it that way:
 *
 * **Containment is depth, never a heading.** The front matter, the story and
 * the back matter are not three lists; they are the order. A picture inside
 * a chapter sits under it because it is in it, and that is the only nesting
 * there is.
 *
 * **A row is its name and its page, and nothing else.** No note, no state, no
 * pair of buttons: what a row *is* it says by where it sits, and what can be
 * done to it is done from the selection. A row that has to explain itself in
 * the margin is the failure this replaces.
 *
 * Nothing here is stored. The list is read from the parts, the markers and
 * the manuscript every time, so cutting a chapter takes its pictures off the
 * rail with nothing run.
 */

export type BookRowKind = 'part' | 'chapter' | 'picture';

export interface BookRow {
  /** The part's id, the marker's, or the figure's element id — what `where` is keyed by. */
  id: string;
  kind: BookRowKind;
  /** What it names, so a caller reads the record rather than parsing the id. */
  part?: BookPart;
  placed?: PlacedMarker;
  figure?: BookFigure;
  /** What the row says. Never a sentence. */
  title: string;
  /** The number a chapter prints before its name, where it has one. */
  label: string;
  /** How far in it sits: a picture inside a chapter sits under it. */
  depth: number;
  /** Whether it may be dragged to somewhere else in the book. */
  draggable: boolean;
}

/** A picture page's name is its picture's, a part having none of its own. */
const plateName = (file: ProjectFile, part: BookPart): string => {
  const named = part.title.trim();
  if (named) return named;
  const asset = file.assets.find((one) => (one.id as string) === part.assetId);
  return asset?.name.trim() || 'Picture';
};

const partRow = (file: ProjectFile, part: BookPart, depth: number): BookRow => ({
  id: part.id,
  kind: 'part',
  part,
  title: part.kind === 'plate' ? plateName(file, part) : partTitle(part),
  label: '',
  depth,
  // A picture page facing a chapter is placed by the chapter it faces, which
  // the drop reads; the rest move within their half.
  draggable: true,
});

const figureRow = (figure: BookFigure, depth: number): BookRow => ({
  id: figure.elementId,
  kind: 'picture',
  figure,
  title: figure.caption.trim() || figure.assetName.trim() || 'Picture',
  label: '',
  depth,
  // A figure stands where it stands in the writing. It is moved by drawing
  // its box on another page, not by dragging a row.
  draggable: false,
});

/**
 * The book as one list. Front matter, then the story with its pictures under
 * their chapters, then the back matter — and the picture pages a writer put
 * before a chapter listed where they actually fall, which is before it.
 */
export const bookRows = (file: ProjectFile): BookRow[] => {
  const parts = partsOf(file);
  const figures = bookFigures(file);
  const noun = isCollection(file.project.format) ? 'Story' : 'Chapter';
  const rows: BookRow[] = [];

  for (const part of parts) if (halfOf(part) === 'front') rows.push(partRow(file, part, 0));
  // Pictures before the first chapter belong to no chapter, so they stand
  // where they are rather than being hidden under one.
  for (const figure of figures) if (figure.markerId === null) rows.push(figureRow(figure, 0));

  for (const placed of contentsDivisions(file)) {
    const id = placed.marker.id as string;
    for (const part of parts) if (part.beforeMarkerId === id) rows.push(partRow(file, part, 0));
    rows.push({
      id,
      kind: 'chapter',
      placed,
      title: placed.marker.title.trim() || placed.label || noun,
      label: placed.marker.title.trim() ? placed.label : '',
      depth: 0,
      draggable: true,
    });
    for (const figure of figures) if (figure.markerId === id) rows.push(figureRow(figure, 1));
  }

  for (const part of parts) if (halfOf(part) === 'back') rows.push(partRow(file, part, 0));
  return rows;
};

// ------------------------------------------------------------ taking one out

/**
 * What goes with a row, said before anything does (the Outliner's habit).
 * A chapter is the one that needs saying: its words are not its own, so
 * removing it joins them to the chapter before rather than cutting them —
 * except where it holds nothing, which is the chapter somebody added by
 * accident and the whole reason this exists.
 */
export const whatGoesWithRow = (file: ProjectFile, row: BookRow): string => {
  if (row.kind === 'part') return row.part?.kind === 'plate' ? 'The page goes; the picture stays in the library.' : 'The page goes.';
  if (row.kind === 'picture') return 'The picture comes out of the writing; it stays in the library.';
  const marker = row.placed?.marker;
  if (!marker) return '';
  const noun = isCollection(file.project.format) ? 'story' : 'chapter';
  const sections = chapterSpan(file, marker.id);
  if (emptyChapter(file, row)) return `Nothing is written in it, so the ${noun} and its empty ${sections.length === 1 ? 'section' : 'sections'} go.`;
  const words = sections.length === 1 ? 'Its section joins' : 'Its sections join';
  return `The ${noun} break goes. ${words} the one before; not a word is cut.`;
};

/** Whether a chapter has nothing written in it — the one added by accident. */
const emptyChapter = (file: ProjectFile, row: BookRow): boolean => {
  const marker = row.placed?.marker;
  if (!marker) return false;
  return chapterSpan(file, marker.id).every((unit) =>
    beatsInScript(file, unit.id).every((beat) => beat.manuscript.elements.every((element) => element.text.trim().length === 0)),
  );
};

/**
 * Take a row out of the book. One act for every kind of row, because the
 * rail is one list: a × means the same thing wherever it is pressed, and
 * `whatGoesWithRow` has already said what that is.
 */
export const removeBookRow = (file: ProjectFile, row: BookRow): ProjectFile => {
  if (row.kind === 'part') return removePart(file, row.id);
  if (row.kind === 'picture') {
    const figure = row.figure;
    if (!figure) return file;
    return removeFigure(file, figure.beatId as BeatId, figure.elementId as ManuscriptElementId);
  }
  const marker = row.placed?.marker;
  if (!marker) return file;
  const empty = emptyChapter(file, row);
  const sections = empty ? chapterSpan(file, marker.id) : [];
  let next = removeMarker(file, marker.id as StoryMarkerId);
  for (const unit of sections) next = removeUnit(next, unit.id);
  return next;
};
