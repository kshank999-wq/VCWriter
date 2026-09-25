import { contentsDivisions, type PlacedMarker } from './markers.js';
import { beatsInScript } from './selectors.js';
import { removeFigure } from './instructional.js';
import { divisionSpan, divisionRemoval, removeDivision } from './outline-binding.js';
import { isCollection } from './formats.js';
import { bookFigures, halfOf, partTitle, partsOf, removePart, type BookFigure, type BookPageRow } from './book-plan.js';
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
  /**
   * Which of the book's three areas it stands in (§9k, from Ken: *I want to
   * add the label back in front matter… a locked area, those items from the
   * list that are front matter will automatically populate that area*).
   *
   * It is **read from the row and stored nowhere**: `halfOf` already decided
   * it for a part, and everything in the story is the story. So the areas
   * cannot drift from what the book prints, and a part that changes half
   * changes area with nothing run — which is the whole of *automatically
   * populate*.
   */
  half: 'front' | 'body' | 'back';
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
  half: halfOf(part),
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
  half: 'body',
  title: unit.title.trim(),
  label: '',
  depth: 1,
  draggable: false,
});

const figureRow = (figure: BookFigure, depth: number): BookRow => ({
  id: figure.elementId,
  kind: 'picture',
  figure,
  half: 'body',
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
      half: 'body',
      title: placed.marker.title.trim() || placed.label || noun,
      label: placed.marker.title.trim() ? placed.label : '',
      depth: 0,
      draggable: true,
    });
    // A collection's story carries its chapters; every other format's
    // chapter is the marker itself and has nothing under it.
    //
    // **Every titled section, the first one included** (§6b, from Ken: *the
    // first chapter has a Roman numeral I with a period, but it still doesn't
    // recognize it in the layout*). It used to drop the first, on the reading
    // that the story's own marker sits there and the story's row already
    // stands for it — true of the section, and not of the **chapter** whose
    // numeral is on it. An imported story whose first heading is `I.` had that
    // numeral nowhere on the rail while every numeral after it was listed,
    // which is the one place a reader would notice a chapter had gone.
    if (chapters) {
      for (const unit of divisionSpan(file, placed.marker.id)) {
        if (unit.title.trim().length > 0) rows.push(sectionRow(unit));
        // **A picture sits under the chapter it is in** (§9l, from Ken). A
        // figure carries its story's marker, so listing by the marker alone
        // put every picture in the story after the last numeral — a picture
        // on page four standing below chapter thirteen, which says nothing
        // about where it is.
        for (const figure of figures) if (figure.unitId === (unit.id as string)) rows.push(figureRow(figure, 2));
      }
      // One that belongs to no section of this story — there should be none,
      // but a picture is never dropped from the rail for tidiness.
      for (const figure of figures) {
        if (figure.markerId !== id) continue;
        if (divisionSpan(file, placed.marker.id).some((unit) => figure.unitId === (unit.id as string))) continue;
        rows.push(figureRow(figure, 1));
      }
    } else {
      for (const figure of figures) if (figure.markerId === id) rows.push(figureRow(figure, 1));
    }
  }

  for (const part of parts) if (halfOf(part) === 'back') rows.push(partRow(file, part, 0));
  return rows;
};

// ------------------------------------------------------------- what is under

/**
 * The pages a division row covers, for the fold (§9m, from Ken twice: *chapter
 * one is still wrong, where it only has page two… chapter three has only one
 * page and it really has four pages… and so every page is accounted for*).
 *
 * The fold used to match ids — a page fell under a row when its `unitId` was
 * that row's — and **matching loses pages**, because not every unit has a row.
 * `bookRows` lists a section only where it has a title (§6), so a story
 * imported as a unit per paragraph has one titled unit carrying the numeral
 * and untitled ones after it: their pages matched no section row and dropped
 * back to the *story*, so the numeral folded open on the one page its heading
 * stood on and the rest were listed a level up. That is exactly what Ken saw,
 * and why two chapters were right and two were not — it depends on how the
 * writing happened to land in units, which is not a fact about the book.
 *
 * So a division's pages are **a range rather than a set**: a page belongs to
 * the nearest division row at or before it, which is `divisionSpan`'s rule
 * pointed at the laid pages. Every page of the story is then under exactly
 * one row by construction, rather than by every unit happening to be listed.
 *
 * A part's page is nobody's: a part has a row of its own and does not fold.
 */
export const pagesUnder = (
  rows: readonly BookRow[],
  pages: readonly BookPageRow[],
): Map<string, BookPageRow[]> => {
  const sections = new Set(rows.filter((row) => row.kind === 'section').map((row) => row.id));
  const chapters = new Set(rows.filter((row) => row.kind === 'chapter').map((row) => row.id));
  const under = new Map<string, BookPageRow[]>();
  const put = (id: string, page: BookPageRow) => {
    const held = under.get(id);
    if (held) held.push(page);
    else under.set(id, [page]);
  };
  let current: string | null = null;
  let marker: string | null = null;
  for (const page of pages) {
    if (page.partId !== null) {
      current = null;
      marker = null;
      continue;
    }
    // A new division starts its own run, so the last one cannot run on into
    // it — the reason `bookPageRows` clears the unit at a chapter opening,
    // said again here because a row is what folds.
    if (page.markerId !== marker) {
      marker = page.markerId;
      current = marker !== null && chapters.has(marker) ? marker : null;
    }
    if (page.unitId !== null && sections.has(page.unitId)) current = page.unitId;
    if (current !== null) put(current, page);
  }
  return under;
};

/** A division row: the two kinds that hold something and so can fold. */
const divides = (row: BookRow): boolean => row.kind === 'chapter' || row.kind === 'section';

/**
 * **What a fold hides** (§9o, from Ken: *when you collapse a story, it only
 * collapses the first chapter. It needs to collapse the entire story until the
 * next one… it still shows the opening page even when you collapse it*).
 *
 * Both halves of that are **one fault**, and it is the rail's own rule going
 * unread. §9a settled that **containment is depth, never a heading** — the
 * front matter, the story and the back matter are not three lists, they are
 * the order, and the only nesting is depth. The fold never asked about depth.
 * It hid a row's **pages** and nothing else, so closing a story hid the one
 * page the story row owns — its opening — and left every chapter under it, and
 * every one of *their* pages, standing. A story of three chapters closed to
 * twelve rows instead of one.
 *
 * And the opening page is the same fault seen from the other end: `pagesUnder`
 * gives each page to **one** owner, so where the story's first chapter carries
 * a row the opening page belongs to *that chapter* rather than to the story —
 * and a chapter row that never hides is an opening page that never hides.
 *
 * So the fold reads depth: **a closed division hides every row after it that
 * is deeper, until the next row at its own level or above**. The pages go with
 * them because a hidden row draws nothing, which is why there is no second
 * rule here about pages.
 */
export const visibleRows = (
  rows: readonly BookRow[],
  open: ReadonlySet<string> | readonly string[],
): BookRow[] => {
  const isOpen = (id: string): boolean => (open instanceof Set ? open.has(id) : (open as readonly string[]).includes(id));
  const out: BookRow[] = [];
  // The depth a closed row is hiding below; null while nothing is shut.
  let shutAt: number | null = null;
  for (const row of rows) {
    if (shutAt !== null && row.depth > shutAt) continue;
    shutAt = null;
    out.push(row);
    if (divides(row) && !isOpen(row.id)) shutAt = row.depth;
  }
  return out;
};

/**
 * Whether a row has anything to show — a row under it, or a page of its own.
 *
 * The arrow is **absent rather than dead** where there is neither, which the
 * row's own comment claimed and the code did not do: every chapter and section
 * got an arrow whether or not anything was under it, so a story's untitled
 * first section offered a fold that opened onto nothing.
 */
export const rowHasUnder = (
  rows: readonly BookRow[],
  folds: ReadonlyMap<string, readonly BookPageRow[]>,
  row: BookRow,
): boolean => {
  if (!divides(row)) return false;
  if ((folds.get(row.id) ?? []).length > 0) return true;
  const at = rows.indexOf(row);
  return at >= 0 && (rows[at + 1]?.depth ?? row.depth) > row.depth;
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
