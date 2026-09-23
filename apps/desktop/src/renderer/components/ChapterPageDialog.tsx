import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHAPTER_TEMPLATES,
  CHAPTER_TEMPLATE_WORDS,
  MAX_CHAPTER_IMAGE_BYTES,
  TYPE_CASES,
  TYPE_FACES,
  acceptSummary,
  addGraphic,
  chapterChoices,
  chapterLeafContent,
  chapterPageStyleOf,
  chapterPlacementOf,
  placesItself,
  type StoryMarker,
  chapterPagesEverywhere,
  chapterTextFor,
  chapterTextIsCut,
  discardSummary,
  graphicsInOrder,
  isInstructional,
  offerSummary,
  placedMarkers,
  setChapterLineStyle,
  setChapterPage,
  setChapterPageStyle,
  summaryRefusal,
  nounsFor,
  templateOf,
  updateMarker,
  type AssetId,
  type ChapterTemplate,
  type LineStyle,
  type ProjectFile,
  type StoryMarkerId,
  type TypeCase,
  type TypeFace,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';
import { ChapterLeaf } from './Paper';

interface ChapterPageDialogProps {
  file: ProjectFile;
  open: boolean;
  /** The chapter to open on, when the caller has one in hand (the Layout rail, a story's row). */
  initialMarkerId?: string | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * The chapter page, from **File → Chapter page** (addendum 02 §12a).
 *
 * A leaf between the chapters is a page of the *book* rather than of the
 * manuscript — nothing on it is writing the writer is writing — which is why it
 * belongs beside the title page and not on the writing screen. Until now the
 * only way to reach one was to find its marker on the timeline and click it,
 * which is a fine way to touch up the chapter you are looking at and a poor way
 * to design the leaf your book opens its chapters with.
 *
 * The screen is in two halves, and the split is the rule:
 *
 * **The look belongs to the book.** Face, sizes, case, the rule, how far down
 * the block sits — set once, for every chapter page there is. A reader who
 * turns to chapter nine and finds its heading in another face has found a
 * mistake rather than a design, which is the same reason the numbering has been
 * the project's since it was built.
 *
 * **The words belong to the chapter.** Its name, its epigraph, its
 * illustration, whether it shows a number at all — chosen per chapter, because
 * those are the things that differ.
 *
 * **The number is neither, and there is nowhere to type it.** It is worked out
 * from where the chapter falls in the story, so moving chapter nine makes it
 * chapter eight and the leaf says so with nothing run. The list on the left
 * shows the number each chapter would print, which is how a writer can see that
 * it is being worked out rather than remembered.
 *
 * Everything here saves as you type — unlike the title page, deliberately. A
 * title page is the front of a thing that goes out to people and trying a
 * credit line on for size should not be the same act as changing it; a chapter
 * leaf is a look being tuned against the sheet beside it, and a page that only
 * updated on a button would make that impossible to judge.
 */
export function ChapterPageDialog({ file, open, initialMarkerId = null, onClose, onUpdate }: ChapterPageDialogProps) {
  const dialog = useModal(open);
  return (
    <dialog ref={dialog} className="track-dialog chapter-page-dialog" aria-label="Chapter page" onClose={onClose}>
      {open ? <Body file={file} initialMarkerId={initialMarkerId} onClose={onClose} onUpdate={onUpdate} /> : null}
    </dialog>
  );
}

export const CASE_WORDS: Record<TypeCase, string> = {
  as_typed: 'As typed',
  capitals: 'CAPITALS',
  small_caps: 'Small caps',
};

/**
 * The faces on offer (§7a). The list is the running heads' — the book's own
 * face by name, and the five it offers — plus the manuscript's Courier, which
 * is what a script's chapter leaf wants. `serif` is not offered: it is the
 * name old-style had before the list widened, and it still parses.
 */
const FACE_WORDS: Record<TypeFace, string> = {
  book: 'The book’s face',
  old_style: 'Old-style serif',
  transitional: 'Transitional serif',
  modern: 'Modern serif',
  sans: 'Sans serif',
  garamond: 'Garamond',
  baskerville: 'Baskerville',
  georgia: 'Georgia',
  caslon: 'Caslon',
  gill_sans: 'Gill Sans',
  lato: 'Lato',
  manuscript: 'The manuscript’s',
  serif: 'Old-style serif',
};

function Body({
  file,
  initialMarkerId,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  initialMarkerId: string | null;
  onClose(): void;
  onUpdate: ChapterPageDialogProps['onUpdate'];
}) {
  const chapters = useMemo(() => chapterChoices(file), [file]);
  // The body mounts afresh each time the dialog opens, so the chapter asked
  // for is the first one shown; a chapter nobody asked for is the first.
  const [chosen, setChosen] = useState<StoryMarkerId | null>(
    (initialMarkerId && chapters.some((one) => one.markerId === initialMarkerId) ? (initialMarkerId as StoryMarkerId) : null) ?? chapters[0]?.markerId ?? null,
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const artPicker = useRef<HTMLInputElement>(null);

  // A chapter that has gone — deleted while this was open — falls back to the
  // first rather than leaving the right-hand side drawing nothing.
  useEffect(() => {
    if (chosen && chapters.some((one) => one.markerId === chosen)) return;
    setChosen(chapters[0]?.markerId ?? null);
  }, [chapters, chosen]);

  const placed = useMemo(
    () => placedMarkers(file).find((one) => one.marker.id === chosen),
    [file, chosen],
  );
  const style = chapterPageStyleOf(file);
  const marker = placed?.marker;
  /**
   * A book's page has a summary and takes its picture from the library
   * (addendum 19 §7). A novel keeps the illustration it has always had.
   */
  const book = isInstructional(file.project.format);
  const library = useMemo(() => (book ? graphicsInOrder(file) : []), [book, file]);

  /**
   * Whether a summary can be suggested at all (addendum 19 §7), asked once
   * when the dialog opens so the button is absent rather than broken, with
   * the account's reason said once at the foot. `null` until the answer is
   * back, which keeps the button from flickering into view.
   */
  const [offer, setOffer] = useState<{ available: boolean; reason: string | null } | null>(null);
  useEffect(() => {
    if (!book) return;
    const bridge = typeof window === 'undefined' ? null : window.vcwriter;
    if (!bridge?.learningAidStatus) {
      setOffer({ available: false, reason: null });
      return;
    }
    let current = true;
    void bridge.learningAidStatus().then((result) => {
      if (!current) return;
      setOffer(
        result.ok && result.data ? result.data : { available: false, reason: result.error ?? 'Suggestions are unavailable.' },
      );
    });
    return () => {
      current = false;
    };
  }, [book]);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  /** What accepting replaced, offered back until the writer moves on. */
  const [undo, setUndo] = useState<string | null>(null);

  /**
   * Ask through the learning-aid route, as a summary of the chapter's
   * sections read together (addendum 19 §7). **The request has no field for
   * the author's words**, and what comes back is recorded with
   * `offerSummary`, which cannot reach `summary` — so a suggestion that
   * comes back wrong costs a button press rather than a paragraph.
   */
  const askForSummary = async (markerId: StoryMarkerId) => {
    const bridge = window.vcwriter;
    setAsking(true);
    setAskError(null);
    try {
      const result = await bridge.suggestLearningAid({
        kind: 'summary',
        sectionText: chapterTextFor(file, markerId),
        sectionTitle: file.markers.find((one) => one.id === markerId)?.title ?? '',
      });
      if (!result.ok || !result.data) throw new Error(result.error ?? 'The suggestion could not be written.');
      const text = result.data.text;
      onUpdate((current) => offerSummary(current, markerId, text));
    } catch (problem) {
      setAskError(problem instanceof Error ? problem.message : 'Could not write a suggestion.');
    }
    setAsking(false);
  };

  const patchPage = (patch: Parameters<typeof setChapterPage>[2]) => {
    if (!marker) return;
    onUpdate((current) => setChapterPage(current, marker.id, patch));
  };

  const takeImage = (picked: File | undefined) => {
    setImageError(null);
    if (!picked) return;
    if (picked.size > MAX_CHAPTER_IMAGE_BYTES) {
      setImageError('That graphic is too large — the project is a text file that syncs. Try one under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patchPage({ image: { dataUrl: String(reader.result), name: picked.name, width: 40 } });
    reader.readAsDataURL(picked);
  };

  /**
   * Import full page art (addendum 19 §7, from Ken): the page made elsewhere
   * as a piece of art, brought in whole. It fills the page edge to edge and
   * nothing is set over it, so this chapter's template becomes *full-page
   * art* in the same act — choosing a picture that is the page and then
   * having to say so is two steps for one decision. On a book the picture
   * joins the library, where every picture lives; on a novel it is the
   * page's own illustration.
   */
  const takeFullPageArt = (picked: File | undefined) => {
    setImageError(null);
    if (!picked || !marker) return;
    if (picked.size > MAX_CHAPTER_IMAGE_BYTES) {
      setImageError('That art is too large — the project is a text file that syncs. Try one under 5MB.');
      return;
    }
    const markerId = marker.id;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      onUpdate((current) => {
        if (isInstructional(current.project.format)) {
          const added = addGraphic(current, { name: picked.name, data: dataUrl });
          return setChapterPage(added.file, markerId, { assetId: added.asset.id, template: 'full_page' });
        }
        return setChapterPage(current, markerId, { image: { dataUrl, name: picked.name, width: 100 }, template: 'full_page' });
      });
    };
    reader.onerror = () => setImageError('That file could not be read.');
    reader.readAsDataURL(picked);
  };

  if (chapters.length === 0) {
    return (
      <>
        <header className="track-dialog-title">
          <span className="bar-title">Chapter page</span>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="muted">
          There are no chapters yet. Mark a scene as a chapter on the timeline, and the leaf it opens
          with is designed here.
        </p>
      </>
    );
  }

  return (
    <>
      <header className="track-dialog-title">
        <span className="bar-title">Chapter page</span>
        {/* Done rather than Update: everything here saves as it is typed, and
            a button that said Update would be claiming otherwise. */}
        <button type="button" className="ghost" onClick={onClose}>
          Done
        </button>
      </header>

      <div className="chapter-page-body">
        {/* Which chapter. The number beside each name is worked out from where
            it falls, which is the thing this list is really for: a writer can
            see that nobody typed it. */}
        <aside className="chapter-page-list" aria-label="Chapters">
          <div className="chapter-page-bulk">
            <button
              type="button"
              className="ghost small"
              onClick={() => onUpdate((current) => chapterPagesEverywhere(current, true))}
            >
              Give every chapter a page
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() => onUpdate((current) => chapterPagesEverywhere(current, false))}
            >
              None of them
            </button>
          </div>
          <ul>
            {chapters.map((chapter) => (
              <li key={chapter.markerId as string}>
                <button
                  type="button"
                  className={chapter.markerId === chosen ? 'chapter-page-pick on' : 'chapter-page-pick'}
                  aria-current={chapter.markerId === chosen}
                  onClick={() => setChosen(chapter.markerId)}
                >
                  <span className="chapter-page-number">{chapter.label}</span>
                  <span className="chapter-page-name">{chapter.title || '—'}</span>
                  {chapter.hasPage ? <span className="chapter-page-dot" title="Has a page" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="chapter-page-form">
          {marker ? (
            <section>
              <h3>This chapter’s page</h3>
              <label className="check">
                <input
                  type="checkbox"
                  checked={marker.page.include}
                  onChange={(event) => patchPage({ include: event.target.checked })}
                />
                <span>Open this chapter with a page of its own</span>
              </label>

              <label className="field">
                <span>Its name</span>
                <input
                  aria-label="Chapter name"
                  placeholder="The Drowned Bell"
                  value={marker.title}
                  onChange={(event) =>
                    onUpdate((current) => updateMarker(current, marker.id, { title: event.target.value }))
                  }
                />
              </label>

              <div className="chapter-page-shows">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={marker.page.showNumber}
                    onChange={(event) => patchPage({ showNumber: event.target.checked })}
                  />
                  <span>Show {placed?.label}</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={marker.page.showTitle}
                    onChange={(event) => patchPage({ showTitle: event.target.checked })}
                  />
                  <span>Show the name</span>
                </label>
              </div>
              {/* Said plainly, because a writer looking for somewhere to type a
                  number should find out here rather than hunt for the box. */}
              <p className="muted small">
                The number is worked out from where the chapter falls in the story — move it and this
                page renumbers itself.
              </p>

              <label className="field">
                <span>A few lines under it</span>
                <textarea
                  aria-label="Epigraph"
                  rows={3}
                  placeholder="An epigraph, a date, a dedication"
                  value={marker.page.epigraph}
                  onChange={(event) => patchPage({ epigraph: event.target.value })}
                />
              </label>

              {/* The summary is the chapter's words (addendum 19 §7), and
                  not the epigraph above it: prose about what the chapter
                  covers, set in the reading face. A book's alone. */}
              {book ? (
                <label className="field">
                  <span>What this chapter covers</span>
                  <textarea
                    aria-label="Summary"
                    rows={5}
                    placeholder="A paragraph on what the reader will find in it"
                    value={marker.page.summary}
                    onChange={(event) => patchPage({ summary: event.target.value })}
                  />
                </label>
              ) : null}

              {/* A suggested summary (addendum 19 §7): absent where the
                  account cannot have one, present and refusing where the
                  chapter has nothing under it yet — that reason being the
                  chapter's rather than the account's. */}
              {book && offer?.available ? (
                <div className="aid-actions chapter-summary-ask">
                  <button
                    type="button"
                    className="ghost small"
                    disabled={asking || summaryRefusal(file, marker.id) !== null}
                    title={summaryRefusal(file, marker.id) ?? 'Read every section under this chapter and suggest a summary'}
                    onClick={() => void askForSummary(marker.id)}
                  >
                    {asking
                      ? 'Reading the chapter…'
                      : marker.page.summary.trim().length > 0
                        ? 'Suggest another summary'
                        : 'Suggest a summary'}
                  </button>
                  {summaryRefusal(file, marker.id) ? (
                    <span className="muted small">{summaryRefusal(file, marker.id)}</span>
                  ) : chapterTextIsCut(file, marker.id) ? (
                    <span className="muted small">A long chapter: only its first part is read.</span>
                  ) : null}
                </div>
              ) : null}
              {askError ? (
                <p className="error small" role="alert">
                  {askError}
                </p>
              ) : null}

              {/* The machine's, in its own box and never in the author's. */}
              {book && marker.page.suggestedSummary.trim().length > 0 ? (
                <div className="aid-offer">
                  <h5>Suggested</h5>
                  <p className="aid-offer-text">{marker.page.suggestedSummary}</p>
                  <div className="aid-actions">
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() =>
                        onUpdate((current) => {
                          const taken = acceptSummary(current, marker.id);
                          setUndo(taken.replaced);
                          return taken.file;
                        })
                      }
                    >
                      Use this
                    </button>
                    <button
                      type="button"
                      className="ghost small"
                      onClick={() => onUpdate((current) => discardSummary(current, marker.id))}
                    >
                      Discard
                    </button>
                    {marker.page.summary.trim().length > 0 ? (
                      <span className="muted small">Replaces what you wrote. You can put it back.</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {book && undo && undo.length > 0 ? (
                <div className="aid-undo">
                  <span className="muted small">Your earlier wording is still here.</span>
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => {
                      patchPage({ summary: undo });
                      setUndo(null);
                    }}
                  >
                    Put it back
                  </button>
                  <button type="button" className="ghost small" onClick={() => setUndo(null)}>
                    Keep the new one
                  </button>
                </div>
              ) : null}

              {/* Where the picture sits is set by the tiles under *This page*
                  (addendum 20 §9c). The select that used to stand here is
                  gone: two controls for one act on one screen are two answers
                  to *where does the graphic go*. */}

              <label className="field">
                <span>On the page</span>
                <select
                  aria-label="Alignment"
                  value={marker.page.align}
                  onChange={(event) => patchPage({ align: event.target.value as 'left' | 'center' })}
                >
                  <option value="center">Centred</option>
                  <option value="left">Ranged left</option>
                </select>
              </label>

              <div className="chapter-page-art">
                {/* On a book the picture comes from the graphics library
                    (addendum 19 §7), so one place holds the pictures and a
                    diagram replaced there is replaced here. */}
                {book ? (
                  <label className="field">
                    <span>The graphic, from the library</span>
                    <select
                      aria-label="Graphic from the library"
                      value={(marker.page.assetId as string | null) ?? ''}
                      onChange={(event) =>
                        patchPage({ assetId: event.target.value ? (event.target.value as AssetId) : null })
                      }
                    >
                      <option value="">{library.length === 0 ? 'The library is empty' : 'None'}</option>
                      {library.map((asset) => (
                        <option key={asset.id as string} value={asset.id as string}>
                          {asset.name || 'Untitled picture'}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {book && marker.page.assetId && templateOf(file, marker) !== 'full_page' ? (
                  <label className="field">
                    <span>How wide — {marker.page.graphicWidth}% of the page</span>
                    <input
                      type="range"
                      aria-label="Graphic width"
                      min={5}
                      max={100}
                      value={marker.page.graphicWidth}
                      onChange={(event) => patchPage({ graphicWidth: Number(event.target.value) })}
                    />
                  </label>
                ) : null}
                <input
                  ref={picker}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => takeImage(event.target.files?.[0])}
                />
                <input
                  ref={artPicker}
                  type="file"
                  accept="image/*"
                  aria-label="Full page art file"
                  hidden
                  onChange={(event) => {
                    takeFullPageArt(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
                {/* The page as a piece of art, brought in whole (addendum 19 §7). */}
                <button
                  type="button"
                  className="raised small"
                  title="A picture that is the whole page, edge to edge: the number and the name are in the art, and nothing is set over it"
                  onClick={() => artPicker.current?.click()}
                >
                  Import full page art…
                </button>
                {templateOf(file, marker) === 'full_page' ? (
                  <p className="muted small">
                    {chapterLeafContent(file, placed!).image
                      ? 'This page is its art, edge to edge; the number and the name are whatever the art carries.'
                      : 'Full-page art, with no picture yet: the page draws as the middle template until one is imported.'}
                  </p>
                ) : null}
                {book && marker.page.assetId ? null : (
                  <button type="button" className="ghost small" onClick={() => picker.current?.click()}>
                    {marker.page.image ? 'Change the illustration' : book ? 'Or add a picture of its own' : 'Add an illustration'}
                  </button>
                )}
                {marker.page.image && !(book && marker.page.assetId) ? (
                  <>
                    {/* Width means nothing on a page that is its art. */}
                    {templateOf(file, marker) !== 'full_page' ? (
                    <label className="field">
                      <span>How wide — {marker.page.image.width}% of the page</span>
                      <input
                        type="range"
                        aria-label="Illustration width"
                        min={5}
                        max={100}
                        value={marker.page.image.width}
                        onChange={(event) =>
                          patchPage({ image: { ...marker.page.image!, width: Number(event.target.value) } })
                        }
                      />
                    </label>
                    ) : null}
                    <button type="button" className="ghost small danger" onClick={() => patchPage({ image: null })}>
                      Remove it
                    </button>
                  </>
                ) : null}
                {imageError ? (
                  <p className="error small" role="alert">
                    {imageError}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* The look, and it is the book's. Said on the heading rather than
              left to be discovered by styling one and finding all of them
              changed. The same fields stand in Layout's Book settings, from
              one component, because *how every chapter page is set* applies
              to the whole book and a second copy would be a second answer. */}
          {marker ? <PagePlacementFields file={file} marker={marker} onUpdate={onUpdate} /> : null}
          <ChapterStyleFields file={file} onUpdate={onUpdate} marker={marker ?? null} />
        </div>

        {/* The sheet, at the shape it will print. The same component the
            preview and the printed page use, so this is not a likeness. */}
        <aside className="chapter-page-preview" aria-label="The page">
          {/* Said once at the foot rather than beside an absent button: why
              a summary cannot be suggested is a fact about the account. */}
          {book && offer && !offer.available && offer.reason ? (
            <p className="muted small aids-why">{offer.reason}</p>
          ) : null}
          <div className="chapter-leaf-sheet">
            {marker && marker.page.include ? (
              <ChapterLeaf chapter={chapterLeafContent(file, placed!)} style={style} />
            ) : (
              <p className="muted">This chapter runs straight on from the last one.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

/** The three controls one line of type needs, and no more. Shared with the Layout room's part pages. */
/**
 * How every chapter page is set (addendum 02 §12a): the face, the lines, the
 * template, the rule and the drop — all of them the **book's** rather than
 * one chapter's, which is why they stand together under one heading.
 *
 * It is a component rather than markup inside the dialog because Layout's
 * **Book settings** shows the same fields (addendum 22 §6a, from Ken: *the
 * story titles should be adjustable with a setting*). What applies to the
 * whole book belongs where the whole book is set, and one component in two
 * places cannot disagree about what a chapter heading looks like.
 */
export function ChapterStyleFields({
  file,
  onUpdate,
  marker,
}: {
  file: ProjectFile;
  onUpdate: ChapterPageDialogProps['onUpdate'];
  /** The chapter being looked at, where there is one: it may override the template. */
  marker: StoryMarker | null;
}) {
  const style = chapterPageStyleOf(file);
  const book = isInstructional(file.project.format);
  const nouns = nounsFor(file.project.format);
  const unit = nouns.division.toLowerCase();
  return (
    <section>
      <h3>How every {unit} page is set</h3>
      <p className="muted small">
        One look for the whole book — a {unit} whose heading is in a different face reads as a mistake
        rather than as a design.
      </p>

      <label className="field">
        <span>Face</span>
        <select
          aria-label={`${nouns.division} page face`}
          value={style.face}
          onChange={(event) => onUpdate((current) => setChapterPageStyle(current, { face: event.target.value as TypeFace }))}
        >
          {TYPE_FACES.map((face) => (
            <option key={face} value={face}>
              {FACE_WORDS[face]}
            </option>
          ))}
        </select>
      </label>

      <Line
        label="The number"
        style={style.number}
        onPatch={(patch) => onUpdate((current) => setChapterLineStyle(current, 'number', patch))}
      />
      <Line
        label="The name"
        style={style.title}
        onPatch={(patch) => onUpdate((current) => setChapterLineStyle(current, 'title', patch))}
      />
      <Line
        label="The lines under it"
        style={style.epigraph}
        tracking={false}
        onPatch={(patch) => onUpdate((current) => setChapterLineStyle(current, 'epigraph', patch))}
      />
      {book ? (
        <Line
          label="The summary"
          style={style.summary}
          tracking={false}
          onPatch={(patch) => onUpdate((current) => setChapterLineStyle(current, 'summary', patch))}
        />
      ) : null}

      <p className="muted small">
        Where the picture sits on a {unit} page, how far down the heading falls and how much air stands over the
        first paragraph belong to <em>that</em> page — double-click it in the book to set them.
      </p>
    </section>
  );
}

/**
 * How **one page** is placed (addendum 20 §9c, from Ken: *these are the
 * settings that need to be removed from book settings … these are going to be
 * page settings*).
 *
 * The split the section rests on: **placement belongs to the page and type
 * belongs to the book**. Where a picture sits, how far down a heading falls
 * and how much air stands over the first paragraph are decisions about one
 * page, and a writer setting a book makes them page by page; the face and the
 * sizes stay book-wide, because a reader who turns to chapter nine and finds
 * its heading in another face has found a mistake rather than a design.
 *
 * Every control offers **the book's** as its starting point and says so, so a
 * page nobody has touched follows the book and goes on following it.
 */
export function PagePlacementFields({
  file,
  marker,
  onUpdate,
}: {
  file: ProjectFile;
  marker: StoryMarker;
  onUpdate: ChapterPageDialogProps['onUpdate'];
}) {
  const book = chapterPageStyleOf(file);
  const placement = chapterPlacementOf(file, marker);
  const template = templateOf(file, marker);
  const own = marker.page;
  const nouns = nounsFor(file.project.format);
  const unit = nouns.division.toLowerCase();
  const patch = (page: Parameters<typeof setChapterPage>[2]) => onUpdate((current) => setChapterPage(current, marker.id, page));
  return (
    <section>
      <h3>This page</h3>

      {/* The four templates as tiles. The page's own where it has chosen one,
          the book's otherwise — `minimumSetups`' shape (addendum 19 §7). */}
      <div className="chapter-template-tiles" role="radiogroup" aria-label="Template">
        {CHAPTER_TEMPLATES.map((one) => (
          <button
            key={one}
            type="button"
            role="radio"
            aria-checked={template === one}
            className={template === one ? 'chapter-template-tile on' : 'chapter-template-tile'}
            title={CHAPTER_TEMPLATE_WORDS[one].says}
            onClick={() => patch({ template: one })}
          >
            <span className={`chapter-template-sketch ${one}`} aria-hidden="true">
              <i className="sketch-graphic" />
              <i className="sketch-head" />
              <i className="sketch-words" />
            </span>
            <span className="chapter-template-name">{CHAPTER_TEMPLATE_WORDS[one].name}</span>
          </button>
        ))}
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={placement.rule}
          onChange={(event) => patch({ rule: event.target.checked })}
        />
        <span>A rule under the heading</span>
      </label>

      <label className="field">
        <span>How far down the page — {placement.dropInches.toFixed(1)}″</span>
        <input
          type="range"
          aria-label="How far down the page"
          min={0}
          max={6}
          step={0.1}
          value={placement.dropInches}
          onChange={(event) => patch({ dropInches: Number(event.target.value) })}
        />
      </label>
      <label className="field">
        <span>
          Above the first paragraph — {placement.openingLines} {placement.openingLines === 1 ? 'line' : 'lines'}
        </span>
        <input
          type="range"
          aria-label="Above the first paragraph"
          min={0}
          max={16}
          step={1}
          value={placement.openingLines}
          onChange={(event) => patch({ openingLines: Number(event.target.value) })}
        />
      </label>
      <p className="muted small">
        The first is the page a {unit} opens on with a leaf of its own, in inches; the second is a {unit} that
        opens above its first paragraph, in lines of the body — what it has to look right against is the text
        under it.
      </p>

      {/* Said rather than shown by a greyed control: a page that has departed
          from the book is a thing the writer wants to know, and putting it
          back is one press rather than three sliders returned by eye. */}
      {placesItself(marker) ? (
        <p className="muted small">
          This page is set on its own. Every other {unit} follows the book.{' '}
          <button
            type="button"
            className="ghost link"
            onClick={() => patch({ template: 'book', rule: null, dropInches: null, openingLines: null })}
          >
            Follow the book again
          </button>
        </p>
      ) : (
        <p className="muted small">
          This page follows the book — {CHAPTER_TEMPLATE_WORDS[book.template].name.toLowerCase()}, {book.dropInches.toFixed(1)}″
          down. Changing anything here sets this page alone.
        </p>
      )}
    </section>
  );
}

export function Line({
  label,
  style,
  tracking = true,
  onPatch,
}: {
  label: string;
  style: LineStyle;
  tracking?: boolean;
  onPatch(patch: Partial<LineStyle>): void;
}) {
  return (
    <div className="chapter-line-style">
      <span className="chapter-line-label">{label}</span>
      <label className="chapter-line-control">
        <span className="muted small">Size</span>
        <input
          type="number"
          aria-label={`${label} size`}
          min={6}
          max={72}
          value={style.size}
          onChange={(event) => onPatch({ size: Number(event.target.value) })}
        />
      </label>
      <label className="chapter-line-control">
        <span className="muted small">Case</span>
        <select
          aria-label={`${label} case`}
          value={style.case}
          onChange={(event) => onPatch({ case: event.target.value as TypeCase })}
        >
          {TYPE_CASES.map((one) => (
            <option key={one} value={one}>
              {CASE_WORDS[one]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label={`${label} bold`}
        aria-pressed={style.bold}
        className={style.bold ? 'chapter-line-mark on' : 'chapter-line-mark'}
        onClick={() => onPatch({ bold: !style.bold })}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        aria-label={`${label} italic`}
        aria-pressed={style.italic}
        className={style.italic ? 'chapter-line-mark on' : 'chapter-line-mark'}
        onClick={() => onPatch({ italic: !style.italic })}
      >
        <i>I</i>
      </button>
      {tracking ? (
        <label className="chapter-line-control">
          <span className="muted small">Tracking</span>
          <input
            type="range"
            aria-label={`${label} tracking`}
            min={0}
            max={50}
            value={style.tracking}
            onChange={(event) => onPatch({ tracking: Number(event.target.value) })}
          />
        </label>
      ) : null}
    </div>
  );
}
