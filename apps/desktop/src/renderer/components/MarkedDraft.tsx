import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CITATION_TOKEN,
  plainInline,
  MARK_COLOURS,
  MARK_KIND_NAMES,
  describeMark,
  markFromSelection,
  marksOn,
  segmentsFor,
  type BeatRevision,
  type ManuscriptSegment,
  type Mark,
  type MarkKind,
} from '@vcwriter/domain';

/**
 * A markup draft, read with its marks on it (addendum 07 §27.2).
 *
 * A markup brought into the script arrives as a draft of the beat named for
 * the writer ("MA markup"). Read beside the working draft, it shows the marked
 * text the way the room showed it — highlight, strike, underline, a note, a
 * suggested wording — and the marks listed underneath with who made them. It
 * is never edited: it is the record of what was said.
 */
export const MarkedDraft = ({
  revision,
  onArchive,
  cites = null,
}: {
  revision: BeatRevision;
  cites?: ReadonlyMap<string, string> | null;
  /** Send it to the archive, or bring it back. Nothing is erased. */
  onArchive(archived: boolean): void;
}): React.ReactElement => (
  <div className="marked-draft">
    <div className="marked-draft-page">
      {revision.manuscript.elements.map((element) => (
        <MarkedLine key={element.id} id={element.id as string} type={element.type} text={element.text} marks={marksOn(revision.marks, element.id as string)} cites={cites} />
      ))}
    </div>
    <div className="marked-draft-list">
      <p className="muted small">
        {revision.marks.length === 1 ? 'One mark' : `${revision.marks.length} marks`}
        {revision.markedBy ? ` by ${revision.markedBy}` : ''}
        {revision.archived ? ' · archived' : ''}
      </p>
      <ol>
        {revision.marks.map((mark) => (
          <li key={mark.id}>
            <span className={`marked-kind marked-kind-${mark.kind}`} style={mark.kind === 'highlight' ? { background: mark.colour } : undefined}>
              {MARK_KIND_NAMES[mark.kind]}
            </span>{' '}
            {describeMark(mark)}
          </li>
        ))}
      </ol>
      <button type="button" className="ghost small" onClick={() => onArchive(!revision.archived)}>
        {revision.archived ? 'Bring back from the archive' : 'Dealt with — send to archive'}
      </button>
    </div>
  </div>
);

/**
 * **A citation reads as its marker, not its code** (from Ken, 21 November: *fix
 * the citation codes in mark up mode*). The token's characters stay in the
 * line, unseen, so a mark's place in the words is the same as the draft's;
 * the chip shows the footnote number or *Flesch 1946*.
 */
const withCites = (text: string, cites: ReadonlyMap<string, string> | null): React.ReactNode => {
  if (!text.includes('[^')) return text;
  const parts: React.ReactNode[] = [];
  let rest = text;
  let n = 0;
  for (let at = rest.indexOf('[^'); at >= 0; at = rest.indexOf('[^')) {
    const token = CITATION_TOKEN.exec(rest.slice(at));
    if (!token) {
      parts.push(rest.slice(0, at + 2));
      rest = rest.slice(at + 2);
      continue;
    }
    if (at > 0) parts.push(rest.slice(0, at));
    const label = cites?.get(token[1]!) ?? '';
    parts.push(
      <span key={`c${n++}`} className={label ? 'marked-cite' : 'marked-cite missing'} data-marker={label || '?'} title={label ? `Citation ${label}` : 'A citation whose source is missing'}>
        <span className="marked-cite-code">{token[0]}</span>
      </span>,
    );
    rest = rest.slice(at + token[0].length);
  }
  if (rest) parts.push(rest);
  return parts;
};

export const MarkedLine = ({
  id,
  type,
  text,
  marks,
  numbers,
  cites = null,
}: {
  id: string;
  type: string;
  text: string;
  marks: Mark[];
  /** Each citation's label by its key, so a token reads as its marker rather than its code (from Ken, 21 November). */
  cites?: ReadonlyMap<string, string> | null;
  /** Each mark's number, for the little circle at its end (from Ken, 13 November). */
  numbers?: ReadonlyMap<string, number>;
}) => {
  const segments = segmentsFor(text, marks);
  let at = 0;
  return (
    <p className={`marked-line marked-${type}`} data-line={id}>
      {segments.map((segment, index) => {
        const from = at;
        at += segment.text.length;
        if (segment.marks.length === 0) return <span key={index}>{withCites(segment.text, cites)}</span>;
        const highlight = segment.marks.find((mark) => mark.kind === 'highlight');
        const ending = segment.marks.filter(
          (mark) => mark.kind === 'suggest' && Math.min(mark.end, text.length) === from + segment.text.length,
        );
        return (
          <span key={index}>
            <span
              className={segment.marks.map((mark) => `marked-${mark.kind}`).join(' ')}
              style={highlight ? { background: highlight.colour } : undefined}
              title={segment.marks.map((mark) => describeMark(mark)).join('\n')}
            >
              {withCites(segment.text, cites)}
            </span>
            {ending.map((mark) => (
              <ins key={mark.id} className="marked-insert" title={describeMark(mark)}>
                {mark.replacement}
              </ins>
            ))}
            {numbers
              ? segment.marks
                  .filter((mark) => Math.min(mark.end, text.length) === from + segment.text.length && numbers.has(mark.id))
                  .map((mark) => (
                    <span key={`n${mark.id}`} className="mark-num" title={describeMark(mark)}>
                      {numbers.get(mark.id)}
                    </span>
                  ))
              : null}
          </span>
        );
      })}
      {marks
        .filter((mark) => mark.end === mark.start)
        .map((mark) => (
          <span key={mark.id} className="marked-pin" title={mark.note}>
            {numbers?.has(mark.id) ? <span className="mark-num">{numbers.get(mark.id)}</span> : '✎'}
          </span>
        ))}
    </p>
  );
};

/** Where a selection sits inside one line, in characters, or null if it spans lines. */
const selectionIn = (container: HTMLElement): { elementId: string; text: string; start: number; end: number } | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const lineOf = (node: Node | null): HTMLElement | null =>
    (node instanceof HTMLElement ? node : node?.parentElement)?.closest('[data-line]') ?? null;
  const line = lineOf(range.startContainer);
  if (!line || line !== lineOf(range.endContainer) || !container.contains(line)) return null;
  const before = document.createRange();
  before.selectNodeContents(line);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  return { elementId: line.dataset['line'] ?? '', text: line.textContent ?? '', start, end: start + range.toString().length };
};

const COLOUR_NAMES = ['Yellow', 'Green', 'Pink', 'Blue'];
const TOOLS: MarkKind[] = ['highlight', 'strike', 'underline', 'note', 'suggest'];
const TOOL_WORDS: Record<MarkKind, string> = {
  highlight: 'Highlight',
  strike: 'Cross out',
  underline: 'Underline',
  note: 'Note',
  suggest: 'Suggest',
};
/** What each tool looks like on its button, so the row reads at a glance. */
const TOOL_FACES: Record<MarkKind, React.ReactNode> = {
  highlight: <span className="tool-face tool-face-highlight" aria-hidden="true">ab</span>,
  strike: <s className="tool-face" aria-hidden="true">ab</s>,
  underline: <u className="tool-face" aria-hidden="true">ab</u>,
  note: <span className="tool-face" aria-hidden="true">✎</span>,
  suggest: <span className="tool-face" aria-hidden="true">⇄</span>,
};

/**
 * Marking up in the beat writing screen (addendum 07 §27.3).
 *
 * From Ken: *a markup ability … so you can mark up your own work, or someone
 * that opens it can mark up the work. Even if they're not in writer's room.*
 * The page becomes a copy of the draft that can be marked and not typed in;
 * **Save as markup draft** keeps the marks, with a copy of the text they were
 * made on, as a draft named for whoever made them ("KS markup").
 */
export const MarkingPage = ({
  manuscript,
  name,
  onName,
  onSave,
  onCancel,
  toolsSlot = null,
  cites = null,
}: {
  cites?: ReadonlyMap<string, string> | null;
  manuscript: ManuscriptSegment;
  /**
   * **Where the tools go: just under the top bar** (from Ken, 21 November:
   * *the markup tools come into the middle of the page. It should just be
   * open something just under the top bar*) — the writing screen's toolbar
   * row, where B, I and U stand while writing. Absent, they draw in place.
   */
  toolsSlot?: HTMLElement | null;
  /** Whoever is marking, remembered on this computer. */
  name: string;
  onName(name: string): void;
  onSave(marks: Mark[]): void;
  onCancel(): void;
}): React.ReactElement => {
  const page = useRef<HTMLDivElement | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [colour, setColour] = useState<string>(MARK_COLOURS[0]);
  const [asking, setAsking] = useState<null | { kind: 'note' | 'suggest'; at: NonNullable<ReturnType<typeof selectionIn>> }>(null);
  const [words, setWords] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  /** Each mark's number: its place in the list, 1 first. */
  const numbers = new Map(marks.map((mark, index) => [mark.id, index + 1] as const));

  const id = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m${Date.now()}${Math.random()}`;

  const apply = (kind: MarkKind) => {
    const at = page.current ? selectionIn(page.current) : null;
    if (!at) {
      setSaid('Select some words on one line first.');
      return;
    }
    if (kind === 'note' || kind === 'suggest') {
      setAsking({ kind, at });
      setWords(kind === 'suggest' ? at.text.slice(at.start, at.end) : '');
      setSaid(null);
      return;
    }
    const made = markFromSelection({ id: id(), ...at, kind, colour });
    if ('reason' in made) {
      setSaid('Select some words first.');
      return;
    }
    setMarks((now) => [...now, made]);
    window.getSelection()?.removeAllRanges();
    setSaid(null);
  };

  const finish = () => {
    if (!asking) return;
    const made = markFromSelection({
      id: id(),
      ...asking.at,
      kind: asking.kind,
      colour,
      note: asking.kind === 'note' ? words : '',
      replacement: asking.kind === 'suggest' ? words : '',
    });
    if ('reason' in made) {
      setSaid(asking.kind === 'note' ? 'Write the note first.' : 'Write the suggested wording first.');
      return;
    }
    setMarks((now) => [...now, made]);
    setAsking(null);
    setWords('');
    window.getSelection()?.removeAllRanges();
  };

  const tools = (
      <div className="marking-tools" role="toolbar" aria-label="Markup tools">
        {TOOLS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`marking-tool marking-tool-${kind}`}
            // Keep the selection: pressing the button must not clear it.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(kind)}
            title={`${MARK_KIND_NAMES[kind]} the selected words`}
            aria-label={TOOL_WORDS[kind]}
            style={kind === 'highlight' ? ({ '--marker': colour } as React.CSSProperties) : undefined}
          >
            {TOOL_FACES[kind]}
            <span>{TOOL_WORDS[kind]}</span>
          </button>
        ))}
        <span className="marking-swatches">
          {MARK_COLOURS.map((one, index) => (
            <button
              key={one}
              type="button"
              className={one === colour ? 'marking-swatch on' : 'marking-swatch'}
              style={{ background: one }}
              aria-label={`${COLOUR_NAMES[index] ?? 'This'} highlighter`}
              title={`${COLOUR_NAMES[index] ?? 'This'} highlighter`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setColour(one)}
            />
          ))}
        </span>
      </div>
  );

  return (
    <div className="marking">
      {toolsSlot ? createPortal(tools, toolsSlot) : tools}

      {asking ? (
        <div className="marking-ask">
          <label>
            <span className="muted small">{asking.kind === 'note' ? 'Your note' : 'Suggested wording'}</span>
            <textarea rows={2} value={words} autoFocus onChange={(event) => setWords(event.target.value)} />
          </label>
          <span className="marking-row">
            <button type="button" className="ghost small" onClick={() => setAsking(null)}>
              Cancel
            </button>
            <button type="button" className="small" onClick={finish}>
              Add
            </button>
          </span>
        </div>
      ) : null}

      <div className="marking-sheet">
      <div className="marked-draft-page marking-page" ref={page}>
        {manuscript.elements.length === 0 ? <p className="muted">Nothing written in this draft yet.</p> : null}
        {manuscript.elements.map((element) => (
          <MarkedLine
            key={element.id}
            id={element.id as string}
            type={element.type}
            text={element.text}
            marks={marksOn(marks, element.id as string)}
            numbers={numbers}
            cites={cites}
          />
        ))}
      </div>

      {/* **The markup notes, numbered, in the margin** (from Ken, 13
          November): one line for every mark, its number the circle's on the
          page, with room to say something about it. */}
      <aside className="marked-draft-list marking-margin" aria-label="Markup notes">
        <h4>Markup notes</h4>
        {marks.length > 0 ? (
          <ol className="markup-note-list">
            {marks.map((mark, index) => (
              <li key={mark.id} className="markup-note">
                <span className="mark-num">{index + 1}</span>
                <span className="markup-note-text">
                  <span
                    className={`marked-kind marked-kind-${mark.kind}`}
                    style={mark.kind === 'highlight' ? { background: mark.colour } : undefined}
                  >
                    {MARK_KIND_NAMES[mark.kind]}
                  </span>{' '}
                  {plainInline(mark.quote).trim() ? <q>{plainInline(mark.quote).trim().slice(0, 80)}</q> : null}
                  {mark.kind === 'suggest' ? <span> → “{mark.replacement}”</span> : null}
                  <textarea
                    className="markup-note-say"
                    rows={2}
                    placeholder={mark.kind === 'note' ? 'The note' : 'Say something about it (optional)'}
                    aria-label={`Note for mark ${index + 1}`}
                    value={mark.note}
                    onChange={(event) =>
                      setMarks((now) => now.map((one) => (one.id === mark.id ? { ...one, note: event.target.value } : one)))
                    }
                  />
                  <button
                    type="button"
                    className="ghost small"
                    onClick={() => setMarks((now) => now.filter((one) => one.id !== mark.id))}
                  >
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">Select words on the page, then pick a tool above. Each mark gets a number here and on the page.</p>
        )}
        <label className="marking-name">
          <span className="muted small">Your name, on the marks</span>
          <input type="text" value={name} placeholder="Your name" onChange={(event) => onName(event.target.value)} />
        </label>
        <span className="marking-row">
          <button type="button" className="ghost small" onClick={onCancel}>
            Stop marking up
          </button>
          <button
            type="button"
            className="small"
            disabled={marks.length === 0 || !name.trim()}
            title={!name.trim() ? 'Put your name on the marks first' : undefined}
            onClick={() => onSave(marks)}
          >
            Save as markup draft
          </button>
        </span>
        {said ? (
          <p className="small" role="status">
            {said}
          </p>
        ) : null}
      </aside>
      </div>
    </div>
  );
};

export default MarkedDraft;
