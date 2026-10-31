import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { RoomSave } from './RoomSave';
import { RoomFormat } from './RoomFormat';
import { SheetInk } from './SheetInk';
import { ContextMenu, type MenuEntry } from './ContextMenu';
import { EbookExportDialog } from './EbookExportDialog';
import {
  ADDABLE_KINDS,
  BOOK_FACES,
  BOOK_STYLES,
  FACE_NAMES,
  FACE_NOTES,
  FOLIO_PLACES,
  FOLIO_PLACE_WORDS,
  HEAD_CONTENTS,
  HEAD_CONTENT_WORDS,
  HEAD_PLACES,
  HEAD_PLACE_WORDS,
  describeHeadTops,
  runningHeadStyleOf,
  OPENINGS,
  PART_INFO,
  TRIM_PRESETS,
  aboutAuthorOf,
  addGraphic,
  addPart,
  addPartInset,
  beginStory,
  bookMetrics,
  bookVars,
  spreadFit,
  PAGE_ZOOM,
  SPREAD_INSET_PX,
  contentsDivisions,
  describeGeometry,
  describeSpine,
  graphicsInOrder,
  halfOf,
  isBackMatterPage,
  mayAdd,
  measureWarning,
  moveChapterBlock,
  movePart,
  opensOnLeaf,
  PART_FACES,
  PART_TEMPLATES,
  PART_TEMPLATE_WORDS,
  bookSettingsOf,
  chapterPageStyleSchema,
  bookNames,
  paragraphsOf,
  partHasStyle,
  partHasDividers,
  partPlacement,
  proseStyleBase,
  partOfInset,
  partStyleOf,
  partTemplateOf,
  partTemplatePatch,
  partTakesInsets,
  partParagraphs,
  partToHalf,
  addBookNumber,
  beginCopyright,
  copyrightLines,
  copyrightOf,
  numberLine,
  removeBookNumber,
  setBookNumber,
  setCopyright,
  BARCODE_INCHES,
  FICTION_DISCLAIMER,
  NUMBER_FORMATS,
  RIGHTS_RESERVED,
  type CopyrightPage,
  partTitle,
  partsOf,
  partsOwnPage,
  placePart,
  removePart,
  removePartInset,
  setChapterPage,
  setTitlePage,
  titlePageFieldsOf,
  updatePartInset,
  type BookFigurePlacement,
  type FigureAnchor,
  type LineStyle,
  type PartInset,
  type PartStyle,
  type PartTemplate,
  type StoryMarkerId,
  renderBookHtml,
  setBookSettings,
  setInContents,
  trimPresetOf,
  updatePart,
  type BookPage,
  type BookPart,
  type BookSettings,
  type PartKind,
  type ProjectFile,
  isCollection,
  holdsWholeWorks,
  nounsFor,
  chapterLeafContent,
  BOOK_PRESET_NAMES,
  BOOK_PRESETS,
  INSET_SPAN,
  INSET_RULE,
  cutsIntoText,
  sayPictureCost,
  droppedFigurePlace,
  MEASURE_SPAN,
  FREE_SPAN,
  sizeBookFigure,
  INSET_STANDOFF,
  PRESET_INFO,
  bookFigures,
  bookPresetOf,
  bookRows,
  drawnFigurePlace,
  moveFigureTo,
  addBookFont,
  bookFontsOf,
  fontBytes,
  fontFaceCss,
  fontFormatOf,
  fontNameOf,
  faceOfFont,
  removeBookFont,
  renameBookFont,
  MAX_FONT_BYTES,
  removeBookFigure,
  pagePlace,
  MARKER_NUMBERINGS,
  markerNumbering,
  type MarkerNumbering,
  bookPageRows,
  pagesUnder,
  rowHasUnder,
  visibleRows,
  blankOffer,
  designOffer,
  designPage,
  blankSpot,
  moveBlankPage,
  blankReason,
  sayBlankReason,
  pictureOffer,
  OWN_PAGE_ONLY_NOTE,
  pageRemoval,
  removeBookPage,
  movePictureTo,
  partBlankOffer,
  divisionStart,
  startDivision,
  chapterPageSchema,
  blankPagesAt,
  takePictureLeaf,
  SHEET,
  setBlankPages,
  setChapterBlank,
  plateIntoStory,
  type BookPageRow,
  type PictureOffer,
  type PageRemoval,
  placeBookFigure,
  placeFigure,
  removeBookRow,
  setBackBlank,
  setSheetAfter,
  setSheetBefore,
  setBlankBefore,
  setFigurePicture,
  whatGoesWithRow,
  type BookFigure,
  type BookRow,
  type PagePlace,
  type SaveKind,
  updateMarker,
  type BlankOffer,
  type BlankSide,
  DOCX_MEDIA_TYPE,
  buildBookDocx,
  suggestedDocxFileName,
  HEAD_FIELDS,
  sectionLayoutOf,
  setSectionLayout,
  type BookContentsRow,
  type SectionLayout,
  partHeading,
} from '@vcwriter/domain';
import { CitableText } from './citations/CitableText';
import { readFont } from '../read-font';
import { PopOutButton } from './PopOutButton';
import { ChapterPageDialog, ChapterStyleFields } from './ChapterPageDialog';
import { LineFields as Line } from './LineFields';
import { ChapterLayoutDialog } from './ChapterLayoutDialog';
import { CopyrightPageDialog } from './CopyrightPageDialog';
import { DesignedPageDialog } from './DesignedPageDialog';
import { BackMatterDialog } from './BackMatterDialog';
import { useModal } from '../use-modal';
import { usePreference, useSplit } from '../use-split';
import { PICTURE_ACCEPT, pictureRefusal, readPicture } from '../read-picture';
import { useBookLaying, type Laying } from '../book-typeset';
import { sayExport } from '../printing';

/**
 * The Layout room (addendum 20 §9): the parts down the left, the spreads in
 * the middle, the inspector on the right.
 *
 * Nothing here edits a word of the manuscript, stores a page number or a
 * margin it worked out, or reorders the story (§9a). What it writes is the
 * book's settings and the book's parts; what it draws is what `layPages`
 * decided from what the browser measured (§4).
 */

interface LayoutWindowProps {
  file: ProjectFile;
  open: boolean;
  /**
   * A part to open the moment the room does (§16b). *File ▸ Title page…* on
   * a book comes through here, because the book's title page is set on the
   * room's own screen and that screen needs the laid pages — its preview is
   * the page as the book sets it and its navigator turns to the next one.
   * Null on every other way in.
   */
  openOnKind?: PartKind | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Take the room to a window of its own (addendum 02 §8). Absent in one. */
  onPopOut?(): void;
  /**
   * Save the project somewhere else, from in here (addendum 29 §2). A room
   * covers the menu bar, so without this the two acts are reachable only by a
   * shortcut nobody can see. Absent where a host hands nothing down.
   */
  onSaveAs?(kind: SaveKind): void;

  /** File ▸ Chapter page…, opened on the chapter asked for. Absent in a window of its own. */
  onOpenChapterPage?(markerId: string): void;
}

const OPENING_WORDS: Record<(typeof OPENINGS)[number], string> = {
  none: 'Nothing special',
  small_caps: 'First words in small capitals',
  drop_cap: 'A drop capital',
};

/** The spread a sheet is on: the first leaf stands alone, then pairs. */
const spreadOfSheet = (sheet: number): number => (sheet <= 1 ? 0 : Math.floor(sheet / 2));

/** Where a picture the writer is choosing will go, decided before the picker opens. */
/**
 * What the picture about to be chosen will become.
 *
 * `front`, `back` and `before` are **gone** (§9w): an art page in a half of
 * the book stopped being a part the day §9i made a picture that is a page of
 * its own a **figure**, and the last thing that still built one was
 * `importPicture`'s fallthrough — the line that put a picture asked for on a
 * blank page at the back of the book. With it gone they were three members
 * nothing could construct and a branch nothing could reach, and leaving
 * `{ kind: 'back' }` as the ref's own starting value would have kept the
 * fault one missing call away.
 */
type ArtTarget =
  /** Into the story, before this element: across the measure, or a page of its own. */
  | {
      kind: 'story';
      elementId: string;
      as: 'measure' | 'page' | 'free';
      /**
       * **Which end of that element it stands at** (§9ap): every page but the
       * last answers *in front of*, and the last page of a book has nothing
       * ahead to stand in front of, so there the picture goes **after** the
       * story's final words — which `placeFigure` has been able to do since it
       * was written.
       */
      anchor?: 'before' | 'after';
      /** Whether it stands in front of the division's opening (§9w). */
      beforeOpening?: boolean;
      /**
       * The record whose blank leaf this picture **takes** (§9aa): a leaf and
       * a page of its own are the same page said two ways, so the leaf goes
       * as the picture arrives rather than standing in front of it.
       */
      takesLeaf?: string | null;
      /** Which of that record's leaves (§19a). */
      takesLeafAt?: number | null;
      /** The rule holding this page blank, freed as the picture goes on (§9al). */
      frees?: PictureOffer['frees'];
    }
  /** Into a part: cut into its words where it has them, a page of its own where it has not. */
  | {
      kind: 'part';
      partId: string;
      as: 'measure' | 'page' | 'free';
      /**
       * Where a **new** page of art goes in, where this is a leaf's answer
       * rather than the part's own (§9ab): the part it stands in front of.
       */
      before?: string | null;
      /** The writer's own leaf it takes, as a story page-figure does (§9aa). */
      takesLeaf?: string | null;
      /** Which of that record's leaves (§19a). */
      takesLeafAt?: number | null;
      /** The rule holding this page blank, freed as the picture goes on (§9al). */
      frees?: PictureOffer['frees'];
    }
  /** A logotype in place of a designed page's title (§9n). */
  | { kind: 'logo'; partId: string }
  /** The page as a piece of art, edge to edge (§8). */
  | { kind: 'part-art'; partId: string }
  /** The publisher's mark, at the foot of the title page (§16). */
  | { kind: 'imprint'; partId: string }
  /** The author's photograph, on *About the author* (§17). */
  | { kind: 'author-photo'; partId: string }
  /** Into a box already drawn and still empty (§9a). */
  | { kind: 'fill'; elementId: string }
  /** The barcode box on the copyright page (§9k). */
  | { kind: 'barcode'; partId: string };

/** The layout dialog opened on no chapter in particular (§14). */
const OPEN_LAYOUT = 'book';

/**
 * What the three areas of a book are called (§9k). *The story* is named too,
 * because two labelled halves around an unlabelled middle reads as though the
 * middle were left over rather than the point of the book.
 */
const AREA_NAMES: Record<'front' | 'body' | 'back', string> = {
  front: 'Front matter',
  body: 'The story',
  back: 'Back matter',
};

/** A page that stands on nothing, before the book has been laid. */
const EMPTY_PLACE: PagePlace = { elementId: null, partId: null, markerId: null };
/** What a picture may do before any page is in hand (§9w): nothing, and it says so. */
const NO_PICTURE: PictureOffer = {
  spot: null,
  pageSpot: null,
  of: null,
  anchor: 'before',
  beforeOpening: false,
  note: null,
  takesLeaf: null,
  takesLeafAt: null,
  ownPageOnly: false,
  newPageBefore: null,
  frees: null,
  refusal: 'Choose a page first: the picture goes at the top of it.',
};

/**
 * Where a blank leaf may go, with no page in hand (§9y) — `NO_PICTURE`'s
 * shape, for the Add menu's own item.
 */
const NOWHERE = 'Choose a page first: a blank page goes beside the one in hand.';
const NO_BLANK: BlankOffer = {
  before: { spot: null, act: null, note: null, refusal: NOWHERE },
  after: { spot: null, act: null, note: null, refusal: NOWHERE },
  fewer: null,
  pages: 0,
  note: null,
  refusal: NOWHERE,
};

/** i, ii, iii — the front matter's numbers, for the rail. */
const roman = (value: number): string => {
  const parts: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let left = value;
  let out = '';
  for (const [size, word] of parts) {
    while (left >= size) {
      out += word;
      left -= size;
    }
  }
  return out;
};

/** The page a part, or a figure, first appears on in a laying. */
const pageOf = (laying: Laying, id: string): BookPage | undefined => {
  const blocks = new Map(laying.blocks.map((block) => [block.id, block]));
  return laying.laid.pages.find((candidate) =>
    candidate.pieces.some((piece) => {
      const block = blocks.get(piece.blockId);
      return (
        block !== undefined &&
        (block.id === id ||
          block.partId === id ||
          block.unitId === id ||
          block.inset?.figureId === id ||
          // A graphic set over the page rides a block without being one
          // (§8c), so without this a free graphic's row turned to no page —
          // which since §9u is the way to its own controls.
          block.free?.some((one) => one.figureId === id) === true)
      );
    }),
  );
};

export function LayoutWindow({ file, open, openOnKind = null, onClose, onUpdate, onPopOut, onSaveAs, onOpenChapterPage }: LayoutWindowProps) {
  const { laying, box } = useBookLaying(file, open);
  /**
   * What is chosen (§9a): one selection for the whole room, because the rail
   * is one list. A row's id is a part's, a chapter's or a figure's, so the
   * inspector reads whichever it turns out to be rather than the room keeping
   * three selections that can disagree.
   */
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  /**
   * The page in hand (§9a, from Ken: *you select a page in the layout view
   * and then add picture*). A sheet number, because a page is not a record —
   * what is *on* it is read back through `pagePlace` at the moment of use.
   */
  const [selectedSheet, setSelectedSheet] = useState<number | null>(null);
  /**
   * The chapters whose pages are showing (§9h, from Ken: *you should be able
   * to drop down each chapter and see how many pages*). A fold rather than a
   * setting: which chapter somebody is looking into is about this minute, so
   * it is not stored anywhere.
   */
  const [openChapters, setOpenChapters] = useState<string[]>([]);
  const [spread, setSpread] = useState(0);
  /**
   * How big the spread is drawn (§9e).
   *
   * **Null means fit**, which is `minimumSetups`' shape a fourth time: the
   * room works the size out from the trim and the window it is in, and stores
   * nothing, so widening the rail, resizing the window or changing the trim
   * re-fits by itself. A number is a zoom the writer set by hand, and it is
   * kept per machine until they press *Fit* again.
   *
   * The key is new on purpose: the old `layout.zoom` held 0.55 because that
   * was the only size the room could be read at, which is not somebody
   * choosing a zoom — carrying it over would hide this from the one machine
   * that has used the room.
   */
  const [chosenZoom, setChosenZoom] = usePreference<number | null>('layout.pageZoom', null);
  /**
   * The stage the spread is drawn in, measured. A callback ref rather than a
   * `useRef`, because the spreads are not rendered until the book has been
   * laid — an effect on mount would find nothing there.
   */
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [space, setSpace] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!stage) return undefined;
    const read = () => setSpace({ width: stage.clientWidth, height: stage.clientHeight });
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const watching = new ResizeObserver(read);
    watching.observe(stage);
    return () => watching.disconnect();
  }, [stage]);
  const [busy, setBusy] = useState(false);
  const [ebookOpen, setEbookOpen] = useState(false);
  /** Book settings (§9, from Ken): the whole book at once, in a dialog off the bar. */
  const [bookSettingsOpen, setBookSettingsOpen] = useState(false);
  /** The part opened in a dialog of its own, by a double-click (§9). */
  const [partDialogId, setPartDialogId] = useState<string | null>(null);
  /** The page of the story opened in a dialog of its own (§9j). */
  const [pageDialogSheet, setPageDialogSheet] = useState<number | null>(null);
  /** Why a drop on an area was refused, said once under the rail (§9k). */
  const [areaRefusal, setAreaRefusal] = useState<string | null>(null);
  /** The copyright page open in its own dialog (§9k). */
  const [copyrightOpen, setCopyrightOpen] = useState(false);
  /**
   * A part asked for on the way in (§16b), opened once the room is up.
   *
   * Keyed on `open` rather than on the kind, so closing the dialog and
   * leaving the room open does not reopen it a moment later — the ask is
   * about arriving, not about the room standing there.
   */
  useEffect(() => {
    if (!open || !openOnKind) return;
    const wanted = partsOf(file).find((one) => one.kind === openOnKind);
    if (!wanted) return;
    setSelectedRowId(wanted.id);
    if (openOnKind === 'copyright') setCopyrightOpen(true);
    else setPartDialogId(wanted.id);
    // Only on arriving. `file` is read for the parts and must not re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openOnKind]);
  /**
   * The chapter-page dialog, **the room's own** (§9, §9d).
   *
   * It used to be handed to the workspace where there was one, and only a
   * popped-out room kept its own — which was fine while the dialog could do
   * nothing the room had to help with. *Add custom graphic…* ended that: the
   * box is drawn on the spread behind the dialog, so the only screen that can
   * offer it is the one holding that spread. `onOpenChapterPage` is still
   * given to Book settings, whose button is about the book rather than about
   * a page in hand.
   */
  const [ownChapterPage, setOwnChapterPage] = useState<string | null>(null);
  const openChapterPage = (markerId: string) => setOwnChapterPage(markerId);
  /** The chapter page being asked about before it is taken off (§9). */
  const [clearing, setClearing] = useState<string | null>(null);
  /**
   * Drawing a picture's box on the page (§8a, §9a, from Ken: *you should be
   * able to draw a box in a page and it will create a graphics box… and then
   * add a graphic to it*). The drag says how wide the box is and which side
   * it cuts in at, and the picture is chosen afterwards.
   *
   * **It makes a box and never redraws one** (§9ak, from Ken: *instead of
   * trying to create a box first, which it seems to cause errors*). It used
   * to hold a figure's own id as well, which is how a picture already in the
   * book was moved — by drawing its box again somewhere else — and that was
   * the only way to move one at all: `placing`, the handle that drags and
   * resizes, was armed for a free graphic and for nothing else. So the one
   * thing a writer could do to a picture in the text was redraw it, which is
   * the gesture his message is about. A picture is **moved and resized where
   * it stands** now, and this tool is what it says it is: the box drawn
   * before there is a picture to put in it.
   */
  const [drawing, setDrawing] = useState(false);
  /**
   * The box just drawn, still being placed (addendum 20 §9d, from Ken: *you
   * can slide it around and watch the text move around it so you can get it
   * placed perfectly … there will be an X or a check mark in the middle of
   * the box*).
   *
   * Placing is a **state of the room rather than of the figure**: nothing
   * about it is stored, so a project saved mid-drag reads as a box standing
   * where it was let go, and the ✗ is what undoes drawing one rather than a
   * field the file has to carry.
   */
  const [placing, setPlacing] = useState<string | null>(null);
  /**
   * **How long the book was when the picture in hand was taken up** (§9at).
   *
   * It is read at the act rather than from an effect on `placing`, because the
   * laying is recomputed a beat later: an effect would read whichever of the
   * two layings happened to be current and so would sometimes compare the book
   * against itself. Captured before the update, it is always the length before
   * this picture, which is the only thing the sentence claims.
   */
  const pagesAtPickup = useRef<number | null>(null);
  /**
   * **The page that was pressed, and what it had free** (§9au), captured at
   * the same moment and for the same reason: once the picture is in, the page
   * has refilled with whatever came after it, so asking afterwards answers
   * about a page that no longer has the question in front of it.
   */
  const chosenAtPickup = useRef<string | null>(null);
  const roomAtPickup = useRef<number | null>(null);
  /** The chapter whose opening layout is being set (§14); OPEN_LAYOUT for the book's. */
  const [layoutDialogId, setLayoutDialogId] = useState<string | null>(null);
  /**
   * The rail's width (§9, from Ken: *the left side toolbar needs to be
   * dragged out, and by default a half inch wider*): a divider the writer
   * drags, remembered per machine, starting half an inch wider than it was.
   */
  // Wide enough to read a row whole (from Ken: *the left toolbar needs to be
  // sized so you can see everything*). A row carries a name, the page it opens
  // on and a ×, and at 288 a story called *The Lamp and the Lighthouse* was
  // cut off. Only a machine that has never dragged the divider takes this:
  // `useSplit` remembers, so nobody's own width is overwritten.
  const rail = useSplit({ key: 'layout.rail', initial: 360, min: 220, reserve: 720, axis: 'x' });
  const [message, setMessage] = useState<string | null>(null);
  /** The Add menu, open at the button (§9a). */
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  /**
   * What the rail is dragging: a part within its half, a chapter as a block,
   * or a picture onto another page (§9w).
   */
  const [dragging, setDragging] = useState<{ kind: 'part' | 'chapter' | 'picture' | 'blank'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /**
   * The one picker for every picture the room takes in (§9, §9a). What the
   * picture will become is decided before the picker opens and read back
   * when the file arrives; nothing is made until it does, so a cancelled
   * dialog leaves no empty page behind.
   */
  const artPicker = useRef<HTMLInputElement>(null);
  // Nothing until something asks (§9w): a starting target that really places
  // a picture is a picture placed by a call nobody made.
  const artTarget = useRef<ArtTarget | null>(null);

  const parts = useMemo(() => partsOf(file), [file]);
  /** The book as one list (§9a): the rail, and the room's one selection. */
  const rows = useMemo(() => bookRows(file), [file]);
  /**
   * A drop on an area heading (§9k). The domain decides whether it may
   * happen and says why not, so the rail never quietly does nothing.
   */
  const dropOnArea = (half: 'front' | 'body' | 'back') => {
    const moving = dragging;
    setDragging(null);
    setOver(null);
    if (!moving || half === 'body') return;
    onUpdate((current) => {
      const done = partToHalf(current, moving.id, half);
      setAreaRefusal(done.refusal);
      return done.file;
    });
  };

  const opened = parts.find((part) => part.id === partDialogId) ?? null;
  /**
   * The four pages that are **a block of words on a page of their own** get
   * the designed-page screen (§9n); every other kind keeps the old fields,
   * because its three sections are about placing a block and a page that
   * flows has none to place. `partPlacement` has drawn that line since §7a,
   * so there is no second list of kinds here.
   */
  const designed = opened && partPlacement(opened.kind) === 'block' && opened.kind !== 'plate' ? opened : null;
  /**
   * The copyright page opens **its own screen** (§15c, from Ken: *it still
   * does not show in the update*). §15a gave the older dialog a button
   * through to it, which is a route rather than a second copy — but the
   * route still landed a writer on the free-text box the dialog replaces,
   * so the new screen read as unbuilt. A double-click is one gesture and
   * the copyright page is one page, so it goes straight there.
   */
  const copyrightPart = opened && opened.kind === 'copyright' ? opened : (copyrightOpen ? (parts.find((one) => one.kind === 'copyright') ?? null) : null);
  /**
   * The seven pages after the story open **their own screen** (§17). It is
   * the same route the copyright page and the designed pages take, and for
   * the same reason: a double-click is one gesture and a page is one page, so
   * it goes straight to the screen that sets it rather than through the
   * older fields it replaces.
   */
  const backMatterPart = opened && isBackMatterPage(opened.kind) ? opened : null;
  const divisions = useMemo(() => contentsDivisions(file), [file]);

  const pages = laying?.laid.pages ?? [];
  /**
   * **A page as the book prints it** (§9au), for a sentence that points at
   * one: roman in the front matter, arabic in the story, and nothing at all
   * where the page carries no number, since naming a number it does not print
   * would send a writer looking for it.
   */
  const pageLabel = (page: BookPage | undefined | null): string | null =>
    !page || page.numbering === 'none' ? null : page.numbering === 'roman' ? roman(page.number) : String(page.number);
  /**
   * **How many lines a page has left** (§9au), counted off the laid page
   * rather than estimated: a piece is a run of a block's lines, so what the
   * page has spent is the sum of its pieces and what is free is the rest.
   * `except` drops a picture already standing there, so taking hold of one
   * asks what room the page would have without it.
   */
  const freeLinesOn = (page: BookPage | undefined | null, except: string | null): number | null => {
    if (!laying || !page) return null;
    const used = page.pieces.reduce(
      (sum, piece) => (piece.blockId === except ? sum : sum + (piece.to - piece.from)),
      0,
    );
    return Math.max(0, laying.geometry.linesPerPage - used);
  };
  /** What the page a picture was asked for is called, and what it had free (§9au). */
  const noteWhereFrom = (sheet: number | null, except: string | null = null) => {
    const at = laying?.laid.pages.find((one) => one.sheet === sheet);
    chosenAtPickup.current = pageLabel(at);
    roomAtPickup.current = freeLinesOn(at, except);
  };
  /**
   * **What the picture in hand has done to the book** (§9at), said on the
   * handle beside its size. It is a reading over the laying in front of the
   * writer, so letting the corner go re-says it with nothing run, and it
   * disappears with the handle.
   */
  const placingNote = useMemo(() => {
    if (!placing || !laying || pagesAtPickup.current === null) return '';
    const held = bookFigures(file).find((one) => one.elementId === placing);
    if (!held) return '';
    // Where it actually came out, read off the laid pages (§9au).
    const on = laying.laid.pages.find((one) => one.pieces.some((piece) => piece.blockId === placing));
    return sayPictureCost({
      place: held.placement.place,
      pages: laying.laid.pages.length - pagesAtPickup.current,
      runsRound: cutsIntoText(laying.blocks, placing),
      chosen: chosenAtPickup.current,
      landed: pageLabel(on),
      room: roomAtPickup.current ?? undefined,
      wants: laying.measured.get(placing),
      span: held.placement.span,
    });
  }, [placing, laying, file]);
  /** Every page of the book with a word for what stands on it (§9h). */
  const pageRows = useMemo(() => (laying ? bookPageRows(laying.laid.pages, laying.blocks) : []), [laying]);
  /** What each division folds open on: a range of pages, so none is lost (§9m). */
  const folds = useMemo(() => pagesUnder(rows, pageRows), [rows, pageRows]);
  /**
   * **Which division the page in hand is in** (§9y), for the title box beside
   * the book's. `markerId` is the rail's own reading — null on a part's page,
   * which is why the first division stands in there rather than the box going
   * absent on the one page a writer is most likely to be looking at when they
   * open Book settings.
   */
  const divisionInHand = pageRows.find((row) => row.sheet === selectedSheet)?.markerId ?? null;
  /**
   * The rows a closed fold leaves standing (§9o). Containment is depth, so a
   * closed story hides every row under it — its chapters and their pages —
   * until the next row at its own level.
   */
  const shown = useMemo(() => visibleRows(rows, openChapters), [rows, openChapters]);
  const spreadCount = Math.max(1, Math.ceil((pages.length + 1) / 2));
  /**
   * The size that fits, read every render from the trim and the space there
   * is (§9e). Until the stage has been measured there is nothing to fit to,
   * so the spread is drawn at the smallest the slider offers for one frame
   * rather than at a number that would have to be undone.
   */
  const fit = laying && space ? spreadFit(laying.geometry, space) : PAGE_ZOOM.min;
  const zoom = chosenZoom ?? fit;
  useEffect(() => {
    if (spread >= spreadCount) setSpread(Math.max(0, spreadCount - 1));
  }, [spread, spreadCount]);

  /**
   * A page just made is turned to once the laying has it: the pages are
   * re-laid after the document changes, so the turn waits for the page to
   * exist rather than looking for it in the laying that came before.
   */
  const turnTo = useRef<string | null>(null);
  useEffect(() => {
    if (!laying || !turnTo.current) return;
    const page = pageOf(laying, turnTo.current);
    if (!page) return;
    turnTo.current = null;
    setSpread(spreadOfSheet(page.sheet));
    // And the page in hand follows what was just made (§9h): a picture asked
    // for on page nine lands on a page of its own, and leaving the old sheet
    // chosen would leave the inspector describing the page before it.
    setSelectedSheet(page.sheet);
  }, [laying]);

  // ← and → turn the pages.
  useEffect(() => {
    if (!open) return undefined;
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (event.key === 'ArrowRight') setSpread((current) => Math.min(spreadCount - 1, current + 1));
      if (event.key === 'ArrowLeft') setSpread((current) => Math.max(0, current - 1));
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [open, spreadCount]);

  /**
   * Delete takes the picture in hand (§9j, from Ken: *I need to be able to
   * select the pictures on the page… or delete them*).
   *
   * Only where a **picture** is chosen, and never while the pointer is in a
   * field — a book has no other selection this key could mean, and a writer
   * typing a caption is not asking for anything to go. The picture leaves the
   * book and stays in the library, which is what makes the key safe to give:
   * Ctrl+Z puts it back, and the file was never at risk.
   *
   * It sits **here**, above the room's own `open` guard, because a hook after
   * a conditional return is a hook that is sometimes not run — which is not a
   * style point: it took the whole room down the first time it was written
   * further down the file, where the figure it acts on is declared.
   */
  useEffect(() => {
    if (!open || !selectedRowId) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const on = event.target as HTMLElement | null;
      if (on?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!bookFigures(file).some((one) => one.elementId === selectedRowId)) return;
      event.preventDefault();
      setSelectedRowId(null);
      setPageDialogSheet(null);
      onUpdate((current) => removeBookFigure(current, selectedRowId));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, selectedRowId, file, onUpdate]);

  if (!open) return null;

  const settings = laying?.settings;
  const write = (patch: Partial<BookSettings>) => onUpdate((current) => setBookSettings(current, patch));

  /** The page a part first appears on, so choosing it turns to it. */
  const goToPart = (partId: string) => {
    if (!laying) return;
    const page = pageOf(laying, partId);
    if (page) setSpread(spreadOfSheet(page.sheet));
  };

  const exportBook = async () => {
    if (!laying) return;
    setBusy(true);
    setMessage(null);
    const html = renderBookHtml(laying.laid.pages, laying.blocks, laying.context, bookNames(file).title);
    const { trim } = laying.geometry;
    const result = await window.vcwriter.exportPdf({
      file,
      kind: 'book',
      html,
      paper: { width: trim.width, height: trim.height },
    });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? 'The book could not be exported');
      return;
    }
    // The same sentence the rest of the program's exports say: this room
    // calls the bridge itself, because it hands the book's markup over, and
    // a second copy of the words would be a second answer to what happened.
    if (result.data) setMessage(sayExport(result.data));
  };

  /**
   * The book as a Word manuscript (addendum 43 §9): the same blocks, its
   * citations as Word's own footnotes and its bibliography as the back
   * matter makes it. Not a page of this room's layout — Word lays its own.
   */
  const exportWord = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await window.vcwriter.saveFile({
        name: suggestedDocxFileName(file),
        bytes: await buildBookDocx(file),
        mediaType: DOCX_MEDIA_TYPE,
        kind: { name: 'Word document', extension: 'docx' },
      });
      if (!result.ok) setMessage(result.error ?? 'The Word document could not be saved');
      else if (result.data) setMessage(`Exported to ${result.data.path}`);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The Word document could not be made');
    } finally {
      setBusy(false);
    }
  };

  const figures = bookFigures(file);
  /** What this format calls a division — Chapter, Story, Episode (§6a). */
  const { division: noun, divisionPlural: nounPlural } = nounsFor(file.project.format);
  const selectedFigure = figures.find((figure) => figure.elementId === selectedRowId) ?? null;

  /** The page a double-click opened, and the picture standing on it (§9j). */
  const dialogPage = pageRows.find((one) => one.sheet === pageDialogSheet && !partsOwnPage(one)) ?? null;
  /**
   * The picture the dialog is about (§9u).
   *
   * A page row's `figureId` names only a picture that **is** the page, so a
   * picture cut into the text and a graphic set over it could not be found
   * from here at all — the inspector was the one place either could be
   * reached, which is why removing it had to answer this first. The picture
   * **in hand** wins where it stands on this page: pressing one on the spread
   * picks it and puts its page in hand, so the two agree by construction.
   */
  const dialogFigure =
    selectedFigure && dialogPage !== null && dialogPage.sheet === selectedSheet
      ? selectedFigure
      : dialogPage?.figureId
        ? (figures.find((one) => one.elementId === dialogPage.figureId) ?? null)
        : null;


  /**
   * What the page in hand stands on (§9a). Everything that adds a picture
   * asks this and nothing else, so *add it to this page* means one thing
   * wherever it is pressed.
   */
  const place = laying && selectedSheet !== null ? pagePlace(laying.laid.pages, laying.blocks, selectedSheet) : EMPTY_PLACE;
  /** Where anything asked for on a sheet would go (§9r), read from the laying. */
  const pagePlaceFor = (sheet: number): PagePlace =>
    laying ? pagePlace(laying.laid.pages, laying.blocks, sheet) : EMPTY_PLACE;
  /**
   * **What a picture may do on that sheet** (§9w), for the drops as well as
   * the buttons. A page row carries the first body block **on** the page,
   * which on a division's opening page is nothing at all — so the drop asked
   * the row and refused there, and dragging a picture onto a chapter's
   * opening page did nothing with nothing saying why. `pagePlace` walks
   * forward for the chapter's first element (§9p), so asking the offer is
   * asking the one reading every other surface takes.
   */
  const offerFor = (sheet: number): PictureOffer => pictureOffer(pagePlaceFor(sheet), pageRows, sheet, nounPlural.toLowerCase());
  /**
   * **Which record a blank page dropped on this page would hang on** (§9an).
   * It is `blankSpot`, the one reading the panel and the Add menu already
   * ask, so the rail cannot land a leaf somewhere neither of them would.
   */
  const blankSpotFor = (sheet: number): string | null => {
    const row = pageRows.find((one) => one.sheet === sheet);
    return row ? blankSpot(pagePlaceFor(sheet), row) : null;
  };
  /**
   * **Where a blank page dropped on a row of the rail would land** (§9ao, from
   * Ken: *I couldn't drag the page to the last page. And I couldn't drag the
   * page again after I already dragged it*).
   *
   * §9an gave the drag to the **page** rows and nowhere else, and measuring
   * the real rail is what showed what that costs: every other row — a part, a
   * division, a section — accepted the drag, **lit up as a drop target**, and
   * then did nothing with it, `dropOn` having no branch for a blank. That is
   * worse than a refusal, because the highlight says the drop will be taken.
   * And it is most of the book: a part with nothing under it but the page its
   * own row names has no page row at all (§17e), so the last page of a book
   * that ends in *About the author* is precisely one of these.
   *
   * **A row is a page**, which the picture drag has read off `pageOf` since
   * §9w, so this is that reading with `blankSpotFor` after it — one answer the
   * dragover and the drop both take, or the highlight could go on lying.
   */
  const blankLandingOn = (row: BookRow): string | null => {
    const at = laying ? pageOf(laying, row.id) : undefined;
    return at ? blankSpotFor(at.sheet) : null;
  };
  /**
   * **Whether a picture may be asked for on the page in hand, and where it
   * will land** (§9w). The one reading the rail's button, the Add menu and the
   * page's own dialog all take, where each used to decide for itself — which
   * is how a button came to act while its own tooltip said to choose a page
   * first.
   */
  const pageOffer = selectedSheet === null ? NO_PICTURE : offerFor(selectedSheet);
  /**
   * **Whether a blank leaf may be asked for on the page in hand** (§9y, from
   * Ken: *I want the ability to put a blank page anywhere. So in the plus add
   * button, I want to be able to put a blank page* — and, a minute later,
   * *I'm trying to enter a blank page so the chapter opening moves a page*).
   *
   * The act is §9r's and is unchanged; what was missing is the **route**. It
   * stood on the page's own dialog and on the part's panel, so a writer
   * looking at the + Add button — which is where anything else that puts a
   * page in is asked for — correctly concluded it was not there. §15c and
   * §16b's lesson a fifth time, and the same reading rather than a second
   * answer: the one `blankOffer` the panel takes, so the menu cannot offer
   * what the panel refuses.
   */
  const chosenRow = selectedSheet === null ? undefined : pageRows.find((row) => row.sheet === selectedSheet);
  const pageBlank =
    selectedSheet === null ? NO_BLANK : blankOffer(place, pageRows, selectedSheet, pagePlaceFor(selectedSheet + 1));
  /**
   * **One press for either side** (§9an). A blank page goes in front of the
   * record the offer names, and that is the whole act — the shift that used
   * to sit beside it, writing a division's `opensRecto` under the words *shift
   * it on a page*, is gone at Ken's own ask. Both screens that offer it call
   * this, so neither holds a second answer about what a press does.
   */
  const addBlank = (side: BlankSide) => {
    const { act, spot } = side;
    if (!act || !spot) return;
    onUpdate((current) => setBlankPages(current, spot, blankPagesAt(current, spot) + 1));
  };
  /**
   * **Design this page, from wherever a writer is standing** (§9ar, from Ken:
   * *every single page that should, that's blank should have the same ability
   * to design it or put something on there*).
   *
   * It is **one act read by both screens** rather than a second copy on the
   * menu: the page's own panel has offered this since §19 and the *+ Add*
   * button — where anything else that puts a page in is asked for — had never
   * heard of it, which is §9y's own finding about the blank page and §15c's
   * about a route. That matters more now than it did an hour ago, because on
   * a blank page this is the **only** way a picture gets there, so a menu that
   * greys the picture and names the design route has to be a menu the design
   * route is on (addendum 10 §8).
   */
  const designHere = (sheet: number) => {
    const made = designPage(file, pagePlaceFor(sheet), pageRows, sheet, nounPlural.toLowerCase());
    if (made.refusal || !made.partId) return;
    setPageDialogSheet(null);
    onUpdate(() => made.file);
    setSelectedRowId(made.partId);
    setPartDialogId(made.partId);
  };
  const pageDesign =
    selectedSheet === null
      ? { leafId: null, leafAt: 0, beforeId: null, frees: null, note: '', refusal: 'No page is chosen.' }
      : designOffer(place, pageRows, selectedSheet, nounPlural.toLowerCase());
  /**
   * **Whether a division may be started on the page in hand** (§9ab), which is
   * `divisionRemoval`'s inverse and so the thing that makes the × on a
   * division's page an act a writer can take back. A marker sits on a unit, so
   * it is the section that **opens** here rather than the one in force — the
   * row says which, and `divisionStart` refuses the rest in a sentence.
   */
  /**
   * **Read off the place rather than the row** (§9ac, from Ken: *then you can
   * be able to turn a blank page into a chapter page with a blank back or
   * not*). A row's `opensUnitId` is a fact about the row, and on a blank leaf
   * it is nothing at all — so the act was absent on the one page a writer is
   * most likely standing on when they want a story to begin there. §9aa's walk
   * forward answers the same question of the place.
   */
  const pageDivision = divisionStart(file, ((place.opensUnitId ?? chosenRow?.opensUnitId) ?? null) as never);
  /** What the page in hand is called in the book, for the buttons that act on it. */
  const chosen = pages.find((one) => one.sheet === selectedSheet);
  const chosenPage =
    !chosen || chosen.numbering === 'none'
      ? 'this page'
      : `page ${chosen.numbering === 'roman' ? roman(chosen.number) : chosen.number}`;

  /** Open the picker for a picture that will become this. */
  const importArt = (target: ArtTarget) => {
    // **The length of the book before this picture** (§9at), read here because
    // every route that puts one in comes through this door.
    pagesAtPickup.current = laying?.laid.pages.length ?? null;
    noteWhereFrom(selectedSheet);
    artTarget.current = target;
    artPicker.current?.click();
  };

  /**
   * A picture into the page in hand (§9a, from Ken: *you click on a page, you
   * click on a button that says add picture… to that page, and it scoots all
   * the text down*).
   *
   * There is one act and it reads where it lands. In the story a picture is a
   * figure put in before the first thing on the page, so the page opens with
   * it and the words move down; in a part with words it is cut into the text;
   * and where the page has neither it is a page of its own. None of that is a
   * choice the writer makes — it is what *here* means at each of those three
   * places.
   */
  const importPicture = (as: 'measure' | 'page' | 'free', on?: PictureOffer) => {
    const offer = on ?? pageOffer;
    /**
     * **A picture asked for on a page goes on that page, or is refused**
     * (§9w). This ended `else importArt({ kind: 'back' })`, so on a page with
     * nothing of the book on it — a blank leaf — a picture asked for here
     * became an art page at the **back of the book**: the one way in this room
     * a picture ever landed where nobody asked for it, and the thing Ken
     * reported. Every control that calls this now reads `offer` first, so the
     * fallthrough has nothing left to catch and is gone.
     */
    /**
     * **A leaf among the front or back pages becomes a page of art, here**
     * (§9ab). It is the only answer with no `spot`, a leaf standing in front
     * of a part having no record of its own to hang a picture from — what it
     * has instead is a **position**, which is what the page of art takes.
     */
    if (offer.newPageBefore) {
      importArt({
        kind: 'part',
        partId: offer.newPageBefore,
        as: 'page',
        before: offer.newPageBefore,
        takesLeaf: offer.takesLeaf,
        takesLeafAt: offer.takesLeafAt,
        frees: offer.frees,
      });
      return;
    }
    if (!offer.spot) {
      setMessage(offer.refusal);
      return;
    }
    if (offer.of === 'story') {
      importArt({
        kind: 'story',
        anchor: offer.anchor,
        /**
         * **A page of its own goes in at the top of the page and a box in the
         * text at the first paragraph that begins on it** (§9af): two
         * positions on a page that opens with somebody's half paragraph, and
         * the same on every other page. `topElement` says why.
         */
        elementId: as === 'page' ? (offer.pageSpot ?? offer.spot) : offer.spot,
        as,
        beforeOpening: as === 'page' && offer.beforeOpening,
        takesLeaf: as === 'page' ? offer.takesLeaf : null,
        takesLeafAt: as === 'page' ? offer.takesLeafAt : null,
        // **The rule goes with the page it holds** (§9al), so it is carried
        // only where the picture really is the page: a box cut into the text
        // is never asked for on a blank leaf (`ownPageOnly`), and freeing a
        // back for one would be turning a switch off for a picture that
        // cannot stand there.
        frees: as === 'page' ? offer.frees : null,
      });
      return;
    }
    importArt({ kind: 'part', partId: offer.spot, as });
  };

  /**
   * **The rule holding the page blank, freed as the picture goes on it**
   * (§9al, from Ken: *I should be able to pick a page, even if it's the back
   * of a text page or the back of a chapter page, and add something to it*).
   *
   * §9ae's rule — *where a rule holds the page, the act frees the rule* — and
   * the two it can meet differ in exactly what they do to the book's length,
   * which is why they are one act and not one line:
   *
   * - a **back** is printed on, so the leaf keeps its place and the side of
   *   the paper it had, the switch goes, and nothing else moves;
   * - a **separating sheet** is taken away and the picture stands in its
   *   place, facing the work that follows.
   *
   * The second was **measured rather than reasoned about**. The first draft
   * gave the picture its own blank back on §9ad's rule — one sheet off and
   * two pages back in — which is right for the writer's own sheet, where
   * nothing forces the leaf onto a side. Here the next work opens on a
   * right-hand page, so a picture asked to leave its back blank takes a recto
   * (§9j) and the book came back **one page longer** than the sheet it
   * replaced: measured on a collection of two stories, 17 pages became 18
   * with the back blank and 16 without it. The picture facing the next work
   * is what a reader sees either way, and it is the shorter book.
   *
   * It is the same act for a figure in the story and a part's page of art:
   * `setBackBlank` already reads which of the three collections an id names
   * (§17e), and there is nothing else to tell them apart.
   */
  const freeTheBlank = (file: ProjectFile, frees: PictureOffer['frees']): ProjectFile => {
    if (!frees) return file;
    if (frees.rule === 'back' && frees.id) return setBackBlank(file, frees.id, false);
    // **And the one after the last of them** (§9ao's sheet), which carries no
    // id: a separation after the last work is a fact about the **book** rather
    // than about any one work, so the act is the book's own switch.
    if (frees.rule === 'ending') return setSheetAfter(file, false);
    // **For this work and never for every one of them at once** (addendum 22
    // §9): `null` is *use the book's*, which is the separation switched on.
    return frees.id ? setSheetBefore(file, frees.id, false) : file;
  };

  /**
   * The picture arrives: it joins the graphics library — the one place the
   * book's pictures live, reachable from Research ▸ Graphics — and is put
   * where the writer asked, in one act, so a writer with a picture on disk
   * never has to know the library exists to use one.
   */
  const takeArt = async (picked: File | undefined) => {
    if (!picked) return;
    // One reading (§16a): a vendor's barcode arrives as a PDF, and a gate
    // written here would go on refusing it after the reader learned to draw
    // one — which is what nine hand-written copies of this had been doing.
    const no = pictureRefusal(picked);
    if (no) {
      setMessage(no);
      return;
    }
    const target = artTarget.current;
    if (!target) return;
    try {
      const read = await readPicture(picked);
      onUpdate((current) => {
        const added = addGraphic(current, { name: picked.name, ...read });
        const assetId = added.asset.id;

        if (target.kind === 'fill') return setFigurePicture(added.file, target.elementId, assetId as string);

        // The barcode on the copyright page (§9k). It goes through the room's
        // one picker like every other picture, so it joins the library and is
        // there to be used again — a second cover, another edition.
        if (target.kind === 'barcode') {
          const part = partsOf(added.file).find((one) => one.id === target.partId);
          if (!part) return added.file;
          const page = setCopyright(part, added.file, { barcodeAssetId: assetId as string });
          return updatePart(added.file, part.id, { copyright: page.copyright });
        }

        if (target.kind === 'story') {
          const beat = added.file.beats.find((one) => one.manuscript.elements.some((element) => (element.id as string) === target.elementId));
          if (!beat) return added.file;
          const made = placeFigure(added.file, {
            beatId: beat.id,
            assetId,
            // **The last page of the book is the one that reads backwards**
            // (§9ap), and the anchor is the offer's rather than this screen's.
            ...(target.anchor === 'after'
              ? { afterElementId: target.elementId as never }
              : { beforeElementId: target.elementId as never }),
            attributes:
              target.as === 'page'
                ? // Which of a division's two openings it stands in front of
                  // (§9w): only what differs from the ordinary answer is
                  // written down, so nothing but a picture asked for on an
                  // opening page carries it.
                  target.beforeOpening
                  ? { bookPlace: 'page', bookBeforeOpening: true }
                  : { bookPlace: 'page' }
                : // A vector graphic goes on **free** (§8c): over the page,
                  // taking no line, at a place the writer then drags. It
                  // lands a tenth in from the top-left rather than at the
                  // corner, so the whole of it is on the paper to take hold
                  // of.
                  target.as === 'free'
                  ? { bookPlace: 'free', bookSpan: FREE_SPAN.default, bookX: 0.1, bookY: 0.1 }
                  : {},
          });
          if (made.elementId) {
            setSelectedRowId(made.elementId as string);
            turnTo.current = made.elementId as string;
            /**
             * **It arrives in hand** (§9ak, from Ken: *insert a picture on
             * the page and then resize that picture to where you want it to
             * be*). A picture put in landed at the top of the page with the
             * row selected and nothing to take hold of, so the next thing a
             * writer did was look for a way to move it — and the only one
             * there was drew its box again. A page of its own is left alone:
             * it *is* the page, so there is no box on it to drag, and moving
             * it means moving it through the writing, which is the rail's
             * grip.
             */
            if (target.as !== 'page') setPlacing(made.elementId as string);
          }
          /**
           * **The picture takes the sheet's front** (§9aa, from Ken: *I put a
           * picture in, and then put a blank page… it should be on the page
           * that I set*; and §9ad, *then you can place information or whatever
           * on it*).
           *
           * A blank leaf and a page of its own are the same mechanism pointed
           * two ways (§9i), so a writer who asked for a sheet here and now
           * says what stands on it meant **that** sheet.
           *
           * **How much of it the picture takes is `takePictureLeaf`** (§9ap):
           * this took two pages and asked for the figure's own back blank
           * whatever stood there, which is §9ad's answer left behind when §9an
           * made the unit a page — so where one page had been asked for the
           * leaf survived and the picture landed on the next page, and where
           * the leaf's front was a verso the back blank forced a recto and
           * moved it anyway. A picture is a page and takes the one page it
           * stands on; the domain says so once, for this branch and the
           * part's.
           */
          // **And the rule that held the page blank, where one did** (§9al).
          const freed = freeTheBlank(made.file, target.frees ?? null);
          return target.takesLeaf ? takePictureLeaf(freed, target.takesLeaf) : freed;
        }

        // A logotype and a page of art are **the part's own pictures**
        // (§9n), so they go straight on the record: choosing one is the act,
        // and the mode is read back from what is there.
        if (target.kind === 'logo') return updatePart(added.file, target.partId, { logoAssetId: assetId as string });
        if (target.kind === 'part-art') return updatePart(added.file, target.partId, { assetId: assetId as string });
        // The publisher's mark (§16): the title page's own field, so it goes
        // on the part beside the logotype rather than into the imprint's
        // name, which is the book's and is words.
        if (target.kind === 'imprint') {
          const part = partsOf(added.file).find((one) => one.id === target.partId);
          if (!part) return added.file;
          return updatePart(added.file, part.id, {
            titlePage: { ...titlePageFieldsOf(part), imprintAssetId: assetId as string },
          });
        }
        // The author's photograph (§17): the page's own field, on `about`
        // beside the biography, for the imprint mark's reason.
        if (target.kind === 'author-photo') {
          const part = partsOf(added.file).find((one) => one.id === target.partId);
          if (!part) return added.file;
          return updatePart(added.file, part.id, {
            about: { ...aboutAuthorOf(part), photoAssetId: assetId as string },
          });
        }

        if (target.kind === 'part') {
          const part = partsOf(added.file).find((one) => one.id === target.partId);
          // A picture cut into a part's own words, where its words take one.
          if (part && target.as === 'measure' && partTakesInsets(part.kind)) {
            setSelectedRowId(part.id);
            return addPartInset(added.file, part.id, { assetId: assetId as string }).file;
          }
          const made = addPart(
            added.file,
            'plate',
            {
              assetId,
              inFront: part ? halfOf(part) === 'front' : false,
              /**
               * **Where the leaf stood** (§19a, from Ken: *if I add a page
               * after and go on that, it's adding the page on the page before
               * for some reason*). A record may carry several leaves, and an
               * art page appended to the plan could not land among them at
               * all — at the end of a book it was emitted above them, so a
               * picture asked for on the last of two blank pages arrived on
               * the one before it.
               */
              ...(target.takesLeaf
                ? { beforeId: target.takesLeaf, afterLeaves: target.takesLeafAt ?? 0 }
                : {}),
            },
            // Where the leaf was, where a leaf asked for it (§9ab); appended
            // to its half where the Add menu asked with no page in hand.
            target.before ?? null,
          );
          if (made.partId) {
            setSelectedRowId(made.partId);
            turnTo.current = made.partId;
          }
          // The rule that held the page blank, where one did (§9al), and then
          // the sheet's front, as in the story (§9aa, §9ad), keeping the back
          // it already had.
          const freed = freeTheBlank(made.file, target.frees ?? null);
          if (!target.takesLeaf || !made.partId) return freed;
          // **The one page it stands on** (§9ap) — the same act the story's
          // branch runs, so the two cannot disagree about how long the book
          // comes out or which page the art lands on.
          return takePictureLeaf(freed, target.takesLeaf);
        }

        return added.file;
      });
      setMessage(null);
    } catch {
      setMessage('That file could not be read.');
    }
  };

  /**
   * What the Add menu offers (§9a). A picture first, because that is what a
   * writer in this room wants most often; then the divisions; then the parts
   * of the book, which are what the menu used to be entirely.
   */
  const addEntries: MenuEntry[] = [
    /**
     * **A leaf takes a page of its own and nothing else** (§9aa), so these two
     * are **absent** rather than greyed on one — the menu's own idiom, where
     * an item that cannot be done *now* is greyed with the reason and one that
     * does not apply is absent, and a picture cut into the words does not
     * apply to a page that has none. The panel does exactly the same with the
     * same two controls, which is why neither carries a sentence.
     */
    ...(pageOffer.ownPageOnly
      ? []
      : ([
          {
            /**
             * **Named the same thing the panel names it** (§9at). This act has
             * been here since the menu was built and was called *Picture…*,
             * while the page's own panel — where a writer standing on a page
             * looks — did not offer it at all: the one route into *a picture in
             * the words, chosen first* was on the surface nobody opens for it,
             * which is §9u's lesson about a route only one surface can reach.
             */
            label: 'Place a picture…',
            disabled: pageOffer.refusal,
            onPick: () => importPicture('measure'),
          },
        ] as MenuEntry[])),
    {
      label: 'Full page picture…',
      disabled: pageOffer.refusal,
      // Where it will really land, where that is not the page in hand (§9w).
      note: pageOffer.note,
      onPick: () => importPicture('page'),
    },
    ...(pageOffer.ownPageOnly
      ? []
      : ([
          {
            // Named for the one thing only it can do (§9at): hold the space
            // before there is a picture, which is why §9ak kept it.
            label: 'Hold space for a picture…',
            disabled: laying ? null : 'The book is still being set',
            onPick: () => setDrawing(true),
          },
        ] as MenuEntry[])),
    /**
     * **A blank page, from the button a writer presses to put a page in**
     * (§9y, Ken's own words). It is read where it lands, exactly as the
     * picture above it is: the leaf goes in front of the page in hand, and on
     * a page a chapter opens on it goes in front of the **opening** — so the
     * numeral, its name and its first words all move on together, which is
     * what he was trying to do. On a leaf he put in himself the same item
     * takes it away again, the offer's own words either way.
     */
    /**
     * **And as many of them as the writer wants** (§9ac, from Ken: *you
     * should be able to just put as many pages in between as you want*).
     *
     * §9y's item flipped its words on a leaf the writer had put in and took
     * that leaf away again, which was §9i's *the only place it can be found*
     * said in a menu — and while that was the act, there was no second leaf to
     * be had anywhere. It only ever adds now, the page's own × being where one
     * is taken away (§9x), and the note says what the press really costs where
     * that is not one more page.
     */
    /**
     * **Two items, because the choice is a side** (§9an, from Ken: *when I
     * add a blank page, I need to be able to decide whether it goes after or
     * before*). The menu reads the same one offer the panel reads, so the
     * two screens cannot disagree about which record a press writes — and
     * each item says in its own disabled title why that side has no press.
     */
    /**
     * **The design, beside the picture it is now the route to** (§9ar). The
     * same `designOffer` the panel reads, so the menu cannot offer what the
     * panel refuses, and its note is the panel's own sentence.
     */
    {
      label: 'Design this page…',
      disabled: pageDesign.refusal,
      note: pageDesign.refusal ? null : pageDesign.note,
      onPick: () => {
        if (selectedSheet !== null) designHere(selectedSheet);
      },
    },
    {
      label: pageBlank.before.act ?? 'A blank page before this one',
      disabled: pageBlank.before.act ? null : (pageBlank.before.refusal ?? pageBlank.refusal),
      // **Each side's own note** (§9ao): this read the combined one, which is
      // the *first* side that has anything to say — so the after item said
      // nothing at all, and at the end of the book, where the two differ most,
      // the one sentence a writer needs was on the wrong item.
      note: pageBlank.before.note,
      onPick: () => addBlank(pageBlank.before),
    },
    {
      label: pageBlank.after.act ?? 'A blank page after this one',
      disabled: pageBlank.after.act ? null : (pageBlank.after.refusal ?? pageBlank.refusal),
      note: pageBlank.after.note,
      onPick: () => addBlank(pageBlank.after),
    },
    /**
     * **The break a writer can make** (§9ab, from Ken after a × took one
     * away: *the story is still there, but it now no longer shows up in the
     * left menu bar* … *in the menu, there's no way to add a chapter page,
     * which might solve the problem*).
     *
     * It is `removeDivision`'s exact inverse and the reason that × stopped
     * being the one act in this room nobody could take back: §9x gave every
     * page a × and answered a division's page with *the break goes and the
     * words stay*, and nothing anywhere could put one back on writing that
     * already existed — *+ New story* makes a **new empty section at the
     * end**, which is a different act and the one thing on offer. A division's
     * page *is* its chapter page, so this is also the item he asked for by
     * name.
     */
    {
      label: pageDivision.act ?? `Start a ${noun.toLowerCase()} here…`,
      disabled: pageDivision.refusal,
      note: pageDivision.comfort || null,
      onPick: () => {
        const spot = pageDivision.unitId;
        if (!spot) return;
        /**
         * **It opens its own page, because it arrives unnamed** (§9ab).
         * The name was on the marker that went, so nothing can give it
         * back — and a row reading *Story* where *The Harbour* used to be
         * is the loss reported a second time. The page a division opens on
         * is where its name is typed, so the act turns to it: §9u's *a page
         * made opens*, and a route rather than a second box here.
         */
        onUpdate((current) => {
          const next = startDivision(current, spot);
          const made = next.markers.find((one) => (one.unitId as string) === spot);
          if (made) window.setTimeout(() => openChapterPage(made.id as string), 0);
          return next;
        });
      },
    },
    'rule',
    ...(isCollection(file.project.format)
      ? [{ label: 'New story', onPick: () => onUpdate((current) => beginStory(current, { title: 'New story' }).file) }]
      : []),
    ...ADDABLE_KINDS.filter((kind) => kind !== 'plate' && mayAdd(file, kind)).map((kind) => ({
      label: PART_INFO[kind].name,
      onPick: () =>
        onUpdate((current) => {
          /**
           * **It goes in where the writer is standing** (§9ab, from Ken: *I
           * should be able to insert a page at any point*). It appended to
           * the end of its half, so adding a page while looking at page vi
           * put it after the index — and then it had to be dragged back,
           * which is the detour this section removes twice. In front of the
           * page in hand, the blank leaf's own rule.
           */
          const made = addPart(current, kind, {}, chosenRow?.partId ?? null);
          if (made.partId) {
            setSelectedRowId(made.partId);
            // **A page made opens** (§9u). While there was a column the new
            // part's fields appeared in it the moment it was added; with the
            // column gone, adding a page would answer with a rail row and
            // nothing else, and a writer who has just made a dedication is
            // looking for somewhere to type it.
            setPartDialogId(made.partId);
          }
          return made.file;
        }),
    })),
  ];

  /** Choosing a row turns to its page and puts that page in hand (§9a). */
  const selectRow = (row: BookRow) => {
    setSelectedRowId(row.id);
    if (!laying) return;
    const page = pageOf(laying, row.id);
    if (!page) return;
    setSpread(spreadOfSheet(page.sheet));
    setSelectedSheet(page.sheet);
  };

  /**
   * A double-click (§9a, from Ken: *if you want to format a page differently,
   * you should be able to double click on that page, and there should be a
   * dialog box*). Each row opens the one thing that sets its page.
   */
  const openRow = (row: BookRow) => {
    selectRow(row);
    if (row.kind === 'part') {
      setPartDialogId(row.id);
      return;
    }
    if (row.kind === 'chapter') {
      openChapterPage(row.id);
      return;
    }
    /**
     * **A section and a picture open the page they stand on** (§9u).
     *
     * Neither is a record with a screen of its own — a chapter inside a story
     * is a section whose heading opens a page (addendum 22 §6), and a picture
     * stands where it stands in the writing — so both used to open nothing at
     * all, which was survivable only while the inspector answered for them.
     */
    const page = laying ? pageOf(laying, row.id) : undefined;
    if (!page) return;
    if (row.kind === 'picture') {
      // A picture is **not** a page, so this is not `openPage`'s question.
      // The page it stands on is very often a chapter's opening, which
      // `openPage` rightly sends to the chapter's leaf — and a chapter's
      // leaf says nothing at all about a picture cut into the text under
      // it. The page's own dialog is where the picture in hand is set.
      setSelectedSheet(page.sheet);
      setPageDialogSheet(page.sheet);
      return;
    }
    // A section **is** a page, so `openPage` answers it — one call rather
    // than a second ladder that could disagree with it.
    openPage(page);
  };

  /**
   * The same, for a press on a page of the spread.
   *
   * **A double-click opens what the page *is*** (§9h). A part's page opens the
   * part; the page a chapter opens on opens that chapter's page. An ordinary
   * page of the story is neither, and used to open the chapter in force
   * anyway — which is how a writer double-clicking page nine found themselves
   * editing chapter two, and how a picture asked for there landed on the
   * chapter's leaf. It puts the page in hand instead, which is the screen
   * §9h gives it.
   */
  const openPage = (page: BookPage) => {
    if (!laying) return;
    const at = pagePlace(laying.laid.pages, laying.blocks, page.sheet);
    const row = bookPageRows(laying.laid.pages, laying.blocks).find((one) => one.sheet === page.sheet);
    /**
     * **A part's page opens the part, and a blank leaf in front of it does
     * not** (§9aq). The place no longer answers with a part for a blank page,
     * which is where the fault was; the row is asked as well because *is this
     * the part's own page* is a question about what prints on it, and the one
     * screen a writer reaches for their own blank page is the page's.
     */
    if (row ? partsOwnPage(row) : at.partId !== null) {
      const part = row?.partId ?? at.partId;
      setSelectedRowId(part);
      setPartDialogId(part);
      return;
    }
    /**
     * **Every page of the story opens the page's own screen** (§9u, and
     * §9j's own words from Ken: *if I double-click any page, the page setup
     * dialog box should pop up with all the options for that page*).
     *
     * §9j sent a page carrying a chapter opening straight to the chapter's
     * leaf instead, which was right while the column still answered a single
     * press with the page's own acts — and strands them now the column is
     * gone: a picture, a box, a vector graphic and a blank leaf are the
     * page's, and a chapter's leaf says nothing about any of them. So the
     * special case goes and the **route** §9l built stays: *Set this
     * chapter's page…* stands on this screen, one press on, which is a door
     * rather than a second copy. The chapter's own row still opens its leaf
     * directly, for a writer who wants the leaf and not the page.
     */
    setSelectedRowId(row?.figureId ?? null);
    setSelectedSheet(page.sheet);
    setPageDialogSheet(page.sheet);
  };

  /**
   * What a page of the story can be told to do, in one place (§9j).
   *
   * The inspector and the page dialog render **this**, rather than each
   * building the same two sections: two copies are two answers to *what can I
   * do to this page*, and the dialog exists precisely so the answer is the
   * same wherever a writer asks it.
   */

  /** Whether that chapter's own page already leaves its back blank (§9r). */
  const chapterBackOf = (markerId: string | null): boolean => {
    if (!markerId) return false;
    const marker = file.markers.find((one) => (one.id as string) === markerId);
    return chapterPageSchema.parse(marker?.page ?? {}).backBlank === true;
  };

  const pageControls = (page: BookPageRow) => {
    const place = pagePlaceFor(page.sheet);
    // The offer is **this page's** rather than the chosen sheet's (§9w): the
    // dialog and the inspector both render this, and a section describing one
    // page while its buttons acted on another would be the fault it fixes.
    const on = offerFor(page.sheet);
    return (
    <StoryPageSection
      page={page}
      place={place}
      nextPlace={pagePlaceFor(page.sheet + 1)}
      divisions={nounPlural.toLowerCase()}
      offer={on}
      remove={pageRemoval(file, pageRows, page.sheet)}
      onRemovePage={() => {
        setPageDialogSheet(null);
        onUpdate((current) => removeBookPage(current, page, pageRemoval(current, pageRows, page.sheet)));
      }}
      chapterBack={chapterBackOf(place.opensMarkerId ?? null)}
      // Every reading this screen takes is over the rows, so the three reasons
      // a page is blank, what a leaf asked for here would do and what a
      // picture would do are all answered from one place (§9w). The component
      // held its own copy of the first.
      rows={pageRows}
      drawing={drawing}
      onPut={() => importPicture('page', on)}
      /* **A picture in the words, chosen before it is placed** (§9at). The act
         already existed; what it never had was a way in from the page a writer
         is standing on. The dialog goes, because the picture is sized on the
         spread it is covering — the same reason `onDraw` has always had. */
      onPlacePicture={() => {
        setPageDialogSheet(null);
        importPicture('measure', on);
      }}
      onDraw={() => {
        // The box is drawn on the spread, so the dialog covering it goes.
        setPageDialogSheet(null);
        setDrawing(true);
      }}
      onVector={() => {
        setPageDialogSheet(null);
        importPicture('free', on);
      }}
      onBlank={(id, pages) => onUpdate((current) => setBlankPages(current, id, pages))}
      onChapterBack={(markerId, blank) => onUpdate((current) => setChapterBlank(current, markerId, 'back', blank))}
      /* **The shift, where a rule is what holds the page** (§9ae): one press
         and one field, the room owning which mechanism moves a page half a
         sheet rather than the writer. */
      onAddBlank={addBlank}
      /**
       * **Design this page** (§19): the leaf becomes a page of the writer's
       * own and the room turns to its screen, which is §9u's rule — *a page
       * made opens* — and is the whole of Ken's *you're able to put the text
       * and everything in the dialog box*.
       */
      /* **One act for both screens** (§9ar): `designHere` reads the rows and
         the place for the sheet it is given, because a leaf the **book** is
         keeping blank is designed too now and the act has to know whose rule
         holds it and what the page stands in front of (§9aq) — and because
         the *+ Add* menu runs the same press. */
      onDesign={() => designHere(page.sheet)}
      format={pageFormat(page).markerId ? pageFormat(page).label : null}
      onFormat={() => {
        const to = pageFormat(page);
        setPageDialogSheet(null);
        if (to.markerId) openChapterPage(to.markerId);
      }}
      // The book's own openings, rendered here where the page has no leaf to
      // set (§9m). `ChapterStyleFields` is the one component Book settings
      // renders too, so the two cannot disagree about how a chapter opens.
      openings={
        pageFormat(page).label && !pageFormat(page).markerId ? (
          <Fold id="page-openings" title="How openings look">
            {/* The **arrangement** is the layout dialog's (§14) and the type
                is here: two questions, and the one that is answered by
                looking at pictures of pages has a screen of its own. */}
            <div className="layout-page-acts">
              <button
                type="button"
                className="raised small"
                onClick={() => {
                  setPageDialogSheet(null);
                  setLayoutDialogId(pageMarker(page) ?? OPEN_LAYOUT);
                }}
              >
                Choose the layout…
              </button>
            </div>
            <ChapterStyleFields file={file} onUpdate={onUpdate} marker={null} onPage />
          </Fold>
        ) : null
      }
    />
    );
  };

  /**
   * Where this page's own look is set (§9l). A chapter with a marker has a
   * page of its own; a chapter **inside a story** has none — §6 made it a
   * section deliberately — so its opening is set once for the whole book.
   * That second case is not a button: sending a writer to Book settings for
   * it took away the picture controls they were standing beside (§9m), so it
   * is the fields themselves, on this screen.
   */
  /** The chapter a page opens, where it carries one — for a dialog to open on. */
  const pageMarker = (page: BookPageRow): string | null => pageFormat(page).markerId;

  const pageFormat = (page: BookPageRow): { label: string | null; markerId: string | null } => {
    const place = pagePlaceFor(page.sheet);
    /**
     * **The route is there on the leaf too** (§9aa, from Ken: *I should be
     * able to set any page as a chapter page*).
     *
     * `pagePlace` reads the opening off the page itself and, on a blank leaf,
     * off the page it stands in front of — and that is the chapter whose own
     * page decides whether this leaf exists at all, the recto rule being set
     * there (§9x). So the leaf in front of a chapter now reaches it, which is
     * the screen a writer standing on an unexplained empty page needs; it is
     * `place.opensMarkerId` rather than a second walk over the pieces, which
     * is what this read before and could only answer for one page.
     */
    if (place.opensMarkerId) {
      // Nothing names a unit itself (addendum 16 §6c): this read *chapter*
      // outright, which on a collection is a story.
      const what = noun.toLowerCase();
      return {
        label: place.standsBefore == null ? `Set this ${what}’s page…` : `Set the next ${what}’s page…`,
        markerId: place.opensMarkerId,
      };
    }
    if (page.says !== 'Chapter opens') return { label: null, markerId: null };
    return { label: 'How openings look', markerId: null };
  };

  const figureControls = (figure: BookFigure) => (
    <FigureSection
      figure={figure}
      // The text block, so a drawn box can be said in inches the way the
      // handle on the spread says it.
      measureInches={laying?.geometry.text.width ?? 0}
      holding={placing === figure.elementId}
      // Whether the words have anything to run round it (§9ak), read off the
      // blocks the room has already laid rather than worked out again here.
      cutsInto={laying ? cutsIntoText(laying.blocks, figure.elementId) : true}
      onPlace={(placement) => onUpdate((current) => placeBookFigure(current, figure.elementId, placement))}
      /**
       * **The handle goes over every picture** (§9ak, from Ken: *insert a
       * picture on the page and then resize that picture to where you want it
       * to be. You can move it around. You can resize it with the corner
       * pins*).
       *
       * §8c's note here said a free graphic is *already on the page, so there
       * is nothing to draw*, and that **a figure in the text has no place
       * until a box is drawn, which is why the two gestures differ**. That is
       * the sentence he is overruling, and he is right: a picture that has
       * been put in has a place too — it stands where the writing puts it —
       * so there is nothing to draw there either. One gesture now, for every
       * kind of picture, and the box tool is left to the one thing only it
       * can do: hold space before there is a picture.
       */
      onHandle={() => {
        // **Only taking it up clears the screen.** The dialog goes because the
        // picture is dragged on the spread it covers; a press that puts the
        // handle *down* has no reason to dismiss the panel the writer is
        // standing in, and closing it either way made the control vanish
        // under its own second press.
        if (placing !== figure.elementId) setPageDialogSheet(null);
        // Taking a picture already in the book up: the sentence then says what
        // moving it costs, from where the book stands now (§9at) — and the page
        // it is standing on is the one it is asked to come back to (§9au),
        // measured without itself on it.
        if (placing !== figure.elementId) {
          pagesAtPickup.current = laying?.laid.pages.length ?? null;
          const on = laying?.laid.pages.find((one) => one.pieces.some((piece) => piece.blockId === figure.elementId));
          noteWhereFrom(on?.sheet ?? null, figure.elementId);
        }
        setPlacing((current) => (current === figure.elementId ? null : figure.elementId));
      }}
      onFill={() => importArt({ kind: 'fill', elementId: figure.elementId })}
      onBackBlank={(blank) => onUpdate((current) => setBackBlank(current, figure.elementId, blank))}
      onRemove={() => {
        setSelectedRowId(null);
        setPageDialogSheet(null);
        onUpdate((current) => removeBookFigure(current, figure.elementId));
      }}
    />
  );

  /**
   * A drop on a **page** (§9i, from Ken: *when I insert a picture it goes to
   * the bottom, but it doesn't allow me to drag it up and place it… I can drag
   * it in between the pages, and it will change the numbering*).
   *
   * An art page is a **part**, and a part stands in the front matter, at the
   * back, or facing a chapter — it has nowhere to be between page six and page
   * seven. A figure that is a page of its own does, so dropping one on a page
   * turns it into that: `plateIntoStory`. A picture already in the writing
   * only moves, which `moveFigureBefore` has done since the box could be
   * redrawn. Either way nothing about pages is stored and the numbering
   * follows from where the picture now stands.
   */
  const dropOnPage = (page: BookPageRow) => {
    const moving = dragging;
    setDragging(null);
    setOver(null);
    /**
     * **A blank page the writer put in moves too** (§9an, from Ken: *in the
     * right menu outliner, I should be able to grab that blank page and just
     * move it down below page 174*). It is one page off one record and onto
     * another — nothing about page 174 changes, because a page is not a
     * record, and the numbering follows as it always has.
     */
    if (moving?.kind === 'blank') {
      const to = blankSpotFor(page.sheet);
      if (to) onUpdate((current) => moveBlankPage(current, moving.id, to));
      return;
    }
    const landing = offerFor(page.sheet);
    if (!moving || !landing.spot || landing.of !== 'story' || moving.id === page.figureId) return;
    onUpdate((current) => {
      const figure = bookFigures(current).find((one) => one.elementId === moving.id);
      // **One act for both drops** (§9w): `movePictureTo` carries which of a
      // division's two openings the page in hand is, which the move alone
      // cannot say — so dragging a picture onto a page row and onto a
      // chapter's row cannot put it in two places.
      if (figure) return movePictureTo(current, figure.elementId, landing);
      const part = partsOf(current).find((one) => one.id === moving.id);
      if (part?.kind !== 'plate') return current;
      const made = plateIntoStory(current, part.id, landing.spot as string);
      if (made.elementId) {
        setSelectedRowId(made.elementId);
        turnTo.current = made.elementId;
      }
      return made.file;
    });
  };

  /**
   * A drop on a row (§9a, from Ken: *just reorder things by dragging them
   * around in the actual left menu*). One drag, three landings, each of them
   * the thing the book already understood: a part moves within its half, a
   * chapter moves with its sections, and a picture page dropped on a chapter
   * comes to face that chapter.
   */
  const dropOn = (row: BookRow) => {
    const moving = dragging;
    if (!moving || moving.id === row.id) return;
    onUpdate((current) => {
      if (moving.kind === 'chapter') {
        return row.kind === 'chapter' ? moveChapterBlock(current, moving.id as never, row.placed?.marker.id ?? null) : current;
      }
      /**
       * **A blank page dropped on a row lands on that row's page** (§9ao) —
       * the same `moveBlankPage` the page rows take, off the same reading, so
       * a leaf cannot land somewhere the panel and the Add menu would not put
       * one. Without this branch the drop was taken and thrown away.
       */
      if (moving.kind === 'blank') {
        const to = blankLandingOn(row);
        return to ? moveBlankPage(current, moving.id, to) : current;
      }
      /**
       * **A picture dropped on a division comes to its opening page** (§9w):
       * the analogue of *a picture page dropped on a chapter faces that
       * chapter*, which this room has done for a plate since §9a, said of a
       * figure. It is the same `movePictureTo` the page rows take, so the
       * landing is `pictureOffer`'s answer rather than a second one.
       */
      if (moving.kind === 'picture') {
        const at = laying ? pageOf(laying, row.id) : undefined;
        if (!at) return current;
        return movePictureTo(current, moving.id, offerFor(at.sheet));
      }
      const part = partsOf(current).find((one) => one.id === moving.id);
      if (!part) return current;
      // A picture page dropped on a chapter faces that chapter.
      if (part.kind === 'plate' && row.kind === 'chapter') return updatePart(current, part.id, { beforeMarkerId: row.id, inFront: false });
      if (row.kind !== 'part' || !row.part) return current;
      // One dropped on a chapter's own picture page comes out of the story.
      if (halfOf(part) === 'body' && halfOf(row.part) !== 'body') {
        return placePart(updatePart(current, part.id, { beforeMarkerId: null, inFront: halfOf(row.part) === 'front' }), part.id, row.id);
      }
      return placePart(current, part.id, row.id);
    });
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="layout-room" role="dialog" aria-label="Layout">
      <style>{BOOK_STYLES}</style>
      {/* The measuring box (§4): the browser sets each block here, out of
          sight, and the domain reads the count of lines back. */}
      <div ref={box} className="bk-measure" aria-hidden="true" />
      <input
        ref={artPicker}
        type="file"
        accept={PICTURE_ACCEPT}
        aria-label="Art page file"
        hidden
        onChange={(event) => {
          void takeArt(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <EbookExportDialog
        open={ebookOpen}
        file={file}
        laid={laying ? { pages: laying.laid.pages, blocks: laying.blocks, context: laying.context, pageStarts: laying.pageStarts ?? [] } : null}
        onClose={() => setEbookOpen(false)}
        onUpdate={onUpdate}
      />

      {settings && laying ? (
        <BookSettingsDialog
          open={bookSettingsOpen}
          file={file}
          laying={laying}
          write={write}
          noun={noun}
          nounPlural={nounPlural}
          divisions={divisions}
          divisionInHand={divisionInHand}
          onUpdate={onUpdate}
          onOpenChapterPage={openChapterPage}
          onClose={() => setBookSettingsOpen(false)}
        />
      ) : null}
      {/* The writer's own fonts, declared once for the whole room (§6b): the
          spread draws with them and the hidden box **measures** with them, so
          the pages fall where the PDF will put them. The same rules go into
          the exported document, from the same builder. */}
      <style>{fontFaceCss(bookFontsOf(file))}</style>
      {(
        <ChapterPageDialog
          file={file}
          open={ownChapterPage !== null}
          initialMarkerId={ownChapterPage}
          onClose={() => setOwnChapterPage(null)}
          onUpdate={onUpdate}
          // The laid pages, so the dialog's back-of-the-leaf control asks the
          // same reading this room's own page panel does (§9s).
          laying={laying ? { pages: laying.laid.pages, blocks: laying.blocks } : null}
          // *Add custom graphic…* (§9d, from Ken: *the menu disappears and
          // allows you to draw a box where you want the graphic*). The dialog
          // goes, because a box is drawn on the page it is covering.
          onDrawBox={() => {
            setOwnChapterPage(null);
            setDrawing(true);
          }}
        />
      )}
      {/* How the opening is laid out (§14, from Ken's handoff): the eight
          arrangements, with the page drawn beside them. It is a screen of its
          own rather than another fold in Book settings, because picking a
          layout is looking at pictures of pages. */}
      <ChapterLayoutDialog
        file={file}
        open={layoutDialogId !== null}
        initialMarkerId={layoutDialogId === OPEN_LAYOUT ? null : (layoutDialogId as never)}
        onClose={() => setLayoutDialogId(null)}
        onUpdate={onUpdate}
      />
      {/* The designed pages have their own screen (§9n), so the older
          dialog is handed only what it still serves. */}
      <DesignedPageDialog
        file={file}
        part={designed}
        laying={laying}
        onUpdate={onUpdate}
        onClose={() => setPartDialogId(null)}
        onPickLogo={(id) => importArt({ kind: 'logo', partId: id })}
        onPickArt={(id) => importArt({ kind: 'part-art', partId: id })}
        onPickImprint={(id) => importArt({ kind: 'imprint', partId: id })}
        /* A route rather than a second copy (§15c, §16): the publisher and
           the edition are the copyright page's fields, so the title page
           sends a writer there instead of offering its own boxes. */
        onOpenCopyright={() => {
          setPartDialogId(null);
          setCopyrightOpen(true);
        }}
        onOpenBookSettings={() => {
          setPartDialogId(null);
          setBookSettingsOpen(true);
        }}
        onTurn={(sheet) => {
          const row = pageRows.find((one) => one.sheet === sheet);
          setSelectedSheet(sheet);
          // A page of the story has no part, so the screen turns to whatever
          // owns the page it lands on — which is what the navigator means.
          setPartDialogId(row?.partId ?? null);
          if (!row?.partId) setPageDialogSheet(sheet);
        }}
      />
      {/* The back matter's own screen (§17), one shell behind seven pages. */}
      <BackMatterDialog
        file={file}
        part={backMatterPart}
        laying={laying}
        onUpdate={onUpdate}
        onClose={() => setPartDialogId(null)}
        onPickPhoto={(id) => importArt({ kind: 'author-photo', partId: id })}
        onTurn={(id) => setPartDialogId(id)}
        /**
         * **A picture on this page** (§19a, from Ken: *on the reader's extra
         * page there needs to be the ability to add a picture*). The same
         * panel the part dialog renders, which a back-matter page has not
         * opened since §17 gave it a screen of its own — one implementation,
         * rendered where the page is set.
         */
        pictures={
          backMatterPart && partTakesInsets(backMatterPart.kind) ? (
            <PartPictures file={file} part={backMatterPart} onUpdate={onUpdate} onTouched={() => undefined} />
          ) : null
        }
      />
      <PartDialog
        file={file}
        part={designed || copyrightPart || backMatterPart ? null : opened}
        laying={laying}
        onUpdate={onUpdate}
        onClose={() => setPartDialogId(null)}
        onRemoved={() => {
          setPartDialogId(null);
          setSelectedRowId(null);
        }}
      />
      {/* A page of the story, opened by a double-click on its row or on the
          page itself (§9j) — and since §9u the only screen it has, the column
          that held a second copy of it being gone. A part opens its part, a
          chapter opening its chapter page, and an ordinary page this. */}
      {/* The copyright page's own dialog (§9k, from Ken). It is opened from
          the part and from the page, both of which are the same page. */}
      <CopyrightPageDialog
        file={file}
        part={copyrightPart}
        onUpdate={onUpdate}
        onClose={() => {
          setCopyrightOpen(false);
          setPartDialogId(null);
        }}
        /* A file dragged onto the barcode's box goes through the room's own
           reader (§15b), so it joins the graphics library like every other
           picture rather than growing a second way in. */
        onDropBarcode={(partId, picked) => {
          artTarget.current = { kind: 'barcode', partId };
          void takeArt(picked);
        }}
        onPickBarcode={(partId) => importArt({ kind: 'barcode', partId })}
      />
      <PageDialog
        page={dialogPage}
        controls={
          dialogPage ? (
            <>
              {pageControls(dialogPage)}
              {dialogFigure ? figureControls(dialogFigure) : null}
            </>
          ) : null
        }
        onClose={() => setPageDialogSheet(null)}
      />

      <header className="sculptor-bar">
        <h2>Layout</h2>
        <RoomFormat format={file.project.format} />
        <span className="muted small">{bookNames(file).title}</span>
        <span className="toolbar-spacer" />
        {laying ? (
          <span className="muted small layout-count">
            {laying.laid.pages.length} {laying.laid.pages.length === 1 ? 'page' : 'pages'} · {laying.laid.arabic} in the
            story
          </span>
        ) : null}
        {/* The whole book at once (§9, from Ken): the trim, the margins, the
            type, the running heads and the page numbers apply all the way
            through, so they are one dialog off the bar rather than a column
            beside every part. */}
        <button
          type="button"
          className="tool"
          disabled={!laying}
          title="The trim, the margins and the spine, the type, the running heads and the page numbers: the whole book at once"
          onClick={() => setBookSettingsOpen(true)}
        >
          Book settings…
        </button>
        {/* How a chapter opens (§14, from Ken's handoff). On the bar rather
            than inside Book settings, because picking a layout is looking at
            pictures of pages and a fold in a settings dialog is not where
            anybody looks for that. */}
        <button
          type="button"
          className="tool"
          disabled={!laying}
          title="Where the graphic goes, how the number is shown, how far down the page the chapter starts"
          onClick={() => setLayoutDialogId(OPEN_LAYOUT)}
        >
          Chapter openings…
        </button>
        <button
          type="button"
          className="tool"
          disabled={!laying || busy}
          title="The book as a PDF at the trim size, every page as it stands here"
          onClick={() => void exportBook()}
        >
          {busy ? 'Exporting…' : 'Export the book…'}
        </button>
        {/* The same blocks as a reflowable EPUB for the stores (addendum 23):
            nothing about a page survives, and the dialog says what does. */}
        <button type="button" className="tool" title="The book as an EPUB for the eBook stores, checked against the store's rules" onClick={() => setEbookOpen(true)}>
          Export as eBook…
        </button>
        <button
          type="button"
          className="tool"
          disabled={busy}
          title="The book as a Word manuscript, its citations as Word footnotes and its bibliography at the back"
          onClick={() => void exportWord()}
        >
          Export as Word…
        </button>
        {onPopOut ? <PopOutButton what="the Layout room" onPopOut={onPopOut} /> : null}
        {onSaveAs ? <RoomSave file={file} onSaveAs={onSaveAs} /> : null}
        <button type="button" className="room-exit" onClick={onClose} aria-label="Close the Layout room" title="Leave Layout">
          Exit
        </button>
      </header>

      <div className="layout-body">
        <aside className="layout-rail" style={{ flex: `0 0 ${rail.size}px` }}>
          {/* Adding is the first thing on the rail (§9a, from Ken): a
              picture into the page in hand, and a menu for everything else.
              Both do the same act — the button is the one people find. */}
          <div className="layout-rail-head">
            <button
              type="button"
              className="raised layout-add"
              /**
               * **Refused where there is nowhere** (§9w). It was disabled only
               * while the book was being set, so on a blank leaf it carried
               * *Choose a page first* in its title **and acted anyway**,
               * putting an art page at the back of the book. The reading the
               * menu's two items already took is this button's now, so the
               * three cannot disagree.
               */
              disabled={!laying || !pageOffer.spot}
              title={pageOffer.refusal ?? `A picture at the top of ${chosenPage}. The words move down.`}
              onClick={() => importPicture('measure')}
            >
              + Picture
            </button>
            <button
              type="button"
              className="raised layout-add"
              aria-label="Add to the book"
              aria-haspopup="menu"
              /**
               * **And the rail keeps its place** (§9ac). This button stands at
               * the top of the rail, which scrolls, so the focus a press gives
               * it is a reason for the browser to scroll the rail back to the
               * top — away from the page the writer had just chosen, and into
               * the scroll that used to shut the menu. The menu takes focus
               * itself and the keyboard still reaches this button by tabbing
               * to it, so declining the focus a *mouse* press gives it costs
               * nothing: measured, the rail stays where it was and no scroll
               * is fired at all.
               */
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                setAddMenu({ x: box.left, y: box.bottom + 4 });
              }}
            >
              + Add <span aria-hidden="true">▾</span>
            </button>
          </div>
          {addMenu ? <ContextMenu x={addMenu.x} y={addMenu.y} label="Add to the book" entries={addEntries} onClose={() => setAddMenu(null)} /> : null}

          {/* The book as one list, in the order it is bound (§9a). No
              headings, no notes: a row is its name and its page. */}
          <ul className="layout-parts layout-tree" aria-label="The book">
            {shown.map((row, index) => {
              /*
               * The three areas of the book (§9k, from Ken: *I want to add the
               * label back in front matter… a locked area, those items from the
               * list that are front matter will automatically populate that
               * area*).
               *
               * §9a took two headings out for being noise, and it was right
               * about what it took: rows that existed only to carry buttons
               * and a sentence. These say something no row can — **which part
               * of the book you are in** — and they are a **reading** of the
               * rows beside them rather than a structure of their own, so a
               * part that changes half changes area with nothing run. The
               * front matter stands even when it is empty, because it is the
               * place a writer drops something into.
               */
              const opens = index === 0 || shown[index - 1]?.half !== row.half;
              const area = opens ? AREA_NAMES[row.half] : null;
              // The page it lands on, read off the laid page rather than off
              // `where`: a picture cut into a paragraph rides inside it, so
              // `where` has no entry of its own for it.
              const at = laying ? pageOf(laying, row.id) : undefined;
              // Every division folds, not only a top-level chapter (§9i, from
              // Ken: *if I select chapter three and it has eight pages, when I
              // toggle the arrow I should see pages one to eight*). What is
              // under one is `pagesUnder`'s range rather than an id match
              // (§9m): matching lost the pages of any unit the rail does not
              // list, so a numeral folded open on the one page its heading
              // stood on.
              // **The arrow is the row's, and only where there is something
              // under it** — `rowHasUnder` over the whole list, so a section
              // with neither a page nor a picture offers no fold rather than
              // one that opens onto nothing, which the row's own comment has
              // claimed since §9h and the code did not do.
              const divides = rowHasUnder(rows, folds, row);
              const under = divides && openChapters.includes(row.id) ? (folds.get(row.id) ?? []) : [];
              return (
                <Fragment key={row.id}>
                {area ? (
                  <li
                    className={`layout-rail-area${over === `area-${row.half}` ? ' drop-before' : ''}`}
                    // Dropping on an area is asking for that half (§9k). Only
                    // an art page can really move; everything else is refused
                    // in a sentence, because a copyright page is front matter
                    // by being a copyright page.
                    onDragOver={(event) => {
                      if (!dragging || row.half === 'body') return;
                      // **A blank page has no half** (§9ao): dropping on an
                      // area asks for that half of the book, which is a
                      // question about a part — a leaf stands in front of a
                      // record, so there is nothing here for one to land on
                      // and the heading must not light as though there were.
                      if (dragging.kind === 'blank') return;
                      event.preventDefault();
                      setOver(`area-${row.half}`);
                    }}
                    onDragLeave={() => setOver((current) => (current === `area-${row.half}` ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropOnArea(row.half);
                    }}
                  >
                    <span>{area}</span>
                  </li>
                ) : null}
                <RailRow
                  row={row}
                  {...(divides
                    ? {
                        open: openChapters.includes(row.id),
                        onToggle: () =>
                          setOpenChapters((current) =>
                            current.includes(row.id) ? current.filter((one) => one !== row.id) : [...current, row.id],
                          ),
                      }
                    : {})}
                  page={!at || at.numbering === 'none' ? '' : at.numbering === 'roman' ? roman(at.number) : String(at.number)}
                  selected={row.id === selectedRowId}
                  over={over === row.id}
                  comfort={whatGoesWithRow(file, row).comfort}
                  refusal={whatGoesWithRow(file, row).refusal}
                  onSelect={() => selectRow(row)}
                  onOpen={() => openRow(row)}
                  onRemove={() => {
                    if (selectedRowId === row.id) setSelectedRowId(null);
                    onUpdate((current) => removeBookRow(current, row));
                  }}
                  onDragStart={() =>
                    setDragging({
                      kind: row.kind === 'chapter' ? 'chapter' : row.kind === 'picture' ? 'picture' : 'part',
                      id: row.id,
                    })
                  }
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragging || dragging.id === row.id) return;
                    // **A row lights only where the drop will be taken**
                    // (§9ao): a blank leaf lands on the row's own page, and
                    // where that answers nothing the row is no target — the
                    // same reading `dropOn` makes, so the highlight cannot
                    // promise what the drop refuses.
                    if (dragging.kind === 'blank') {
                      const to = blankLandingOn(row);
                      if (!to || to === dragging.id) return;
                    }
                    event.preventDefault();
                    setOver(row.id);
                  }}
                  onDragLeave={() => setOver((current) => (current === row.id ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropOn(row);
                  }}
                />
                {/* The chapter's own pages (§9h, from Ken): one row each,
                    saying what stands on it, and choosing one puts *that* page
                    in hand — which is what makes a picture land where it was
                    asked for rather than on the chapter. */}
                {under.map((one) => (
                  <PageRow
                    key={`page-${one.sheet}`}
                    page={one}
                    remove={pageRemoval(file, pageRows, one.sheet)}
                    chosen={selectedSheet === one.sheet}
                    over={over === `page-${one.sheet}`}
                    onSelect={() => {
                      setSelectedRowId(one.figureId);
                      setSelectedSheet(one.sheet);
                      setSpread(spreadOfSheet(one.sheet));
                    }}
                    onOpen={() => {
                      setSpread(spreadOfSheet(one.sheet));
                      const at = pages.find((sheet) => sheet.sheet === one.sheet);
                      if (at) openPage(at);
                    }}
                    onRemove={() => {
                      if (selectedSheet === one.sheet) setSelectedSheet(null);
                      onUpdate((current) => removeBookPage(current, one, pageRemoval(current, pageRows, one.sheet)));
                    }}
                    onDragStart={() =>
                      one.figureId
                        ? setDragging({ kind: 'picture', id: one.figureId })
                        : one.blankFor && setDragging({ kind: 'blank', id: one.blankFor })
                    }
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragOver={(event) => {
                      // The offer rather than the row's own element (§9w): a
                      // division's opening page carries none, and that is
                      // exactly the page a picture is dragged onto.
                      if (!dragging) return;
                      // A blank page lands wherever a blank page may go, which
                      // is a different question from where a picture may; a
                      // drop on the leaf it already stands in front of is the
                      // act refusing, so the target does not light.
                      if (dragging.kind === 'blank') {
                        const to = blankSpotFor(one.sheet);
                        if (!to || to === dragging.id) return;
                      } else if (!offerFor(one.sheet).spot || dragging.id === one.figureId) return;
                      event.preventDefault();
                      setOver(`page-${one.sheet}`);
                    }}
                    onDragLeave={() => setOver((current) => (current === `page-${one.sheet}` ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropOnPage(one);
                    }}
                  />
                ))}
                </Fragment>
              );
            })}
          </ul>
          {/* A refusal says itself where the drop happened (§9k), and goes
              the moment anything else is dragged. */}
          {areaRefusal ? <p className="small layout-rail-refusal">{areaRefusal}</p> : null}
          {/* The two gestures, said once under the list they are about (§9f).
              With the column gone (§9u) the double-click is the **only** way
              to what sets a page, so it is the one thing on this screen that
              has to be told rather than seen. */}
          <p className="muted small layout-rail-note">
            A double-click opens what sets a page — here, or on the spread.
          </p>
        </aside>
        <div className="divider vertical" role="separator" aria-label="Rail width" aria-orientation="vertical" title="Drag to widen the rail" {...rail.dividerProps} />

        <div className="layout-stage">
          {/* A big arrow either side of the spread, the way pictures are
              turned on a web page (§9b, from Ken). They stand **beside** the
              spread rather than over it — a page being set is the thing to
              look at, and an arrow laid across the corner of it is in the way.
              The scrubber at the foot stays, for moving a long way at once. */}
          <div className="layout-viewport">
            <button
              type="button"
              className="layout-turn"
              aria-label="Previous spread"
              disabled={spread === 0}
              onClick={() => setSpread((current) => Math.max(0, current - 1))}
            >
              <span aria-hidden="true">‹</span>
            </button>
          {laying ? (
            <Spreads
              laying={laying}
              spread={spread}
              zoom={zoom}
              stageRef={setStage}
              onPickFigure={(figureId) => {
                // A picture cut into a part's text belongs to the part, and
                // opens it; the manuscript's figures go to the inspector.
                const owner = partOfInset(file, figureId);
                if (owner) {
                  setSelectedRowId(owner.id);
                  setPartDialogId(owner.id);
                  return;
                }
                setSelectedRowId(figureId);
              }}
              selectedSheet={selectedSheet}
              onPickPage={setSelectedSheet}
              onOpenPage={openPage}
              placing={placing}
              placingEmpty={placing !== null && bookFigures(file).find((one) => one.elementId === placing)?.assetId == null}
              placingFree={placing !== null && bookFigures(file).find((one) => one.elementId === placing)?.placement.place === 'free'}
              placingNote={placingNote}
              onSpan={(span, ofPage, tall) => {
                const what = placing;
                if (!what) return;
                onUpdate((current) => {
                  const held = bookFigures(current).find((one) => one.elementId === what);
                  if (!held) return current;
                  // A free graphic's width is a share of the **page**, an
                  // inset's of the measure: two measurements of two things.
                  const wide = held.placement.place === 'free' ? ofPage : span;
                  /**
                   * **One act, and the rule is the domain's** (§9ak): a
                   * corner drag keeps the picture's proportions and gives an
                   * empty box the height it was dragged to, which is the one
                   * thing that tells this gesture from drawing a box.
                   * `sizeBookFigure` holds it, so the handle and anything
                   * built on it afterwards cannot disagree.
                   */
                  return sizeBookFigure(current, what, wide, tall);
                });
              }}
              onPick={() => {
                const what = placing;
                if (what) importArt({ kind: 'fill', elementId: what });
              }}
              onSlide={(place, anchor, at) => {
                const what = placing;
                if (!what) return;
                onUpdate((current) => {
                  const held = bookFigures(current).find((one) => one.elementId === what);
                  // A free graphic slides **on the page** and never changes
                  // which paragraph carries it: where it rides is about which
                  // page it lands on, and dragging it across the sheet is not
                  // a request to move it through the writing.
                  if (held?.placement.place === 'free') {
                    return placeBookFigure(current, what, { ...held.placement, x: at.x, y: at.y });
                  }
                  // **Which end of the block** (§9z): dragged below the last
                  // line the anchor says *after*, which is the foot of the
                  // page and the one position the slide could not reach.
                  const moved = anchor && anchor.elementId !== what ? moveFigureTo(current, what, anchor) : current;
                  /**
                   * **Below the words it is not a picture the text runs
                   * round** (§9ak, from Ken: *if there is a blank lower half
                   * of the page, that you can drag and drop it in there and
                   * resize it and it won't touch the text*).
                   *
                   * `blockUnder` says `after` only where the pointer is past
                   * every block on the page, which is exactly that white — so
                   * there is nothing to cut into, and calling it an inset was
                   * the room naming the picture after a side of the page
                   * rather than after what it does. §8's rule then drew it
                   * across the measure anyway, so the words on the screen and
                   * the picture on the page disagreed and a corner dragged on
                   * it had nowhere to be written down.
                   */
                  const as = droppedFigurePlace(place, anchor);
                  // The side it cuts in at is the writer's; what the book does
                  // with an inset that has no paragraph left to cut into is
                  // §8's own rule — it stands across the measure — and is not
                  // written back onto the record, which would be storing what
                  // `bookBlocks` already answers.
                  return placeBookFigure(moved, what, { place: as });
                });
              }}
              onKeep={() => {
                // Where they wanted it: the box stays and the inspector asks
                // for the picture, which is the *choose graphic browse* he
                // described (§9d).
                const what = placing;
                setPlacing(null);
                if (what) setSelectedRowId(what);
              }}
              onDrop={() => {
                const what = placing;
                setPlacing(null);
                if (!what) return;
                if (selectedRowId === what) setSelectedRowId(null);
                onUpdate((current) => removeBookFigure(current, what));
              }}
              drawing={drawing}
              onGaveUp={() => setDrawing(false)}
              onDrawn={(placement, sheet, anchor) => {
                if (!drawing || !laying) return;
                // The book as it stands before the box goes in (§9at), and the
                // page it was drawn on with what that page had free (§9au).
                pagesAtPickup.current = laying.laid.pages.length;
                noteWhereFrom(sheet);
                setDrawing(false);
                setSelectedSheet(sheet);
                const at = pagePlace(laying.laid.pages, laying.blocks, sheet);
                /**
                 * **Where the box was drawn** (§9z). The anchor is the block
                 * the drag began over, which is a *block* id — a chapter
                 * opening and §9s's stood-in title are blocks and not
                 * elements of the manuscript — so it is used only where it
                 * names one, and `pagePlace`'s walk forward stays the answer
                 * everywhere else, which is what it was written for.
                 */
                const anchorOf = (current: ProjectFile): FigureAnchor | null =>
                  anchor && current.beats.some((beat) => beat.manuscript.elements.some((one) => (one.id as string) === anchor.elementId))
                    ? anchor
                    : null;
                /**
                 * **A box is cut into the words, so it wants words** (§9aa).
                 * A blank leaf answers with the page it stands in front of so
                 * that a picture can be put on it — and a box drawn here would
                 * take that answer literally and cut into the text on *that*
                 * page, which is a picture landing where nobody drew it.
                 */
                if (pageRows.find((one) => one.sheet === sheet)?.blank) {
                  setMessage('A blank leaf is a page rather than a page of text. Put a picture on it and the picture is the page.');
                  return;
                }
                // A box drawn where the story is not cannot hold a figure:
                // the parts carry their pictures themselves.
                if (!at.elementId) {
                  setMessage('Draw the box on a page of the story: the front and back pages carry their own pictures.');
                  return;
                }
                /**
                 * The box first, the picture afterwards (§9a, from Ken) — and
                 * it is **placed** before it is filled (§9d): the box stays
                 * in hand with a ✗ and a ✓ on it until the writer says it is
                 * where they want it.
                 *
                 * **And that is all this tool does now** (§9ak). A second
                 * branch here redrew an existing picture's box, which was the
                 * only way to move one; the handle moves it instead, so what
                 * that branch alone could do is carried rather than left — and
                 * a route only one surface could reach is not kept beside the
                 * surface that replaced it (§9u).
                 */
                onUpdate((current) => {
                  const spot = anchorOf(current);
                  const beat = current.beats.find((one) => one.manuscript.elements.some((element) => (element.id as string) === at.elementId));
                  if (!beat) return current;
                  const made = placeFigure(current, {
                    beatId: beat.id,
                    beforeElementId: at.elementId as never,
                    attributes: {
                      bookPlace: placement.place,
                      bookSpan: placement.span ?? INSET_SPAN.default,
                      // The box's drawn height (§9z), so it fits where it
                      // was drawn rather than taking a height nobody chose.
                      ...(placement.boxHeight ? { bookBoxHeight: placement.boxHeight } : {}),
                      ...(placement.standoff !== undefined && placement.standoff !== INSET_STANDOFF.default ? { bookStandoff: placement.standoff } : {}),
                    },
                  });
                  if (made.elementId) {
                    setSelectedRowId(made.elementId as string);
                    setPlacing(made.elementId as string);
                  }
                  // Made at the head of the page, then taken to where the
                  // box was drawn — the one act that can say *after*.
                  return spot && made.elementId && spot.elementId !== made.elementId
                    ? moveFigureTo(made.file, made.elementId as string, spot)
                    : made.file;
                });
              }}
            />
          ) : (
            <p className="muted empty-state">Setting the book…</p>
          )}
            <button
              type="button"
              className="layout-turn"
              aria-label="Next spread"
              disabled={spread >= spreadCount - 1}
              onClick={() => setSpread((current) => Math.min(spreadCount - 1, current + 1))}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div className="layout-foot">
            <input
              type="range"
              aria-label="Which spread"
              min={0}
              max={Math.max(0, spreadCount - 1)}
              value={Math.min(spread, spreadCount - 1)}
              onChange={(event) => setSpread(Number(event.target.value))}
            />
            <span className="muted small">{describeSpread(pages, spread)}</span>
            <label className="zoom">
              <span className="muted">Zoom</span>
              <input
                type="range"
                min={Math.round(PAGE_ZOOM.min * 100)}
                max={Math.round(PAGE_ZOOM.max * 100)}
                step={1}
                value={Math.round(zoom * 100)}
                aria-label="Page zoom"
                onChange={(event) => setChosenZoom(Number(event.target.value) / 100)}
              />
            </label>
            {/* Which of the two it is, said either way (§9e). While the spread
                is fitted the word states it; once a zoom has been set by hand
                the same place is the way back. Absent rather than greyed: a
                button that can only refuse is one that lies. */}
            {chosenZoom === null ? (
              <span className="muted small">Fit</span>
            ) : (
              // Raised, because a flat one reads as the same word in the other
              // state and the two states would look alike.
              <button type="button" className="small" onClick={() => setChosenZoom(null)}>
                Fit
              </button>
            )}
            {message ? <span className="small layout-message">{message}</span> : null}
          </div>
        </div>

        {/* **The column is gone** (§9u, from Ken: *since we can double click
            any of the pages and it opens up the dialog box, let's remove the
            right-hand menu. There's no need for it. It's just redundant*).
            It was: every screen it held is the screen a double-click opens,
            and the room was paying a third of a laptop window for a second
            copy of one. What it took to make that true is in §9u — the two
            rows whose double-click did nothing, and the pictures a page's
            own dialog could not name. */}
      </div>
    </div>
  );
}

const describeSpread = (pages: BookPage[], spread: number): string => {
  if (pages.length === 0) return '';
  if (spread === 0) return `Sheet 1 of ${pages.length}`;
  const left = pages[spread * 2 - 1];
  const right = pages[spread * 2];
  const say = (page: BookPage | undefined) => (page ? page.folio || (page.blank ? 'blank' : '—') : '');
  return `Sheets ${spread * 2}–${Math.min(spread * 2 + 1, pages.length)} of ${pages.length} · ${say(left)} · ${say(right)}`;
};

/**
 * A group of the inspector's settings behind a heading drawn as a button
 * (§9, from Ken): press it and the group folds, so the trim, the type and
 * the running heads read as three things rather than one long column.
 * Whether each is open is a preference of the machine, not of the book.
 */
/**
 * What a screen would otherwise say in the margin (§9m, from Ken: *all this
 * extra text that's instructional can be a pop-up box, like a floating help
 * box*).
 *
 * The prose was true and in the way. A writer who has read *a picture put here
 * goes in before the words on it* once reads it again every time they open a
 * page, and it pushed the buttons they came for down the panel. It is behind a
 * **?** now, and it **floats** rather than opening in the flow: nothing else on
 * the screen moves when it is asked for, which is what stops it being read as
 * part of the controls.
 */
function Help({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="layout-help">
      <button
        type="button"
        className="layout-help-ask"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        ?
      </button>
      {open ? (
        <span className="layout-help-box" role="note">
          {children}
          <button type="button" className="ghost small" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
      ) : null}
    </span>
  );
}

function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const [open, setOpen] = usePreference(`layout.fold.${id}`, true);
  return (
    <section className={open ? 'layout-section layout-fold open' : 'layout-section layout-fold'}>
      <button type="button" className="raised layout-fold-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="layout-fold-arrow" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open ? <div className="layout-fold-body">{children}</div> : null}
    </section>
  );
}

/**
 * One row of the rail (§9a, from Ken): a grip, a name, its page, and a ×.
 *
 * The same row draws a part, a chapter and a picture, because on the rail
 * they are the same kind of thing — something in the book, at a place in it.
 * What each one *is* it says by where it sits and how far in it sits; the
 * margin says nothing else, which is the whole of the revision.
 */
function RailRow({
  row,
  page,
  selected,
  over,
  comfort,
  refusal,
  open,
  onToggle,
  onSelect,
  onOpen,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  row: BookRow;
  /** The page it begins on, where the book has been laid. */
  page: string;
  selected: boolean;
  over: boolean;
  /** What goes with it, said once, while the × is being asked about. */
  comfort: string;
  /**
   * Why there is nothing to take, where there is nothing (§9ac): a story with
   * writing in it is never run together with the one before it, so its × is
   * **disabled with the reason in its title** rather than absent — absence is
   * what read as *there's no way to delete those pages* (§9x).
   */
  refusal: string | null;
  /** A chapter's pages, showing or not (§9h). Absent on everything else. */
  open?: boolean;
  onToggle?(): void;
  onSelect(): void;
  /** A double-click: the page opened to be set (§9a). */
  onOpen(): void;
  onRemove(): void;
  onDragStart(): void;
  onDragEnd(): void;
  onDragOver(event: React.DragEvent): void;
  onDragLeave(): void;
  onDrop(event: React.DragEvent): void;
}) {
  const [asking, setAsking] = useState(false);
  return (
    <li
      className={`layout-rail-row layout-rail-${row.kind}${over ? ' drop-before' : ''}${asking ? ' layout-rail-asking' : ''}`}
      style={row.depth ? { paddingLeft: `${row.depth * 16}px` } : undefined}
      draggable={row.draggable}
      onDragStart={(event) => {
        if (!row.draggable) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* What is under the row, folded (§9h). Absent rather than a dead arrow
          where there is nothing under it — which `rowHasUnder` now decides,
          this comment having claimed it since §9h while every chapter and
          section got one regardless.

          **Not *the pages*** (§9o): a story holds its chapters as well as its
          own opening page, and a label naming only one of the two describes
          the fold a writer is complaining about rather than the one they
          have. */}
      {onToggle ? (
        <button
          type="button"
          className="ghost small layout-rail-fold"
          aria-expanded={open === true}
          aria-label={`${open ? 'Hide' : 'Show'} what is under ${row.title}`}
          title={row.kind === 'chapter' ? 'What is under it, one row each' : 'Its pages, one row each'}
          onClick={onToggle}
        >
          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
        </button>
      ) : null}
      <button
        type="button"
        className={selected ? 'ghost layout-part selected' : 'ghost layout-part'}
        aria-pressed={selected}
        title={
          row.kind === 'section'
            ? 'A chapter inside this story. Its heading opens the page; × takes the break off and the words run on.'
            : row.kind === 'picture'
            ? 'A picture in the writing. It stands where it stands there; draw its box on another page to move it.'
            : row.kind === 'chapter'
              ? 'Drag it to move it in the book. Double-click to set the page it opens on.'
              : 'Drag it to move it. Double-click to open the page.'
        }
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className="layout-grip" aria-hidden="true">
          {row.draggable ? '⠿' : ''}
        </span>
        {row.label ? <span className="muted layout-rail-label">{row.label}</span> : null}
        <span className="layout-part-name">{row.title}</span>
        <span className="muted layout-page-no">{page}</span>
      </button>
      {/* × comes off every row (§9a, from Ken: *I added a new story on
          accident, and there's no way to get rid of it*). Asked once inline,
          with what would go said beside it, because a chapter's words are
          not the chapter's to take. */}
      {asking && !refusal ? (
        <span className="layout-ask">
          <span className="muted small layout-ask-why">{comfort}</span>
          <button type="button" className="ghost small danger" onClick={onRemove}>
            Remove
          </button>
          <button type="button" className="ghost small" onClick={() => setAsking(false)}>
            Keep
          </button>
        </span>
      ) : (
        /* **Disabled with the reason in its title, never absent** (§9ac):
           a story with writing in it is never run together with the one
           before it, and §9x's own finding is that absence read as *there's
           no way to delete those pages*. */
        <button
          type="button"
          className="ghost small layout-part-remove"
          aria-label={`Remove ${row.title}`}
          disabled={refusal !== null}
          title={refusal ?? 'Take it out of the book'}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      )}
    </li>
  );
}

/**
 * **One page of the book, as a row of the rail** (§9w, from Ken: *there's
 * numbered pages, page one, two, three. There's no way to delete those pages.
 * There needs to be a little X in the left menu allowing you to delete
 * them*, and *it should be draggable so you can move things around if you
 * wanted to, the pages. Especially the pages that you import or pictures that
 * you import*).
 *
 * §9h drew these inline, as a fold under a row rather than as rows, and they
 * were the only thing in this rail with neither a × nor a grip — which is why
 * every other row in the room could be taken out and a page could not.
 * They are `RailRow`'s shape now, and the two controls say what they can do:
 *
 * **The × takes away what the writer put on the page**, which `pageRemoval`
 * decides — a blank leaf they asked for, or the picture that *is* the page —
 * and is **absent with the reason in its place** on the two pages that have
 * nothing of theirs on them, a × that could only refuse being one a writer
 * never trusts again.
 *
 * **The grip moves a picture**, which is `moveFigureBefore`, the act redrawing
 * the box already ran. A page of text does not drag: its order is the
 * writing's, and the title says so rather than leaving a grip that does
 * nothing.
 */
function PageRow({
  page,
  remove,
  chosen,
  over,
  onSelect,
  onOpen,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  page: BookPageRow;
  /** What a × here would take, or why there is none (§9w). */
  remove: PageRemoval;
  chosen: boolean;
  over: boolean;
  onSelect(): void;
  onOpen(): void;
  onRemove(): void;
  onDragStart(): void;
  onDragEnd(): void;
  onDragOver(event: React.DragEvent): void;
  onDragLeave(): void;
  onDrop(event: React.DragEvent): void;
}) {
  const [asking, setAsking] = useState(false);
  /**
   * **A picture and the writer's own blank page move; a page of words does
   * not** (§9an, Ken's own rule: *we can only do that with blank pages and
   * illustrated pages. You don't want to drag the story around on accident*).
   *
   * It is the same distinction the × makes: what a writer **put** on a page
   * is theirs to move, and what the cutter did is a consequence of a rule that
   * a drag could only disagree with. So the leaves the recto rule left and the
   * sheet between two works are not draggable — they go by removing their
   * reason, which is the row's own ×.
   */
  const carries = page.figureId ?? page.blankFor;
  const draggable = carries !== null;
  return (
    <li
      className={`layout-rail-row layout-rail-page${over ? ' drop-before' : ''}${asking ? ' layout-rail-asking' : ''}`}
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', carries as string);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={`layout-rail-name${chosen ? ' on' : ''}`}
        aria-current={chosen}
        title={
          page.figureId
            ? 'A picture on a page of its own. Drag it onto another page to move it; double-click to set it.'
            : draggable
              ? 'A blank page you put in. Drag it onto another page to move it there; double-click to open the page.'
              : 'Double-click to open the page.'
        }
        onClick={onSelect}
        // The rail and the spread are one gesture (§9j): a double-click opens
        // the page wherever it is pressed.
        onDoubleClick={onOpen}
      >
        <span className="layout-grip" aria-hidden="true">
          {draggable ? '⠿' : ''}
        </span>
        {/* **The row is the page** (§9l, from Ken: *it should say page two,
            page three, page four, page five*). The number is the page's own,
            printed or not — an illustration and a blank leaf are counted like
            any other page and merely print no folio, so a row that showed the
            folio left both of them nameless. What stands on the page follows,
            and a page of plain text needs no word: that is what a page of a
            book is. */}
        <span className="layout-rail-title">Page {page.counted}</span>
        {page.says === 'Text' ? null : <span className="muted small layout-rail-says">{page.says}</span>}
      </button>
      {asking ? (
        <span className="layout-ask">
          <span className="muted small layout-ask-why">{remove.comfort}</span>
          <button
            type="button"
            className="ghost small danger"
            onClick={() => {
              // **The ask closes with the act.** A row is keyed by its sheet
              // and the sheet survives what stood on it, so leaving it open
              // left *Remove · Keep* sitting on whatever page took that
              // number next — a question about a page that had gone.
              setAsking(false);
              onRemove();
            }}
          >
            Remove
          </button>
          <button type="button" className="ghost small" onClick={() => setAsking(false)}>
            Keep
          </button>
        </span>
      ) : (
        /**
         * **Never absent** (§9x). §9w drew this only where it had an act, and
         * on a collection that is no page at all: *page one, two, three* each
         * carried none, which is the report coming back word for word. Where
         * a page really cannot be taken away — a part's, which has a row of
         * its own — it is **disabled with the reason in its title**, because
         * the writer has to be able to find out *why*, and absence told them
         * nothing.
         */
        <button
          type="button"
          className="ghost small layout-part-remove"
          aria-label={`Remove page ${page.counted}`}
          title={remove.act ?? remove.refusal ?? ''}
          disabled={!remove.act}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      )}
    </li>
  );
}

/** The two facing pages, drawn from the same markup the PDF prints (§4). */
function Spreads({
  laying,
  spread,
  zoom,
  stageRef,
  onPickFigure,
  selectedSheet,
  onPickPage,
  onOpenPage,
  drawing,
  onDrawn,
  onGaveUp,
  placing,
  placingEmpty,
  placingFree,
  placingNote,
  onSlide,
  onSpan,
  onPick,
  onKeep,
  onDrop,
}: {
  laying: Laying;
  spread: number;
  zoom: number;
  /** The stage, handed back so the room can measure what the spread has to fit (§9e). */
  stageRef(element: HTMLDivElement | null): void;
  onPickFigure(figureId: string): void;
  /** The page in hand (§9a): outlined, so a writer can see which one the buttons mean. */
  selectedSheet: number | null;
  onPickPage(sheet: number): void;
  /** A double-click on a page (§9): whatever the page belongs to opens. */
  onOpenPage(page: BookPage): void;
  /** The figure whose box is being drawn (§8a), `'new'` for one not yet made (§9a), or null. */
  /** Whether the box tool is armed (§9ak): it makes a box and never redraws one. */
  drawing: boolean;
  onDrawn(placement: BookFigurePlacement, sheet: number, anchor: FigureAnchor | null): void;
  /** A press that drew nothing: the tool goes down rather than staying armed (§9p). */
  onGaveUp(): void;
  /** The box being placed (§9d), which wears a ✗ and a ✓ and can be slid. */
  placing: string | null;
  /** Whether that box is still waiting for a picture (§9m). */
  placingEmpty: boolean;
  /** The figure in hand is set over the page, so its width is a share of it. */
  placingFree: boolean;
  /** What it has done to the words and to the length of the book (§9at). */
  placingNote: string;
  /** Slid to a side, and before the element it was let go over. */
  onSlide(place: 'left' | 'right', anchor: FigureAnchor | null, at: { x: number; y: number }): void;
  /**
   * A corner dragged: the new width as a share of the measure (§9m), of the
   * page (§8c), and the new height as a share of the measure (§9af).
   */
  onSpan(span: number, ofPage: number, tall: number): void;
  /** A picture for the box being placed (§9m). */
  onPick(): void;
  onKeep(): void;
  onDrop(): void;
}) {
  /** The rectangle being dragged, in the sheet's own pixels, and which sheet. */
  const [box, setBox] = useState<{ key: string; x: number; y: number; w: number; h: number } | null>(null);
  const start = useRef<{ key: string; sheet: HTMLElement; x: number; y: number; page: BookPage } | null>(null);
  /** The two sheets on the screen, so the handle can be measured off them. */
  const sheets = useRef<Record<string, HTMLElement | null>>({});
  const [handles, setHandles] = useState<Record<string, { left: number; top: number; width: number; height: number } | null>>({});
  const { pageWidthPx, pageHeightPx } = bookMetrics(laying.geometry);
  const blocks = useMemo(() => new Map(laying.blocks.map((block) => [block.id, block])), [laying.blocks]);
  const pages = laying.laid.pages;
  const left = spread === 0 ? null : pages[spread * 2 - 1] ?? null;
  const right = spread === 0 ? pages[0] ?? null : pages[spread * 2] ?? null;
  const vars = {
    ...bookVars(laying.context),
    '--bk-page-width': `${pageWidthPx}px`,
    '--bk-page-height': `${pageHeightPx}px`,
  } as React.CSSProperties;

  /**
   * The box the writer drew, read against the text block it was drawn over
   * (§8a): how much of the measure it covers, and which side of the measure
   * it sits on. The picture keeps its own proportions, so the height is not
   * taken — a box drawn tall and thin makes a narrow picture, not a squashed
   * one, which is what a float does.
   */
  const finish = () => {
    const drawn = box;
    const from = start.current;
    start.current = null;
    setBox(null);
    /**
     * **A press that draws no box puts the tool down** (§9p, from Ken: *after
     * drawing a box and placing a picture, I tried to reselect it and I can't
     * select it, delete it, or manipulate it in any way*).
     *
     * Every one of these four ways out used to leave the room **in drawing
     * mode**, where a press on the spread returns before it selects anything
     * — so a click that missed, or a box dragged a few pixels wide, left the
     * writer unable to choose a page or a picture with nothing on the screen
     * saying why, and no way back if the box that would carry the ✗ was never
     * made. It is the divide tools' own idiom (addendum 21 §10): the tool
     * puts itself down when the act is over, whether or not it came off.
     */
    if (!drawing || !drawn || !from) {
      onGaveUp();
      return;
    }
    const text = from.sheet.querySelector('.bk-text') as HTMLElement | null;
    const sheetRect = from.sheet.getBoundingClientRect();
    const textRect = (text ?? from.sheet).getBoundingClientRect();
    /**
     * **In the sheet's own pixels, like the drag** (§9z). The box is measured
     * unzoomed (`(client − left) / zoom`, above) and the text block was read
     * straight off its client rect — so every figure taken from the two
     * together was out by the zoom, which is 1 only when a writer has typed a
     * number in. At *Fit* that made the share of the measure too big, so a
     * modest box read as full width and the side it cut in at was decided
     * against a midpoint in the wrong units; `measureOn` has divided by the
     * zoom since it was written, and this is the one place that did not.
     */
    const inset = (textRect.left - sheetRect.left) / zoom;
    const width = (textRect.width || sheetRect.width) / zoom;
    const share = drawn.w / width;
    const span = Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, share));
    const side = drawn.x + drawn.w / 2 < inset + width / 2 ? 'left' : 'right';
    /**
     * **The box is what it was drawn as** (§9z). It used to be cut into the
     * text whatever its width, so a box drawn right across the measure came
     * back at 60% with words squeezed beside it; `drawnFigurePlace` reads the
     * share and the band already says where the line is. Its free position is
     * whatever `figurePlacement` falls back to and is never read.
     */
    const place = drawnFigurePlace(share, side);
    /**
     * **And the height it was drawn to** (§9z), as a share of the measure so
     * it holds at any trim and any zoom. Without it an empty box took eight
     * lines of leading whatever the drag said, so a box drawn to fill the
     * white under a section's last words did not fit there and the cutter
     * moved it to the next page.
     */
    const boxHeight = Math.min(4, Math.max(0, drawn.h / width));
    /**
     * **A drag too small to be a box is a press** (§9af, from Ken: *on the
     * last picture, when I was trying to exit, it drew a box in the wrong
     * place on the right page at the wrong size*).
     *
     * The floor was eight pixels across and nothing at all down, so a hand
     * that twitched while dismissing the tool made a real figure: the band
     * clamps anything under a fifth of the measure **up** to a fifth, so a
     * ten-pixel drag came back as a 20% box, and a few pixels of height as a
     * sliver — a picture in a place nobody chose at a size nobody drew. The
     * floor is the band's own `min` across, which is the narrowest box there
     * is, and two lines of the measure down; under either the tool puts
     * itself down with nothing made, which is what it already did for a
     * click.
     */
    if (share < INSET_SPAN.min || boxHeight < 0.08) {
      onGaveUp();
      return;
    }
    /**
     * **And where it was drawn.** `onDrawn` used to anchor every box at the
     * element the page *opens with*, so the whole vertical half of the drag
     * was thrown away and a picture drawn at the foot of the page appeared at
     * the top of it — which is the whole of *it places it and then it's just
     * stuck there*. It is the same reading the handle slides by, so drawing a
     * box and dragging one cannot disagree about what a height means.
     */
    // Read off the box's **top**: a box drawn over a paragraph stands in
    // front of it and pushes it down, and one drawn in the white under the
    // last line stands after it. The foot would put a box drawn across two
    // paragraphs under the second, which is not where it was begun.
    const topY = from.sheet.getBoundingClientRect().top + drawn.y * zoom;
    onDrawn(
      { place, span, side: 'either', standoff: INSET_STANDOFF.default, x: 0, y: 0, boxHeight },
      from.page.sheet,
      blockUnder(from.page, from.sheet, topY),
    );
  };

  /** The text block's width on a sheet, in the sheet's own pixels. */
  const measureOn = (sheetEl: HTMLElement | null): number => {
    if (!sheetEl) return 0;
    const text = sheetEl.querySelector('.bk-text') as HTMLElement | null;
    const rect = (text ?? sheetEl).getBoundingClientRect();
    return (rect.width || sheetEl.getBoundingClientRect().width) / zoom;
  };

  /** A dragged corner, as the share of the measure the picture takes (§9m). */
  /** A sheet's own width in the room's pixels, which a free graphic is a share of. */
  const sheetWidthOf = (sheetEl: HTMLElement | null): number =>
    sheetEl ? sheetEl.getBoundingClientRect().width / zoom : 0;

  /**
   * **The share the corner was dragged to, and no band** (§9ak). It clamped
   * into `INSET_SPAN` here as well as in the act, which is a second answer
   * the moment the two kinds of picture stopped sharing one band: a picture
   * across the measure may be anything up to the whole of it, and this would
   * have held every corner drag to half.
   */
  const spanFor = (sheetEl: HTMLElement | null, width: number): number => {
    const measure = measureOn(sheetEl);
    if (measure <= 0) return INSET_SPAN.default;
    return Math.min(1, Math.max(0, width / measure));
  };

  /**
   * What the box measures, in the book's own inches (§9m, from Ken: *it should
   * give you the specifications of its dimensions*). Read off the **laid page**
   * rather than off the drag, so it is the size the book will print.
   */
  const sizeOf = (sheetEl: HTMLElement | null, at: { width: number; height: number } | null): string => {
    if (!at) return '';
    const perInch = pageWidthPx / laying.geometry.trim.width;
    if (perInch <= 0) return '';
    // A free graphic is a share of the **page** and everything else of the
    // measure (§8c). Saying *of the measure* over a graphic that is not in
    // the text's way is a figure that cannot be checked against anything.
    const free = placingFree;
    const against = free ? sheetWidthOf(sheetEl) : measureOn(sheetEl);
    const share = against > 0 ? Math.round((at.width / against) * 100) : 0;
    const of = free ? 'of the page' : 'of the measure';
    return `${(at.width / perInch).toFixed(2)} × ${(at.height / perInch).toFixed(2)} in${share > 0 ? ` · ${share}% ${of}` : ''}`;
  };

  /**
   * Which block the pointer is over, on a page (§9d).
   *
   * The rendered children of `.bk-text` stand in the same order as the page's
   * pieces — the one builder writes them that way — so the nth child is the
   * nth piece's block. That join is what lets the box be slid **among the
   * paragraphs** without the markup carrying an id for every one of them: a
   * `data-` attribute on every paragraph would change what the print and the
   * eBook emit, to answer a question only this room asks.
   */
  const blockUnder = (page: BookPage, sheetEl: HTMLElement, clientY: number): FigureAnchor | null => {
    const text = sheetEl.querySelector('.bk-text');
    if (!text) return null;
    const kids = Array.from(text.children) as HTMLElement[];
    for (let at = 0; at < kids.length; at += 1) {
      const id = page.pieces[at]?.blockId;
      if (clientY < kids[at]!.getBoundingClientRect().bottom) return id ? { elementId: id, after: false } : null;
    }
    /**
     * **Below the last line is after it** (§9z, from Ken: *I was trying to
     * fill the bottom of a last page of a section with a picture*).
     *
     * This answered with the last piece and so meant *before the last
     * paragraph*, a line higher up — so the one place on a page a writer most
     * wants a picture, the white under a section's closing words, was the one
     * place the gesture could not reach, and a box drawn there came back
     * somewhere else. The pointer is past every block, so the anchor is the
     * far end of the last one.
     */
    const last = page.pieces[page.pieces.length - 1]?.blockId;
    return last ? { elementId: last, after: true } : null;
  };

  /**
   * The box being placed, drawn over the figure wherever the laying put it
   * (§9d). It is read off the page rather than kept in state, so the moment
   * the text re-flows the handle is on the picture again — which is what
   * makes sliding it show the words moving rather than a box floating over a
   * page that has not caught up.
   */
  const handleFor = (sheetEl: HTMLElement | null): { left: number; top: number; width: number; height: number } | null => {
    if (!placing || !sheetEl) return null;
    const mark = sheetEl.querySelector(`[data-figure="${CSS.escape(placing)}"]`) as HTMLElement | null;
    if (!mark) return null;
    const sheetRect = sheetEl.getBoundingClientRect();
    const rect = mark.getBoundingClientRect();
    return {
      left: (rect.left - sheetRect.left) / zoom,
      top: (rect.top - sheetRect.top) / zoom,
      width: rect.width / zoom,
      height: rect.height / zoom,
    };
  };

  // The handle is measured after the page has drawn, and again whenever the
  // laying, the zoom or the spread moves it — which is what makes the box
  // follow the picture as the text re-flows around it.
  useEffect(() => {
    if (!placing) {
      setHandles({});
      return;
    }
    setHandles({ left: handleFor(sheets.current.left ?? null), right: handleFor(sheets.current.right ?? null) });
  }, [placing, laying, zoom, spread]);

  const draw = (page: BookPage | null, key: string) =>
    page ? (
      <div
        key={key}
        ref={(node) => {
          sheets.current[key] = node;
        }}
        className={`layout-sheet${drawing ? ' layout-sheet-drawing' : ''}${page.sheet === selectedSheet ? ' layout-sheet-chosen' : ''}`}
        style={{ width: pageWidthPx, height: pageHeightPx }}
        aria-label={`Page ${page.sheet}`}
        onClick={(event) => {
          // A press puts the page in hand (§9a), and a press on a figure —
          // tagged with its element id (§8) — picks the figure too.
          if (drawing) return;
          onPickPage(page.sheet);
          const hit = (event.target as HTMLElement).closest('[data-figure]');
          if (hit) onPickFigure(hit.getAttribute('data-figure') ?? '');
        }}
        onDoubleClick={() => {
          if (!drawing) onOpenPage(page);
        }}
        onPointerDown={(event) => {
          if (!drawing) return;
          const sheet = event.currentTarget as HTMLElement;
          const rect = sheet.getBoundingClientRect();
          event.preventDefault();
          sheet.setPointerCapture(event.pointerId);
          const x = (event.clientX - rect.left) / zoom;
          const y = (event.clientY - rect.top) / zoom;
          start.current = { key, sheet, x, y, page };
          setBox({ key, x, y, w: 0, h: 0 });
        }}
        onPointerMove={(event) => {
          const from = start.current;
          if (!drawing || !from || from.key !== key) return;
          const rect = from.sheet.getBoundingClientRect();
          const x = (event.clientX - rect.left) / zoom;
          const y = (event.clientY - rect.top) / zoom;
          setBox({ key, x: Math.min(from.x, x), y: Math.min(from.y, y), w: Math.abs(x - from.x), h: Math.abs(y - from.y) });
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        title={drawing ? 'Drag a box where the picture goes; the text will run round it' : 'Choose this page; double-click to open what it belongs to'}
      >
        {/* The page's own markup, from the one builder the export reads too. */}
        <SheetInk page={page} blocks={blocks} context={laying.context} className="layout-sheet-ink" />
        {box && box.key === key ? (
          <div className="layout-draw-box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true" />
        ) : null}
        <PlacingHandle
          at={handles[key] ?? null}
          empty={placingEmpty}
          note={placingNote}
          size={sizeOf(sheets.current[key] ?? null, handles[key] ?? null)}
          onSlideTo={(clientX, clientY) => {
            const sheetEl = sheets.current[key];
            if (!sheetEl) return;
            const text = sheetEl.querySelector('.bk-text') as HTMLElement | null;
            const rect = (text ?? sheetEl).getBoundingClientRect();
            // A free graphic is placed against the **page** (§8c), an inset
            // against the text block — so both are read here and the room
            // uses whichever the figure in hand is.
            const sheetRect = sheetEl.getBoundingClientRect();
            onSlide(clientX < rect.left + rect.width / 2 ? 'left' : 'right', blockUnder(page, sheetEl, clientY), {
              x: (clientX - sheetRect.left) / (sheetRect.width || 1),
              y: (clientY - sheetRect.top) / (sheetRect.height || 1),
            });
          }}
          onCorner={(width, height) => {
            const sheetEl = sheets.current[key] ?? null;
            // The height as a share of the **measure**, which is what
            // `boxHeight` is everywhere (§9z): the markup's aspect ratio and
            // the cutter's measurement read the same number, so a box
            // resized here is the same size on the page and in the hole the
            // page keeps for it.
            const measure = measureOn(sheetEl);
            onSpan(
              spanFor(sheetEl, width),
              width / (sheetWidthOf(sheetEl) || 1),
              measure > 0 ? Math.min(4, height / measure) : 0,
            );
          }}
          onPick={onPick}
          onKeep={onKeep}
          onDrop={onDrop}
        />
      </div>
    ) : (
      <div key={key} className="layout-sheet layout-no-sheet" style={{ width: pageWidthPx, height: pageHeightPx }} />
    );
  return (
    // The padding is the inset `spreadFit` allows for, set from the one
    // constant rather than typed again in the stylesheet — two numbers that
    // had to agree would be two answers to how big a page may be drawn (§9e).
    <div className="layout-spreads" ref={stageRef} style={{ padding: SPREAD_INSET_PX }}>
      <div
        className="layout-spread-box"
        style={{ width: pageWidthPx * 2 * zoom + 24, height: pageHeightPx * zoom + 24 }}
      >
        <div className="layout-spread" style={{ ...vars, transform: `scale(${zoom})` }}>
          {draw(left, 'left')}
          {draw(right, 'right')}
        </div>
      </div>
    </div>
  );
}

function TrimSection({ laying, write }: { laying: Laying; write(patch: Partial<BookSettings>): void }) {
  const { settings, geometry } = laying;
  const preset = trimPresetOf(geometry.trim);
  const [custom, setCustom] = useState(preset === null);
  const warning = measureWarning(geometry);
  const margin = (edge: keyof BookSettings['margins'], label: string) => {
    const typed = settings.margins[edge];
    return (
      <label className="field layout-margin" key={edge}>
        <span>
          {label} <span className="muted">{typed === null ? 'worked out' : 'typed'}</span>
        </span>
        <span className="layout-margin-row">
          <input
            type="number"
            step={0.0625}
            min={0}
            max={4}
            aria-label={`${label} margin in inches`}
            placeholder={geometry.margins[edge].toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}
            value={typed ?? ''}
            onChange={(event) => {
              const value = event.target.value.trim();
              write({ margins: { ...settings.margins, [edge]: value === '' ? null : Number(value) } });
            }}
          />
          {typed !== null ? (
            <button
              type="button"
              className="ghost small"
              title="Work it out from the trim again"
              aria-label={`Work out the ${label.toLowerCase()} margin again`}
              onClick={() => write({ margins: { ...settings.margins, [edge]: null } })}
            >
              ×
            </button>
          ) : null}
        </span>
      </label>
    );
  };
  return (
    <>
      <label className="field">
        <span>Trim size</span>
        <select
          aria-label="Trim size"
          value={custom ? 'custom' : preset?.id ?? 'custom'}
          onChange={(event) => {
            const chosen = TRIM_PRESETS.find((one) => one.id === event.target.value);
            if (!chosen) {
              setCustom(true);
              return;
            }
            setCustom(false);
            write({ trim: { width: chosen.width, height: chosen.height } });
          }}
        >
          {TRIM_PRESETS.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name} — {one.note}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </label>
      {custom ? (
        <div className="layout-two">
          <label className="field">
            <span>Width, in</span>
            <input
              type="number"
              step={0.125}
              min={3}
              max={14}
              aria-label="Trim width in inches"
              value={geometry.trim.width}
              onChange={(event) => write({ trim: { ...geometry.trim, width: Number(event.target.value) || geometry.trim.width } })}
            />
          </label>
          <label className="field">
            <span>Height, in</span>
            <input
              type="number"
              step={0.125}
              min={4}
              max={20}
              aria-label="Trim height in inches"
              value={geometry.trim.height}
              onChange={(event) => write({ trim: { ...geometry.trim, height: Number(event.target.value) || geometry.trim.height } })}
            />
          </label>
        </div>
      ) : null}
      <div className="layout-two">
        {margin('inside', 'Inside')}
        {margin('outside', 'Outside')}
        {margin('top', 'Top')}
        {margin('bottom', 'Bottom')}
      </div>
      <p className="small layout-geometry">{describeGeometry(geometry, settings.face, settings.fonts)}</p>
      {/* The spine (§3, from Ken): what the binding takes is worked out from
          the page count every time the book is laid, and said here so nobody
          hunts for a switch. */}
      <p className="small layout-geometry layout-spine">{describeSpine(geometry)}</p>
      {warning ? <p className="small layout-warning">{warning}</p> : null}
    </>
  );
}

/**
 * Book settings (§9, from Ken: *a book settings button in the top toolbar,
 * because this applies to the entire book*): the trim, the margins and the
 * spine, the type, the running heads and the page numbers, and the chapter
 * openings — everything that runs all the way through — in one dialog in
 * the middle of the screen, behind the same folds the inspector had.
 */
function BookSettingsDialog({
  open,
  file,
  laying,
  write,
  noun,
  nounPlural,
  divisions,
  divisionInHand,
  onUpdate,
  onOpenChapterPage,
  onClose,
}: {
  open: boolean;
  file: ProjectFile;
  laying: Laying;
  write(patch: Partial<BookSettings>): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  noun: string;
  nounPlural: string;
  divisions: ReturnType<typeof contentsDivisions>;
  /** The division the page in hand is in, whose title the right-hand top may carry. */
  divisionInHand: string | null;
  onOpenChapterPage?(markerId: string): void;
  onClose(): void;
}) {
  const dialog = useModal(open);
  const settings = laying.settings;
  /**
   * What the two tops will print, worked out **once** and read by both the row
   * in *The book* and the pair in *Running heads*: one sentence in two places
   * rather than two sentences that could disagree about one page.
   */
  const tops = describeHeadTops(settings, bookNames(file), firstDivisionTitle(divisions), file.project.format);
  return (
    <dialog ref={dialog} className="track-dialog layout-book-dialog" aria-label="Book settings" onClose={onClose}>
      <header>
        <div className="track-dialog-title">
          <strong>Book settings</strong>
          <span className="muted small">{bookNames(file).title} · the whole book, all the way through</span>
        </div>
        <button type="button" className="ghost" aria-label="Close book settings" onClick={onClose}>
          ×
        </button>
      </header>
      {open ? (
        <div className="layout-book-dialog-body">
          {/* What the book is called (§9, from Ken: *it is taking it from
              the actual saved file name, and that is ending up on the tops
              of the pages*). The title runs all the way through — the
              running heads, the contents, the title page, the eBook and the
              exported file all read it — so it belongs here and nowhere
              else; empty means the project's name, which an import took
              from the file on disk, and that is the placeholder. */}
          <Fold id="names" title="The book">
            <label className="field">
              <span>Book title</span>
              <input
                aria-label="Book title"
                placeholder={file.project.title}
                value={file.settings.titlePage.title}
                onChange={(event) => onUpdate((current) => setTitlePage(current, { title: event.target.value }))}
              />
            </label>
            {/* **The other title the tops choose between** (§9y, from Ken: *the
                book title is now correct, but just underneath that, we need to
                have the story title or chapter. And you should be able to type
                that in instead of trying to take it from the actual file
                name*).

                The two tops choose between two titles, so **both titles are
                typed where the choice is made**. It is `updateMarker` — the
                division's own title, which the chapter page prints and the
                contents page lists — so this is a *second control onto one
                field* (§16d) rather than a second answer: naming the story
                here renames it everywhere.

                It names the division the **page in hand** is in and says
                which, because a collection has a title per story and the top
                carries whichever story the page is in: one box that silently
                renamed a story a writer was not looking at would be worse
                than none. */}
            <DivisionTitleRow
              divisions={divisions}
              divisionInHand={divisionInHand}
              noun={noun}
              onUpdate={onUpdate}
            />
            <label className="field">
              <span>Author</span>
              <input
                aria-label="Author"
                placeholder={file.project.author || 'Nobody yet'}
                value={file.settings.titlePage.author}
                onChange={(event) => onUpdate((current) => setTitlePage(current, { author: event.target.value }))}
              />
            </label>
            <label className="field">
              <span>Publisher</span>
              <input
                aria-label="Publisher"
                placeholder="Nothing under the author"
                value={settings.imprint}
                onChange={(event) => write({ imprint: event.target.value })}
              />
            </label>
            {/* Which title goes on which top (§7c, from Ken: *there's no way
                to determine the title on one side or the other*).

                One control per side, standing where the titles are typed.
                §7b put a single select here naming both tops at once, which
                is the same shape as the complaint — one control deciding both
                sides — so this is the pair itself, moved up out of the
                furniture fold rather than copied into a second place. */}
            <HeadTopsRow settings={settings} write={write} noun={noun} tops={tops} />
            <p className="muted small">
              The <em>book’s</em> title is on the contents page, the title page, the eBook and the exported file. Empty means the
              project’s own name,{' '}
              <em>{file.project.title}</em>, which an imported book took from its file.
            </p>
          </Fold>
          <Fold id="trim" title="Trim, margins & spine">
            <TrimSection laying={laying} write={write} />
          </Fold>
          <Fold id="type" title="Type">
            <TypeSection settings={settings} write={write} noun={noun} />
          </Fold>
          {/* The writer's own fonts (§6b, from Ken). Its own fold rather than
              a corner of Type: importing a face is a thing done once and the
              list of them is a thing to look at, while Type is set often. */}
          <Fold id="fonts" title="Your fonts">
            <FontsSection file={file} onUpdate={onUpdate} />
          </Fold>
          <Fold id="furniture" title="Running heads & page numbers">
            <FurnitureSection
              settings={settings}
              write={write}
              noun={noun}
              nounPlural={nounPlural}
              tops={tops}
              /* Absent rather than greyed off a collection and a series
                 (addendum 22 §9): a chapter is a division *of* a novel, so
                 there is nothing there for a sheet to separate. */
              separates={holdsWholeWorks(file.project.format)}
            />
          </Fold>
          {/* A division laid out on its own terms (addendum 43 §10, Ken's
              spec §6: chapter-specific heads, a first page different, page
              numbers restarting per section). */}
          <Fold id="by-division" title={`Heads & numbers by ${noun.toLowerCase()}`}>
            <SectionsSection settings={settings} rows={laying.context.contents} noun={noun} onUpdate={onUpdate} />
          </Fold>
          {/* How a division's heading is set (§6a, from Ken: *the story titles
              should be adjustable with a setting*). It used to be a sentence
              pointing at another dialog, which is not a setting. The fields
              are the chapter-page dialog's own component, so the two cannot
              disagree about what a heading looks like. */}
          <Fold id="openings" title={`${noun} openings`}>
            {/* How a division is numbered (§9h). It was reachable only by
                opening a marker on the timeline, which is nowhere near the
                room a book is set in — so a writer whose file divided at
                Roman numerals had no way, here, to have the book print them.
                It applies to every division, so §9's own rule puts it where
                the whole book is set. */}
            <label className="field">
              <span>How they are numbered</span>
              <select
                aria-label="How divisions are numbered"
                value={markerNumbering(file)}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    settings: { ...current.settings, markerNumbering: event.target.value as MarkerNumbering },
                  }))
                }
              >
                {MARKER_NUMBERINGS.map((scheme) => (
                  <option key={scheme.value} value={scheme.value}>
                    {scheme.label}
                    {scheme.example ? ` — ${scheme.example}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <ChapterStyleFields file={file} onUpdate={onUpdate} marker={null} />
            <p className="muted small">
              A {noun.toLowerCase()} page carrying a device, a summary or an epigraph opens on a leaf of its own; one
              carrying only its number and name opens above its first paragraph.
            </p>
            {onOpenChapterPage && divisions[0] ? (
              <button type="button" className="ghost small" onClick={() => onOpenChapterPage(divisions[0]!.marker.id as string)}>
                Open one {noun.toLowerCase()}’s own page…
              </button>
            ) : null}
          </Fold>
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * A part in a dialog of its own (§9, from Ken: *double click the front
 * matter or whatever page … in a dialog box that pops up in the centre, and
 * you can see the type of page formatting*): its fields on the left, the
 * pictures cut into its text under them, and on the right the page as the
 * book sets it — the same markup the spread draws and the PDF prints, so
 * what is seen here is what will be printed.
 */
/**
 * One page of the story, in a dialog (§9j, from Ken: *if I double-click any
 * page, the page setup dialog box should pop up with all the options for that
 * page*).
 *
 * It holds **nothing of its own**: the caller hands it the same sections the
 * inspector shows, so opening a page in a dialog and choosing it in the rail
 * cannot offer different things. What it adds is the gesture — every page in
 * the book now answers a double-click, where an ordinary page of the story
 * answered nothing because it was the one kind that belonged to no record.
 */
function PageDialog({
  page,
  controls,
  onClose,
}: {
  page: BookPageRow | null;
  controls: ReactNode;
  onClose(): void;
}) {
  const dialog = useModal(Boolean(page));
  return (
    <dialog ref={dialog} className="layout-page-dialog" aria-label="Page" onClose={onClose}>
      {page ? (
        <>
          {/* The bar carries the way out and nothing else: the section below
              already names the page, and two headings saying *Page 5* is one
              of them explaining nothing. */}
          <header className="layout-page-dialog-bar">
            <span className="toolbar-spacer" />
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="layout-page-dialog-body">{controls}</div>
        </>
      ) : null}
    </dialog>
  );
}

/**
 * The copyright page (addendum 20 §9k, from Ken: *with the copyright page in
 * particular, we need to have a special pop-up dialog box that is for the
 * copyright information, that allows you to put all the information
 * attached*).
 *
 * Every other page in the front matter is one thing said once. This one is a
 * dozen separate facts in a settled order, and a writer typing them into a box
 * has to know a convention the program already knows — which line comes first,
 * how a notice is punctuated, what a number line means. So the fields are the
 * page, and the lines they make are shown underneath, from `copyrightLines`:
 * the same reading the printed book uses, so what is on the screen is what
 * will be on the paper.
 */

function PartDialog({
  file,
  part,
  laying,
  onUpdate,
  onClose,
  onRemoved,
}: {
  file: ProjectFile;
  part: BookPart | null;
  laying: Laying | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  onRemoved(): void;
}) {
  const dialog = useModal(part !== null);
  /** The picture last touched, so the page beside the fields turns to where it fell. */
  const [touched, setTouched] = useState<string | null>(null);
  const focus = touched === 'newest' ? (part?.insets[part.insets.length - 1]?.id ?? null) : touched;
  return (
    <dialog ref={dialog} className="track-dialog layout-part-dialog" aria-label="Part" onClose={onClose}>
      {part ? (
        <>
          <header>
            <div className="track-dialog-title">
              <strong>{partTitle(part)}</strong>
              <span className="muted small">{PART_INFO[part.kind].note}</span>
            </div>
            <button type="button" className="ghost" aria-label="Close the part" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="layout-part-dialog-body">
            <div className="layout-part-dialog-fields">
              {/* The copyright page never arrives here: it opens its own
                  screen (§15c), so there is no button through to one. */}
              <PartFields
                file={file}
                part={part}
                onUpdate={onUpdate}
                onDone={onRemoved}
                rows={laying ? bookPageRows(laying.laid.pages, laying.blocks) : []}
              />
              {partTakesInsets(part.kind) ? <PartPictures file={file} part={part} onUpdate={onUpdate} onTouched={setTouched} /> : null}
              {/* What the contents page lists (§9v). On the contents page's
                  own screen rather than in the rail: the rail lists the book
                  and the contents lists **entries**, and the two are not the
                  same list — a story's chapters are a fold away there and all
                  of them are here, which is the list being ticked. */}
              {part.kind === 'contents' ? <ContentsPicker file={file} laying={laying} onUpdate={onUpdate} /> : null}
            </div>
            <PagePreview laying={laying} partId={part.id} focus={focus} />
          </div>
        </>
      ) : null}
    </dialog>
  );
}

/**
 * The pictures cut into a part's text (§8, from Ken: *placing a graphic on
 * a page is different from a page graphic — drop in graphics that cut into
 * the text*). Each one names the paragraph it sits beside, the side and
 * how much of the measure it takes; the picture comes from a file, or from
 * the library where it is already in the book.
 */
/**
 * What the contents page lists (§9v, from Ken: *you need to be able to select
 * in the menu what is going to be in the table of contents… that can be done
 * in the contents dialog box*).
 *
 * **The list is the contents itself**, in the book's order and at its depth,
 * with the page each entry would carry. Ken offered the rail as the other
 * place, and the rail cannot be it: it lists the *book*, where a story's
 * chapters are a fold away and a writer would have to open every one to see
 * what they are ticking. Here they are all in front of them, beside the page
 * the ticks make.
 *
 * Everything is listed until somebody says otherwise, so a chapter written
 * tomorrow is on the page the day it is written — the ticks are read off
 * `contentsOut`, which holds only what was taken off.
 */
function ContentsPicker({
  file,
  laying,
  onUpdate,
}: {
  file: ProjectFile;
  laying: Laying | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const rows = laying?.context.contents ?? [];
  const off = rows.filter((row) => !row.listed).length;
  return (
    <section className="layout-section layout-contents-picker">
      <h3>What it lists</h3>
      {rows.length === 0 ? (
        <p className="muted small">Nothing to list yet.</p>
      ) : (
        <>
          <p className="muted small">
            {off === 0
              ? 'Everything in the book. Anything added later is listed too.'
              : `${off} left off. ${rows.length - off} of ${rows.length} on the page.`}
          </p>
          <ul className="layout-contents-list">
            {rows.map((row) => (
              <li key={row.id} className={row.depth ? 'layout-contents-under' : undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={row.listed}
                    onChange={(event) => onUpdate((current) => setInContents(current, row.id, event.target.checked))}
                  />
                  <span className="layout-contents-name">{row.label ? `${row.label} ${row.title}`.trim() : row.title}</span>
                  <span className="muted layout-contents-page">{row.page > 0 ? row.page : ''}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function PartPictures({
  file,
  part,
  onUpdate,
  onTouched,
}: {
  file: ProjectFile;
  part: BookPart;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Which picture was just added ('newest') or changed, so the page beside turns to it. */
  onTouched(insetId: string): void;
}) {
  const library = graphicsInOrder(file);
  const pictures = new Map(file.assets.map((asset) => [asset.id as string, asset]));
  /**
   * **What the page really prints** (§19a). It counted `part.text`, which on
   * a glossary, a bibliography and a reader extra is empty whatever is on the
   * page — so the one control that cuts a picture into the words could only
   * ever say *write a paragraph first*. `partParagraphs` is the page's own
   * count, which is the reading `partOwnBlocks`' comment already said the
   * panel must share.
   */
  const paragraphs = partParagraphs(part, file);
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const partId = part.id;
  const patchInset = (insetId: string, patch: Partial<Omit<PartInset, 'id'>>) => {
    onUpdate((current) => updatePartInset(current, partId, insetId, patch));
    onTouched(insetId);
  };
  const takeFile = async (picked: File | undefined) => {
    setError(null);
    if (!picked) return;
    const no = pictureRefusal(picked);
    if (no) {
      setError(no);
      return;
    }
    try {
      const read = await readPicture(picked);
      onUpdate((current) => {
        const added = addGraphic(current, { name: picked.name, ...read });
        return addPartInset(added.file, partId, { assetId: added.asset.id }).file;
      });
      onTouched('newest');
    } catch {
      setError('That file could not be read.');
    }
  };
  const nothingToCutInto = paragraphs.length === 0;
  return (
    <section className="layout-section layout-part-pictures">
      <h3>Pictures cut into the text</h3>
      <p className="muted small">
        A picture beside a paragraph, the words running round it — not the whole page, which is an art page. It cuts in at the
        left or the right, at a fraction of the measure.
      </p>
      <input
        ref={picker}
        type="file"
        accept={PICTURE_ACCEPT}
        aria-label="Part picture file"
        hidden
        onChange={(event) => {
          void takeFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {part.insets.length > 0 ? (
        <ul className="layout-insets" aria-label="Pictures cut into the text">
          {part.insets.map((inset, index) => {
            const asset = inset.assetId ? pictures.get(inset.assetId) : undefined;
            return (
              <li key={inset.id} className="layout-inset-row">
                <span className="layout-inset-thumb" aria-hidden="true">
                  {asset ? <img src={asset.data} alt="" /> : <span className="muted small">no picture</span>}
                </span>
                <span className="layout-inset-fields">
                  <label className="field">
                    <span>Picture</span>
                    <select aria-label={`Picture ${index + 1}`} value={inset.assetId ?? ''} onChange={(event) => patchInset(inset.id, { assetId: event.target.value || null })}>
                      <option value="">None</option>
                      {library.map((one) => (
                        <option key={one.id as string} value={one.id as string}>
                          {one.name || one.caption || 'Untitled'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Beside paragraph</span>
                    <select
                      aria-label={`Picture ${index + 1} paragraph`}
                      value={Math.min(inset.paragraph, Math.max(0, paragraphs.length - 1))}
                      onChange={(event) => patchInset(inset.id, { paragraph: Number(event.target.value) })}
                    >
                      {paragraphs.map((text, at) => (
                        <option key={at} value={at}>
                          {at + 1} — {text.slice(0, 32)}
                          {text.length > 32 ? '…' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="layout-two">
                    <label className="field">
                      <span>Side</span>
                      <select aria-label={`Picture ${index + 1} side`} value={inset.place} onChange={(event) => patchInset(inset.id, { place: event.target.value as 'left' | 'right' })}>
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Width · {Math.round(inset.span * 100)}% of the measure</span>
                      <input
                        type="range"
                        min={Math.round(INSET_SPAN.min * 100)}
                        max={Math.round(INSET_SPAN.max * 100)}
                        step={5}
                        aria-label={`Picture ${index + 1} width`}
                        value={Math.round(inset.span * 100)}
                        onChange={(event) => patchInset(inset.id, { span: Number(event.target.value) / 100 })}
                      />
                    </label>
                  </span>
                  <label className="field">
                    <span>Caption</span>
                    <input aria-label={`Picture ${index + 1} caption`} value={inset.caption} onChange={(event) => patchInset(inset.id, { caption: event.target.value })} />
                  </label>
                </span>
                <button
                  type="button"
                  className="ghost small layout-part-remove"
                  aria-label={`Take picture ${index + 1} out`}
                  title="Take this picture out of the text; it stays in the library"
                  onClick={() => onUpdate((current) => removePartInset(current, partId, inset.id))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {nothingToCutInto ? (
        <p className="muted small">Write a paragraph first: a picture cuts into the text beside it.</p>
      ) : (
        <div className="layout-plate-pick">
          <button type="button" className="raised small" title="A picture from a file on this computer; it joins the book's pictures under Research ▸ Graphics" onClick={() => picker.current?.click()}>
            + Picture from a file…
          </button>
          {library.length > 0 ? (
            <select
              aria-label="Picture already in the book"
              value=""
              onChange={(event) => {
                const assetId = event.target.value;
                if (!assetId) return;
                onUpdate((current) => addPartInset(current, partId, { assetId }).file);
                onTouched('newest');
              }}
            >
              <option value="">+ One already in the book…</option>
              {library.map((one) => (
                <option key={one.id as string} value={one.id as string}>
                  {one.name || one.caption || 'Untitled'}
                </option>
              ))}
            </select>
          ) : null}
          {error ? (
            <span className="error small" role="alert">
              {error}
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * The part's pages as the book sets them (§9): every page the part falls
 * on, drawn from the laying with the same builder the spread and the PDF
 * read, at a size that fits beside the fields. Re-laid as the words
 * change, so a picture cut in is seen cut in.
 */
function PagePreview({ laying, partId, focus }: { laying: Laying | null; partId: string; focus: string | null }) {
  const [at, setAt] = useState(0);
  const blocks = useMemo(() => new Map((laying?.blocks ?? []).map((block) => [block.id, block])), [laying]);
  const pages = useMemo(
    () =>
      (laying?.laid.pages ?? []).filter((page) =>
        page.pieces.some((piece) => {
          const block = blocks.get(piece.blockId);
          return block !== undefined && (block.id === partId || block.partId === partId);
        }),
      ),
    [laying, blocks, partId],
  );
  // A picture just placed is on some page of the part: turn to it, once
  // the laying has caught up, so the writer sees it cut in where it fell.
  useEffect(() => {
    if (!focus) return;
    const index = pages.findIndex((page) => page.pieces.some((piece) => blocks.get(piece.blockId)?.inset?.figureId === focus));
    if (index >= 0) setAt(index);
  }, [focus, pages, blocks]);
  if (!laying) return <div className="layout-page-preview muted small">Setting the page…</div>;
  const { pageWidthPx, pageHeightPx } = bookMetrics(laying.geometry);
  const scale = Math.min(1, 540 / pageHeightPx, 420 / pageWidthPx);
  const page = pages[Math.min(at, Math.max(0, pages.length - 1))];
  const vars = {
    ...bookVars(laying.context),
    '--bk-page-width': `${pageWidthPx}px`,
    '--bk-page-height': `${pageHeightPx}px`,
  } as React.CSSProperties;
  return (
    <div className="layout-page-preview" aria-label="The page as set">
      {page ? (
        <>
          <div className="layout-page-preview-box" style={{ width: pageWidthPx * scale, height: pageHeightPx * scale }}>
            <div className="layout-spread" style={{ ...vars, transform: `scale(${scale})` }}>
              <SheetInk page={page} blocks={blocks} context={laying.context} className="layout-sheet" />
            </div>
          </div>
          <div className="layout-page-preview-foot">
            <button type="button" className="ghost small" aria-label="Previous page of the part" disabled={at <= 0} onClick={() => setAt((current) => Math.max(0, current - 1))}>
              ←
            </button>
            <span className="muted small">
              {page.folio ? `Page ${page.folio}` : 'Unnumbered page'} · {pages.length === 1 ? 'the whole part' : `${Math.min(at, pages.length - 1) + 1} of ${pages.length} pages`}
              {' · '}
              {page.side === 'recto' ? 'a right-hand page' : 'a left-hand page'}
            </span>
            <button
              type="button"
              className="ghost small"
              aria-label="Next page of the part"
              disabled={at >= pages.length - 1}
              onClick={() => setAt((current) => Math.min(pages.length - 1, current + 1))}
            >
              →
            </button>
          </div>
        </>
      ) : (
        <p className="muted small">This part has no page yet: it is set once it has something on it.</p>
      )}
    </div>
  );
}

/** An illustrated page, or a picture cut into the text (§8, §8a). */
const PLACE_WORDS: Record<BookFigurePlacement['place'], string> = {
  measure: 'across the measure',
  left: 'cut in at the left',
  right: 'cut in at the right',
  page: 'a page of its own',
  free: 'set over the page',
};

/**
 * The box being placed (addendum 20 §9d, from Ken: *you can slide it around
 * and watch the text move around it so you can get it placed perfectly … and
 * there will be an X or a check mark in the middle of the box*).
 *
 * It is drawn **over the picture where the laying put it**, so dragging it
 * does not move a floating rectangle — it moves the figure, the book is set
 * again, and the handle lands back on it. That is the difference between a
 * preview and the thing itself, and the reason there is no separate ghost.
 *
 * The two marks sit **in the middle**, as he asked, and say which is which:
 * ✗ takes the box away as though it had never been drawn, ✓ keeps it where it
 * stands and asks for the picture.
 */
function PlacingHandle({
  at,
  empty,
  size,
  note,
  onSlideTo,
  onCorner,
  onPick,
  onKeep,
  onDrop,
}: {
  at: { left: number; top: number; width: number; height: number } | null;
  /** Whether the box is still waiting for its picture (§9m). */
  empty: boolean;
  /** What it measures, said on the box itself: *3.1 × 2.0 in · 62% of the measure*. */
  size: string;
  /** What it has done to the words, said before ✓ keeps it (§9at). */
  note: string;
  onSlideTo(clientX: number, clientY: number): void;
  /** A corner dragged: the new width and height in the sheet's own pixels (§9m, §9af). */
  onCorner(width: number, height: number): void;
  /** Put a picture in this box, from here (§9m, from Ken). */
  onPick(): void;
  onKeep(): void;
  onDrop(): void;
}) {
  const [sliding, setSliding] = useState(false);
  /** Which corner is being dragged, and where the box stood when it was taken. */
  const corner = useRef<{
    x: number;
    y: number;
    from: 'left' | 'right';
    down: 'up' | 'down';
    /** The box's size when the corner was taken (§9ak). */
    width: number;
    height: number;
  } | null>(null);
  /** Where a press began, and whether it has become a slide (§9af). */
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  /** A slide just happened, so the click that ends it is not a mark's (§9af). */
  const slid = useRef(false);
  if (!at) return null;
  /**
   * A corner resizes it (§9m, from Ken: *it needs to have draggable corners
   * that maintain its squareness*). A corner on the near side grows it
   * towards the pointer, the far side being pinned, so the box grows where
   * the hand is.
   *
   * **And an empty box takes its height from the drag too** (§9af, from Ken:
   * *it doesn't allow me to resize it… and it should be*). §9m's rule — only
   * the width is dragged, the height follows from the picture's own
   * proportions — is right about a box with a picture in it and has nothing
   * to say about an empty one, which is the only kind a corner is ever
   * dragged on: a box is drawn before it is filled (§9a). Measured before
   * the fix: a corner took a box from 46% to 60% of the measure with its
   * height pinned at 1.87in, so the one gesture for changing its shape
   * changed only half of it and the shape the writer dragged was not the
   * shape they got.
   */
  const takeCorner = (event: React.PointerEvent, from: 'left' | 'right', down: 'up' | 'down') => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    /**
     * **The size at the press, not the size now** (§9ak, measured). `across`
     * is the distance from where the corner was taken, and this read the
     * box's **live** width to add it to — a width the previous move had
     * already changed, the book being set again between them. So each move
     * applied the whole journey to an answer that had already travelled, and
     * the box ran away from the hand: measured on the real spread, a 100-pixel
     * drag inward on a 342-pixel picture came back at **68 pixels**, the
     * band's own floor, rather than 242. The further a writer drags, the
     * worse it is, which is exactly the hand that is being careful.
     *
     * Held here, the box simply follows the pointer, which is the one thing a
     * corner has to do.
     */
    corner.current = { x: event.clientX, y: event.clientY, from, down, width: at.width, height: at.height };
  };
  const moveCorner = (event: React.PointerEvent) => {
    const held = corner.current;
    if (!held) return;
    const across = event.clientX - held.x;
    const downBy = event.clientY - held.y;
    onCorner(
      Math.max(24, held.from === 'right' ? held.width + across : held.width - across),
      Math.max(16, held.down === 'down' ? held.height + downBy : held.height - downBy),
    );
  };
  const letGo = (event: React.PointerEvent) => {
    corner.current = null;
    setSliding(false);
    event.stopPropagation();
  };
  const grip = (where: string, from: 'left' | 'right', down: 'up' | 'down') => (
    <span
      key={where}
      className={`layout-placing-grip ${where}`}
      role="presentation"
      onPointerDown={(event) => takeCorner(event, from, down)}
      onPointerMove={moveCorner}
      onPointerUp={letGo}
      onPointerCancel={letGo}
    />
  );
  /**
   * **A mark acts on a press and the box slides on a drag** (§9af, from Ken:
   * *it doesn't allow me to move the box anywhere*).
   *
   * The marks are in the middle of the box because that is where Ken asked
   * for them (§9d) — and three 30px circles with their gaps are **106px
   * across the middle**, which on a 137px box (1.67in of a 4.19in measure,
   * the size in his own screenshot) leaves fifteen pixels of box to grab
   * either side of them and nothing at all in the middle. A hand reaching for
   * the centre of a box lands on a button, the drag never begins, and the
   * first of those buttons is **✗** — so *it doesn't allow me to move the
   * box* and *when I delete the box, all the text comes back* are one press
   * reported twice.
   *
   * So the guard is a **threshold rather than a target**: a press anywhere on
   * the box may become a slide, and a mark does its own work only where the
   * pointer did not travel. The grips stay their own, a corner being a
   * different gesture rather than a slower one.
   */
  const act = (run: () => void) => () => {
    if (slid.current) {
      slid.current = false;
      return;
    }
    run();
  };
  return (
    <div
      className={sliding ? 'layout-placing sliding' : 'layout-placing'}
      style={{ left: at.left, top: at.top, width: at.width, height: at.height }}
      onPointerDown={(event) => {
        // The grips are their own gesture; the whole of the rest of the box,
        // the marks included, is the handle that slides it (§9af).
        const on = event.target as HTMLElement;
        if (on.classList.contains('layout-placing-grip')) return;
        // Only where the press is not a mark's: cancelling it there would
        // take the press away from the button it is sitting on.
        if (!on.closest('button')) event.preventDefault();
        /**
         * **And the pointer is captured only once it moves** (§9af). Taking
         * capture here made the slide work and **stopped every mark working**:
         * a captured pointer retargets its events to the capturing element,
         * so the `click` the browser builds from the press landed on the box
         * rather than on the button under the hand, and ✗, ✓ and ＋ did
         * nothing at all. Driven: a fresh box could not be taken away by any
         * route. Capture is what a drag needs and a press does not.
         */
        press.current = { x: event.clientX, y: event.clientY, moved: false };
      }}
      onPointerMove={(event) => {
        const from = press.current;
        if (!from) return;
        if (!from.moved) {
          // A press that has not travelled is still a press (§9af): four
          // pixels is the slack a hand has on a button, and past it the
          // writer is moving the box.
          if (Math.abs(event.clientX - from.x) < 4 && Math.abs(event.clientY - from.y) < 4) return;
          from.moved = true;
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          setSliding(true);
        }
        onSlideTo(event.clientX, event.clientY);
      }}
      onPointerUp={() => {
        slid.current = press.current?.moved === true;
        press.current = null;
        setSliding(false);
      }}
      onPointerCancel={() => {
        press.current = null;
        setSliding(false);
      }}
      /* The help in the tooltip (addendum 09 §8a), which is also where the
         one thing Ken was frightened by belongs: a box in the text pushes the
         words it stands in front of down the book, and taking it away brings
         them back — *when I delete the box, all the text comes back*, which
         he worked out for himself with nothing on the screen saying it. */
      title="Drag to slide the box; the text runs round it as you go. Drag a corner to resize it. The words it stands in front of move down the book, and ✗ brings them back."
    >
      {/* What it measures, on the box (§9m, from Ken: *it should give you the
          specifications of its dimensions, so you can match your picture to
          it*). Read off the laid page every time, so it is the size the book
          will print rather than the size of the drag. */}
      <span className="layout-placing-size">{size}</span>
      {/* **What the page has just given up, before ✓ keeps it** (§9at, from
          Ken: *show a preview before committing that says whether the text
          will move*). §9d's live laying stays — it is his own *you can slide it
          around and watch the text move around it* — and what stands beside it
          now is the half a writer cannot see on the spread: whether the book
          got longer. Read off the laying rather than estimated, so it cannot
          claim a cost the page does not show. */}
      {note ? <span className="layout-placing-note">{note}</span> : null}
      {/* **The act that takes it away is not the one under the first finger**
          (§9af). ✗ stood leftmost, which is where a hand reaching for the
          middle-left of a box lands — so the one destructive mark on the
          screen was the one most easily pressed by somebody meaning to drag.
          The useful one comes first instead: an empty box wants a picture. */}
      <div className="layout-placing-marks">
        {/* A picture, from the box itself (§9m, from Ken: *there's nothing
            that allows you to actually put a graphic in the box area — it
            just says picture goes here*). It was in the inspector and behind
            the ✓, which is a press and a panel away from the thing on the
            screen that says it wants one. */}
        {empty ? (
          <button
            type="button"
            className="layout-placing-mark pick"
            aria-label="Put a picture in this box"
            title="Choose a picture from a file. It joins the graphics library and goes in this box."
            onClick={act(onPick)}
          >
            ＋
          </button>
        ) : null}
        <button type="button" className="layout-placing-mark keep" aria-label="Keep the box here" title="Keep the box here" onClick={act(onKeep)}>
          ✓
        </button>
        <button type="button" className="layout-placing-mark drop" aria-label="Take the box away" title="Take the box away" onClick={act(onDrop)}>
          ✗
        </button>
      </div>
      {[grip('nw', 'left', 'up'), grip('ne', 'right', 'up'), grip('sw', 'left', 'down'), grip('se', 'right', 'down')]}
    </div>
  );
}

/**
 * Where a figure sits in the book (§8, §8a): across the measure, cut into
 * the text at a side, or an **illustrated page** of its own inside the
 * story, on the left or the right of the spread.
 *
 * The box is **drawn on the page** (from Ken: *you draw a box and then the
 * text moves around the box*): pressing *Draw the box* puts the spread in
 * a drawing mode, and the rectangle says how much of the measure the
 * picture takes and which side it cuts in at. The picture keeps its own
 * proportions, so only the width and the side are read off the drag.
 */
/**
 * A page inside the story (§9h, from Ken: *if I want to add a picture on a
 * facing page, I should be able to click it, and the only thing that should be
 * in there is the ability to put graphics on that page, and the adjustments of
 * that graphic*).
 *
 * The room had no screen for one. A page of the story belongs to no record —
 * it is where the laying cut — so a press on it fell through to the chapter in
 * force, or to the part whose pages it sat among, and the writer's picture
 * landed on the chapter page or their typing changed the title page. This is
 * the missing screen, and it holds **pictures and nothing else**: what stands
 * on the page, and the two ways to put a picture on it. Where there is one
 * already, `FigureSection` below is the adjustments — the place, the side and
 * the width it has always had, reached from the page at last.
 */
function StoryPageSection({
  page,
  drawing,
  onPut,
  onPlacePicture,
  onDraw,
  onVector,
  onBlank,
  onChapterBack,
  onAddBlank,
  onRemovePage,
  place,
  nextPlace,
  chapterBack,
  rows,
  offer,
  remove,
  onFormat,
  format,
  divisions,
  openings,
  onDesign,
}: {
  page: BookPageRow;
  /**
   * What the book holds, in the format's own plural and lowercased (addendum
   * 22 §9) — read once by the room and handed down, because nothing names a
   * unit itself (addendum 16 §6c).
   */
  divisions: string;
  /** Where a picture or a leaf asked for on this page would go (§9r). */
  place: PagePlace;
  /** Whether this chapter's page already leaves its back blank. */
  chapterBack: boolean;
  /**
   * Every page of the book (§9w). The three reasons a page is blank, whether a
   * leaf may be asked for here and what a picture would do are all readings
   * over this list, so the screen holds no copy of any of them — it held one
   * of the first, as three branches of its own help text.
   */
  rows: readonly BookPageRow[];
  /** Whether a picture may be asked for here, and where it would land (§9w). */
  offer: PictureOffer;
  /** What a × on this page would take away, or why there is none (§9w, §9x). */
  remove: PageRemoval;
  /** The page after this one, so *after this page* has a record (§9an). */
  nextPlace: PagePlace | null;
  /** Take the page away — the same act the row's × runs (§9x). */
  onRemovePage(): void;
  drawing: boolean;
  onPut(): void;
  /** A picture into the words, chosen first and sized afterwards (§9at). */
  onPlacePicture(): void;
  onDraw(): void;
  onVector(): void;
  /** A blank leaf before this page, wherever it lands (§9r): an element, a part or a chapter. */
  /** How many of the writer's own leaves should stand there (§9ac). */
  onBlank(id: string, pages: number): void;
  /** A blank on the back of a chapter's own leaf (§9r). */
  onChapterBack(markerId: string, blank: boolean): void;
  /** One press for either side, the window's own act (§9an). */
  onAddBlank(side: BlankSide): void;
  /**
   * How the page is set (§9l, from Ken: *it should have all the graphic
   * buttons that let you format a page instantly and have all the options for
   * that page*). A chapter's own page where the page carries a chapter's
   * marker; the book's openings where it is a chapter inside a story, which
   * has no marker and so no page of its own to set.
   */
  onFormat(): void;
  /** What that button says, and null where the page has nothing to set. */
  format: string | null;
  /**
   * How openings look, set **here** rather than through a door (§9m, from Ken:
   * *set how openings look just gives you the book settings, and we need the
   * graphic dialogue buttons included in this menu*). A chapter inside a story
   * has no page of its own, so its look is the book's — and sending the writer
   * to Book settings for it took away the picture buttons they were standing
   * next to.
   */
  openings: ReactNode;
  /** Turn this blank leaf into a page of the book (§19). */
  onDesign(): void;
}) {
  /**
   * Whether a blank leaf may be asked for here, where it would go, and what a
   * press would do (§9r) — one reading over the three places it can land and
   * over the one case where a leaf already stands in front, so no screen holds
   * a second answer about either.
   */
  const blank = blankOffer(place, rows, page.sheet, nextPlace);
  /** What designing this page would do, or why it cannot be (§19, §9aq). */
  const design = designOffer(place, rows, page.sheet, divisions);
  /** The × asks once, inline, exactly as the row's does (§9x). */
  const [asking, setAsking] = useState(false);
  /** Which of the three reasons this page is blank (§9w), where it is. */
  const why = blankReason(rows, page.sheet);
  /** What stands on the page, in the rail's own words rather than a sentence. */
  const what = page.figureId ? 'a picture' : page.blank ? 'blank' : page.says === 'Chapter opens' ? 'a chapter opens' : null;
  return (
    <section className="layout-section layout-page-section">
      <h3>
        Page {page.counted}
        {what ? <span className="muted"> · {what}</span> : null}
        <Help label={`About page ${page.counted}`}>
          <span>
            {page.figureId
              ? 'A picture stands on it. How it sits is below.'
              : why
                ? // Three blank pages, three reasons, and only one of them the
                  // writer's — a page that says the wrong one is a page nobody
                  // can work out how to be rid of. The three used to be
                  // written out here; `blankReason` is the one place that
                  // knows, so the refusals can say them too (§9w).
                  //
                  // **And a leaf is a page you can put something on** (§9aa):
                  // the sentence said why it was there and stopped, under a
                  // screen that offered nothing, which read as a page nothing
                  // could be done to.
                  `It is blank because ${sayBlankReason(why, 'the leaf', divisions)}. It counts as a page and prints no number.${
                    offer.refusal ? '' : ' A picture put here fills this leaf rather than adding a page.'
                  }`
                : page.says === 'Chapter opens'
                  ? 'The chapter opens on it. A picture put here goes in before it, and the chapter moves down.'
                  : 'Story text. A picture put here goes in before the words on it, and they move down.'}{' '}
            The pictures here are this page’s alone.
          </span>
        </Help>
      </h3>
      {/* How the opening is set (§9l, §9m), **first** (§9ae, from Ken: *make
          the set this as a story page at the top of the dialog box*).

          It stood under the pictures, which is addendum 02 §4a's ordering
          argument the wrong way round: **what a page is comes before what you
          can put on it**, and on a page a story opens this is the one control
          that says what the page is. A chapter with a page of its own keeps
          the **button**, because that page has a sheet to be set against and a
          dialog that draws it. A chapter inside a story has no page, so its
          look is the book's — and that is rendered **here** rather than behind
          a door, the fields being the same component Book settings renders,
          never a second copy. */}
      {format ? (
        <div className="layout-page-acts layout-page-is">
          <button type="button" className="raised small" onClick={onFormat}>
            {format}
          </button>
        </div>
      ) : null}
      {page.figureId ? null : (
        <div className="layout-page-acts">
          {/* **Whether a picture may be put here is whether anything refuses
              it** (§9ab), never whether the offer names a record. A leaf among
              the front or back pages answers with a **position** and no
              `spot` — there is nothing on it to hang a picture from — so
              gating on the record drew no buttons at all on exactly the page
              Ken reported being locked out of, with the domain answering
              perfectly the whole time. */}
          {/* **A blank page the writer put in is a page of the book waiting
              to be one** (§19, from Ken: *on blank pages, I want this level of
              styling to where you can add a graphic at the top, you can add
              text in it, you can add a graphic at the bottom*).

              The leaf becomes a part, which is what gives it a template, a
              drop, a rule, an alignment, a face and its own words with none
              of them written a second time — and the book stays the length it
              is, `takePictureLeaf`'s own rule (§9ap).

              **And on every blank page, not only the writer's own** (§9aq,
              from Ken: *any blank page, I should be able to design the page.
              I didn't even get to look at that function. And now I can't find
              it*). One leaf asked for in front of a page the book holds on a
              right-hand side produces **two** blank pages — the writer's and
              the one the cutter then has to leave — and only the first had
              this button, with the second drawing nothing at all. §9al's rule
              answers it: where a rule holds the page, the act frees the
              rule. */}
          {design.refusal === null ? (
            <button type="button" className="small" onClick={onDesign}>
              Design this page…
            </button>
          ) : null}
          {/* **Printed once where the two agree** (§9aq). Both acts meet the
              same four rules and `sayBlankFreed` is one sentence about the
              **page**, so on a leaf the book was keeping blank this and the
              picture's note are the same words — and two near-identical notes
              one under the other under two buttons is §9an's own fault. What
              stands here is what designing does and the picture does not. */}
          {design.refusal === null && design.note && design.note !== offer.note ? (
            <p className="field-note">{design.note}</p>
          ) : null}
          {/* **Why this page cannot be one of yours** (§9aq). It drew nothing
              at all, which is what Ken reported after seeing the button once:
              on a page the book holds blank there was no control and no
              sentence, so the function he had just used read as gone. Nearly
              every blank page is designed now, so this is the narrow case the
              mechanism really cannot reach — and it says so. */}
          {design.refusal && page.blank ? <p className="muted small">{design.refusal}</p> : null}
          {!offer.refusal ? (
            <>
              <button type="button" className="small" onClick={onPut}>
                Full page picture…
              </button>
              {/* **A leaf takes a page of its own and nothing else** (§9aa).
                  A box is cut into the words and a graphic is set over them,
                  so on a page with no words both would ride a block that is
                  on the page ahead and draw there — §9w's own fault wearing
                  two more controls. Absent rather than greyed, the picture
                  above being what this page can have — **with the reason in
                  their place** (§9ap, from Ken: *I want to be able to add a
                  vector or a picture or have the same formatting as any other
                  page*), absence on a blank page having read as nothing
                  applying at all. */}
              {offer.ownPageOnly ? (
                <p className="muted small">{OWN_PAGE_ONLY_NOTE}</p>
              ) : (
                <>
                  {/* **The picture is chosen first, and then it is sized**
                      (§9at, from Ken: *maybe the best way is to insert a
                      picture on the page and then resize that picture to where
                      you want it to be… instead of trying to create a box
                      first, which it seems to cause errors*).

                      The act it runs is the one `importPicture` has had since
                      it was written and **no control on this panel called**:
                      the three here were a page of its own, an empty box and a
                      graphic over the page, so the one a writer asks for most —
                      a picture, in the words, chosen before anything is
                      dragged — was reachable from nowhere. It lands at the head
                      of the page with the handle already in hand, which is the
                      *then you can resize it with the corner pins* half. */}
                  <button type="button" className="small" onClick={onPlacePicture}>
                    Place a picture…
                  </button>
                  {/* **Named for the one thing only it can do** (§9at). It made
                      an empty box and was called *Draw a box for a picture…*,
                      which reads as the way to put a picture in — so a writer
                      took it, got a rectangle saying *Picture goes here*, and
                      had to find the ＋ on the handle to finish an act whose
                      label said it was already about a picture. §9ak kept this
                      route deliberately, for holding space before there is a
                      picture; its name says that now. */}
                  <button type="button" className={drawing ? 'small on' : 'small'} onClick={onDraw}>
                    {drawing ? 'Drawing the box…' : 'Hold space for a picture…'}
                  </button>
                  {/* A vector graphic (§8c, from Ken: *add a vector graphic …
                      anywhere on the page, and then they can resize that also.
                      But it has a transparent background*). */}
                  <button type="button" className="small" onClick={onVector}>
                    Add a vector graphic…
                  </button>
                </>
              )}
            </>
          ) : null}
          {/* **Where a picture asked for here will really land** (§9w): said
              before the press, because an empty leaf in front of the page is
              filled rather than added to, so the picture stands a page
              earlier — which from the writer's chair is the picture moving
              on its own. */}
          {offer.note ? <p className="muted small">{offer.note}</p> : null}
          {/* **Why there is no picture button** (§9w). §8c offered the vector
              graphic on every page, a blank leaf included, and the mechanism
              could not keep it: a leaf is where the cutter stopped, so there
              is nothing on it for a picture to stand before, and pressing
              put an art page at the back of the book.

              **Left to the design note where designing is on offer** (§9ar).
              On a blank page the picture's refusal *is* the design route, and
              the note under the button above has said *a picture, a few words,
              or both* since §19 — so printing both puts one fact on the screen
              twice, two sentences one under the other reading as two things to
              do (§9y). Where designing is refused — the end of the book, which
              keeps its own backwards answer — this still stands, which is the
              only place the two can differ. */}
          {offer.refusal && design.refusal !== null ? <p className="muted small">{offer.refusal}</p> : null}
          {/* **A blank page, and which side it goes on** (§9an, from Ken:
              *when I add a blank page, I need to be able to decide whether it
              goes after or before. So it'll have to ask you, enter a blank
              page before this page or after this page*).

              Until this there were two vocabularies over one field — a
              **sheet** named for what it put in and a **shift** named for
              what it did to the page in hand — and neither could say *after*.
              A writer standing on the last page of a story and asking for a
              leaf got one in front of those words, with the story's own
              ending pushed over the page, which is the report. The unit is a
              page now and the choice is the side; two of them make a sheet,
              which the note says.

              Each side is **absent with its own reason in its place** where
              it cannot be had, because the two reasons differ: the end of the
              book has no page after it, and a page the recto rule holds has a
              gap in front of it already. */}
          <span className="layout-shift">
            {blank.before.act ? (
              <button type="button" className="small" onClick={() => onAddBlank(blank.before)}>
                {blank.before.act}
              </button>
            ) : null}
            {blank.after.act ? (
              <button type="button" className="small" onClick={() => onAddBlank(blank.after)}>
                {blank.after.act}
              </button>
            ) : null}
            {/* **And never beside the page's own ×** (§9aq). On a leaf the
                writer put in, *Take the blank page away* and the *Take this
                page away* at the foot are the **same act** said twice — one
                named for the record and one for the page in hand — which is
                two answers to one question on a screen that is about this
                page. The × is the one that is about it, so it keeps the act
                here and this button stands only where the leaves are in
                front of the page rather than under it. */}
            {blank.fewer && blank.before.spot && !(page.blank && page.blankFor) ? (
              <button type="button" className="small" onClick={() => onBlank(blank.before.spot as string, blank.pages - 1)}>
                {blank.fewer}
              </button>
            ) : null}
          </span>
          {blank.before.note ? <p className="muted small">{blank.before.note}</p> : null}
          {blank.after.note && blank.after.note !== blank.before.note ? (
            <p className="muted small">{blank.after.note}</p>
          ) : null}
          {/* **The reason stands where the control would** (§9ae). Gating the
              sentence on the button took the refusal away with it, so a page
              the book holds on a side said nothing at all — *absent rather
              than greyed* is a rule about the control and never about the
              sentence that explains it, which is `pictureOffer`'s own finding
              (§9w). */}
          {!blank.before.act && blank.before.refusal && blank.before.refusal !== blank.refusal ? (
            <p className="muted small">{blank.before.refusal}</p>
          ) : null}
          {!blank.after.act && blank.after.refusal && blank.after.refusal !== blank.refusal ? (
            <p className="muted small">{blank.after.refusal}</p>
          ) : null}
          {/* **Not the fact said twice** (§9y). The refusal now carries a
              sentence where there is no leaf to be had, so the Add menu can
              grey its item with a reason in its title — and on a page with
              nothing of the book on it the picture above has just said the
              same thing about the same page. Where it has, this one is left
              off; where the refusal is the one about the leaf already in
              front, there is nothing above it and it stands.

              **And not on a leaf** (§9aa). *This page is blank already* under
              a button that puts a picture on it reads as a refusal of that
              button, and it is the heading's own word said a second time —
              the sentence is for the Add menu's title, where a greyed item
              needs a reason, and the ? above says why this page is blank.

              **And not under the note** (§9aa, measured on the screen). The
              two are set on the same condition — a leaf standing empty in
              front of this page — so where the picture has just named it and
              said which page it means, this one is that fact a second time in
              weaker words, which is §9y's own objection one sentence along. */}
          {blank.refusal && !offer.refusal && !offer.note && !page.blank ? (
            <p className="muted small">{blank.refusal}</p>
          ) : null}
          {/* **A blank on the chapter page's back** (§9r, Ken's own words).
              Absent where the chapter opens with its own first paragraph:
              there is no back to leave, the next page being the middle of the
              chapter, and a control that did something there would be doing
              what nobody could predict. */}
          {/* **A tick rather than a button that flips its words** (§9ab, from
              Ken: *for the back of the page in the dialog box, just make it a
              check mark so you know. And can toggle that on and off*). He is
              right, and it is addendum 02 §4a's switch exactly: a control
              whose label is the act it would perform says nothing about the
              state it is in, so a writer had to press it to find out — and
              pressing it is the one thing that changes the answer. Every
              other back-blank in the room has been a checkbox since it was
              written; this one was the odd one out. */}
          {place.opensMarkerId && place.opensAlone ? (
            <label className="field field-check layout-page-check">
              <input
                type="checkbox"
                aria-label="Leave the back of this page blank"
                checked={chapterBack}
                onChange={(event) => onChapterBack(place.opensMarkerId as string, event.target.checked)}
              />
              <span>Leave the back of this page blank</span>
            </label>
          ) : null}
        </div>
      )}
      {/*
        **Taking the page away** (§9x, from Ken twice: *there's no way to
        delete those pages* and *there's a stray page that has a bunch of
        information on it that I want to remove, but I can't remove it*).

        §9w put the × on the row alone and said the sentence here. That was
        half an answer: this dialog is the other place a writer stands when
        they want the page gone — he described it as *a very small dialogue
        box… put a picture, draw a box for a picture, add a vector graphic* —
        and it offered pictures and nothing else. It is the **same act** the
        row's × runs, read from the same `pageRemoval`, so the two cannot
        promise different things.
      */}
      {page.figureId ? null : (
        <div className="layout-page-acts layout-page-remove">
          {remove.act ? (
            asking ? (
              <span className="layout-ask">
                <span className="muted small layout-ask-why">{remove.comfort}</span>
                <button type="button" className="ghost small danger" onClick={onRemovePage}>
                  Remove
                </button>
                <button type="button" className="ghost small" onClick={() => setAsking(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="small danger" onClick={() => setAsking(true)}>
                {remove.act}
              </button>
            )
          ) : (
            <p className="muted small">{remove.refusal}</p>
          )}
        </div>
      )}
      {openings}
    </section>
  );
}

function FigureSection({
  figure,
  measureInches,
  holding,
  cutsInto,
  onPlace,
  onHandle,
  onFill,
  onBackBlank,
  onRemove,
}: {
  figure: BookFigure;
  /** The text block's width, for saying a drawn box in inches. */
  measureInches: number;
  /** Whether the handle is on this picture — it is being moved and resized (§9ak). */
  holding: boolean;
  /** Whether there are words after it for the text to run round it (§9ak). */
  cutsInto: boolean;
  onPlace(placement: BookFigurePlacement): void;
  /** Put the handle on it, or take it off (§9ak). */
  onHandle(): void;
  /** Put a picture in a box that has none yet (§9a). */
  onFill(): void;
  /** Ask for the leaf behind a picture page, or stop asking (§9i). */
  onBackBlank(blank: boolean): void;
  /** Take the picture out of the book (§9j). The library keeps the file. */
  onRemove(): void;
}) {
  const { place, span, standoff, side, boxHeight } = figure.placement;
  const backBlank = figure.backBlank;
  const cut = place === 'left' || place === 'right';
  const empty = figure.assetId === null;
  return (
    <section className="layout-section layout-figure">
      {/* The line under this heading described the picture the writer was
          looking at (§9m, from Ken: *under picture it's saying about the
          actual picture — I don't know if that's necessary*). What it said
          that the screen does not is behind the **?**. */}
      <h3>
        {empty ? 'An empty box' : figure.caption.trim() || figure.assetName || 'Picture'}
        <Help label="About this picture">
          <span>
            {empty
              ? 'The box holds its space on the page. Choose what goes in it below, or take hold of it to move it and resize it.'
              : `The manuscript prints it across the measure; the book puts it where you say.${figure.chapterTitle ? ` It is in ${figure.chapterTitle}.` : ''}`}
          </span>
        </Help>
      </h3>
      <label className="field">
        <span>Place</span>
        <select
          aria-label="Figure place"
          value={place}
          onChange={(event) => onPlace({ ...figure.placement, place: event.target.value as BookFigurePlacement['place'] })}
        >
          <option value="measure">Across the measure</option>
          <option value="left">Cut into the text, at the left</option>
          <option value="right">Cut into the text, at the right</option>
          <option value="page">A page of its own, inside the story</option>
          <option value="free">Set over the page, anywhere</option>
        </select>
      </label>
      {/*
        **How tall it is** (§9aj, from Ken: *what should happen is the picture
        and box are resized to fit that area… or the picture's resized to fit
        the box… or there needs to be an option that is scale box to fit
        picture at that size*).

        Those are his own two answers and they are two states of one field.
        A box drawn in the white under a short page's last paragraph is a
        height the writer chose, and §9z kept it only while the box was empty
        — the moment a picture arrived its own proportions took over, which on
        his book turned a 20-line hole into a 33-line one on a 35-line page.
        The box is kept now, so this says which of the two is wanted.

        **Absent where no box was drawn**, there being nothing to choose
        between: the picture's shape is the only answer a figure that was
        never drawn as a box has.
      */}
      {(place === 'measure' || cut) && boxHeight > 0 ? (
        <>
          <label className="field">
            <span>Height</span>
            <select
              aria-label="Figure height"
              value="box"
              onChange={(event) => {
                if (event.target.value === 'picture') onPlace({ ...figure.placement, boxHeight: 0 });
              }}
            >
              <option value="box">The box you drew — the picture fits inside it</option>
              <option value="picture">The picture’s own shape — the box grows to it</option>
            </select>
          </label>
          <p className="field-note">
            The box is {(boxHeight * measureInches).toFixed(2)} in tall. A picture that is not that shape sits inside it
            with the rest left clear; nothing of it is cut off.
          </p>
        </>
      ) : null}
      {/* A free graphic (§8c): a width that is a share of the **page** and
          nothing about the text, because it is not in the text's way. It is
          moved and resized on the spread, which is the gesture that shows
          where it will actually be. */}
      {place === 'free' ? (
        <>
          <label className="field">
            <span>Width, {Math.round(span * 100)}% of the page</span>
            <input
              type="range"
              aria-label="Graphic width"
              min={Math.round(FREE_SPAN.min * 100)}
              max={Math.round(FREE_SPAN.max * 100)}
              step={1}
              value={Math.round(span * 100)}
              onChange={(event) => onPlace({ ...figure.placement, span: Number(event.target.value) / 100 })}
            />
          </label>
          <p className="muted small">
            It stands over the page and moves nothing: no line is given up for it, and whatever the file leaves clear stays
            clear. Press <em>Move and resize it…</em> to drag it and take its corner.
          </p>
        </>
      ) : null}
      {place === 'page' ? (
        <>
          {/*
            **Which side of the leaf it falls on** (addendum 22 §9a, from Ken:
            *when I added the picture, it only would add it on the right-hand
            side of the page. I wanted the picture to be on page 66*).

            §9j took a *Which page* control out for a good reason — it asked a
            question the gesture had already answered, the picture going where
            it was put — and what was not noticed is that **ticking the back
            blank answers it instead**: that forced a right-hand page, so the
            one control a writer could reach moved the picture without saying
            so, and after §9j there was no way to ask for a left-hand page at
            all. This is the question §9j removed asked properly: not *which
            page*, which the press already said, but **which side of the
            paper**, which only the writer can.

            *Wherever it falls* is the default and is what every picture made
            before this stores, so no book moves.
          */}
          <label className="field">
            <span>Side of the leaf</span>
            <select
              aria-label="Which side of the leaf"
              value={side}
              onChange={(event) =>
                onPlace({ ...figure.placement, side: event.target.value as BookFigurePlacement['side'] })
              }
            >
              <option value="either">Wherever it falls</option>
              <option value="verso">A left-hand page</option>
              <option value="recto">A right-hand page</option>
            </select>
          </label>
          {/* The leaf behind it (§9i, from Ken: *you need to have an option
              for the back page to be blank, so the illustration doesn't bleed
              through*). It counts in the numbering and prints nothing, the
              same two facts as the picture page itself. */}
          <label className="field field-check">
            <input
              type="checkbox"
              aria-label="Leave the back of the page blank"
              checked={backBlank}
              onChange={(event) => onBackBlank(event.target.checked)}
            />
            <span>Leave the back of the page blank</span>
          </label>
          <p className="muted small">
            The picture fills the page, edge to edge, where it stands in the writing — no running head over it and no page number
            on it.
            {/* **Where the back is, is read off the side** (addendum 22
                §9a): a leaf is a recto and the verso behind it, so the back
                of a picture on a left-hand page is the page **in front** of
                it. The sentence used to say *right-hand* whatever was set,
                which is what made the override invisible. */}
            {backBlank
              ? side === 'verso'
                ? ' On a left-hand page the other side of the sheet is the page in front of it, so that is the one left empty; both count as pages and neither prints a number.'
                : ' It takes a right-hand page, so the empty leaf after it really is its back; both count as pages and neither prints a number. The words start again on the page after that.'
              : ''}
          </p>
        </>
      ) : null}
      {cut ? (
        <>
          <label className="field">
            <span>Width, {Math.round(span * 100)}% of the measure</span>
            <input
              type="range"
              aria-label="Figure width"
              min={Math.round(INSET_SPAN.min * 100)}
              max={Math.round(INSET_SPAN.max * 100)}
              step={5}
              value={Math.round(span * 100)}
              onChange={(event) => onPlace({ ...figure.placement, span: Number(event.target.value) / 100 })}
            />
          </label>
          {/* The border the text keeps around it (§8a, from Ken). */}
          <label className="field">
            <span>Border, {standoff.toFixed(1)} ems of clear space</span>
            <input
              type="range"
              aria-label="Border round the picture"
              min={Math.round(INSET_STANDOFF.min * 10)}
              max={Math.round(INSET_STANDOFF.max * 10)}
              step={1}
              value={Math.round(standoff * 10)}
              onChange={(event) => onPlace({ ...figure.placement, standoff: Number(event.target.value) / 10 })}
            />
          </label>
          {/* **The rule, from the domain** (§9ak, from Ken: *it has to be one
              of its borders aligned with the margin… and can only be as wide
              as half of the text area*). `INSET_RULE` is the one copy, so the
              sentence and the band cannot part company. */}
          <p className="field-note">{INSET_RULE}</p>
          {/* **And whether there is anything to run round it** (§9ak, measured
              on an imported collection). §8's rule is that an inset with no
              paragraph after it stands across the measure, which is right and
              was said nowhere — so a picture at the end of a chapter drew full
              width and the writer was left to conclude the side had not
              taken. */}
          {cutsInto ? (
            <p className="muted small">The text after it runs round the picture; a paragraph carrying one is never split across a page.</p>
          ) : (
            <p className="muted small">
              Nothing follows it for the words to run round, so it stands across the measure where it is. Move it up into the
              writing and the text will cut round it.
            </p>
          )}
        </>
      ) : null}
      {/* **How wide one across the measure is** (§9ak, from Ken: *if there is
          a blank lower half of the page, that you can drag and drop it in
          there and resize it and it won't touch the text*). It had no width
          at all, so a corner dragged on a picture standing in that white had
          nowhere to be written down. Narrowed, it is centred: flush to a
          margin is the rule for a picture the words run beside, and one
          standing alone is a plate in miniature. */}
      {place === 'measure' ? (
        <>
          <label className="field">
            <span>Width, {Math.round(span * 100)}% of the measure</span>
            <input
              type="range"
              aria-label="Picture width"
              min={Math.round(MEASURE_SPAN.min * 100)}
              max={Math.round(MEASURE_SPAN.max * 100)}
              step={5}
              value={Math.round(span * 100)}
              onChange={(event) => onPlace({ ...figure.placement, span: Number(event.target.value) / 100 })}
            />
          </label>
          <p className="muted small">
            The words stand above it and below it, never beside it, so nothing runs round it whatever its width. Narrower than
            the measure it is centred.
          </p>
        </>
      ) : null}
      <div className="layout-plate-pick">
        <button
          type="button"
          className="raised small"
          title="Choose a picture from a file. It joins the graphics library and goes in this box."
          onClick={onFill}
        >
          {empty ? 'Choose a picture…' : 'Another picture…'}
        </button>
        {/* **One gesture for every picture** (§9ak, from Ken). Where this
            read *Draw the box…* on a picture in the text, it reads what a
            free graphic's has read since §8c — the handle goes over the
            picture wherever the laying put it, and it is dragged and resized
            there. The corners keep its proportions; what the text does about
            it is read off where it lands. */}
        <button
          type="button"
          className={holding ? 'raised small selected' : 'raised small'}
          aria-pressed={holding}
          title="Drag it where it goes and take a corner to resize it; the picture keeps its proportions. Dropped in the white under the words it stands there and the text is left alone."
          onClick={onHandle}
        >
          {holding ? 'Moving it — drag on the page' : 'Move and resize it…'}
        </button>
      </div>
      <div className="layout-part-actions">
        {/* Taking the picture out (§9j, from Ken: *I need to be able to
            select the pictures on the page… or delete them*). Only the box
            goes: the picture stays in the graphics library, which is the same
            promise `removeBookFigure` has always kept. */}
        <button
          type="button"
          className="ghost small danger"
          title="Take this picture out of the book. The file stays in the graphics library."
          onClick={onRemove}
        >
          Delete
        </button>
      </div>
    </section>
  );
}

/**
 * The fonts the writer brought in (addendum 20 §6b, from Ken: *put an option
 * to import a font … so you can download a font and select it from a browse,
 * and add it to your fonts*).
 *
 * This is §12's open question answered from the other end — we do not ship
 * font files, and a writer who has licensed one can hand it to their own
 * book. **The file travels in the project**, which is the whole point: a
 * stack resolves to whatever is installed, and an imported face prints the
 * same on the next machine.
 *
 * Importing **never chooses the face**: bringing a font in and setting the
 * book in it are two decisions, and a book quietly re-set by a file dialog is
 * the worse surprise. The list says what to do next instead.
 */
function FontsSection({ file, onUpdate }: { file: ProjectFile; onUpdate: LayoutWindowProps['onUpdate'] }) {
  const fonts = bookFontsOf(file);
  const [trouble, setTrouble] = useState<string | null>(null);
  const settings = bookSettingsOf(file);
  const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
  return (
    <>
      <p className="muted small">
        A font you have downloaded and are licensed to use. It is kept in the project, so the book prints the same on
        another machine — which a font merely installed here cannot promise.
      </p>
      <label className="field">
        <span>Import a font file</span>
        <input
          type="file"
          aria-label="Font file"
          accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
          onChange={async (event) => {
            const chosen = event.target.files?.[0];
            event.target.value = '';
            if (!chosen) return;
            setTrouble(null);
            if (chosen.size > MAX_FONT_BYTES) {
              setTrouble(`That file is ${kb(chosen.size)}. A font is kept inside the project, so ${kb(MAX_FONT_BYTES)} is the most one can be.`);
              return;
            }
            const read = await readFont(chosen);
            let made = false;
            onUpdate((current) => {
              const added = addBookFont(current, {
                family: fontNameOf(chosen.name),
                fileName: chosen.name,
                format: fontFormatOf(chosen.name),
                data: read.data,
                bytes: read.bytes,
              });
              made = added.font !== null;
              return added.file;
            });
            if (!made) setTrouble('That file could not be read as a font.');
          }}
        />
      </label>
      {trouble ? <p className="layout-message small">{trouble}</p> : null}

      {fonts.length === 0 ? (
        <p className="muted small">None yet. A .ttf, .otf, .woff or .woff2 file.</p>
      ) : (
        <ul className="layout-parts">
          {fonts.map((font) => {
            const inUse = settings.face === faceOfFont(font);
            return (
              <li key={font.id} className="layout-rail-row">
                <div className="layout-part">
                  {/* Renaming is what the list is for: a file called
                      `EBGaramond-Regular.ttf` is *EB Garamond* in the book. */}
                  <input
                    className="layout-font-name"
                    aria-label={`Name for ${font.fileName || font.family}`}
                    value={font.family}
                    style={{ fontFamily: `'${font.family}'` }}
                    onChange={(event) => onUpdate((current) => renameBookFont(current, font.id, event.target.value))}
                  />
                  <span className="muted small">{kb(font.bytes)}</span>
                </div>
                <button
                  type="button"
                  className="ghost small"
                  disabled={inUse}
                  title={inUse ? 'The book is set in this one' : 'Set the book’s body text in this font'}
                  onClick={() => onUpdate((current) => setBookSettings(current, { face: faceOfFont(font) }))}
                >
                  {inUse ? 'In use' : 'Use it'}
                </button>
                <button
                  type="button"
                  className="layout-part-remove"
                  aria-label={`Remove ${font.family}`}
                  title="Take it out of the project. Anything set in it falls back to the book’s serif."
                  onClick={() => onUpdate((current) => removeBookFont(current, font.id))}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {fonts.length > 0 ? (
        <p className="muted small">
          {fonts.length === 1 ? 'One font' : `${fonts.length} fonts`}, {kb(fontBytes(fonts))} of the project. They are in
          the face lists above as well, for a heading or a running head. Embedding a font in a book you sell is a
          licensing question, and the licence is yours rather than ours.
        </p>
      ) : null}
    </>
  );
}

function TypeSection({ settings, write, noun }: { settings: BookSettings; write(patch: Partial<BookSettings>): void; noun: string }) {
  const preset = bookPresetOf(settings);
  return (
    <>
      {/* The three presets (§6): a whole style at once, and what is in force
          is read back from the fields rather than stored, so a change by
          hand reads as custom by itself. */}
      <label className="field">
        <span>Style</span>
        <select
          aria-label="Type style"
          value={preset ?? 'custom'}
          onChange={(event) => {
            const chosen = event.target.value;
            if (chosen === 'classic' || chosen === 'modern' || chosen === 'textbook') write(BOOK_PRESETS[chosen]);
          }}
        >
          {BOOK_PRESET_NAMES.map((name) => (
            <option key={name} value={name}>
              {PRESET_INFO[name].name} — {PRESET_INFO[name].about}
            </option>
          ))}
          {preset === null ? <option value="custom">Custom — set by hand below</option> : null}
        </select>
      </label>
      <label className="field">
        <span>Face</span>
        <select aria-label="Body face" value={settings.face} onChange={(event) => write({ face: event.target.value })}>
          {BOOK_FACES.map((face) => (
            <option key={face} value={face}>
              {FACE_NAMES[face]} — {FACE_NOTES[face]}
            </option>
          ))}
          {/* The writer's own, under the names we ship (§6b). */}
          {(settings.fonts ?? []).map((font) => (
            <option key={font.id} value={faceOfFont(font)}>
              {font.family} — your own
            </option>
          ))}
        </select>
      </label>
      <div className="layout-two">
        <label className="field">
          <span>Size, pt</span>
          <input
            type="number"
            step={0.5}
            min={8}
            max={14}
            aria-label="Body size in points"
            value={settings.size}
            onChange={(event) => write({ size: Number(event.target.value) || settings.size })}
          />
        </label>
        <label className="field">
          <span>
            Leading, pt <span className="muted">{settings.leading === null ? 'proposed' : 'typed'}</span>
          </span>
          <span className="layout-margin-row">
            <input
              type="number"
              step={0.5}
              min={8}
              max={30}
              aria-label="Leading in points"
              placeholder={String(Math.round(settings.size * 1.35 * 2) / 2)}
              value={settings.leading ?? ''}
              onChange={(event) => {
                const value = event.target.value.trim();
                write({ leading: value === '' ? null : Number(value) });
              }}
            />
            {settings.leading !== null ? (
              <button type="button" className="ghost small" aria-label="Propose the leading again" onClick={() => write({ leading: null })}>
                ×
              </button>
            ) : null}
          </span>
        </label>
      </div>
      <label className="field">
        <span>A {noun.toLowerCase()}’s first paragraph</span>
        <select aria-label={`${noun} opening paragraph`} value={settings.opening} onChange={(event) => write({ opening: event.target.value as BookSettings['opening'] })}>
          {OPENINGS.map((opening) => (
            <option key={opening} value={opening}>
              {OPENING_WORDS[opening]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Scene break ornament</span>
        <span className="layout-margin-row">
          <input
            aria-label="Scene break ornament"
            placeholder="a blank line"
            value={settings.ornament}
            onChange={(event) => write({ ornament: event.target.value })}
          />
          {['❦', '✦', '* * *', '~'].map((glyph) => (
            <button key={glyph} type="button" className="ghost small" onClick={() => write({ ornament: glyph })}>
              {glyph}
            </button>
          ))}
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.justify} onChange={(event) => write({ justify: event.target.checked })} /> Justify
        the lines
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.hyphenate} onChange={(event) => write({ hyphenate: event.target.checked })} />{' '}
        Hyphenate
      </label>
    </>
  );
}

/**
 * The title of the first division the book has, for the sentence below — the
 * words a right-hand top will actually print. Empty where the book has no
 * division yet, which the sentence says in words rather than inventing one.
 */
const firstDivisionTitle = (divisions: ReturnType<typeof contentsDivisions>): string => {
  const first = divisions[0];
  return first ? first.marker.title.trim() || first.label : '';
};

/**
 * **The division's own title, typed beside the book's** (§9y, from Ken: *just
 * underneath that, we need to have the story title or chapter. And you should
 * be able to type that in instead of trying to take it from the actual file
 * name*).
 *
 * He is right about where it belongs and right about why: an imported book is
 * named after its file **and so is each story in it**, so the right-hand top
 * printed `ken-harbour` with no way to say otherwise from the screen where the
 * top was chosen. §7c put the two tops beside the book's title because the
 * choice has to stand next to what it chooses between; the other title is the
 * other half of the same argument.
 *
 * It writes `updateMarker`, which is the title the chapter page prints, the
 * contents page lists and the rail shows — **one field with two doors**
 * (§16d), never a second string for the running head to read, which would be
 * two answers to what a story is called the moment either was edited.
 *
 * **It says which division it names.** A collection has a title per story and
 * the top carries whichever story the page is in, so a single box has to be
 * about one of them: it is the one the page in hand is in, named in the
 * sentence under it, with the others reached by turning to them. A box that
 * renamed whatever story happened to be first would be a control that acts on
 * something the writer is not looking at.
 *
 * And **it only claims the page in hand where there is one** — driving it
 * caught the first draft saying *the story the page in hand is in* with
 * nothing chosen at all, which is where a writer opening Book settings
 * straight after an import stands. With none it names the first story and
 * says so, which is true and is still enough to act on.
 *
 * Absent where the book has no division at all — there is no title to type
 * and nothing a top could carry, which `describeHeadTops` says in words one
 * row below.
 */
function DivisionTitleRow({
  divisions,
  divisionInHand,
  noun,
  onUpdate,
}: {
  divisions: ReturnType<typeof contentsDivisions>;
  divisionInHand: string | null;
  noun: string;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const placed = divisions.find((one) => one.marker.id === divisionInHand) ?? divisions[0];
  if (!placed) return null;
  const marker = placed.marker;
  /** Whether this is the division the page in hand is in, or the first by default. */
  const inHand = marker.id === divisionInHand;
  const named = marker.title.trim() || placed.label || 'Untitled';
  const word = noun.toLowerCase();
  return (
    <>
      <label className="field">
        <span>{`The ${word}’s title`}</span>
        <input
          aria-label={`${noun} title`}
          placeholder="Untitled"
          value={marker.title}
          onChange={(event) => onUpdate((current) => updateMarker(current, marker.id, { title: event.target.value }))}
        />
      </label>
      <p className="field-note">
        {divisions.length < 2
          ? `The title this ${word} prints on its own page, lists on the contents page and carries along the top.`
          : inHand
            ? `Names “${named}”, the ${word} the page in hand is in. Each ${word} carries its own title — turn to another and this names that one.`
            : `Names “${named}”, the first ${word}. Each ${word} carries its own title — choose a page in another and this names that one.`}
      </p>
    </>
  );
}

/**
 * **The two tops, one control each** (§7c, from Ken: *there's no way to
 * determine the title on one side or the other*).
 *
 * §7b read *another category* as a value in a list and answered with one
 * select naming both tops at once — which is the same shape as the thing he
 * reported, a single control that decides both sides. **Two sides are two
 * controls**: a left and a right, standing where the book's title is typed,
 * each naming the titles the book has in the format's own noun, with the
 * words box under whichever side carries the writer's own.
 *
 * It is **the pair itself**, moved rather than copied — the furniture fold no
 * longer holds a second one, because two folds offering the same choice is
 * exactly the confusion this is fixing.
 */
function HeadTopsRow({
  settings,
  write,
  noun,
  tops,
}: {
  settings: BookSettings;
  write(patch: Partial<BookSettings>): void;
  noun: string;
  tops: string;
}) {
  const setHeads = (patch: Partial<BookSettings['runningHeads']>) => write({ runningHeads: { ...settings.runningHeads, ...patch } });
  /** The words a side carries, named for the format rather than for a novel. */
  const contentWords = (one: (typeof HEAD_CONTENTS)[number]) =>
    one === 'chapter' ? `The ${noun.toLowerCase()}’s title` : HEAD_CONTENT_WORDS[one];
  const side = (which: 'verso' | 'recto') => {
    const carries = which === 'verso' ? settings.runningHeads.verso : settings.runningHeads.recto;
    const typed = which === 'verso' ? settings.runningHeads.versoText : settings.runningHeads.rectoText;
    const name = which === 'verso' ? 'Verso' : 'Recto';
    return (
      <div className="layout-head-side">
        <label className="field">
          <span>{which === 'verso' ? 'Top of left-hand pages' : 'Top of right-hand pages'}</span>
          <select
            aria-label={`${name} running head`}
            value={carries}
            onChange={(event) => setHeads({ [which]: event.target.value } as Partial<BookSettings['runningHeads']>)}
          >
            {HEAD_CONTENTS.map((one) => (
              <option key={one} value={one}>
                {contentWords(one)}
              </option>
            ))}
          </select>
        </label>
        {/* Absent rather than greyed: a box for words the page will not print
            is a control that lies about what it does. */}
        {carries === 'custom' ? (
          <label className="field">
            <span className="muted small">The words</span>
            <input
              type="text"
              aria-label={`${name} running head words`}
              value={typed}
              placeholder="What these pages should say"
              onChange={(event) => setHeads({ [`${which}Text`]: event.target.value } as Partial<BookSettings['runningHeads']>)}
            />
            <FieldChips
              noun={noun}
              onField={(field) => setHeads({ [`${which}Text`]: `${typed}${typed && !typed.endsWith(' ') ? ' ' : ''}${field}` } as Partial<BookSettings['runningHeads']>)}
            />
          </label>
        ) : null}
      </div>
    );
  };
  return (
    <>
      {/* No heading over them: the labels say *top* and *which side*, so one
          would be the fact said twice (addendum 33 §1's own finding), and the
          room's `h3` is a tracked-capitals shout under a fold head that is
          already one (§9n). */}
      <div className="layout-two">
        {side('verso')}
        {side('recto')}
      </div>
      <p className="field-note">{tops}</p>
    </>
  );
}

/**
 * **The fields a head or foot may carry**, as chips that type one in
 * (addendum 43 §10): the book's title, this division's, the author, the page,
 * the count and the date. Typed by hand they work the same; the chips are so
 * nobody has to know the braces.
 */
function FieldChips({ noun, onField }: { noun: string; onField(field: string): void }) {
  return (
    <span className="layout-field-chips" aria-label="Insert a field">
      {HEAD_FIELDS.map((one) => (
        <button key={one.field} type="button" className="ghost small" title={`Put ${one.field} in: printed as ${one.words.toLowerCase()}`} onClick={() => onField(one.field)}>
          {one.field === '{chapter}' ? `${noun}’s title` : one.words}
        </button>
      ))}
    </span>
  );
}

/**
 * **Heads and numbers by division** (addendum 43 §10, Ken's spec §6): each
 * chapter, part or section may carry its own tops and foot, carry them on its
 * opening page too, start its page numbers again, or number in roman. A row
 * is the contents page's own, so it names the division the way the book does.
 */
function SectionsSection({
  settings,
  rows,
  noun,
  onUpdate,
}: {
  settings: BookSettings;
  rows: readonly BookContentsRow[];
  noun: string;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const set = (id: string, patch: Partial<Omit<SectionLayout, 'id'>>) => onUpdate((current) => setSectionLayout(current, id, patch));
  if (rows.length === 0) return <p className="muted small">The book has no {noun.toLowerCase()}s or pages of its own yet.</p>;
  /**
   * **A head or the foot set to print nothing** (addendum 43 §21). Null is the
   * book's, empty words are nothing, and anything else is the division's own.
   * Which a box means is chosen beside it, so an empty box never has to stand
   * for two things; a box being typed in stays its own words while it is empty.
   */
  const [typing, setTyping] = useState<ReadonlySet<string>>(new Set());
  const heads = settings.runningHeads;
  /** What the division's own words start as: what the book prints there, as fields. */
  const seed = (line: 'verso' | 'recto' | 'foot'): string => {
    if (line === 'foot') return heads.foot.trim() || '{title}';
    const what = line === 'verso' ? heads.verso : heads.recto;
    const typed = (line === 'verso' ? heads.versoText : heads.rectoText).trim();
    const field = what === 'title' ? '{title}' : what === 'author' ? '{author}' : what === 'chapter' ? '{chapter}' : what === 'custom' ? typed : '';
    return field || '{chapter}';
  };
  return (
    <div className="layout-sections">
      <p className="muted small">
        Each {noun.toLowerCase()} takes the book’s heads, foot and numbering unless it is given its own here. An opening page stands clear of the heads and foot unless it asks for them.
      </p>
      {rows.map((row) => {
        const own = sectionLayoutOf(settings, row.id);
        const name = [row.label, row.title].filter(Boolean).join(' · ') || 'Untitled';
        const summary = own
          ? [
              own.verso === '' && own.recto === '' ? 'no heads' : own.verso !== null || own.recto !== null ? 'own heads' : '',
              own.foot === '' ? 'no foot' : own.foot !== null ? 'own foot' : '',
              own.headsOnOpening ? 'heads on its opening' : '',
              own.restart ? 'numbers restart' : '',
              own.numbering === 'roman' ? 'roman' : own.numbering === 'arabic' ? 'arabic' : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : 'as the book';
        const opened = openId === row.id;
        return (
          <div key={row.id} className={`layout-section-row${row.depth ? ' under' : ''}`}>
            <button type="button" className="ghost layout-section-name" aria-expanded={opened} onClick={() => setOpenId(opened ? null : row.id)}>
              <span>{name}</span>
              <span className="muted small">{summary}</span>
            </button>
            {opened ? (
              <div className="layout-section-body" aria-label={`Layout of ${name}`}>
                {(
                  [
                    ['verso', 'Top of left-hand pages', 'This division’s left-hand head'],
                    ['recto', 'Top of right-hand pages', 'This division’s right-hand head'],
                    ['foot', 'Running foot', 'This division’s running foot'],
                  ] as const
                ).map(([line, words, label]) => {
                  const value = own?.[line] ?? null;
                  const key = `${row.id}:${line}`;
                  const mode = value === null ? 'book' : value !== '' || typing.has(key) ? 'own' : 'nothing';
                  const typingOff = () =>
                    setTyping((current) => {
                      const next = new Set(current);
                      next.delete(key);
                      return next;
                    });
                  return (
                    <div key={line} className="field layout-section-line">
                      <span>{words}</span>
                      <select
                        aria-label={`What ${label.replace('This division’s ', 'its ')} prints`}
                        value={mode}
                        onChange={(event) => {
                          const chosen = event.target.value;
                          if (chosen === 'own') {
                            setTyping((current) => new Set(current).add(key));
                            set(row.id, { [line]: seed(line) });
                          } else {
                            typingOff();
                            set(row.id, { [line]: chosen === 'nothing' ? '' : null });
                          }
                        }}
                      >
                        <option value="book">As the book</option>
                        <option value="nothing">Nothing</option>
                        <option value="own">Its own words</option>
                      </select>
                      {mode === 'own' ? (
                        <input
                          type="text"
                          aria-label={label}
                          value={value ?? ''}
                          onFocus={() => setTyping((current) => new Set(current).add(key))}
                          onBlur={typingOff}
                          onChange={(event) => set(row.id, { [line]: event.target.value })}
                        />
                      ) : null}
                    </div>
                  );
                })}
                <p className="field-note">Fields work here too: {HEAD_FIELDS.map((one) => one.field).join(' ')}.</p>
                <label className="check">
                  <input type="checkbox" checked={own?.headsOnOpening ?? false} onChange={(event) => set(row.id, { headsOnOpening: event.target.checked })} /> Its opening page carries the heads and foot too
                </label>
                <label className="check">
                  <input type="checkbox" checked={own?.restart ?? false} onChange={(event) => set(row.id, { restart: event.target.checked })} /> Page numbers start again at its opening
                </label>
                <label className="field">
                  <span>Numbered</span>
                  <select
                    aria-label="This division’s numbering"
                    value={own?.numbering ?? 'book'}
                    onChange={(event) => set(row.id, { numbering: event.target.value === 'book' ? null : (event.target.value as 'roman' | 'arabic') })}
                  >
                    <option value="book">As the book</option>
                    <option value="arabic">1, 2, 3</option>
                    <option value="roman">i, ii, iii</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The running heads and the folios (§7a, from Ken: *the running headers and
 * footers need to be adjustable*). There used to be four dropdowns and a
 * sentence saying nothing about them could be typed; all three lines are set
 * here now, the same `Line` control the chapter page uses.
 *
 * **Which title each side carries is no longer here** (§7c): it is a question
 * about the book's titles rather than about type, so it stands beside them in
 * *The book*, and a second copy in this fold would be a second place to make
 * one choice. What is left is how they are set and where they sit, with one
 * sentence saying what they will print so the fold that styles them is not
 * blind to them.
 */
function FurnitureSection({
  settings,
  write,
  noun,
  nounPlural,
  tops,
  separates,
}: {
  settings: BookSettings;
  write(patch: Partial<BookSettings>): void;
  noun: string;
  nounPlural: string;
  tops: string;
  /** Whether this book holds whole works, and so has anything to separate. */
  separates: boolean;
}) {
  const heads = settings.runningHeads;
  const style = runningHeadStyleOf(settings);
  const setHeads = (patch: Partial<BookSettings['runningHeads']>) => write({ runningHeads: { ...heads, ...patch } });
  const setLine = (which: 'verso' | 'recto' | 'folio', patch: Partial<LineStyle>) =>
    write({ runningHeadStyle: { ...style, [which]: { ...style[which], ...patch } } });
  return (
    <>
      {/* The one reading of what the two tops will print, the same sentence
          *The book*'s pair carries — said rather than set, because the choice
          itself belongs where the titles are. It opens the fold rather than
          annotating a control, so it wears the lead-in's class and not
          `.field-note`, which is tucked against the field above it. */}
      <p className="muted small">
        {tops} Which title each side carries is chosen in <em>The book</em>, above.
      </p>
      <div className="layout-two">
        <label className="field">
          <span>Running heads sit</span>
          <select
            aria-label="Running head place"
            value={heads.place}
            onChange={(event) => setHeads({ place: event.target.value as BookSettings['runningHeads']['place'] })}
          >
            {HEAD_PLACES.map((place) => (
              <option key={place} value={place}>
                {HEAD_PLACE_WORDS[place]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Page number</span>
          <select aria-label="Page number place" value={settings.folio} onChange={(event) => write({ folio: event.target.value as BookSettings['folio'] })}>
            {FOLIO_PLACES.map((place) => (
              <option key={place} value={place}>
                {FOLIO_PLACE_WORDS[place]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* The running foot (addendum 43 §10, Ken's spec §6): a line at the
          foot of every text page, typed with the fields the chips put in. */}
      <div className="layout-two">
        <label className="field">
          <span>Running foot</span>
          <input
            type="text"
            aria-label="Running foot"
            value={heads.foot}
            placeholder="Nothing, or e.g. {title} · page {page} of {pages}"
            onChange={(event) => setHeads({ foot: event.target.value })}
          />
        </label>
        <label className="field">
          <span>The foot sits</span>
          <select aria-label="Running foot place" value={heads.footPlace} onChange={(event) => setHeads({ footPlace: event.target.value as BookSettings['runningHeads']['footPlace'] })}>
            {HEAD_PLACES.map((place) => (
              <option key={place} value={place}>
                {HEAD_PLACE_WORDS[place]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FieldChips noun={noun} onField={(field) => setHeads({ foot: `${heads.foot}${heads.foot && !heads.foot.endsWith(' ') ? ' ' : ''}${field}` })} />
      <label className="field">
        <span>Set in</span>
        <select
          aria-label="Running head face"
          value={style.face}
          onChange={(event) => write({ runningHeadStyle: { ...style, face: event.target.value as (typeof PART_FACES)[number] } })}
        >
          {PART_FACES.map((face) => (
            <option key={face} value={face}>
              {face === 'book' ? 'The book’s face' : FACE_NAMES[face]}
            </option>
          ))}
        </select>
      </label>
      <Line label="Left-hand head" style={style.verso} onPatch={(patch) => setLine('verso', patch)} />
      <Line label="Right-hand head" style={style.recto} onPatch={(patch) => setLine('recto', patch)} />
      {settings.folio !== 'none' ? <Line label="Page number" style={style.folio} onPatch={(patch) => setLine('folio', patch)} /> : null}
      <label className="check">
        <input type="checkbox" checked={settings.folioOnOpening} onChange={(event) => write({ folioOnOpening: event.target.checked })} />{' '}
        A {noun.toLowerCase()} opening shows its number
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.chaptersOpenRecto} onChange={(event) => write({ chaptersOpenRecto: event.target.checked })} />{' '}
        Every {noun.toLowerCase()} opens on a right-hand page
      </label>
      {/*
        **A full blank sheet between one work and the next** (addendum 22 §9,
        from Ken: *between stories, there needs to be a full blank sheet*).

        It stands beside the recto rule because they are the two things that
        decide what a reader meets at a division, and only together: the recto
        rule puts the opening on a right-hand page and may leave the verso in
        front of it empty, which is a *gap* rather than a separation — one
        blank side with the previous story printed on its back. This is a
        sheet, so both sides are empty, and being two pages it cannot change
        which side anything after it falls on.
      */}
      {separates ? (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.sheetBetweenWorks}
              onChange={(event) => write({ sheetBetweenWorks: event.target.checked })}
            />{' '}
            A blank sheet between {nounPlural.toLowerCase()}
          </label>
          <p className="field-note">
            Both sides of one leaf, so the reader turns a page with nothing on it. The first {noun.toLowerCase()} gets none — the front
            matter already stands in front of it.
          </p>
          {/*
            **And one at the end of the last** (§9ao, from Ken: *yes, make that
            end-of-story page automatic*). The same sheet said at the other
            end, so it stands immediately under its own pair rather than
            somewhere else in the fold.
          */}
          <label className="check">
            <input type="checkbox" checked={settings.sheetAfterWorks} onChange={(event) => write({ sheetAfterWorks: event.target.checked })} />{' '}
            A blank sheet after the last {noun.toLowerCase()}
          </label>
          <p className="field-note">
            Between the {nounPlural.toLowerCase()} and the back matter, so the reader knows the last one has ended. There is none where the
            book has no back matter — a blank sheet at the very end separates nothing.
          </p>
        </>
      ) : null}
      <p className="muted small">
        A head carrying the book or its {nounPlural.toLowerCase()} reads its words from them; what the book is called, and by whom, is under{' '}
        <em>The book</em> above. A head keeps a quarter inch clear of the paper’s edge whatever is set here, or the printer’s trim would take it off.
      </p>
    </>
  );
}

function PartFields({
  file,
  part,
  onUpdate,
  onDone,
  rows = [],
}: {
  file: ProjectFile;
  part: BookPart;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onDone(): void;
  /** The laid pages, so the blank leaf's offer can see what is in front (§9r). */
  rows?: readonly BookPageRow[];
}) {
  const info = PART_INFO[part.kind];
  const blank = partBlankOffer(rows, part);
  const library = graphicsInOrder(file);
  const chapters = contentsDivisions(file);
  const [asking, setAsking] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const picturePicker = useRef<HTMLInputElement>(null);
  const patch = (fields: Partial<Omit<BookPart, 'id' | 'kind'>>) => onUpdate((current) => updatePart(current, part.id, fields));
  /**
   * A plate's picture straight from a file (§9, from Ken: *can't we just
   * find the picture and load it?*). It goes into the graphics library —
   * the one place the book's pictures live, reachable from Research ▸
   * Graphics — and the plate takes it in the same act, so a writer with a
   * picture on disk never has to know the library exists to use one.
   */
  const takePicture = async (picked: File | undefined) => {
    setPictureError(null);
    if (!picked) return;
    const no = pictureRefusal(picked);
    if (no) {
      setPictureError(no);
      return;
    }
    try {
      const read = await readPicture(picked);
      const partId = part.id;
      onUpdate((current) => {
        const added = addGraphic(current, { name: picked.name, ...read });
        return updatePart(added.file, partId, { assetId: added.asset.id });
      });
    } catch {
      setPictureError('That file could not be read.');
    }
  };
  return (
    <section className="layout-section layout-part-fields">
      <h3>{info.name}</h3>
      <p className="muted small">{info.note}.</p>
      {/* **A blank leaf before this page** (§9r, from Ken: *you should be
          able to enter a blank page wherever you want*). Here as well as on
          the page's own screen, because this is the panel a part shows when
          it is chosen in the rail — which is where a writer reaches for it,
          and where §9r found the act had no answer at all. It reads the
          **offer** rather than toggling the field: a leaf asked for where the
          cutter has already left one is absorbed, and a control that did that
          silently is the fault this was written to stop. */}
      {blank.before.act ? (
        <button
          type="button"
          className="ghost small layout-part-blank"
          onClick={() => patch({ blankBefore: blank.pages + 1 })}
        >
          {blank.before.act}
        </button>
      ) : null}
      {/* **And one after it where this page ends the book** (§9ao, from Ken:
          *I can't put a page after the end once I remove it*).

          This panel is the only screen a writer can reach for the **last page
          of the book**: a part with nothing under it but the page its own row
          names has no page row at all (§17e), so that page cannot be
          double-clicked or chosen, and the refusal that used to stand here
          named a screen with no route to it. There is one position after the
          end and the **book** is its record, so the act is the general one
          rather than a write to this part's field. */}
      {blank.after.act && blank.after.spot ? (
        <button
          type="button"
          className="ghost small layout-part-blank"
          onClick={() => {
            const spot = blank.after.spot as string;
            onUpdate((current) => setBlankPages(current, spot, blankPagesAt(current, spot) + 1));
          }}
        >
          {blank.after.act}
        </button>
      ) : null}
      {/* **And one fewer** (§9ac): it is a count rather than a switch, so the
          `aria-pressed` went with it — a control that adds one more is not in
          a state, and the number standing there is said by the two buttons. */}
      {blank.fewer ? (
        <button
          type="button"
          className="ghost small layout-part-blank"
          onClick={() => patch({ blankBefore: blank.pages - 1 })}
        >
          {blank.fewer}
        </button>
      ) : null}
      {blank.before.note ? <p className="muted small">{blank.before.note}</p> : null}
      {blank.after.note && blank.after.note !== blank.before.note ? <p className="muted small">{blank.after.note}</p> : null}
      {/* **A part has a front and no back** (§9an): *after this page* needs to
          know which page of the part a writer is looking at, which a part does
          not, so the refusal names the screen that does. */}
      {!blank.before.act && blank.before.refusal ? <p className="muted small">{blank.before.refusal}</p> : null}
      {blank.after.refusal ? <p className="muted small">{blank.after.refusal}</p> : null}
      {/* **The half title and the title page never arrive here either**
          (§9u). `partPlacement` calls both a block, so both have gone to the
          designed-page screen since §9n — and this panel went on holding a
          second set of fields for them, reachable from the column, which is
          the two-answers fault that screen was built to end. It was the
          column that kept them alive; the column is gone. */}
      <label className="field">
        <span>Heading</span>
        <input aria-label="The part's heading" placeholder={partHeading({ ...part, title: '' }, file)} value={part.title} onChange={(event) => patch({ title: event.target.value })} />
      </label>
      {/* A copyright page never arrives here (§15c): it opens its own screen,
          and with the inspector gone (§9u) this panel is `PartDialog`'s alone,
          which the copyright page does not reach. The button through to that
          screen went with the column that held the only route to it. */}
      {info.carries === 'text' && !(part.kind === 'copyright' && copyrightOf(part)) ? (
        <label className="field">
          <span>Text</span>
          <CitableText
            file={file}
            onUpdate={onUpdate}
            aria-label="The part's text"
            rows={part.kind === 'dedication' || part.kind === 'epigraph' || part.kind === 'copyright' ? 6 : 14}
            placeholder={part.kind === 'copyright' ? `Copyright © ${file.project.author}` : 'A blank line between paragraphs.'}
            value={part.text}
            onChange={(text) => patch({ text })}
          />
        </label>
      ) : null}
      {/* The page as a piece of art, brought in whole (§8, from Ken: *the
          title page also needs to be able to take a full page piece of art*).
          Every **designed** page takes one — a dedication and an epigraph
          among them (§7a) — because the words are in the picture whichever
          page it is, and the print draws all four the same way. */}
      {partHasStyle(part.kind) ? (
        <>
          <input
            ref={picturePicker}
            type="file"
            accept={PICTURE_ACCEPT}
            aria-label="Title art file"
            hidden
            onChange={(event) => {
              void takePicture(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="layout-plate-pick">
            <button type="button" className="raised small" title="A picture that is the whole page, edge to edge, with the words in it; it joins the book's pictures under Research ▸ Graphics" onClick={() => picturePicker.current?.click()}>
              {part.assetId ? 'Import other full page art…' : 'Import full page art…'}
            </button>
            {part.assetId ? (
              <button type="button" className="ghost small danger" onClick={() => patch({ assetId: null })}>
                Set the words instead
              </button>
            ) : null}
            {pictureError ? (
              <span className="error small" role="alert">
                {pictureError}
              </span>
            ) : null}
          </div>
          {part.assetId ? <p className="muted small">The art is the page: nothing is set over it, the words being in the picture.</p> : null}
        </>
      ) : null}
      {partHasStyle(part.kind) ? <PageStyle part={part} file={file} onUpdate={onUpdate} /> : null}
      {info.carries === 'reading' && part.kind !== 'half_title' && part.kind !== 'title_page' ? (
        <p className="muted small">Read from the book every time; there is nothing to type on it.</p>
      ) : null}
      {info.carries === 'plate' ? (
        <>
          <input
            ref={picturePicker}
            type="file"
            accept={PICTURE_ACCEPT}
            aria-label="Plate picture file"
            hidden
            onChange={(event) => {
              void takePicture(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <div className="layout-plate-pick">
            <button type="button" className="raised small" title="A picture from a file on this computer; it joins the book's pictures under Research ▸ Graphics" onClick={() => picturePicker.current?.click()}>
              {part.assetId ? 'Choose another picture…' : 'Choose a picture…'}
            </button>
            {pictureError ? (
              <span className="error small" role="alert">
                {pictureError}
              </span>
            ) : null}
          </div>
          <label className="field">
            <span>{library.length > 0 ? 'Or one already in the book' : 'Pictures already in the book'}</span>
            <select aria-label="Plate picture" value={part.assetId ?? ''} onChange={(event) => patch({ assetId: event.target.value || null })}>
              <option value="">{library.length === 0 ? 'None yet — choose a picture above' : 'Choose one…'}</option>
              {library.map((asset) => (
                <option key={asset.id as string} value={asset.id as string}>
                  {asset.name || asset.caption || 'Untitled'}
                </option>
              ))}
            </select>
          </label>
          <p className="muted small">
            The picture is the page, edge to edge: a title page or an index made as a piece of art carries its own words. The book’s pictures are kept under
            Research ▸ Graphics.
          </p>
          <label className="field">
            <span>Description</span>
            <input
              aria-label="Art page description"
              placeholder="For a reader who cannot see it; prints nowhere"
              value={part.caption}
              onChange={(event) => patch({ caption: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Where</span>
            {/* Three places, one control: the front matter, the back, or
                facing a chapter — the same page wherever it goes. */}
            <select
              aria-label="Plate place"
              value={part.beforeMarkerId ?? (part.inFront ? 'front' : 'back')}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'front') patch({ inFront: true, beforeMarkerId: null });
                else if (value === 'back') patch({ inFront: false, beforeMarkerId: null });
                else patch({ beforeMarkerId: value });
              }}
            >
              <option value="front">In the front matter</option>
              <option value="back">At the back</option>
              {chapters.map((placed) => (
                <option key={placed.marker.id as string} value={placed.marker.id as string}>
                  Before {placed.label}
                  {placed.marker.title.trim() ? ` — ${placed.marker.title}` : ''}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
      <div className="layout-part-tools">
        <button type="button" className="ghost small" aria-label="Move the part up" onClick={() => onUpdate((current) => movePart(current, part.id, -1))}>
          ↑
        </button>
        <button type="button" className="ghost small" aria-label="Move the part down" onClick={() => onUpdate((current) => movePart(current, part.id, 1))}>
          ↓
        </button>
        {asking ? (
          <span className="layout-ask">
            <span className="small">Remove {partTitle(part)}?</span>
            <button
              type="button"
              className="ghost small danger"
              onClick={() => {
                onUpdate((current) => removePart(current, part.id));
                onDone();
              }}
            >
              Remove
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="ghost small" onClick={() => setAsking(true)}>
            Remove…
          </button>
        )}
        <span className="toolbar-spacer" />
        <button type="button" className="ghost small" onClick={onDone}>
          Done
        </button>
      </div>
    </section>
  );
}

/**
 * How a designed page is set (§9, from Ken: *options for different
 * templates, a way to redo the wording and the fonts, and stylize the
 * page*): a template for where the block sits, a face, the title's line
 * and the lines under it, and a rule — the chapter page's controls pointed
 * at this one page. The template is read back from the placement, never
 * stored, so a hand change reads as *Custom* by itself.
 */
/**
 * **Exported so the body-type walk can reach it** (§18, read a second time).
 * §18's own surfaces test said it walked *every* dialog that takes body text
 * and walked three, this panel — the one the front matter's prose pages and
 * the two that flow actually open — being the fourth and the one Ken's report
 * came off. `ChapterStyleFields`' own reason: a control a test cannot render
 * is a control the next change forgets.
 */
export function PageStyle({ part, file, onUpdate }: { part: BookPart; file: ProjectFile; onUpdate(mutate: (current: ProjectFile) => ProjectFile): void }) {
  /* A prose part starts as the book's own — its chapter opening for the
     heading, its body for the words (§7a) — so the controls open on what the
     page already prints and every field is an override of it. The print
     resolves the same way, so the screen and the page agree. */
  const base = proseStyleBase(chapterPageStyleSchema.parse(file.settings.chapterPageStyle ?? {}), bookSettingsOf(file).size);
  const style = partStyleOf(part, base);
  const template = partTemplateOf(style);
  const words = part.kind === 'dedication' || part.kind === 'epigraph';
  /* Where a designed page sits is what the page **is** rather than a choice
     (§7a), so the template and the drop are absent on the two that are not a
     block of words on a page: the copyright page hangs at the foot, and the
     contents and the index flow over as many pages as they need. */
  const placement = partPlacement(part.kind);
  const atFoot = placement === 'foot';
  const flows = placement === 'flows';
  /* A prose part — a foreword, an afterword, *About the author*: a heading at
     the head and paragraphs running on under it, so there is no block to
     place either, and what is set is the heading and the words. */
  const prose = placement === 'prose';
  const partId = part.id;
  const write = (patch: Partial<PartStyle>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      return updatePart(current, partId, { style: { ...partStyleOf(now, base), ...patch } });
    });
  return (
    <section className="layout-section layout-page-style">
      <h3>Page style</h3>
      {atFoot ? (
        <p className="muted small">This page hangs at the foot, where a copyright page goes. Everything else about it is set here.</p>
      ) : null}
      {flows ? (
        <p className="muted small">
          {part.kind === 'contents' ? 'The contents run' : 'The index runs'} to as many pages as {part.kind === 'contents' ? 'they need' : 'it needs'}, so there is nowhere to place a
          block: the heading stands at the head and the entries follow. Everything else about it is set here.
        </p>
      ) : null}
      {prose ? (
        <p className="muted small">
          The heading stands at the head of the page and the words run on under it, for as many pages as they take — so there is
          nowhere to place a block. This page starts as the book’s own; anything set here is this page’s alone.
        </p>
      ) : null}
      {/* The **title page's** placement is a pair of heights (§16) — where
          the title sits and where the author does — and this select offers
          the one-height templates the other block pages use, so on this page
          it could only disagree with the three arrangements. Absent rather
          than greyed, with the way through said. */}
      {part.kind === 'title_page' ? (
        <p className="muted small">
          Where the title and the author sit is set on the page’s own screen: the two heights are one arrangement, and half of
          one here could only disagree with it.
        </p>
      ) : null}
      {atFoot || flows || prose || part.kind === 'title_page' ? null : (
      <>
      <label className="field">
        <span>Template</span>
        <select
          aria-label="Page template"
          value={template ?? 'custom'}
          onChange={(event) => {
            const chosen = event.target.value as PartTemplate | 'custom';
            if (chosen !== 'custom') write(partTemplatePatch(chosen));
          }}
        >
          {PART_TEMPLATES.map((one) => (
            <option key={one} value={one}>
              {PART_TEMPLATE_WORDS[one].name}
            </option>
          ))}
          {template === null ? <option value="custom">Custom — placed by hand</option> : null}
        </select>
      </label>
      <p className="muted small">{template ? PART_TEMPLATE_WORDS[template].says : 'Where the block sits was set by hand below; choose a template to place it again.'}</p>
      <label className="field">
        <span>Down the page · {style.drop}%</span>
        <input type="range" min={0} max={80} step={2} aria-label="How far down the page" value={style.drop} onChange={(event) => write({ drop: Number(event.target.value) })} />
      </label>
      </>
      )}
      <label className="field">
        <span>{flows || prose ? 'The heading, ranged' : 'Ranged'}</span>
        <select aria-label="Page alignment" value={style.align} onChange={(event) => write({ align: event.target.value as PartStyle['align'] })}>
          <option value="left">Left</option>
          <option value="center">Centred</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="field">
        <span>Face</span>
        <select aria-label="Page face" value={style.face} onChange={(event) => write({ face: event.target.value as PartStyle['face'] })}>
          {PART_FACES.map((one) => (
            <option key={one} value={one}>
              {one === 'book' ? 'The book’s own face' : `${FACE_NAMES[one]} — ${FACE_NOTES[one]}`}
            </option>
          ))}
        </select>
      </label>
      <Line
        label={atFoot ? 'The small print' : flows || prose ? 'The heading' : words ? 'The first line' : 'Title'}
        style={style.title}
        onPatch={(patch) => write({ title: { ...style.title, ...patch } })}
      />
      {/* The lines under it (§7a, from Ken: *the epigraph and dedication pages
          need the same style options*). They were the title page's alone, so an
          epigraph's attribution and a dedication's second line could not be set
          apart from the words above them. They start as those words, so a page
          made before this is unchanged. On a page that flows they are the
          entries under the heading, which is the same pair said of a list. */}
      {/* **And the body text is settable here too** (§18, read a second time
          from Ken: *on all the back matter and front matter, we need to be
          able to where there's a heading and a text box. The text box needs to
          be able to be centered or justified to the right or left also*).

          §18 gave the alignment and the face to the three screens it walked
          and **this is the fourth** — the panel a foreword, a preface, an
          introduction, a prologue, an epilogue, an afterword, the contents and
          the index open, which is most of the front matter and the pages its
          own test never asked about. The `Ranged` select above is the
          **heading's**, so a writer who pressed it watched the heading move
          and correctly concluded the words could not be ranged at all. */}
      {part.kind === 'title_page' || words || flows || prose ? (
        <>
          <Line
            label={flows ? 'The entries' : prose ? 'The words' : 'Lines under it'}
            style={style.line}
            align
            fonts={bookFontsOf(file)}
            onPatch={(patch) => write({ line: { ...style.line, ...patch } })}
          />
          <p className="field-note">
            Left alone, {flows ? 'the entries take' : 'the words take'} the page’s own face and the way the book ranges its text.
          </p>
        </>
      ) : null}
      {/* The letter dividers (§7a, from Ken: *separate out the letter
          dividers*). An index's A and B are a third kind of line rather than
          a bold entry, and the index is the only page that has any. */}
      {partHasDividers(part.kind) ? (
        <Line label="The letter dividers" style={style.divider} onPatch={(patch) => write({ divider: { ...style.divider, ...patch } })} />
      ) : null}
      {words ? <p className="muted small">The first line of the text is the words; anything under it — an attribution, a second line — is set by the pair above.</p> : null}
      <label className="check">
        <input type="checkbox" aria-label="A rule under the title" checked={style.rule} onChange={(event) => write({ rule: event.target.checked })} />
        <span>A rule under the {atFoot ? 'small print' : flows || prose ? 'heading' : words ? 'words' : 'title'}</span>
      </label>
      <button type="button" className="ghost small" onClick={() => onUpdate((current) => updatePart(current, partId, { style: {} }))}>
        Back to the page’s own look
      </button>
    </section>
  );
}
