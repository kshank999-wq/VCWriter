import { contentsDivisions, type PlacedMarker } from './markers.js';
import { beatsInScript } from './selectors.js';
import { removeFigure } from './instructional.js';
import { divisionSpan, divisionRemoval, removeDivision } from './outline-binding.js';
import { isCollection } from './formats.js';
import { bookFigures, halfOf, partTitle, partsOf, removePart, type BookFigure } from './book-plan.js';
import type { BookPart } from './entities/book.js';
import type { StructuralUnit } from './entities/structure.js';
import type { ProjectFile } from './project-file.js';
import type { BeatId, ManuscriptElementId } from './ids.js';

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

export type BookRowKind = 'part' | 'chapter' | 'picture' | 'section';

export interface BookRow {
  /** The part's id, the marker's, or the figure's element id — what `where` is keyed by. */
  id: string;
  kind: BookRowKind;
  /** What it names, so a caller reads the record rather than parsing the id. */
  part?: BookPart;
  placed?: PlacedMarker;
  figure?: BookFigure;
  /** The section, on a collection's chapter inside a story (addendum 22 §6). */
  unit?: StructuralUnit;
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

/**
 * A chapter inside a story (addendum 22 §6, from Ken). In a collection the
 * chapter-kind marker is the story, so a chapter within one is its section —
 * listed under it, named by the heading the page prints, and not draggable,
 * because moving a chapter inside a story is moving the writing and that is
 * the Outliner's to do.
 */
const sectionRow = (unit: StructuralUnit): BookRow => ({
  id: unit.id as string,
  kind: 'section',
  unit,
  title: unit.title.trim(),
  label: '',
  depth: 1,
  draggable: false,
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
  const chapters = isCollection(file.project.format);
  const noun = chapters ? 'Story' : 'Chapter';
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
    // A collection's story carries its chapters; every other format's
    // chapter is the marker itself and has nothing under it.
    if (chapters) {
      for (const unit of divisionSpan(file, placed.marker.id).slice(1)) {
        if (unit.title.trim().length > 0) rows.push(sectionRow(unit));
      }
    }
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
  if (row.kind === 'section') return 'The chapter break goes. Its words join the chapter before; not a word is cut.';
  const marker = row.placed?.marker;
  if (!marker) return '';
  // One answer, wherever a division is removed from (addendum 22 §7): the
  // Stories rail in the workspace asks the same function, so a × here and a ×
  // there cannot promise different things. It also reads the noun off the
  // format table, where this held a private *story or chapter?* of its own.
  return divisionRemoval(file, marker.id);
};

/** Whether a chapter has nothing written in it — the one added by accident. */
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
  // A chapter inside a story is its section's heading and nothing else, so
  // taking it out is taking the heading off: the words stay where they are
  // and run on into the chapter before, which is what a reader would see.
  if (row.kind === 'section') return row.unit ? clearSectionHead(file, row.unit) : file;
  const marker = row.placed?.marker;
  if (!marker) return file;
  return removeDivision(file, marker.id);
};

/**
 * Take the heading off a section so it stops opening a chapter (§6). The
 * title goes with it, because the title *is* the heading here — the rail,
 * the contents page and the printed page all read the one thing.
 */
const clearSectionHead = (file: ProjectFile, unit: StructuralUnit): ProjectFile => {
  const heads = new Set(
    beatsInScript(file, unit.id)
      .flatMap((beat) => beat.manuscript.elements)
      .filter((element) => element.type === 'heading')
      .slice(0, 1)
      .map((element) => element.id as string),
  );
  return {
    ...file,
    units: file.units.map((one) => (one.id === unit.id ? { ...one, title: '' } : one)),
    beats: file.beats.map((beat) =>
      beat.unitId === unit.id
        ? { ...beat, manuscript: { ...beat.manuscript, elements: beat.manuscript.elements.filter((element) => !heads.has(element.id as string)) } }
        : beat,
    ),
  };
};
