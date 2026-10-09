import { contentsDivisions, type PlacedMarker } from './markers.js';
import { beatsInScript } from './selectors.js';
import { removeFigure } from './instructional.js';
import { divisionSpan, divisionRemoval, removeDivision, unclaimedUnits, type DivisionRemoval } from './outline-binding.js';
import { isCollection, nounsFor } from './formats.js';
import {
  blankReason,
  bookFigures,
  halfOf,
  partTitle,
  partsOf,
  removeBookFigure,
  setBackBlank,
  setChapterRecto,
  setSheetBefore,
  removePart,
  sayBlankReason,
  blankPagesAt,
  SHEET,
  setBlankPages,
  type BookFigure,
  type BookPageRow,
} from './book-plan.js';
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
const sectionRow = (unit: StructuralUnit, depth = 1): BookRow => ({
  id: unit.id as string,
  kind: 'section',
  unit,
  half: 'body',
  title: unit.title.trim(),
  label: '',
  depth,
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
  /**
   * **A picture drags** (§9w, from Ken: *everything in the outliner should be
   * in order and it should be draggable so you can move things around if you
   * wanted to, the pages. Especially the pages that you import or pictures
   * that you import*).
   *
   * This said *a figure stands where it stands in the writing; it is moved by
   * drawing its box on another page*, which is true of the box and was taken
   * to settle the drag as well. It does not: redrawing the box is how a
   * picture's **place on a page** is set, and *which page* is a different
   * question that the rail is the natural place to answer. The act is the one
   * that already existed — `moveFigureBefore`, which the box's own redraw
   * calls — so this is a second door rather than a second answer, and the
   * landing is a page row.
   */
  draggable: true,
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

  /**
   * **Writing that no division claims is listed rather than merged** (§9ab,
   * from Ken: *the story is still there, but it now no longer shows up in the
   * left menu bar* … *each story needs to be held together not merged with
   * other stories*).
   *
   * Everything here reads the markers, so sections ahead of the first break
   * had no row — and `pagesUnder` then held their pages for the **next**
   * division, which is §9w's rule doing exactly the wrong thing with them:
   * one story's pages listed under another's name, with the story itself
   * nowhere. Measured on his book after a × took a break away: two sections
   * and six pages of *In For A Pound* filed under *Simple Pleasures*.
   *
   * They stand at **depth 0**, because they are inside nothing — that is the
   * whole fact about them — and `unclaimedUnits` answers only where the book
   * has divisions at all, so a novel that was never broken into chapters is
   * untouched.
   */
  for (const unit of unclaimedUnits(file)) {
    rows.push(sectionRow(unit, 0));
    for (const figure of figures) if (figure.unitId === (unit.id as string)) rows.push(figureRow(figure, 1));
  }

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
 * **And a part's pages are the part's** (§17e, from Ken: *all pages need to be
 * accounted for blank or not… and show up in the outliner in the left*). A
 * part used to claim none — *a part has a row of its own and does not fold* —
 * which is true of the page it prints on and false of every leaf around it:
 * the blank verso before a title page that opens on a right-hand one, and the
 * back-blank §17d puts behind it, belonged to no row at all and so appeared
 * **nowhere in the rail**, which is why a book that grew by two pages could
 * not be asked where they had gone. A part folds now wherever it holds more
 * than the one page its row already names.
 */
export const pagesUnder = (
  rows: readonly BookRow[],
  pages: readonly BookPageRow[],
): Map<string, BookPageRow[]> => {
  const sections = new Set(rows.filter((row) => row.kind === 'section').map((row) => row.id));
  const chapters = new Set(rows.filter((row) => row.kind === 'chapter').map((row) => row.id));
  const parts = new Set(rows.filter((row) => row.kind === 'part').map((row) => row.id));
  const under = new Map<string, BookPageRow[]>();
  const put = (id: string, page: BookPageRow) => {
    const held = under.get(id);
    if (held) held.push(page);
    else under.set(id, [page]);
  };
  let current: string | null = null;
  let marker: string | null = null;
  /**
   * **Pages that stand in front of the division they belong to** (§9w).
   *
   * A picture asked for on a division's own opening page is emitted before the
   * opening, so its page — and the leaf the recto rule leaves beside it —
   * carry no marker and no unit, and the walk had nothing to give them to:
   * they appeared under no row at all, which took the picture's page off the
   * rail the moment the picture landed where it was asked for. They are held
   * and given to the **next** division row, which is where `bookRows` already
   * puts the picture itself.
   */
  let waiting: BookPageRow[] = [];
  for (const page of pages) {
    if (page.partId !== null) {
      // The part's own page, and whatever stood unclaimed in front of it —
      // the leaf its recto rule left there, which is nobody else's. `current`
      // goes back to nothing afterwards, so a leaf standing between the front
      // matter and chapter one is still held for the **division** it is there
      // for (§9w) rather than falling to the part before it.
      const owner = parts.has(page.partId) ? page.partId : null;
      if (owner !== null) {
        for (const held of waiting) put(owner, held);
        put(owner, page);
      }
      current = null;
      marker = null;
      waiting = [];
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
    if (current === null) {
      waiting.push(page);
      continue;
    }
    for (const held of waiting) put(current, held);
    waiting = [];
    put(current, page);
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
  // **A part folds where it holds more than its own page** (§17e). Its row
  // already names the page it prints on, so an arrow over that one page alone
  // would open onto what the row has just said; a leaf either side of it is
  // another matter, and until now appeared nowhere.
  if (row.kind === 'part') return (folds.get(row.id) ?? []).length > 1;
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
export const whatGoesWithRow = (file: ProjectFile, row: BookRow): DivisionRemoval => {
  const goes = (comfort: string): DivisionRemoval => ({ comfort, refusal: null });
  if (row.kind === 'part') {
    return goes(row.part?.kind === 'plate' ? 'The page goes; the picture stays in the library.' : 'The page goes.');
  }
  if (row.kind === 'picture') return goes('The picture comes out of the writing; it stays in the library.');
  if (row.kind === 'section') return goes('The chapter break goes. Its words join the chapter before; not a word is cut.');
  const marker = row.placed?.marker;
  if (!marker) return goes('');
  // One answer, wherever a division is removed from (addendum 22 §7): the
  // Stories rail in the workspace asks the same function, so a × here and a ×
  // there cannot promise different things. It also reads the noun off the
  // format table, where this held a private *story or chapter?* of its own.
  //
  // **Including the refusal** (§9ac): a story with writing in it is never run
  // together with the one before, so the row carries the reason rather than a
  // × that would do it.
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

// ------------------------------------------------------------ a page's own ×

/**
 * **What a × on a page row takes away** (§9w, and corrected by §9x).
 *
 * Ken asked for this twice in the same words — *there's numbered pages, page
 * one, two, three. There's no way to delete those pages. There needs to be a
 * little X in the left menu allowing you to delete them*, and *there's a stray
 * page that has a bunch of information on it that I want to remove, but I
 * can't remove it* — and the second time nothing had changed for him, because
 * §9w built the × and then made it **absent on every kind of page his book
 * is made of**. Measured on an imported story: pages one to five, each one a
 * chapter opening or a page of prose, and not one of them carried a ×.
 *
 * The mistake was a rule misapplied. *Absent rather than greyed* is right
 * about a control that can only refuse, and §9w read it as *so there is no
 * control*, when the question it should have asked is **what a × on a page
 * can honestly do**. Every page has an answer:
 *
 * - **a blank leaf the writer put in** — the leaf goes;
 * - **a picture that is the page** — the picture comes out of the writing;
 * - **a page of the story's words** — those words are cut. That is the act
 *   the stray page needs: a submission header that came in with a `.docx` is
 *   writing as far as the manuscript is concerned and is not the writer's
 *   story, and no other screen in the room will take it out;
 * - **a leaf the cutter left** — the leaf is not the thing to remove, the
 *   **reason for it** is, so the × takes that: the picture stops leaving its
 *   back blank, or the chapter after it stops opening on a right-hand page.
 *
 * So a page row's × is never absent, which is the whole of the report.
 */
export interface PageRemoval {
  /** What the act needs: the leaf's own spot, the picture, or the chapter. */
  id: string | null;
  /** Which act it is, so one × can serve six kinds of page. */
  what: 'leaf' | 'picture' | 'words' | 'back' | 'recto' | 'between' | 'division' | null;
  /** The ×'s label, where there is one. */
  act: string | null;
  /** What goes with it, said beside the ask. */
  comfort: string;
  /** Why there is none, in a sentence a writer can act on. */
  refusal: string | null;
}

export const pageRemoval = (file: ProjectFile, rows: readonly BookPageRow[], sheet: number): PageRemoval => {
  const page = rows.find((one) => one.sheet === sheet);
  const no = (refusal: string): PageRemoval => ({ id: null, what: null, act: null, comfort: '', refusal });
  if (!page) return no('The book is still being set.');

  // The leaf a writer asked for: the only place it can be found again (§9i).
  if (page.blankFor) {
    return {
      id: page.blankFor,
      what: 'leaf',
      act: 'Take this page away',
      // **A sheet, so both of its pages** (§9ad): the writer put a leaf in and
      // a leaf is two sides, so a × on either of them takes the whole sheet.
      // Nothing after it changes side, two pages being an even number.
      comfort: 'The blank sheet goes — both its pages. Nothing else changes which side of the paper it is on.',
      refusal: null,
    };
  }

  /**
   * **A leaf the cutter left is removed by removing its reason** (§9x). §9w
   * refused here and named the reason, which is honest and leaves the writer
   * holding a page they cannot be rid of — and the reason is a setting one
   * press away, so the × reaches it.
   */
  if (page.blank) {
    /**
     * **The sheet between two whole works** (addendum 22 §9). It is the one
     * blank in the room that is neither the writer's nor the cutter's: the
     * book is **set** to leave it, so the × would have to reach a setting
     * that governs every one of them at once — which is not what a × on one
     * page means. It refuses and **names where the decision lives**, in §9x's
     * shape rather than §9w's: disabled with the reason in its title, because
     * absence is what read as *there's no way to delete those pages*.
     */
    if (page.blankBetween) {
      // Nothing names a unit itself (addendum 16 §6c).
      const one = nounsFor(file.project.format).division.toLowerCase();
      return {
        id: page.blankBetween,
        what: 'between',
        act: 'Take this page away',
        comfort: `The blank sheet goes — both its pages. Only this ${one} stops being separated by one; every other ${one} keeps its sheet, and Book settings is where they are all decided.`,
        refusal: null,
      };
    }
    if (page.blankBack) {
      const before = rows.find((one) => one.sheet === sheet - 1);
      // **Either side** (addendum 22 §9a): a picture on a left-hand page has
      // its back in **front** of it, that being the other side of the sheet,
      // so the picture this leaf belongs to may be on either neighbour.
      const after = rows.find((one) => one.sheet === sheet + 1);
      const picture = before?.figureId ?? after?.figureId ?? null;
      if (picture) {
        return {
          id: picture,
          what: 'back',
          act: 'Take this page away',
          comfort: `The picture ${before?.figureId ? 'before' : 'after'} it stops leaving its back blank. The picture stays where it is.`,
          refusal: null,
        };
      }
      /**
       * **The leaf behind a page of the book** (§17e, from Ken: *I added the
       * title page and said, leave the back of it blank, but it left an
       * additional page blank*). §9i wrote this branch for a picture, which
       * was everything it had; §17d then gave a **part** the same switch and
       * §9r a **chapter page**, and neither reached here — so the one leaf a
       * writer had deliberately asked for was the one with no × and a sentence
       * about the recto rule, which is the reason for a different leaf
       * altogether. `setBackBlank` reads which record the id names, so this
       * needs no third branch and the act is the same act.
       */
      const owner = before?.partId ?? before?.markerId ?? null;
      if (owner) {
        return {
          id: owner,
          what: 'back',
          act: 'Take this page away',
          comfort:
            'The page before it stops leaving its back blank, so what follows prints on its reverse again. The book may lose more than this one leaf.',
          refusal: null,
        };
      }
    }
    // The verso the recto rule leaves in front of an opening.
    const opens = rows.find((one) => one.sheet === sheet + 1);
    if (opens?.markerId && opens.says === 'Chapter opens') {
      return {
        id: opens.markerId,
        what: 'recto',
        act: 'Take this page away',
        comfort: 'The chapter after it opens on whichever page comes next, rather than on a right-hand one. Only that chapter changes.',
        refusal: null,
      };
    }
    /**
     * The one leaf with no act: the recto a page of the **book** takes — a
     * title page, a copyright page — which is a convention about that page
     * rather than a setting, so the sentence names it and sends the writer
     * to its own screen rather than offering a press that would have to
     * invent a rule.
     */
    return no(
      'This page is blank because the page after it opens on a right-hand page. That is the page to set, and it has a row of its own below.',
    );
  }

  if (page.figureId) {
    return {
      id: page.figureId,
      what: 'picture',
      act: 'Take this page away',
      comfort: 'The picture comes out of the writing; it stays in the library. Any leaf behind it goes with it.',
      refusal: null,
    };
  }

  // A page of the book's own front or back matter has a row of its own
  // above, with a × on it since §9a.
  if (page.partId) return no('This page belongs to a page of the book, which has a row of its own above.');

  /**
   * **The words on the page** (§9x). It is the biggest thing a × does in this
   * room, so the sentence counts them and names where they go; undo takes it
   * back like any other act (addendum 02 §6c).
   */
  if (page.elementIds.length > 0) {
    const count = page.elementIds.length;
    return {
      id: page.sheet.toString(),
      what: 'words',
      act: 'Take this page away',
      comfort: `${count} ${count === 1 ? 'paragraph goes' : 'paragraphs go'} — the words on this page are cut from the manuscript, and what follows moves up.`,
      refusal: null,
    };
  }

  /**
   * **A page carrying only a division's own leaf** — a story's title page in
   * a collection, a chapter page with a picture on it. Nothing of the
   * manuscript stands on it, so the only thing there is the break, and taking
   * the page away is taking the break out.
   *
   * §9w sent the writer to the row one line above instead, which is true and
   * is still a page with no ×. **Two controls onto one act are not two
   * answers** (§16d): this runs `removeDivision`, the row's own act, and says
   * the row's own sentence, so they cannot drift.
   */
  if (page.markerId) {
    /**
     * **And where the division is a whole work, there is nothing to take**
     * (§9ac, from Ken: *when I deleted the page, it removed the chapter page
     * completely… it also merged story two and three together into one story
     * for some reason*).
     *
     * This is the route he pressed. The page is the story's own, so the only
     * thing on it is the break — and taking that out ran two stories together,
     * which `divisionRemoval` now refuses outright. The refusal is carried
     * rather than paraphrased, so the page's own screen says exactly what the
     * rail's × says.
     */
    const division = divisionRemoval(file, page.markerId as never);
    if (division.refusal) return no(division.refusal);
    return {
      id: page.markerId,
      what: 'division',
      act: 'Take this page away',
      comfort: division.comfort,
      refusal: null,
    };
  }
  return no('Nothing of the book stands on this page.');
};

/**
 * Take a page out. **One act for every kind** (§9x), read off what
 * `pageRemoval` said it was, so no screen holds a second answer about what a
 * page's × does.
 */
export const removeBookPage = (file: ProjectFile, page: BookPageRow, what: PageRemoval): ProjectFile => {
  if (!what.id) return file;
  // **One leaf, not all of them** (§9ac): a writer may ask for several in one
  // place now, so a × on one of them takes that one — clearing the count
  // would take a run of pages away for a press on one row.
  // **A × takes the whole sheet, both its pages** (§9ad) — and the count is
  // in pages since the shift (§9ae), so it says how many that is rather than
  // leaving `1` to mean half a leaf.
  if (what.what === 'leaf') return setBlankPages(file, what.id, blankPagesAt(file, what.id) - SHEET);
  if (what.what === 'picture') return removeBookFigure(file, what.id);
  if (what.what === 'back') return setBackBlank(file, what.id, false);
  if (what.what === 'recto') return setChapterRecto(file, what.id, false);
  // **This work's separation, never the book's** (addendum 22 §9): the ×
  // stands on one page and a setting that reached every division at once
  // would be a control acting on something nobody is looking at.
  if (what.what === 'between') return setSheetBefore(file, what.id, false);
  if (what.what === 'words') return cutElements(file, page.elementIds);
  if (what.what === 'division') return removeDivision(file, what.id as never);
  return file;
};

/**
 * Cut a run of manuscript elements, wherever in the writing they are (§9x).
 * Nothing else about the beat changes, so the words that follow move up and
 * the book is set again — which is the whole of *what follows moves up*.
 */
const cutElements = (file: ProjectFile, ids: readonly string[]): ProjectFile => {
  const going = new Set(ids);
  if (going.size === 0) return file;
  return {
    ...file,
    beats: file.beats.map((beat) => ({
      ...beat,
      manuscript: {
        ...beat.manuscript,
        elements: beat.manuscript.elements.filter((element) => !going.has(element.id as string)),
      },
    })),
  };
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
