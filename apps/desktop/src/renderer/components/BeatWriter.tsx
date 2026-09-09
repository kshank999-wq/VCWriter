import { useMemo, useState } from 'react';
import {
  countWords,
  draftText,
  draftsOf,
  findLane,
  findUnit,
  newId,
  pageBreaks,
  reformatUntyped,
  startRevision,
  switchRevision,
  updateBeat,
  type Beat,
  type BeatId,
  type BeatRevisionId,
  type ManuscriptElementId,
  type ProjectFile,
} from '@vcwriter/domain';
import { BeatBody } from './BeatBody';
import { ManuscriptDataLists } from './ManuscriptDataLists';
import { usePreference } from '../use-split';

const NEW_REVISION = '__new__';
const WORKING = '__working__';

/** What the page can be scaled to, as a fraction of its true printed size. */
const ZOOMS = [0.75, 0.85, 1, 1.15, 1.35, 1.6];

export interface BeatWriterProps {
  file: ProjectFile;
  beat: Beat;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Writing in a beat makes it the selection, so the rest of the app follows. */
  onSelect?(beatId: BeatId): void;
  /** Absent in a window of its own, where the window's own close does it. */
  onClose?(): void;
  /** Offered where it can be honoured: the workspace, not a satellite window. */
  onPopOut?(): void;
}

/**
 * The writing screen (addendum 02 §7): one beat, a full page.
 *
 * This is where the writing is done, and it is a page — 8½ by 11 at the
 * margins a script is actually printed at, so a line that will break on
 * paper breaks here, and the rules across it are the printed page breaks
 * from the same paginator the PDF uses. The element flow is the one every
 * screenwriter has in their hands already: Return gives the element that
 * conventionally follows, Tab re-types the line you are on, cues and
 * sluglines complete from what the script already knows.
 *
 * There is no sidebar. The bar across the top carries the three things that
 * belong to the beat as a whole: its **name**, centred; the **version** it
 * is being written in; and whether it is **in the script**. Everything else
 * about the beat — colour, status, links, what it sets up — is the
 * inspector's business, and stays out of the way of the page.
 */
export function BeatWriter({ file, beat, onUpdate, onSelect, onClose, onPopOut }: BeatWriterProps) {
  const unit = findUnit(file, beat.unitId);
  const lane = unit ? findLane(file, unit.laneId) : undefined;
  const [naming, setNaming] = useState(false);
  /** Which draft is being read beside the one being written; null for none. */
  const [comparing, setComparing] = useState<string | null>(null);
  const [fromCopy, setFromCopy] = useState(false);
  const [name, setName] = useState('');
  const [zoom, setZoom] = usePreference('writerZoom', 1);

  // Where the printed pages break, from the one paginator the exports use.
  // Only this beat's elements are in it; the rest of the map costs nothing.
  const breaks = useMemo(() => pageBreaks(file), [file]);

  // The tool offers itself only when it would actually change something, so
  // a beat that is already a script leaves it greyed out.
  const reformatted = useMemo(
    () => reformatUntyped(beat.manuscript.elements, file.project.format),
    [beat.manuscript.elements, file.project.format],
  );
  const untyped =
    reformatted.length !== beat.manuscript.elements.length ||
    reformatted.some((part, position) => {
      const original = beat.manuscript.elements[position];
      return !original || original.type !== part.type || original.text !== part.text;
    });

  /**
   * Re-read the beat's plain lines as a script, keeping every line that was
   * deliberately styled exactly as it is — and keeping the identity of the
   * elements the text came from, so nothing hanging off them is lost.
   */
  const reformat = () => {
    onUpdate((current) => {
      const beatNow = current.beats.find((candidate) => candidate.id === beat.id);
      if (!beatNow) return current;
      const source = beatNow.manuscript.elements;
      const elements = reformatUntyped(source, current.project.format).map((part) => {
        const original = part.from === undefined ? undefined : source[part.from];
        return original
          ? { ...original, type: part.type, text: part.text }
          : {
              id: newId<ManuscriptElementId>(),
              type: part.type,
              text: part.text,
              characterId: null,
              attributes: {},
            };
      });
      return updateBeat(current, beat.id, { manuscript: { elements } });
    });
  };

  /** The draft being read alongside, resolved to its text. */
  const against = useMemo(() => {
    if (comparing === null) return null;
    const revision = beat.revisions.find((candidate) => (candidate.id as string) === comparing);
    const manuscript = draftText(beat, comparing);
    return revision && manuscript ? { name: revision.name, manuscript } : null;
  }, [beat, comparing]);

  const chooseVersion = (value: string) => {
    if (value === NEW_REVISION) {
      setName(`Draft ${beat.revisions.length + 2}`);
      setFromCopy(false);
      setNaming(true);
      return;
    }
    if (value === WORKING) return;
    onUpdate((current) => switchRevision(current, beat.id, value as BeatRevisionId));
  };

  return (
    <>
      <ManuscriptDataLists file={file} />

      <header className="writer-bar" style={{ borderLeftColor: beat.color ?? lane?.color }}>
        <span className="writer-caption muted">Beat name</span>
        <input
          className="writer-name"
          aria-label="Beat name"
          placeholder="Name this beat"
          value={beat.title}
          onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { title: event.target.value }))}
        />
        <div className="writer-tools">
          <label className="revision-picker">
            <span className="muted">Draft</span>
            <select aria-label="Draft" value={WORKING} onChange={(event) => chooseVersion(event.target.value)}>
              <option value={WORKING}>{beat.revisionName}</option>
              {beat.revisions.map((revision) => (
                <option key={revision.id} value={revision.id}>
                  {revision.name}
                </option>
              ))}
              <option value={NEW_REVISION}>New draft…</option>
            </select>
          </label>

          {/* Two drafts side by side: the one being written, and one to read
              against it. Only offered when there is another to read. */}
          {beat.revisions.length > 0 ? (
            <label className="check" title="Read another draft beside this one">
              <input
                type="checkbox"
                aria-label="Compare"
                checked={comparing !== null}
                onChange={(event) => {
                  const on = event.target.checked;
                  setComparing(on ? (beat.revisions[0]?.id as string) : null);
                  // Two pages need two pages' worth of room; the page size
                  // comes down to fit and the writer can put it back.
                  if (on && zoom > 0.85) setZoom(0.75);
                }}
              />
              <span>Compare</span>
            </label>
          ) : null}

          {comparing !== null ? (
            <label className="revision-picker">
              <span className="muted">Against</span>
              <select
                aria-label="Draft to compare"
                value={comparing}
                onChange={(event) => setComparing(event.target.value)}
              >
                {beat.revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {revision.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="check" title="Off: the beat keeps its text and leaves the script">
            <input
              type="checkbox"
              aria-label="In script"
              checked={beat.inScript}
              onChange={(event) => onUpdate((current) => updateBeat(current, beat.id, { inScript: event.target.checked }))}
            />
            <span>In script</span>
          </label>
          {onPopOut ? (
            <button
              type="button"
              className="ghost"
              aria-label="Open this beat in its own window"
              title="Open this beat in its own window — put it on another monitor"
              onClick={onPopOut}
            >
              ⧉
            </button>
          ) : null}
          {onClose ? (
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          ) : null}
        </div>
      </header>

      {naming ? (
        <form
          className="revision-naming"
          onSubmit={(event) => {
            event.preventDefault();
            onUpdate((current) => startRevision(current, beat.id, name, { from: fromCopy ? 'copy' : 'blank' }));
            setNaming(false);
            setName('');
          }}
        >
          <span className="muted">
            {beat.revisionName} is kept whole, and the page clears: a new draft is the scene written again.
          </span>
          <input aria-label="New draft name" value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          <label className="check" title="Start from what is there instead of a blank page">
            <input
              type="checkbox"
              aria-label="Start from a copy"
              checked={fromCopy}
              onChange={(event) => setFromCopy(event.target.checked)}
            />
            <span>Start from a copy</span>
          </label>
          <button type="submit">Start</button>
          <button type="button" className="ghost" onClick={() => setNaming(false)}>
            Cancel
          </button>
        </form>
      ) : null}

      <div className={comparing !== null ? 'writer-body comparing' : 'writer-body'}>
        {/* The page itself, at the size it prints, scaled by the zoom. */}
        <div className="writer-sheet" style={{ '--page-zoom': zoom } as React.CSSProperties}>
          {comparing !== null ? <p className="writer-column-name muted">{beat.revisionName} — writing</p> : null}
          <BeatBody
            file={file}
            beat={beat}
            breaks={breaks}
            onUpdate={onUpdate}
            onActivate={() => onSelect?.(beat.id)}
          />
        </div>

        {/* The draft being read against it. Read-only on purpose: two live
            editors of the same scene is a way to lose an afternoon's work. */}
        {against ? (
          <div className="writer-sheet reading" style={{ '--page-zoom': zoom } as React.CSSProperties}>
            <p className="writer-column-name muted">{against.name} — reading</p>
            <BeatBody
              file={file}
              beat={{ ...beat, manuscript: against.manuscript, revisions: [] }}
              onUpdate={() => undefined}
              readOnly
            />
          </div>
        ) : null}
      </div>

      <footer className="writer-status muted">
        <span>
          {unit ? `${unit.sequenceLabel || unit.kind} ${unit.title || ''}`.trim() : ''}
          {lane ? ` · ${lane.name}` : ''}
        </span>
        <span>
          {countWords(beat.manuscript)} words
          {beat.inScript ? '' : ' · not in the script'}
        </span>
        <span className="writer-actions">
          {/* Text that came in as plain text, read as a script (§7.1). It
              only ever re-types lines nobody styled, so it is safe to press
              and pressing it twice does nothing further. */}
          <button
            type="button"
            className="ghost"
            disabled={!untyped}
            title={untyped ? 'Read the plain lines as sluglines, cues and dialogue' : 'Nothing left to reformat'}
            onClick={reformat}
          >
            Reformat
          </button>
          <label className="writer-zoom">
            <span className="muted">Page</span>
            <select aria-label="Page size" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
              {ZOOMS.map((step) => (
                <option key={step} value={step}>
                  {Math.round(step * 100)}%
                </option>
              ))}
            </select>
          </label>
          <span>Return for the next element · Tab to change its type</span>
        </span>
      </footer>
    </>
  );
}
