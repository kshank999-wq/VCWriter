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
  OPENINGS,
  PART_INFO,
  TRIM_PRESETS,
  addGraphic,
  addPart,
  addPartInset,
  beginStory,
  bookMetrics,
  bookVars,
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
  bookNames,
  paragraphsOf,
  partHasStyle,
  partOfInset,
  partStyleOf,
  partTemplateOf,
  partTemplatePatch,
  partTakesInsets,
  partTitle,
  partsOf,
  placePart,
  removePart,
  removePartInset,
  setChapterPage,
  setTitlePage,
  updatePartInset,
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
  chapterLeafContent,
  BOOK_PRESET_NAMES,
  BOOK_PRESETS,
  INSET_SPAN,
  PRESET_INFO,
  bookFigures,
  bookPresetOf,
  placeBookFigure,
  type BookFigure,
} from '@vcwriter/domain';
import { PopOutButton } from './PopOutButton';
import { ChapterPageDialog, Line } from './ChapterPageDialog';
import { useModal } from '../use-modal';
import { usePreference, useSplit } from '../use-split';
import { readPicture } from '../read-picture';
import { useBookLaying, type Laying } from '../book-typeset';

/**
 * The Layout room (addendum 20 §9): the parts down the left, the spreads in
 * the middle, the inspector on the right.
 *
 * Nothing here edits a word of the manuscript, stores a page number or a
 * margin it worked out, or reorders the story (§10). What it writes is the
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

const FOLIO_WORDS: Record<(typeof FOLIO_PLACES)[number], string> = {
  foot_outside: 'Foot, outside corner',
  foot_centre: 'Foot, centred',
  head_outside: 'Head, outside corner',
};

const OPENING_WORDS: Record<(typeof OPENINGS)[number], string> = {
  none: 'Nothing special',
  small_caps: 'First words in small capitals',
  drop_cap: 'A drop capital',
};

/** The spread a sheet is on: the first leaf stands alone, then pairs. */
const spreadOfSheet = (sheet: number): number => (sheet <= 1 ? 0 : Math.floor(sheet / 2));

/** Where an art page is going: among the front matter, at the back, or facing a chapter. */
type ArtTarget = { kind: 'front' } | { kind: 'back' } | { kind: 'before'; markerId: string };

/** The page a part, or a figure, first appears on in a laying. */
const pageOf = (laying: Laying, id: string): BookPage | undefined => {
  const blocks = new Map(laying.blocks.map((block) => [block.id, block]));
  return laying.laid.pages.find((candidate) =>
    candidate.pieces.some((piece) => {
      const block = blocks.get(piece.blockId);
      return block !== undefined && (block.id === id || block.partId === id || block.inset?.figureId === id);
    }),
  );
};

export function LayoutWindow({ file, open, onClose, onUpdate, onPopOut, onOpenChapterPage }: LayoutWindowProps) {
  const { laying, box } = useBookLaying(file, open);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [spread, setSpread] = useState(0);
  const [zoom, setZoom] = usePreference('layout.zoom', 0.55);
  const [busy, setBusy] = useState(false);
  const [ebookOpen, setEbookOpen] = useState(false);
  /** Book settings (§9, from Ken): the whole book at once, in a dialog off the bar. */
  const [bookSettingsOpen, setBookSettingsOpen] = useState(false);
  /** The part opened in a dialog of its own, by a double-click (§9). */
  const [partDialogId, setPartDialogId] = useState<string | null>(null);
  /**
   * The chapter-page dialog, opened here when the room is in a window of its
   * own and has no workspace to ask (§9): a room on the other monitor must
   * not be able to do less than the panel it came out of.
   */
  const [ownChapterPage, setOwnChapterPage] = useState<string | null>(null);
  const openChapterPage = onOpenChapterPage ?? ((markerId: string) => setOwnChapterPage(markerId));
  /** The chapter page being asked about before it is taken off (§9). */
  const [clearing, setClearing] = useState<string | null>(null);
  /**
   * The rail's width (§9, from Ken: *the left side toolbar needs to be
   * dragged out, and by default a half inch wider*): a divider the writer
   * drags, remembered per machine, starting half an inch wider than it was.
   */
  const rail = useSplit({ key: 'layout.rail', initial: 288, min: 200, reserve: 720, axis: 'x' });
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** The Add a part menu, open at the button (§9). */
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  /** What the rail is dragging: a part within its half, or a chapter as a block. */
  const [dragging, setDragging] = useState<{ kind: 'part' | 'chapter'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /**
   * The one picker for an art page (§9, from Ken: *it should be just as
   * easy to add a plate in the front matter, the back matter or the story*).
   * Where the page will go is decided before the picker opens and read back
   * when the file arrives; nothing is made until it does, so a cancelled
   * dialog leaves no empty page behind.
   */
  const artPicker = useRef<HTMLInputElement>(null);
  const artTarget = useRef<ArtTarget>({ kind: 'back' });

  const parts = useMemo(() => partsOf(file), [file]);
  const selected = parts.find((part) => part.id === selectedPartId) ?? null;
  const opened = parts.find((part) => part.id === partDialogId) ?? null;
  const divisions = useMemo(() => contentsDivisions(file), [file]);
  /** The plates the writer put before each chapter, by the chapter (§9). */
  const platesBefore = useMemo(() => {
    const map = new Map<string, BookPart[]>();
    for (const part of parts) {
      if (part.kind !== 'plate' || !part.beforeMarkerId) continue;
      map.set(part.beforeMarkerId, [...(map.get(part.beforeMarkerId) ?? []), part]);
    }
    return map;
  }, [parts]);

  const pages = laying?.laid.pages ?? [];
  const spreadCount = Math.max(1, Math.ceil((pages.length + 1) / 2));
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

  const chapterCount = divisions.length;
  const figures = bookFigures(file);
  /** A collection's divisions are stories (addendum 22); the rail says so. */
  const noun = isCollection(file.project.format) ? 'Story' : 'Chapter';
  const nounPlural = isCollection(file.project.format) ? 'stories' : 'chapters';
  const selectedFigure = figures.find((figure) => figure.elementId === selectedFigureId) ?? null;

  /** Open the picker for an art page that will go here. */
  const importArt = (target: ArtTarget) => {
    artTarget.current = target;
    artPicker.current?.click();
  };

  /**
   * The picture arrives: it joins the graphics library — the one place the
   * book's pictures live, reachable from Research ▸ Graphics — and a page
   * is made for it where the writer asked, in one act, so a writer with a
   * picture on disk never has to know the library exists to use one.
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
        const made = addPart(added.file, 'plate', {
          assetId: added.asset.id,
          inFront: target.kind === 'front',
          beforeMarkerId: target.kind === 'before' ? target.markerId : null,
        });
        if (made.partId) {
          setSelectedPartId(made.partId);
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
   * What the Add a part menu offers: every kind the book can still take, an
   * art page for either half — the picker, not a blank page, being what a
   * press opens — and on a collection a new story.
   */
  const addEntries: MenuEntry[] = [
    ...ADDABLE_KINDS.filter((kind) => kind !== 'plate' && mayAdd(file, kind)).map((kind) => ({
      label: `${PART_INFO[kind].name} — ${PART_INFO[kind].note}`,
      onPick: () =>
        onUpdate((current) => {
          const made = addPart(current, kind);
          if (made.partId) setSelectedPartId(made.partId);
          return made.file;
        }),
    })),
    'rule',
    { label: `${PART_INFO.plate.name} in the front matter — ${PART_INFO.plate.note}, from a file…`, onPick: () => importArt({ kind: 'front' }) },
    { label: `${PART_INFO.plate.name} at the back — ${PART_INFO.plate.note}, from a file…`, onPick: () => importArt({ kind: 'back' }) },
    ...(isCollection(file.project.format)
      ? ['rule' as const, { label: 'A new story — on a section of its own, at the end', onPick: () => onUpdate((current) => beginStory(current, { title: 'New story' }).file) }]
      : []),
  ];

  /**
   * A page on the spread, double-clicked (§9, from Ken: *double click the
   * front matter or whatever page*): a part's page opens the part, a
   * chapter's opening opens the chapter page.
   */
  const openPage = (page: BookPage) => {
    if (!laying) return;
    const blocks = new Map(laying.blocks.map((block) => [block.id, block]));
    for (const piece of page.pieces) {
      const block = blocks.get(piece.blockId);
      if (!block) continue;
      if (block.partId) {
        setSelectedPartId(block.partId);
        setPartDialogId(block.partId);
        return;
      }
      if (block.kind === 'chapter_opening') {
        openChapterPage(block.id);
        return;
      }
    }
  };

  /** A part's row: pressable, draggable within its half, and removable. */
  const partRow = (part: BookPart) => (
    <PartRow
      key={part.id}
      part={part}
      selected={part.id === selectedPartId}
      over={over === `part:${part.id}`}
      onSelect={() => {
        setSelectedPartId(part.id);
        goToPart(part.id);
      }}
      onOpen={() => {
        setSelectedPartId(part.id);
        goToPart(part.id);
        setPartDialogId(part.id);
      }}
      onRemove={() => {
        if (selectedPartId === part.id) setSelectedPartId(null);
        onUpdate((current) => removePart(current, part.id));
      }}
      onDragStart={() => setDragging({ kind: 'part', id: part.id })}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
      onDragOver={(event) => {
        if (dragging?.kind !== 'part' || dragging.id === part.id) return;
        event.preventDefault();
        setOver(`part:${part.id}`);
      }}
      onDragLeave={() => setOver((current) => (current === `part:${part.id}` ? null : current))}
      onDrop={(event) => {
        if (dragging?.kind !== 'part') return;
        event.preventDefault();
        const moving = dragging.id;
        onUpdate((current) => placePart(current, moving, part.id));
        setDragging(null);
        setOver(null);
      }}
    />
  );

  /** Where a dragged part lands to go last in its half. */
  const endZone = (half: 'front' | 'back') => (
    <li
      key={`end-${half}`}
      className={`layout-drop-end${over === `part:end:${half}` ? ' drop-before' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(`part:end:${half}`);
      }}
      onDragLeave={() => setOver((current) => (current === `part:end:${half}` ? null : current))}
      onDrop={(event) => {
        if (dragging?.kind !== 'part') return;
        event.preventDefault();
        const moving = dragging.id;
        onUpdate((current) => placePart(current, moving, null));
        setDragging(null);
        setOver(null);
      }}
    >
      Last of the {half} matter
    </li>
  );

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
          divisions={divisions}
          onUpdate={onUpdate}
          onOpenChapterPage={openChapterPage}
          onClose={() => setBookSettingsOpen(false)}
        />
      ) : null}
      {onOpenChapterPage ? null : (
        <ChapterPageDialog file={file} open={ownChapterPage !== null} initialMarkerId={ownChapterPage} onClose={() => setOwnChapterPage(null)} onUpdate={onUpdate} />
      )}
      <PartDialog
        file={file}
        part={opened}
        laying={laying}
        onUpdate={onUpdate}
        onClose={() => setPartDialogId(null)}
        onRemoved={() => {
          setPartDialogId(null);
          setSelectedPartId(null);
        }}
        onOpenBookSettings={() => {
          setPartDialogId(null);
          setBookSettingsOpen(true);
        }}
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
          {/* Adding is the first thing on the rail (§9, from Ken): one
              button, a menu of every kind the book can still take, a new
              story on a collection among them. */}
          <div className="layout-rail-head">
            <button
              type="button"
              className="raised layout-add"
              aria-label="Add a part"
              aria-haspopup="menu"
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                setAddMenu({ x: box.left, y: box.bottom + 4 });
              }}
            >
              + Add a part <span aria-hidden="true">▾</span>
            </button>
          </div>
          {addMenu ? <ContextMenu x={addMenu.x} y={addMenu.y} label="Parts to add" entries={addEntries} onClose={() => setAddMenu(null)} /> : null}

          <h3>Front matter</h3>
          <ul className="layout-parts" aria-label="Front matter">
            {parts
              .filter((part) => halfOf(part) === 'front')
              .map((part) => partRow(part))}
            {dragging?.kind === 'part' && halfOf(parts.find((part) => part.id === dragging.id) as BookPart) === 'front' ? endZone('front') : null}
          </ul>

          <h3>The story</h3>
          <ul className="layout-parts layout-story" aria-label="The story">
            {divisions.length === 0 ? (
              <li className="muted small">No {nounPlural} yet: the story runs as one.</li>
            ) : (
              divisions.map((placed) => {
                const id = placed.marker.id as string;
                const at = laying?.laid.where.get(id);
                const facing = platesBefore.get(id) ?? [];
                const leaf = opensOnLeaf(chapterLeafContent(file, placed));
                const title = placed.label || placed.marker.title.trim() || noun;
                return (
                  <Fragment key={id}>
                    {/* A picture on the page facing this chapter: a plate the
                        writer put before it, listed where it falls (§9). */}
                    {facing.map((part) => partRow(part))}
                    {/* The page between the parts of the book (§9, from Ken):
                        the leaf this chapter opens on, made with the chapter
                        page creator, or a full-page picture before it. */}
                    <li className="layout-leaf-row">
                      {/* The row is the way in (§9, from Ken: *there's no way
                          to edit these*): its name opens the page, and a leaf
                          of its own carries a × that takes the page off. */}
                      <span className="layout-leaf-head">
                        <button
                          type="button"
                          className="ghost layout-leaf-name"
                          title={`Open the page this ${noun.toLowerCase()} opens on: its name, an epigraph, a picture, how it is set`}
                          onClick={() => openChapterPage(id)}
                        >
                          <span className="muted">{noun} page</span>
                          <span className="muted small">· {leaf ? 'a leaf of its own' : 'above the first paragraph'}</span>
                        </button>
                        {leaf ? (
                          clearing === id ? (
                            <span className="layout-ask">
                              <button
                                type="button"
                                className="ghost small danger"
                                onClick={() => {
                                  onUpdate((current) => setChapterPage(current, id as StoryMarkerId, { image: null, summary: '', epigraph: '' }));
                                  setClearing(null);
                                }}
                              >
                                Take it off
                              </button>
                              <button type="button" className="ghost small" onClick={() => setClearing(null)}>
                                Keep
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="ghost small layout-part-remove"
                              aria-label={`Take the ${noun.toLowerCase()} page off`}
                              title={`Take the picture, the summary and the epigraph off this page, so the ${noun.toLowerCase()} opens above its first paragraph again`}
                              onClick={() => setClearing(id)}
                            >
                              ×
                            </button>
                          )
                        ) : null}
                      </span>
                      <span className="layout-story-actions">
                        <button
                          type="button"
                          className="ghost small"
                          title={`The page this ${noun.toLowerCase()} opens on: its name, an epigraph, a picture, how it is set`}
                          onClick={() => openChapterPage(id)}
                        >
                          {noun} page…
                        </button>
                        <button
                          type="button"
                          className="ghost small"
                          title={`A picture that fills the page facing this ${noun.toLowerCase()}, edge to edge, from a file. It is listed above this row once chosen; × takes it out.`}
                          onClick={() => importArt({ kind: 'before', markerId: id })}
                        >
                          + Picture facing
                        </button>
                      </span>
                    </li>
                    <li
                      className={`layout-story-row${over === `chapter:${id}` ? ' drop-before' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', id);
                        setDragging({ kind: 'chapter', id });
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onDragOver={(event) => {
                        if (dragging?.kind !== 'chapter' || dragging.id === id) return;
                        event.preventDefault();
                        setOver(`chapter:${id}`);
                      }}
                      onDragLeave={() => setOver((current) => (current === `chapter:${id}` ? null : current))}
                      onDrop={(event) => {
                        if (dragging?.kind !== 'chapter') return;
                        event.preventDefault();
                        const moving = dragging.id;
                        onUpdate((current) => moveChapterBlock(current, moving as never, placed.marker.id));
                        setDragging(null);
                        setOver(null);
                      }}
                    >
                      <button
                        type="button"
                        className="ghost layout-part"
                        title={`${noun} of the manuscript. Drag it to move it in the story, its ${isCollection(file.project.format) ? 'sections' : 'scenes'} with it.`}
                        onClick={() => {
                          setSelectedPartId(null);
                          goToPart(id);
                        }}
                      >
                        <span className="layout-grip" aria-hidden="true">⠿</span>
                        <span className="layout-part-name">{title}</span>
                        <span className="muted">{placed.label ? placed.marker.title.trim() : ''}</span>
                        <span className="muted layout-page-no">{at && at.numbering === 'arabic' ? at.number : ''}</span>
                      </button>
                    </li>
                  </Fragment>
                );
              })
            )}
            {dragging?.kind === 'chapter' ? (
              <li
                className={`layout-drop-end${over === 'chapter:end' ? ' drop-before' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setOver('chapter:end');
                }}
                onDragLeave={() => setOver((current) => (current === 'chapter:end' ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  const moving = dragging.id;
                  onUpdate((current) => moveChapterBlock(current, moving as never, null));
                  setDragging(null);
                  setOver(null);
                }}
              >
                Last in the story
              </li>
            ) : null}
          </ul>
          {figures.length > 0 ? (
            <>
              <h3>Figures</h3>
              <ul className="layout-parts layout-figures">
                {figures.map((figure) => (
                  <li key={figure.elementId}>
                    <button
                      type="button"
                      className={figure.elementId === selectedFigureId ? 'ghost layout-part selected' : 'ghost layout-part'}
                      title="A figure in the manuscript. Where it sits in the book is set here; the manuscript prints it across the measure."
                      onClick={() => {
                        setSelectedPartId(null);
                        setSelectedFigureId(figure.elementId);
                        goToPart(figure.elementId);
                      }}
                    >
                      <span className="layout-part-name">{figure.caption.trim() || figure.assetName || 'Figure'}</span>
                      <span className="muted">{PLACE_WORDS[figure.placement.place]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3>Back matter</h3>
          <ul className="layout-parts" aria-label="Back matter">
            {parts
              .filter((part) => halfOf(part) === 'back')
              .map((part) => partRow(part))}
            {dragging?.kind === 'part' && halfOf(parts.find((part) => part.id === dragging.id) as BookPart) === 'back' ? endZone('back') : null}
          </ul>
          <p className="muted small">
            The story is the manuscript in story order, {chapterCount}{' '}
            {isCollection(file.project.format) ? (chapterCount === 1 ? 'story' : 'stories') : chapterCount === 1 ? 'chapter' : 'chapters'}.
            Drag a {noun.toLowerCase()} to move it, or a part within its half; × takes a part out; double-click a part to open its
            page. Between the {nounPlural} go a picture on the facing page or the {noun.toLowerCase()}’s own page. The trim, the type
            and the running heads are the whole book’s, under <em>Book settings…</em> in the bar.
          </p>
        </aside>
        <div className="divider vertical" role="separator" aria-label="Rail width" aria-orientation="vertical" title="Drag to widen the rail" {...rail.dividerProps} />

        <div className="layout-stage">
          {laying ? (
            <Spreads
              laying={laying}
              spread={spread}
              zoom={zoom}
              onPickFigure={(figureId) => {
                // A picture cut into a part's text belongs to the part, and
                // opens it; the manuscript's figures go to the inspector.
                const owner = partOfInset(file, figureId);
                if (owner) {
                  setSelectedPartId(owner.id);
                  setPartDialogId(owner.id);
                  return;
                }
                setSelectedPartId(null);
                setSelectedFigureId(figureId);
              }}
              onOpenPage={openPage}
            />
          ) : (
            <p className="muted empty-state">Setting the book…</p>
          )}
          <div className="layout-foot">
            <button
              type="button"
              className="ghost"
              aria-label="Previous spread"
              disabled={spread === 0}
              onClick={() => setSpread((current) => Math.max(0, current - 1))}
            >
              ←
            </button>
            <input
              type="range"
              aria-label="Which spread"
              min={0}
              max={Math.max(0, spreadCount - 1)}
              value={Math.min(spread, spreadCount - 1)}
              onChange={(event) => setSpread(Number(event.target.value))}
            />
            <button
              type="button"
              className="ghost"
              aria-label="Next spread"
              disabled={spread >= spreadCount - 1}
              onClick={() => setSpread((current) => Math.min(spreadCount - 1, current + 1))}
            >
              →
            </button>
            <span className="muted small">{describeSpread(pages, spread)}</span>
            <label className="zoom">
              <span className="muted">Zoom</span>
              <input
                type="range"
                min={25}
                max={120}
                step={5}
                value={Math.round(zoom * 100)}
                aria-label="Page zoom"
                onChange={(event) => setZoom(Number(event.target.value) / 100)}
              />
            </label>
            {message ? <span className="small layout-message">{message}</span> : null}
          </div>
        </div>

        <aside className="layout-inspector">
          {selectedFigure ? (
            <FigureSection
              figure={selectedFigure}
              onPlace={(placement) => onUpdate((current) => placeBookFigure(current, selectedFigure.elementId, placement))}
              onDone={() => setSelectedFigureId(null)}
            />
          ) : null}
          {selected ? (
            <>
              <PartFields file={file} part={selected} onUpdate={onUpdate} onDone={() => setSelectedPartId(null)} onOpenBookSettings={() => setBookSettingsOpen(true)} />
              <p className="muted small">
                <button type="button" className="ghost small" onClick={() => setPartDialogId(selected.id)}>
                  Open the page…
                </button>{' '}
                to see it set{partTakesInsets(selected.kind) ? ' and cut pictures into its text' : ''}.
              </p>
            </>
          ) : null}
          {!selected && !selectedFigure ? (
            // Nothing chosen: the column says what it is for rather than
            // standing empty, the book-wide settings having moved to the bar.
            <p className="muted small layout-inspector-hint">
              Choose a part on the left to edit it here, or double-click one — or a page — to open it. The trim, the margins,
              the type and the running heads are the whole book’s, under <em>Book settings…</em> in the bar.
            </p>
          ) : null}
        </aside>
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

function PartRow({
  part,
  selected,
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
  part: BookPart;
  selected: boolean;
  over: boolean;
  onSelect(): void;
  /** A double-click: the part opened in a dialog of its own (§9). */
  onOpen(): void;
  onRemove(): void;
  onDragStart(): void;
  onDragEnd(): void;
  onDragOver(event: React.DragEvent): void;
  onDragLeave(): void;
  onDrop(event: React.DragEvent): void;
}) {
  const info = PART_INFO[part.kind];
  const [asking, setAsking] = useState(false);
  return (
    <li
      className={`layout-part-row${over ? ' drop-before' : ''}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', part.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={selected ? 'ghost layout-part selected' : 'ghost layout-part'}
        aria-pressed={selected}
        title={
          halfOf(part) === 'body'
            ? `${info.note}. Double-click to open it. It faces its chapter; Where moves it.`
            : `${info.note}. Double-click to open it. Drag to move it within the ${halfOf(part) === 'front' ? 'front' : 'back'} matter.`
        }
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className="layout-grip" aria-hidden="true">⠿</span>
        <span className="layout-part-name">{partTitle(part)}</span>
        <span className="muted">{info.carries === 'reading' ? 'read' : info.carries === 'plate' ? 'picture' : ''}</span>
      </button>
      {/* × takes the part out (§9, from Ken): asked once inline, because a
          copyright notice somebody typed goes with it. */}
      {asking ? (
        <span className="layout-ask">
          <button type="button" className="ghost small danger" onClick={onRemove}>
            Remove
          </button>
          <button type="button" className="ghost small" onClick={() => setAsking(false)}>
            Keep
          </button>
        </span>
      ) : (
        <button type="button" className="ghost small layout-part-remove" aria-label={`Remove ${partTitle(part)}`} title="Take this part out of the book" onClick={() => setAsking(true)}>
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
  onPickFigure,
  onOpenPage,
}: {
  laying: Laying;
  spread: number;
  zoom: number;
  onPickFigure(figureId: string): void;
  /** A double-click on a page (§9): whatever the page belongs to opens. */
  onOpenPage(page: BookPage): void;
}) {
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
  const draw = (page: BookPage | null, key: string) =>
    page ? (
      <div
        key={key}
        className="layout-sheet"
        onClick={(event) => {
          // A figure on the page is tagged with its element id (§8); pressing
          // it picks it for the inspector, whichever page it fell on.
          const hit = (event.target as HTMLElement).closest('[data-figure]');
          if (hit) onPickFigure(hit.getAttribute('data-figure') ?? '');
        }}
        onDoubleClick={() => onOpenPage(page)}
        title="Double-click to open what this page belongs to"
        // The page's own markup, from the one builder the export reads too;
        // every string in it was escaped there.
        dangerouslySetInnerHTML={{ __html: renderBookPage(page, blocks, laying.context) }}
      />
    ) : (
      <div key={key} className="layout-sheet layout-no-sheet" style={{ width: pageWidthPx, height: pageHeightPx }} />
    );
  return (
    <div className="layout-spreads">
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
      <p className="small layout-geometry">{describeGeometry(geometry, settings.face)}</p>
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
            <TypeSection settings={settings} write={write} />
          </Fold>
          <Fold id="furniture" title="Running heads & page numbers">
            <FurnitureSection settings={settings} write={write} />
          </Fold>
          <Fold id="openings" title={isCollection(file.project.format) ? 'Story openings' : 'Chapter openings'}>
            <p className="muted small">
              The number, the name, the face and the drop are set once for the book in <em>File ▸ Chapter page…</em>. A chapter
              page carrying a device, a summary or an epigraph opens on a leaf of its own; one carrying only its number and name
              opens above its first paragraph.
            </p>
            {onOpenChapterPage && divisions[0] ? (
              <button type="button" className="ghost small" onClick={() => onOpenChapterPage(divisions[0]!.marker.id as string)}>
                {noun} page…
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

const PLACE_WORDS: Record<'measure' | 'left' | 'right', string> = {
  measure: 'across the measure',
  left: 'cut in at the left',
  right: 'cut in at the right',
};

/** Where a figure sits in the book (§8): across the measure, or cut into the text at a side. */
function FigureSection({
  figure,
  onPlace,
  onDone,
}: {
  figure: BookFigure;
  onPlace(placement: { place: 'measure' | 'left' | 'right'; span: number }): void;
  onDone(): void;
}) {
  const { place, span } = figure.placement;
  return (
    <section className="layout-section layout-figure">
      <h3>Figure</h3>
      <p className="muted small">
        {figure.caption.trim() || figure.assetName || 'A figure'}
        {figure.chapterTitle ? ` · in ${figure.chapterTitle}` : ''}. The manuscript prints it across the measure; the
        book puts it where you say.
      </p>
      <label className="field">
        <span>Place</span>
        <select aria-label="Figure place" value={place} onChange={(event) => onPlace({ place: event.target.value as 'measure' | 'left' | 'right', span })}>
          <option value="measure">Across the measure</option>
          <option value="left">Cut into the text, at the left</option>
          <option value="right">Cut into the text, at the right</option>
        </select>
      </label>
      {place !== 'measure' ? (
        <label className="field">
          <span>Width, {Math.round(span * 100)}% of the measure</span>
          <input
            type="range"
            aria-label="Figure width"
            min={Math.round(INSET_SPAN.min * 100)}
            max={Math.round(INSET_SPAN.max * 100)}
            step={5}
            value={Math.round(span * 100)}
            onChange={(event) => onPlace({ place, span: Number(event.target.value) / 100 })}
          />
        </label>
      ) : null}
      <p className="muted small">The text after it wraps beside the picture; a paragraph carrying one is never split across a page.</p>
      <div className="layout-part-actions">
        <button type="button" className="ghost small" onClick={onDone}>
          Done
        </button>
      </div>
    </section>
  );
}

function TypeSection({ settings, write }: { settings: BookSettings; write(patch: Partial<BookSettings>): void }) {
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
        <select aria-label="Body face" value={settings.face} onChange={(event) => write({ face: event.target.value as BookSettings['face'] })}>
          {BOOK_FACES.map((face) => (
            <option key={face} value={face}>
              {FACE_NAMES[face]} — {FACE_NOTES[face]}
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
        <span>A chapter’s first paragraph</span>
        <select aria-label="Chapter opening paragraph" value={settings.opening} onChange={(event) => write({ opening: event.target.value as BookSettings['opening'] })}>
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

function FurnitureSection({ settings, write }: { settings: BookSettings; write(patch: Partial<BookSettings>): void }) {
  return (
    <>
      <div className="layout-two">
        <label className="field">
          <span>Left-hand pages carry</span>
          <select
            aria-label="Verso running head"
            value={settings.runningHeads.verso}
            onChange={(event) => write({ runningHeads: { ...settings.runningHeads, verso: event.target.value as BookSettings['runningHeads']['verso'] } })}
          >
            <option value="author">The author</option>
            <option value="title">The book’s title</option>
            <option value="none">Nothing</option>
          </select>
        </label>
        <label className="field">
          <span>Right-hand pages carry</span>
          <select
            aria-label="Recto running head"
            value={settings.runningHeads.recto}
            onChange={(event) => write({ runningHeads: { ...settings.runningHeads, recto: event.target.value as BookSettings['runningHeads']['recto'] } })}
          >
            <option value="chapter">The chapter’s title</option>
            <option value="title">The book’s title</option>
            <option value="none">Nothing</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Page number</span>
        <select aria-label="Page number place" value={settings.folio} onChange={(event) => write({ folio: event.target.value as BookSettings['folio'] })}>
          {FOLIO_PLACES.map((place) => (
            <option key={place} value={place}>
              {FOLIO_WORDS[place]}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.folioOnOpening} onChange={(event) => write({ folioOnOpening: event.target.checked })} />{' '}
        A chapter opening shows its number
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.chaptersOpenRecto} onChange={(event) => write({ chaptersOpenRecto: event.target.checked })} />{' '}
        Every chapter opens on a right-hand page
      </label>
      <p className="muted small">
        The words in the running heads are read from the book and the chapters; nothing about them is typed here. What the book is
        called, and by whom, is under <em>The book</em> above.
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
}: {
  file: ProjectFile;
  part: BookPart;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onDone(): void;
  /** The book's title and author are set there, not here (§9). */
  onOpenBookSettings?(): void;
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
          {/* The page as a piece of art, brought in whole (§8, from Ken: *the
              title page also needs to be able to take a full page piece of
              art*): the picture is the page, edge to edge, the title in it. */}
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
            <button type="button" className="raised small" title="A picture that is the whole page, edge to edge, with the title in it; it joins the book's pictures under Research ▸ Graphics" onClick={() => picturePicker.current?.click()}>
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
          {part.assetId ? <p className="muted small">The art is the page: nothing is set over it, the title and the author being in the picture.</p> : null}
        </>
      )}
      {info.carries === 'text' ? (
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
      {partHasStyle(part.kind) ? <PageStyle part={part} onUpdate={onUpdate} /> : null}
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
function PageStyle({ part, onUpdate }: { part: BookPart; onUpdate(mutate: (current: ProjectFile) => ProjectFile): void }) {
  const style = partStyleOf(part);
  const template = partTemplateOf(style);
  const words = part.kind === 'dedication' || part.kind === 'epigraph';
  const partId = part.id;
  const write = (patch: Partial<PartStyle>) =>
    onUpdate((current) => {
      const now = partsOf(current).find((one) => one.id === partId) ?? part;
      return updatePart(current, partId, { style: { ...partStyleOf(now), ...patch } });
    });
  return (
    <section className="layout-section layout-page-style">
      <h3>Page style</h3>
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
      <label className="field">
        <span>Ranged</span>
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
      <Line label={words ? 'The words' : 'Title'} style={style.title} onPatch={(patch) => write({ title: { ...style.title, ...patch } })} />
      {part.kind === 'title_page' ? <Line label="Lines under it" style={style.line} onPatch={(patch) => write({ line: { ...style.line, ...patch } })} /> : null}
      {words ? null : (
        <label className="check">
          <input type="checkbox" aria-label="A rule under the title" checked={style.rule} onChange={(event) => write({ rule: event.target.checked })} />
          <span>A rule under the title</span>
        </label>
      )}
      <button type="button" className="ghost small" onClick={() => onUpdate((current) => updatePart(current, partId, { style: {} }))}>
        Back to the page’s own look
      </button>
    </section>
  );
}
