import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  runningHeadStyleOf,
  OPENINGS,
  PART_INFO,
  TRIM_PRESETS,
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
  partToHalf,
  addBookNumber,
  beginCopyright,
  copyrightLines,
  copyrightOf,
  describeCopyright,
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
  placePart,
  removePart,
  removePartInset,
  setChapterPage,
  setTitlePage,
  updatePartInset,
  type BookFigurePlacement,
  type LineStyle,
  type PartInset,
  type PartStyle,
  type PartTemplate,
  type StoryMarkerId,
  renderBookHtml,
  renderBookPage,
  setBookSettings,
  trimPresetOf,
  updatePart,
  type BookPage,
  type BookPart,
  type BookSettings,
  type PartKind,
  type ProjectFile,
  isCollection,
  nounsFor,
  chapterLeafContent,
  BOOK_PRESET_NAMES,
  BOOK_PRESETS,
  INSET_SPAN,
  FREE_SPAN,
  INSET_STANDOFF,
  PRESET_INFO,
  bookFigures,
  bookPresetOf,
  bookRows,
  moveFigureBefore,
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
  plateIntoStory,
  type BookPageRow,
  placeBookFigure,
  placeFigure,
  removeBookRow,
  setBackBlank,
  setBlankBefore,
  setFigurePicture,
  whatGoesWithRow,
  type BookFigure,
  type BookRow,
  type PagePlace,
} from '@vcwriter/domain';
import { readFont } from '../read-font';
import { PopOutButton } from './PopOutButton';
import { ChapterPageDialog, ChapterStyleFields, Line } from './ChapterPageDialog';
import { ChapterLayoutDialog } from './ChapterLayoutDialog';
import { CopyrightPageDialog } from './CopyrightPageDialog';
import { DesignedPageDialog } from './DesignedPageDialog';
import { useModal } from '../use-modal';
import { usePreference, useSplit } from '../use-split';
import { readPicture } from '../read-picture';
import { useBookLaying, type Laying } from '../book-typeset';

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
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Take the room to a window of its own (addendum 02 §8). Absent in one. */
  onPopOut?(): void;
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
type ArtTarget =
  | { kind: 'front' }
  | { kind: 'back' }
  | { kind: 'before'; markerId: string }
  /** Into the story, before this element: across the measure, or a page of its own. */
  | { kind: 'story'; elementId: string; as: 'measure' | 'page' | 'free' }
  /** Into a part: cut into its words where it has them, a page of its own where it has not. */
  | { kind: 'part'; partId: string; as: 'measure' | 'page' | 'free' }
  /** A logotype in place of a designed page's title (§9n). */
  | { kind: 'logo'; partId: string }
  /** The page as a piece of art, edge to edge (§8). */
  | { kind: 'part-art'; partId: string }
  /** Into a box already drawn and still empty (§9a). */
  | { kind: 'fill'; elementId: string }
  /** The barcode box on the copyright page (§9k). */
  | { kind: 'barcode'; partId: string };

/** The box drawn before anything has been chosen to go in it (§9a). */
const NEW_BOX = 'new';
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
        (block.id === id || block.partId === id || block.unitId === id || block.inset?.figureId === id)
      );
    }),
  );
};

export function LayoutWindow({ file, open, onClose, onUpdate, onPopOut, onOpenChapterPage }: LayoutWindowProps) {
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
   * it cuts in at; `'new'` makes the box first and leaves the picture for
   * afterwards, which is the order he asked for.
   */
  const [drawing, setDrawing] = useState<string | null>(null);
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
  /**
   * The inspector's width (§9f). It was a fixed 320px column, which on a
   * 1280-wide window is a quarter of the screen the writer cannot argue with —
   * and since §9e that quarter is a quarter less book. It drags like the rail,
   * from the other end: `from: 'end'` so the same gesture sizes the pane after
   * the divider rather than the one before it.
   */
  const inspector = useSplit({ key: 'layout.inspector', initial: 320, min: 240, reserve: 560, axis: 'x', from: 'end' });
  const [message, setMessage] = useState<string | null>(null);
  /** The Add menu, open at the button (§9a). */
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  /** What the rail is dragging: a part within its half, or a chapter as a block. */
  const [dragging, setDragging] = useState<{ kind: 'part' | 'chapter'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /**
   * The one picker for every picture the room takes in (§9, §9a). What the
   * picture will become is decided before the picker opens and read back
   * when the file arrives; nothing is made until it does, so a cancelled
   * dialog leaves no empty page behind.
   */
  const artPicker = useRef<HTMLInputElement>(null);
  const artTarget = useRef<ArtTarget>({ kind: 'back' });

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

  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;
  const selected = selectedRow?.part ?? null;
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
  const divisions = useMemo(() => contentsDivisions(file), [file]);

  const pages = laying?.laid.pages ?? [];
  /** Every page of the book with a word for what stands on it (§9h). */
  const pageRows = useMemo(() => (laying ? bookPageRows(laying.laid.pages, laying.blocks) : []), [laying]);
  /** What each division folds open on: a range of pages, so none is lost (§9m). */
  const folds = useMemo(() => pagesUnder(rows, pageRows), [rows, pageRows]);
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
    if (result.data) {
      setMessage(
        result.data.pageCount > 0
          ? `Exported ${result.data.pageCount} pages to ${result.data.path}`
          : `Exported to ${result.data.path}`,
      );
    }
  };

  const figures = bookFigures(file);
  /** What this format calls a division — Chapter, Story, Episode (§6a). */
  const { division: noun, divisionPlural: nounPlural } = nounsFor(file.project.format);
  const selectedFigure = figures.find((figure) => figure.elementId === selectedRowId) ?? null;

  /** The page a double-click opened, and the picture standing on it (§9j). */
  const dialogPage = pageRows.find((one) => one.sheet === pageDialogSheet && one.partId === null) ?? null;
  const dialogFigure = dialogPage?.figureId ? (figures.find((one) => one.elementId === dialogPage.figureId) ?? null) : null;


  /**
   * What the page in hand stands on (§9a). Everything that adds a picture
   * asks this and nothing else, so *add it to this page* means one thing
   * wherever it is pressed.
   */
  const place = laying && selectedSheet !== null ? pagePlace(laying.laid.pages, laying.blocks, selectedSheet) : EMPTY_PLACE;
  /**
   * The page in hand, where it is **inside the story** (§9h). A page in the
   * front or back matter belongs to a part and the part's own fields are its
   * screen; a page of the story belongs to nobody, which is why it had none.
   */
  const storyPage = pageRows.find((one) => one.sheet === selectedSheet && one.partId === null) ?? null;
  /** The column stands for a part, a picture, or a page of the story (§9f, §9h). */
  const showInspector = Boolean(selected || selectedFigure || storyPage);
  /** What the page in hand is called in the book, for the buttons that act on it. */
  const chosen = pages.find((one) => one.sheet === selectedSheet);
  const chosenPage =
    !chosen || chosen.numbering === 'none'
      ? 'this page'
      : `page ${chosen.numbering === 'roman' ? roman(chosen.number) : chosen.number}`;

  /** Open the picker for a picture that will become this. */
  const importArt = (target: ArtTarget) => {
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
  const importPicture = (as: 'measure' | 'page' | 'free') => {
    if (place.elementId) importArt({ kind: 'story', elementId: place.elementId, as });
    else if (place.partId) importArt({ kind: 'part', partId: place.partId, as });
    else importArt({ kind: 'back' });
  };

  /**
   * The picture arrives: it joins the graphics library — the one place the
   * book's pictures live, reachable from Research ▸ Graphics — and is put
   * where the writer asked, in one act, so a writer with a picture on disk
   * never has to know the library exists to use one.
   */
  const takeArt = async (picked: File | undefined) => {
    if (!picked) return;
    if (!picked.type.startsWith('image/')) {
      setMessage('That is not a picture file.');
      return;
    }
    const target = artTarget.current;
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
            beforeElementId: target.elementId as never,
            attributes:
              target.as === 'page'
                ? { bookPlace: 'page' }
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
          }
          return made.file;
        }

        // A logotype and a page of art are **the part's own pictures**
        // (§9n), so they go straight on the record: choosing one is the act,
        // and the mode is read back from what is there.
        if (target.kind === 'logo') return updatePart(added.file, target.partId, { logoAssetId: assetId as string });
        if (target.kind === 'part-art') return updatePart(added.file, target.partId, { assetId: assetId as string });

        if (target.kind === 'part') {
          const part = partsOf(added.file).find((one) => one.id === target.partId);
          // A picture cut into a part's own words, where its words take one.
          if (part && target.as === 'measure' && partTakesInsets(part.kind)) {
            setSelectedRowId(part.id);
            return addPartInset(added.file, part.id, { assetId: assetId as string }).file;
          }
          const made = addPart(added.file, 'plate', { assetId, inFront: part ? halfOf(part) === 'front' : false });
          if (made.partId) {
            setSelectedRowId(made.partId);
            turnTo.current = made.partId;
          }
          return made.file;
        }

        const made = addPart(added.file, 'plate', {
          assetId,
          inFront: target.kind === 'front',
          beforeMarkerId: target.kind === 'before' ? target.markerId : null,
        });
        if (made.partId) {
          setSelectedRowId(made.partId);
          turnTo.current = made.partId;
        }
        return made.file;
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
    {
      label: 'Picture…',
      disabled: place.elementId || place.partId ? null : 'Choose a page first',
      onPick: () => importPicture('measure'),
    },
    {
      label: 'Picture on a page of its own…',
      disabled: place.elementId || place.partId ? null : 'Choose a page first',
      onPick: () => importPicture('page'),
    },
    {
      label: 'Draw a box for a picture…',
      disabled: laying ? null : 'The book is still being set',
      onPick: () => setDrawing(NEW_BOX),
    },
    'rule',
    ...(isCollection(file.project.format)
      ? [{ label: 'New story', onPick: () => onUpdate((current) => beginStory(current, { title: 'New story' }).file) }]
      : []),
    ...ADDABLE_KINDS.filter((kind) => kind !== 'plate' && mayAdd(file, kind)).map((kind) => ({
      label: PART_INFO[kind].name,
      onPick: () =>
        onUpdate((current) => {
          const made = addPart(current, kind);
          if (made.partId) setSelectedRowId(made.partId);
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
    if (row.kind === 'part') setPartDialogId(row.id);
    else if (row.kind === 'chapter') openChapterPage(row.id);
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
    if (at.partId) {
      setSelectedRowId(at.partId);
      setPartDialogId(at.partId);
      return;
    }
    const row = bookPageRows(laying.laid.pages, laying.blocks).find((one) => one.sheet === page.sheet);
    // The chapter's own page, but **only where this page carries the chapter
    // opening itself** (§9j). Read off the page's blocks rather than off the
    // chapter in force, and rather than off the row's word: a chapter inside
    // a story opens with a heading and has no marker of its own (addendum 22
    // §6), so asking the chapter in force sent a writer who double-clicked
    // the numeral to the *story's* page — a different page, which is the
    // *trying to enter any information just changes title pages* of §9h in
    // one more place.
    const index = new Map(laying.blocks.map((block) => [block.id, block]));
    const opensHere = page.pieces.some((piece) => index.get(piece.blockId)?.kind === 'chapter_opening');
    if (opensHere && at.markerId) {
      openChapterPage(at.markerId);
      return;
    }
    // An ordinary page of the story opens **its own dialog** (§9j, from Ken:
    // *if I double-click any page, the page setup dialog box should pop up
    // with all the options for that page*). It used to put the page in hand
    // and nothing more, so a double-click on the one kind of page that has no
    // other owner appeared to do nothing at all.
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
  const pageControls = (page: BookPageRow) => (
    <StoryPageSection
      page={page}
      // Why a blank leaf is blank is a reading of the page before it, and the
      // two reasons are different acts: one the cutter's, one the writer's
      // own (§9i).
      behindPicture={pageRows.find((one) => one.sheet === page.sheet - 1)?.says === 'Illustration'}
      drawing={drawing === NEW_BOX}
      onPut={() => importPicture('page')}
      onDraw={() => {
        // The box is drawn on the spread, so the dialog covering it goes.
        setPageDialogSheet(null);
        setDrawing(NEW_BOX);
      }}
      onVector={() => {
        setPageDialogSheet(null);
        importPicture('free');
      }}
      onBlank={(elementId, blank) => onUpdate((current) => setBlankBefore(current, elementId, blank))}
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
    if (page.says !== 'Chapter opens') return { label: null, markerId: null };
    const opens = laying
      ? laying.laid.pages
          .find((one) => one.sheet === page.sheet)
          ?.pieces.map((piece) => laying.blocks.find((block) => block.id === piece.blockId))
          .find((block) => block?.kind === 'chapter_opening')
      : undefined;
    if (opens) return { label: 'Set this chapter’s page…', markerId: opens.id };
    return { label: 'How openings look', markerId: null };
  };

  const figureControls = (figure: BookFigure) => (
    <FigureSection
      figure={figure}
      drawing={figure.placement.place === 'free' ? placing === figure.elementId : drawing === figure.elementId}
      onPlace={(placement) => onUpdate((current) => placeBookFigure(current, figure.elementId, placement))}
      onDraw={() => {
        setPageDialogSheet(null);
        // A free graphic is **already on the page**, so there is nothing to
        // draw: the handle goes straight over it and it is dragged and
        // resized where it stands (§8c). A figure in the text has no place
        // until a box is drawn, which is why the two gestures differ.
        if (figure.placement.place === 'free') {
          setPlacing((current) => (current === figure.elementId ? null : figure.elementId));
          return;
        }
        setDrawing((current) => (current === figure.elementId ? null : figure.elementId));
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
    if (!moving || !page.elementId || moving.id === page.figureId) return;
    onUpdate((current) => {
      const figure = bookFigures(current).find((one) => one.elementId === moving.id);
      if (figure) return moveFigureBefore(current, figure.elementId, page.elementId as string);
      const part = partsOf(current).find((one) => one.id === moving.id);
      if (part?.kind !== 'plate') return current;
      const made = plateIntoStory(current, part.id, page.elementId as string);
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
        accept="image/*"
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
        laid={laying ? { pages: laying.laid.pages, blocks: laying.blocks, context: laying.context } : null}
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
          // *Add custom graphic…* (§9d, from Ken: *the menu disappears and
          // allows you to draw a box where you want the graphic*). The dialog
          // goes, because a box is drawn on the page it is covering.
          onDrawBox={() => {
            setOwnChapterPage(null);
            setDrawing(NEW_BOX);
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
      <PartDialog
        file={file}
        part={designed || copyrightPart ? null : opened}
        laying={laying}
        onUpdate={onUpdate}
        onClose={() => setPartDialogId(null)}
        onRemoved={() => {
          setPartDialogId(null);
          setSelectedRowId(null);
        }}
        onOpenBookSettings={() => {
          setPartDialogId(null);
          setBookSettingsOpen(true);
        }}
      />
      {/* A page of the story, opened by a double-click on its row or on the
          page itself (§9j). It holds exactly what the inspector holds, being
          the same two components, so the gesture is uniform across every kind
          of page: a part opens its part, a chapter opening its chapter page,
          and an ordinary page this. */}
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
        {onPopOut ? <PopOutButton what="the Layout room" onPopOut={onPopOut} /> : null}
        <button type="button" className="ghost" onClick={onClose} aria-label="Close the Layout room">
          ×
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
              disabled={!laying}
              title={
                place.elementId || place.partId
                  ? `A picture at the top of ${chosenPage}. The words move down.`
                  : 'Choose a page first: the picture goes at the top of it.'
              }
              onClick={() => importPicture('measure')}
            >
              + Picture
            </button>
            <button
              type="button"
              className="raised layout-add"
              aria-label="Add to the book"
              aria-haspopup="menu"
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
            {rows.map((row, index) => {
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
              const opens = index === 0 || rows[index - 1]?.half !== row.half;
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
              const divides = row.kind === 'chapter' || row.kind === 'section';
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
                  comfort={whatGoesWithRow(file, row)}
                  onSelect={() => selectRow(row)}
                  onOpen={() => openRow(row)}
                  onRemove={() => {
                    if (selectedRowId === row.id) setSelectedRowId(null);
                    onUpdate((current) => removeBookRow(current, row));
                  }}
                  onDragStart={() => setDragging({ kind: row.kind === 'chapter' ? 'chapter' : 'part', id: row.id })}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragging || dragging.id === row.id) return;
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
                  <li
                    key={`page-${one.sheet}`}
                    className={`layout-rail-row layout-rail-page${over === `page-${one.sheet}` ? ' drop-before' : ''}`}
                    // A picture dragged onto a page lands there (§9i, from
                    // Ken: *it doesn't allow me to drag it up and place it*).
                    onDragOver={(event) => {
                      if (!dragging || !one.elementId) return;
                      event.preventDefault();
                      setOver(`page-${one.sheet}`);
                    }}
                    onDragLeave={() => setOver((current) => (current === `page-${one.sheet}` ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropOnPage(one);
                    }}
                  >
                    <button
                      type="button"
                      className={`layout-rail-name${selectedSheet === one.sheet ? ' on' : ''}`}
                      aria-current={selectedSheet === one.sheet}
                      onClick={() => {
                        setSelectedRowId(one.figureId);
                        setSelectedSheet(one.sheet);
                        setSpread(spreadOfSheet(one.sheet));
                      }}
                      // The rail and the spread are one gesture (§9j): a
                      // double-click opens the page wherever it is pressed.
                      onDoubleClick={() => {
                        setSpread(spreadOfSheet(one.sheet));
                        const at = pages.find((sheet) => sheet.sheet === one.sheet);
                        if (at) openPage(at);
                      }}
                    >
                      {/* **The row is the page** (§9l, from Ken: *it should
                          say page two, page three, page four, page five*).
                          The number is the page's own, printed or not — an
                          illustration and a blank leaf are counted like any
                          other page and merely print no folio, so a row that
                          showed the folio left both of them nameless. What
                          stands on the page follows, and a page of plain text
                          needs no word: that is what a page of a book is. */}
                      <span className="layout-rail-title">Page {one.counted}</span>
                      {one.says === 'Text' ? null : <span className="muted small layout-rail-says">{one.says}</span>}
                    </button>
                  </li>
                ))}
                </Fragment>
              );
            })}
          </ul>
          {/* What is left of the old column's paragraph (§9f): the two
              gestures, and nothing else. It said three things, and two of them
              — what *+ Picture* does and where the book's settings are — were
              labels for buttons already on the screen. These two cannot be
              seen, so they are said, once, under the list they are about. */}
          {/* A refusal says itself where the drop happened (§9k), and goes
              the moment anything else is dragged. */}
          {areaRefusal ? <p className="small layout-rail-refusal">{areaRefusal}</p> : null}
          <p className="muted small layout-rail-note">A page can be chosen on the spread too. A double-click opens it.</p>
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
              onSpan={(span, ofPage) => {
                const what = placing;
                if (!what) return;
                onUpdate((current) => {
                  const held = bookFigures(current).find((one) => one.elementId === what);
                  if (!held) return current;
                  // A free graphic's width is a share of the **page**, an
                  // inset's of the measure: two measurements of two things.
                  const wide = held.placement.place === 'free' ? ofPage : span;
                  return placeBookFigure(current, what, { ...held.placement, span: wide });
                });
              }}
              onPick={() => {
                const what = placing;
                if (what) importArt({ kind: 'fill', elementId: what });
              }}
              onSlide={(place, beforeElementId, at) => {
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
                  const moved = beforeElementId && beforeElementId !== what ? moveFigureBefore(current, what, beforeElementId) : current;
                  return placeBookFigure(moved, what, { place });
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
              onDrawn={(placement, sheet) => {
                const what = drawing;
                if (!what || !laying) return;
                setDrawing(null);
                setSelectedSheet(sheet);
                const at = pagePlace(laying.laid.pages, laying.blocks, sheet);
                // A box drawn where the story is not cannot hold a figure:
                // the parts carry their pictures themselves.
                if (!at.elementId) {
                  setMessage('Draw the box on a page of the story: the front and back pages carry their own pictures.');
                  return;
                }
                if (what === NEW_BOX) {
                  // The box first, the picture afterwards (§9a, from Ken) —
                  // and it is **placed** before it is filled (§9d): the box
                  // stays in hand with a ✗ and a ✓ on it until the writer
                  // says it is where they want it.
                  onUpdate((current) => {
                    const beat = current.beats.find((one) => one.manuscript.elements.some((element) => (element.id as string) === at.elementId));
                    if (!beat) return current;
                    const made = placeFigure(current, {
                      beatId: beat.id,
                      beforeElementId: at.elementId as never,
                      attributes: {
                        bookPlace: placement.place,
                        bookSpan: placement.span ?? INSET_SPAN.default,
                        ...(placement.standoff !== undefined && placement.standoff !== INSET_STANDOFF.default ? { bookStandoff: placement.standoff } : {}),
                      },
                    });
                    if (made.elementId) {
                      setSelectedRowId(made.elementId as string);
                      setPlacing(made.elementId as string);
                    }
                    return made.file;
                  });
                  return;
                }
                setSelectedRowId(what);
                // Drawing the box on another page moves the picture there,
                // rather than leaving it where it was and lying about it.
                const alreadyHere = pageOf(laying, what)?.sheet === sheet;
                onUpdate((current) => {
                  const moved = alreadyHere || at.elementId === what ? current : moveFigureBefore(current, what, at.elementId as string);
                  return placeBookFigure(moved, what, placement);
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

        {/* The inspector is the selection's, so with nothing chosen there is
            no column (§9f): it stood holding one paragraph, and on a small
            window that paragraph cost a quarter of the screen — which since
            §9e is a quarter less book. Absent rather than empty. */}
        {showInspector ? (
          <div
            className="divider vertical"
            role="separator"
            aria-label="Inspector width"
            aria-orientation="vertical"
            title="Drag to widen the inspector"
            {...inspector.dividerProps}
          />
        ) : null}
        {showInspector ? (
        <aside className="layout-inspector" style={{ flex: `0 0 ${inspector.size}px` }}>
          {/* A page inside the story does pictures and nothing else (§9h, from
              Ken: *the only thing that should be in there is the ability to
              put graphics on that page, and the adjustments of that graphic*).
              It used to open the chapter's page or the title page's fields,
              which is how a picture asked for on page 9 landed on chapter 2. */}
          {storyPage ? pageControls(storyPage) : null}
          {selectedFigure ? figureControls(selectedFigure) : null}
          {selected ? (
            <>
              <PartFields
                file={file}
                part={selected}
                onUpdate={onUpdate}
                onDone={() => setSelectedRowId(null)}
                onOpenBookSettings={() => setBookSettingsOpen(true)}
                onOpenCopyright={() => setCopyrightOpen(true)}
              />
              <p className="muted small">
                <button type="button" className="ghost small" onClick={() => setPartDialogId(selected.id)}>
                  Open the page…
                </button>{' '}
                to see it set{partTakesInsets(selected.kind) ? ' and cut pictures into its text' : ''}.
              </p>
            </>
          ) : null}
        </aside>
        ) : null}
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
      {/* The chapter's pages, folded (§9h). Absent rather than a dead arrow
          on a row that has no pages under it. */}
      {onToggle ? (
        <button
          type="button"
          className="ghost small layout-rail-fold"
          aria-expanded={open === true}
          aria-label={`${open ? 'Hide' : 'Show'} the pages of ${row.title}`}
          title="Its pages, one row each"
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
      {asking ? (
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
        <button
          type="button"
          className="ghost small layout-part-remove"
          aria-label={`Remove ${row.title}`}
          title="Take it out of the book"
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
  placing,
  placingEmpty,
  placingFree,
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
  drawing: string | null;
  onDrawn(placement: BookFigurePlacement, sheet: number): void;
  /** The box being placed (§9d), which wears a ✗ and a ✓ and can be slid. */
  placing: string | null;
  /** Whether that box is still waiting for a picture (§9m). */
  placingEmpty: boolean;
  /** The figure in hand is set over the page, so its width is a share of it. */
  placingFree: boolean;
  /** Slid to a side, and before the element it was let go over. */
  onSlide(place: 'left' | 'right', beforeElementId: string | null, at: { x: number; y: number }): void;
  /** A corner dragged: the new width as a share of the measure (§9m). */
  onSpan(span: number, ofPage: number): void;
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
    if (!drawing || !drawn || !from || drawn.w < 8) return;
    const text = from.sheet.querySelector('.bk-text') as HTMLElement | null;
    const sheetRect = from.sheet.getBoundingClientRect();
    const textRect = (text ?? from.sheet).getBoundingClientRect();
    const inset = textRect.left - sheetRect.left;
    const width = textRect.width || sheetRect.width;
    const span = Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, drawn.w / width));
    const place = drawn.x + drawn.w / 2 < inset + width / 2 ? 'left' : 'right';
    // A drawn box is always cut into the text, so its free position is
    // whatever `figurePlacement` falls back to and is never read.
    onDrawn({ place, span, side: 'either', standoff: INSET_STANDOFF.default, x: 0, y: 0 }, from.page.sheet);
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

  const spanFor = (sheetEl: HTMLElement | null, width: number): number => {
    const measure = measureOn(sheetEl);
    if (measure <= 0) return INSET_SPAN.default;
    return Math.min(INSET_SPAN.max, Math.max(INSET_SPAN.min, width / measure));
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
  const blockUnder = (page: BookPage, sheetEl: HTMLElement, clientY: number): string | null => {
    const text = sheetEl.querySelector('.bk-text');
    if (!text) return null;
    const kids = Array.from(text.children) as HTMLElement[];
    for (let at = 0; at < kids.length; at += 1) {
      if (clientY < kids[at]!.getBoundingClientRect().bottom) return page.pieces[at]?.blockId ?? null;
    }
    return page.pieces[page.pieces.length - 1]?.blockId ?? null;
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
        {/* The page's own markup, from the one builder the export reads too;
            every string in it was escaped there. */}
        <div className="layout-sheet-ink" dangerouslySetInnerHTML={{ __html: renderBookPage(page, blocks, laying.context) }} />
        {box && box.key === key ? (
          <div className="layout-draw-box" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true" />
        ) : null}
        <PlacingHandle
          at={handles[key] ?? null}
          empty={placingEmpty}
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
          onCorner={(width) => onSpan(spanFor(sheets.current[key] ?? null, width), width / (sheetWidthOf(sheets.current[key] ?? null) || 1))}
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
  onOpenChapterPage?(markerId: string): void;
  onClose(): void;
}) {
  const dialog = useModal(open);
  const settings = laying.settings;
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
            <p className="muted small">
              The title is on the running heads, the contents page, the title page, the eBook and the exported file. Empty means the
              project’s own name, <em>{file.project.title}</em>, which an imported book took from its file.
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
            <FurnitureSection settings={settings} write={write} noun={noun} nounPlural={nounPlural} />
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
  onOpenBookSettings,
}: {
  file: ProjectFile;
  part: BookPart | null;
  laying: Laying | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  onRemoved(): void;
  onOpenBookSettings?(): void;
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
              <PartFields file={file} part={part} onUpdate={onUpdate} onDone={onRemoved} onOpenBookSettings={onOpenBookSettings} />
              {partTakesInsets(part.kind) ? <PartPictures file={file} part={part} onUpdate={onUpdate} onTouched={setTouched} /> : null}
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
  const paragraphs = paragraphsOf(part.text);
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
    if (!picked.type.startsWith('image/')) {
      setError('That is not a picture file.');
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
        accept="image/*"
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
              {/* The page's own markup, every string in it escaped by the builder. */}
              <div className="layout-sheet" dangerouslySetInnerHTML={{ __html: renderBookPage(page, blocks, laying.context) }} />
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
  onSlideTo(clientX: number, clientY: number): void;
  /** A corner dragged: the new width in the sheet's own pixels (§9m). */
  onCorner(width: number): void;
  /** Put a picture in this box, from here (§9m, from Ken). */
  onPick(): void;
  onKeep(): void;
  onDrop(): void;
}) {
  const [sliding, setSliding] = useState(false);
  /** Which corner is being dragged, and where the box stood when it was taken. */
  const corner = useRef<{ x: number; left: number; right: number; from: 'left' | 'right' } | null>(null);
  if (!at) return null;
  /**
   * A corner resizes it (§9m, from Ken: *it needs to have draggable corners
   * that maintain its squareness*). Only the **width** is dragged, and the
   * height follows from the picture's own proportions — which is what keeps
   * the box square-cornered and the picture unsquashed, and is why there is
   * no *fill the box* to press: the box is never a shape the picture fails to
   * fill. A corner on the near side grows it towards the pointer, the far
   * side being pinned, so the box grows where the hand is.
   */
  const takeCorner = (event: React.PointerEvent, from: 'left' | 'right') => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    corner.current = { x: event.clientX, left: at.left, right: at.left + at.width, from };
  };
  const moveCorner = (event: React.PointerEvent) => {
    const held = corner.current;
    if (!held) return;
    const by = event.clientX - held.x;
    onCorner(Math.max(24, held.from === 'right' ? at.width + by : at.width - by));
  };
  const letGo = (event: React.PointerEvent) => {
    corner.current = null;
    setSliding(false);
    event.stopPropagation();
  };
  const grip = (where: string, from: 'left' | 'right') => (
    <span
      key={where}
      className={`layout-placing-grip ${where}`}
      role="presentation"
      onPointerDown={(event) => takeCorner(event, from)}
      onPointerMove={moveCorner}
      onPointerUp={letGo}
      onPointerCancel={letGo}
    />
  );
  return (
    <div
      className={sliding ? 'layout-placing sliding' : 'layout-placing'}
      style={{ left: at.left, top: at.top, width: at.width, height: at.height }}
      onPointerDown={(event) => {
        // The marks and the grips are their own; everything else in the box
        // is the handle that slides it.
        const on = event.target as HTMLElement;
        if (on.closest('button') || on.classList.contains('layout-placing-grip')) return;
        event.preventDefault();
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        setSliding(true);
      }}
      onPointerMove={(event) => {
        if (!sliding) return;
        onSlideTo(event.clientX, event.clientY);
      }}
      onPointerUp={() => setSliding(false)}
      onPointerCancel={() => setSliding(false)}
      title="Drag to slide the box; the text runs round it as you go. Drag a corner to resize it."
    >
      {/* What it measures, on the box (§9m, from Ken: *it should give you the
          specifications of its dimensions, so you can match your picture to
          it*). Read off the laid page every time, so it is the size the book
          will print rather than the size of the drag. */}
      <span className="layout-placing-size">{size}</span>
      <div className="layout-placing-marks">
        <button type="button" className="layout-placing-mark drop" aria-label="Take the box away" title="Take the box away" onClick={onDrop}>
          ✗
        </button>
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
            onClick={onPick}
          >
            ＋
          </button>
        ) : null}
        <button type="button" className="layout-placing-mark keep" aria-label="Keep the box here" title="Keep the box here" onClick={onKeep}>
          ✓
        </button>
      </div>
      {[grip('nw', 'left'), grip('ne', 'right'), grip('sw', 'left'), grip('se', 'right')]}
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
  behindPicture,
  drawing,
  onPut,
  onDraw,
  onVector,
  onBlank,
  onFormat,
  format,
  openings,
}: {
  page: BookPageRow;
  /** A blank leaf standing behind a picture page, asked for rather than left (§9i). */
  behindPicture: boolean;
  drawing: boolean;
  onPut(): void;
  onDraw(): void;
  onVector(): void;
  /** Put a blank leaf in before an element, or take one away (§9i). */
  onBlank(elementId: string, blank: boolean): void;
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
}) {
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
              : page.blank
                ? // Three blank pages, three reasons, and only one of them the
                  // writer's — a page that says the wrong one is a page nobody
                  // can work out how to be rid of.
                  page.blankFor
                  ? 'It is blank because you put it here. It counts as a page and prints no number.'
                  : behindPicture
                    ? 'It is blank — the back of the picture before it, kept empty so nothing shows through. It counts as a page and prints no number.'
                    : 'It is blank — the page before a chapter that opens on a right-hand page.'
                : page.says === 'Chapter opens'
                  ? 'The chapter opens on it. A picture put here goes in before it, and the chapter moves down.'
                  : 'Story text. A picture put here goes in before the words on it, and they move down.'}{' '}
            The pictures here are this page’s alone.
          </span>
        </Help>
      </h3>
      {page.figureId ? null : (
        <div className="layout-page-acts">
          {page.blank ? null : (
            <>
              <button type="button" className="small" onClick={onPut}>
                Put a picture on this page…
              </button>
              <button type="button" className={drawing ? 'small on' : 'small'} onClick={onDraw}>
                {drawing ? 'Drawing the box…' : 'Draw a box for a picture…'}
              </button>
            </>
          )}
          {/* A vector graphic (§8c, from Ken: *add a vector graphic … anywhere
              on the page, and then they can resize that also. But it has a
              transparent background*). Offered on **every** page, a blank
              leaf included: a flourish takes no room in the text, so there is
              no writing for it to need. */}
          <button type="button" className="small" onClick={onVector}>
            Add a vector graphic…
          </button>
          {/* A blank page (§9i, from Ken: *insert a blank page… and it will
              slide what was on that page to the next page*). Offered where
              there is writing to stand before; on a leaf the writer put in,
              the same button takes it away, which is the only place it can
              be found again. */}
          {page.blankFor ? (
            <button type="button" className="small" onClick={() => onBlank(page.blankFor as string, false)}>
              Take this blank page away
            </button>
          ) : page.elementId ? (
            <button type="button" className="small" onClick={() => onBlank(page.elementId as string, true)}>
              Put a blank page here…
            </button>
          ) : null}
        </div>
      )}
      {/* How the opening is set (§9l, §9m). A chapter with a page of its own
          keeps the **button**, because that page has a sheet to be set
          against and a dialog that draws it. A chapter inside a story has no
          page, so its look is the book's — and that is rendered **here**
          rather than behind a door, the fields being the same component Book
          settings renders, never a second copy. */}
      {format ? (
        <div className="layout-page-acts">
          <button type="button" className="raised small" onClick={onFormat}>
            {format}
          </button>
        </div>
      ) : null}
      {openings}
    </section>
  );
}

function FigureSection({
  figure,
  drawing,
  onPlace,
  onDraw,
  onFill,
  onBackBlank,
  onRemove,
}: {
  figure: BookFigure;
  drawing: boolean;
  onPlace(placement: BookFigurePlacement): void;
  onDraw(): void;
  /** Put a picture in a box that has none yet (§9a). */
  onFill(): void;
  /** Ask for the leaf behind a picture page, or stop asking (§9i). */
  onBackBlank(blank: boolean): void;
  /** Take the picture out of the book (§9j). The library keeps the file. */
  onRemove(): void;
}) {
  const { place, span, standoff } = figure.placement;
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
              ? 'The box holds its space on the page. Choose what goes in it below, or draw it again to move it or resize it.'
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
          {/* *Which page* is gone (§9j, from Ken: *you can take the which
              page out and just make it whatever the selected page*). It asked
              a question the gesture had already answered — the picture goes
              where it was put — and its one real use, holding a page for a
              facing illustration, is what the box below does properly. An
              older book's answer is still honoured; there is just nowhere to
              set a new one. */}
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
            {backBlank
              ? ' It takes a right-hand page, so the empty leaf after it really is its back; both count as pages and neither prints a number. The words start again on the page after that.'
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
          <p className="muted small">The text after it runs round the picture; a paragraph carrying one is never split across a page.</p>
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
        <button
          type="button"
          className={drawing ? 'raised small selected' : 'raised small'}
          aria-pressed={drawing}
          title={
            place === 'free'
              ? 'Drag it where it goes and take a corner to resize it.'
              : 'Drag a box on the page where the picture goes; its width and the side it lands on are taken from the box. Drawn on another page, it moves the picture there.'
          }
          onClick={onDraw}
        >
          {place === 'free'
            ? drawing
              ? 'Moving it — drag on the page'
              : 'Move and resize it…'
            : drawing
              ? 'Drawing — drag on the page'
              : 'Draw the box…'}
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
 * The running heads and the folios (§7a, from Ken: *the running headers and
 * footers need to be adjustable*). There used to be four dropdowns and a
 * sentence saying nothing about them could be typed. Now each side says what
 * it likes — the writer's own words among the choices — and all three lines
 * are set here, the same `Line` control the chapter page uses.
 */
function FurnitureSection({ settings, write, noun, nounPlural }: { settings: BookSettings; write(patch: Partial<BookSettings>): void; noun: string; nounPlural: string }) {
  const heads = settings.runningHeads;
  const style = runningHeadStyleOf(settings);
  const setHeads = (patch: Partial<BookSettings['runningHeads']>) => write({ runningHeads: { ...heads, ...patch } });
  const setLine = (which: 'verso' | 'recto' | 'folio', patch: Partial<LineStyle>) =>
    write({ runningHeadStyle: { ...style, [which]: { ...style[which], ...patch } } });
  /** The words a side carries, named for the format rather than for a novel. */
  const contentWords = (one: (typeof HEAD_CONTENTS)[number]) =>
    one === 'chapter' ? `The ${noun.toLowerCase()}’s title` : HEAD_CONTENT_WORDS[one];
  const sideFields = (side: 'verso' | 'recto') => {
    const carries = side === 'verso' ? heads.verso : heads.recto;
    const typed = side === 'verso' ? heads.versoText : heads.rectoText;
    const label = side === 'verso' ? 'Left-hand pages carry' : 'Right-hand pages carry';
    return (
      <div className="layout-head-side">
        <label className="field">
          <span>{label}</span>
          <select
            aria-label={`${side === 'verso' ? 'Verso' : 'Recto'} running head`}
            value={carries}
            onChange={(event) => setHeads({ [side]: event.target.value } as Partial<BookSettings['runningHeads']>)}
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
              aria-label={`${side === 'verso' ? 'Verso' : 'Recto'} running head words`}
              value={typed}
              placeholder="What these pages should say"
              onChange={(event) => setHeads({ [`${side}Text`]: event.target.value } as Partial<BookSettings['runningHeads']>)}
            />
          </label>
        ) : null}
      </div>
    );
  };
  return (
    <>
      <div className="layout-two">
        {sideFields('verso')}
        {sideFields('recto')}
      </div>
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
  onOpenBookSettings,
  onOpenCopyright,
}: {
  file: ProjectFile;
  part: BookPart;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onDone(): void;
  /** The book's title and author are set there, not here (§9). */
  onOpenBookSettings?(): void;
  /** The copyright page's own dialog (§9k); absent on every other kind. */
  onOpenCopyright?(): void;
}) {
  const info = PART_INFO[part.kind];
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
    if (!picked.type.startsWith('image/')) {
      setPictureError('That is not a picture file.');
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
      {part.kind !== 'half_title' && part.kind !== 'title_page' ? (
        <label className="field">
          <span>Heading</span>
          <input aria-label="The part's heading" placeholder={info.name} value={part.title} onChange={(event) => patch({ title: event.target.value })} />
        </label>
      ) : (
        <>
          {/* The book's title and author run all the way through, so they
              are in Book settings and not here (§9, from Ken); this page
              says what it will print and where that is set, rather than
              offering a second box for the same field. */}
          <p className="muted small">
            This page prints <em>{bookNames(file).title}</em>
            {part.kind === 'title_page' ? ` by ${bookNames(file).author || 'nobody yet'}` : ''}. The title and the author are the
            whole book’s, under <em>Book settings…</em> in the bar.
          </p>
          {onOpenBookSettings ? (
            <button type="button" className="ghost small" onClick={onOpenBookSettings}>
              Book settings…
            </button>
          ) : null}
          {part.kind === 'title_page' ? (
            <label className="field">
              <span>Under the title</span>
              <input
                aria-label="Under the title"
                placeholder="A subtitle — A novel, Stories — or nothing"
                value={file.settings.titlePage.episode}
                onChange={(event) => onUpdate((current) => setTitlePage(current, { episode: event.target.value }))}
              />
            </label>
          ) : null}
          <p className="muted small">A logotype in place of the title is under <em>File ▸ Title page…</em>.</p>
        </>
      )}
      {/* The copyright page is set in a dialog of its own (§9k): a dozen
          facts in a settled order are not a box to type into. The free text
          box stays where the fields have never been used, so a page written
          before this is still editable where it was written. */}
      {part.kind === 'copyright' && onOpenCopyright ? (
        <>
          <button type="button" className="raised small" onClick={onOpenCopyright}>
            The copyright information…
          </button>
          <p className="muted small">{describeCopyright(part, file)}</p>
        </>
      ) : null}
      {info.carries === 'text' && !(part.kind === 'copyright' && copyrightOf(part)) ? (
        <label className="field">
          <span>Text</span>
          <textarea
            aria-label="The part's text"
            rows={part.kind === 'dedication' || part.kind === 'epigraph' || part.kind === 'copyright' ? 6 : 14}
            placeholder={part.kind === 'copyright' ? `Copyright © ${file.project.author}` : 'A blank line between paragraphs.'}
            value={part.text}
            onChange={(event) => patch({ text: event.target.value })}
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
            accept="image/*"
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
            accept="image/*"
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
function PageStyle({ part, file, onUpdate }: { part: BookPart; file: ProjectFile; onUpdate(mutate: (current: ProjectFile) => ProjectFile): void }) {
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
      {atFoot || flows || prose ? null : (
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
      {part.kind === 'title_page' || words || flows || prose ? (
        <Line
          label={flows ? 'The entries' : prose ? 'The words' : 'Lines under it'}
          style={style.line}
          onPatch={(patch) => write({ line: { ...style.line, ...patch } })}
        />
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
