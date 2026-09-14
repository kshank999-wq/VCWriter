import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MAX_CHAPTER_IMAGE_BYTES,
  TYPE_CASES,
  TYPE_FACES,
  chapterChoices,
  chapterPageContent,
  chapterPageStyleOf,
  chapterPagesEverywhere,
  placedMarkers,
  setChapterLineStyle,
  setChapterPage,
  setChapterPageStyle,
  updateMarker,
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
export function ChapterPageDialog({ file, open, onClose, onUpdate }: ChapterPageDialogProps) {
  const dialog = useModal(open);
  return (
    <dialog ref={dialog} className="lane-dialog chapter-page-dialog" aria-label="Chapter page" onClose={onClose}>
      {open ? <Body file={file} onClose={onClose} onUpdate={onUpdate} /> : null}
    </dialog>
  );
}

const CASE_WORDS: Record<TypeCase, string> = {
  as_typed: 'As typed',
  capitals: 'CAPITALS',
  small_caps: 'Small caps',
};

const FACE_WORDS: Record<TypeFace, string> = {
  manuscript: 'The manuscript’s',
  serif: 'Serif',
  sans: 'Sans serif',
};

function Body({
  file,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  onClose(): void;
  onUpdate: ChapterPageDialogProps['onUpdate'];
}) {
  const chapters = useMemo(() => chapterChoices(file), [file]);
  const [chosen, setChosen] = useState<StoryMarkerId | null>(chapters[0]?.markerId ?? null);
  const [imageError, setImageError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

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

  if (chapters.length === 0) {
    return (
      <>
        <header className="lane-dialog-title">
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
      <header className="lane-dialog-title">
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
                <input
                  ref={picker}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => takeImage(event.target.files?.[0])}
                />
                <button type="button" className="ghost small" onClick={() => picker.current?.click()}>
                  {marker.page.image ? 'Change the illustration' : 'Add an illustration'}
                </button>
                {marker.page.image ? (
                  <>
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
              changed. */}
          <section>
            <h3>How every chapter page is set</h3>
            <p className="muted small">
              One look for the whole book — a chapter whose heading is in a different face reads as a
              mistake rather than as a design.
            </p>

            <label className="field">
              <span>Face</span>
              <select
                aria-label="Face"
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

            <label className="check">
              <input
                type="checkbox"
                checked={style.rule}
                onChange={(event) => onUpdate((current) => setChapterPageStyle(current, { rule: event.target.checked }))}
              />
              <span>A rule under the heading</span>
            </label>

            <label className="field">
              <span>How far down the page — {style.dropInches.toFixed(1)}″</span>
              <input
                type="range"
                aria-label="Drop"
                min={0}
                max={6}
                step={0.1}
                value={style.dropInches}
                onChange={(event) =>
                  onUpdate((current) => setChapterPageStyle(current, { dropInches: Number(event.target.value) }))
                }
              />
            </label>
          </section>
        </div>

        {/* The sheet, at the shape it will print. The same component the
            preview and the printed page use, so this is not a likeness. */}
        <aside className="chapter-page-preview" aria-label="The page">
          <div className="chapter-leaf-sheet">
            {marker && marker.page.include ? (
              <ChapterLeaf chapter={chapterPageContent(placed!)} style={style} />
            ) : (
              <p className="muted">This chapter runs straight on from the last one.</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

/** The three controls one line of type needs, and no more. */
function Line({
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
