import { useMemo, useRef, useState } from 'react';
import {
  MARKER_NUMBERINGS,
  MAX_CHAPTER_IMAGE_BYTES,
  chapterPageContent,
  hasChapterPages,
  markerNumbering,
  placedMarkers,
  removeMarker,
  setChapterPage,
  updateMarker,
  type MarkerNumbering,
  type ProjectFile,
  type StoryMarkerId,
  type StoryMarkerKind,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

interface MarkerDialogProps {
  file: ProjectFile;
  markerId: StoryMarkerId | null;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

const KINDS: ReadonlyArray<{ value: StoryMarkerKind; label: string }> = [
  { value: 'act', label: 'Act' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'part', label: 'Part' },
  { value: 'sequence', label: 'Sequence' },
  { value: 'note', label: 'Just a note' },
];

/**
 * A marker, opened from the timeline (addendum 02 §11).
 *
 * What is in here depends on what the project is. A **novel** or a **short
 * story** puts a leaf between its chapters, so this is where that page is
 * designed: which of the number, the name, an epigraph and a device it
 * carries, and how it sits on the paper. A **screenplay** prints no such
 * thing between its acts, so instead of a page to design it has a place to
 * write down what this point in the story is for.
 *
 * The numbering is the project's, not this marker's — a book whose chapters
 * are numbered three different ways is not a book — so changing it here
 * changes every marker at once, and says so.
 */
export function MarkerDialog({ file, markerId, onClose, onUpdate }: MarkerDialogProps) {
  const placed = useMemo(
    () => (markerId ? placedMarkers(file).find((candidate) => candidate.marker.id === markerId) : undefined),
    [file, markerId],
  );
  const dialog = useModal(Boolean(placed));

  return (
    <dialog ref={dialog} className="lane-dialog marker-dialog" aria-label="Marker" onClose={onClose}>
      {placed ? <Body file={file} placed={placed} onClose={onClose} onUpdate={onUpdate} /> : null}
    </dialog>
  );
}

function Body({
  file,
  placed,
  onClose,
  onUpdate,
}: {
  file: ProjectFile;
  placed: NonNullable<ReturnType<typeof placedMarkers>[number]>;
  onClose(): void;
  onUpdate: MarkerDialogProps['onUpdate'];
}) {
  const marker = placed.marker;
  const leaves = hasChapterPages(file.project.format);
  const numbering = markerNumbering(file);
  const [imageError, setImageError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const patchPage = (patch: Parameters<typeof setChapterPage>[2]) =>
    onUpdate((current) => setChapterPage(current, marker.id, patch));

  /**
   * A device for the chapter page, held in the document as a data URL. The
   * project is a text file that syncs, so this is deliberately small: a
   * printer's ornament or a small illustration, not a photograph.
   */
  const chooseImage = (fileList: FileList | null) => {
    const picked = fileList?.[0];
    if (!picked) return;
    if (picked.size > MAX_CHAPTER_IMAGE_BYTES) {
      setImageError(`That is ${(picked.size / (1024 * 1024)).toFixed(1)}MB. A chapter page holds up to 5MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageError(null);
      patchPage({ image: { dataUrl: String(reader.result), name: picked.name, width: 40 } });
    };
    reader.onerror = () => setImageError('That file could not be read.');
    reader.readAsDataURL(picked);
  };

  const preview = chapterPageContent(placed);

  return (
    <>
      <header className="lane-dialog-title marker-dialog-title">
        <span className="muted">{placed.label}</span>
        <input
          className="bar-title"
          aria-label="Marker name"
          placeholder={leaves ? 'Name this chapter' : 'Name this act'}
          value={marker.title}
          onChange={(event) => onUpdate((current) => updateMarker(current, marker.id, { title: event.target.value }))}
        />
        <select
          aria-label="Marker kind"
          value={marker.kind}
          onChange={(event) =>
            onUpdate((current) => updateMarker(current, marker.id, { kind: event.target.value as StoryMarkerKind }))
          }
        >
          {KINDS.map((kind) => (
            <option key={kind.value} value={kind.value}>
              {kind.label}
            </option>
          ))}
        </select>
        <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="marker-dialog-body">
        <div className="marker-dialog-main">
          <label className="field">
            Numbering
            <select
              aria-label="Numbering"
              value={numbering}
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
          {numbering === 'symbol' ? (
            <label className="field">
              Symbol
              <input
                aria-label="Symbol"
                value={file.settings.markerSymbol}
                onChange={(event) =>
                  onUpdate((current) => ({
                    ...current,
                    settings: { ...current.settings, markerSymbol: event.target.value },
                  }))
                }
              />
            </label>
          ) : null}
          <p className="muted">Numbering is the whole project’s: every marker counts the same way.</p>

          {leaves ? (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  aria-label="Give this chapter a page of its own"
                  checked={marker.page.include}
                  onChange={(event) => patchPage({ include: event.target.checked })}
                />
                <span>Give this chapter a page of its own</span>
              </label>

              <fieldset className="marker-page-fields" disabled={!marker.page.include}>
                <label className="check">
                  <input
                    type="checkbox"
                    aria-label="Show the number"
                    checked={marker.page.showNumber}
                    onChange={(event) => patchPage({ showNumber: event.target.checked })}
                  />
                  <span>Show the number</span>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    aria-label="Show the name"
                    checked={marker.page.showTitle}
                    onChange={(event) => patchPage({ showTitle: event.target.checked })}
                  />
                  <span>Show the name</span>
                </label>
                <label className="field">
                  Epigraph
                  <textarea
                    aria-label="Epigraph"
                    rows={4}
                    placeholder="A line under the title: a quotation, a date, a place"
                    value={marker.page.epigraph}
                    onChange={(event) => patchPage({ epigraph: event.target.value })}
                  />
                </label>
                <label className="field">
                  On the page
                  <select
                    aria-label="Alignment"
                    value={marker.page.align}
                    onChange={(event) => patchPage({ align: event.target.value as 'left' | 'center' })}
                  >
                    <option value="center">Centred</option>
                    <option value="left">Ranged left</option>
                  </select>
                </label>

                <div className="marker-device">
                  <input
                    ref={picker}
                    type="file"
                    accept="image/*"
                    aria-label="Graphic"
                    hidden
                    onChange={(event) => chooseImage(event.target.files)}
                  />
                  <button type="button" className="ghost" onClick={() => picker.current?.click()}>
                    {marker.page.image ? 'Change the graphic' : 'Add a graphic'}
                  </button>
                  {marker.page.image ? (
                    <>
                      <button type="button" className="ghost danger" onClick={() => patchPage({ image: null })}>
                        Remove
                      </button>
                      <label className="field">
                        How wide
                        <input
                          type="range"
                          min={5}
                          max={100}
                          aria-label="Graphic width"
                          value={marker.page.image.width}
                          onChange={(event) =>
                            patchPage({
                              image: { ...marker.page.image!, width: Number(event.target.value) },
                            })
                          }
                        />
                      </label>
                    </>
                  ) : null}
                  {imageError ? (
                    <p className="error" role="alert">
                      {imageError}
                    </p>
                  ) : null}
                </div>
              </fieldset>
            </>
          ) : (
            <label className="field">
              Notes
              {/* A script prints no leaf between its acts, so what a marker
                  carries here is what the writer wants to remember about
                  this point in the story. */}
              <textarea
                aria-label="Notes"
                rows={12}
                placeholder="What this act is for, what has to land in it, what it costs"
                value={marker.notes}
                onChange={(event) => onUpdate((current) => updateMarker(current, marker.id, { notes: event.target.value }))}
              />
            </label>
          )}

          <button
            type="button"
            className="ghost danger marker-remove"
            onClick={() => {
              onUpdate((current) => removeMarker(current, marker.id));
              onClose();
            }}
          >
            Remove this marker
          </button>
        </div>

        {leaves ? (
          <aside className="marker-page-preview" aria-label="The page">
            <div className="chapter-leaf-sheet" style={{ textAlign: preview.align }}>
              {marker.page.include ? (
                <>
                  {preview.label.length > 0 ? <p className="chapter-leaf-label">{preview.label}</p> : null}
                  {preview.title.length > 0 ? <p className="chapter-leaf-title">{preview.title}</p> : null}
                  {preview.image ? (
                    <img
                      className="chapter-leaf-device"
                      src={preview.image.dataUrl}
                      alt={preview.image.name}
                      style={{ width: `${preview.image.width}%` }}
                    />
                  ) : null}
                  {preview.epigraph.trim().length > 0 ? (
                    <p className="chapter-leaf-epigraph">{preview.epigraph}</p>
                  ) : null}
                </>
              ) : (
                <p className="muted">This chapter runs straight on from the last one.</p>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </>
  );
}
