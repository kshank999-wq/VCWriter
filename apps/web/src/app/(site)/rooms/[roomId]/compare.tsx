'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MARK_COLOURS,
  MARK_KIND_NAMES,
  describeMark,
  manuscriptElements,
  markFromSelection,
  marksOn,
  parseProjectFile,
  segmentsFor,
  type Mark,
  type MarkKind,
} from '@vcwriter/domain';

/**
 * Compare and mark up (addendum 07 §27).
 *
 * From Ken: *see three versions across the screen at a time, or two, or just
 * the one, and mark it up … like how you can mark up a PDF … and send that
 * back.* One, two or three panes, each holding any version the visitor may
 * read; the marks made on a pane are kept in this browser until they are sent,
 * so a reload loses nothing.
 */

export interface VersionChoice {
  id: string;
  /** "Jo · Submitted · Nov 9, 3:12 PM" */
  label: string;
  writer: string;
  colour: string;
  authorId: string | null;
}

interface Line {
  id: string;
  type: string;
  text: string;
}

const linesOf = (raw: unknown): Line[] =>
  manuscriptElements(parseProjectFile(raw), { includeSceneHeadings: true })
    .filter((element) => element.text.trim().length > 0)
    .map((element) => ({ id: element.id as string, type: element.type as string, text: element.text }));

const useVersionLines = (roomId: string, versionId: string): { lines: Line[] | null; error: string | null } => {
  const [state, setState] = useState<{ lines: Line[] | null; error: string | null }>({ lines: null, error: null });
  useEffect(() => {
    if (!versionId) return;
    let live = true;
    setState({ lines: null, error: null });
    fetch(`/api/rooms/${roomId}/versions/${versionId}`, { headers: { accept: 'application/json' } })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { file?: unknown; error?: string };
        if (!live) return;
        if (!response.ok || !body.file) {
          setState({ lines: null, error: body.error ?? 'That version could not be opened.' });
          return;
        }
        try {
          setState({ lines: linesOf(body.file), error: null });
        } catch {
          setState({ lines: null, error: 'That version could not be read.' });
        }
      })
      .catch(() => live && setState({ lines: null, error: 'That version could not be opened.' }));
    return () => {
      live = false;
    };
  }, [roomId, versionId]);
  return state;
};

const COLOUR_NAMES: Record<string, string> = {
  [MARK_COLOURS[0]]: 'Yellow',
  [MARK_COLOURS[1]]: 'Green',
  [MARK_COLOURS[2]]: 'Pink',
  [MARK_COLOURS[3]]: 'Blue',
};

const storeKey = (roomId: string, versionId: string) => `vcw-markup:${roomId}:${versionId}`;

const loadDraft = (roomId: string, versionId: string): Mark[] => {
  try {
    const raw = window.localStorage.getItem(storeKey(roomId, versionId));
    return raw ? (JSON.parse(raw) as Mark[]) : [];
  } catch {
    return [];
  }
};

const saveDraft = (roomId: string, versionId: string, marks: Mark[]) => {
  try {
    if (marks.length === 0) window.localStorage.removeItem(storeKey(roomId, versionId));
    else window.localStorage.setItem(storeKey(roomId, versionId), JSON.stringify(marks));
  } catch {
    // A private window: the marks still work, they just do not outlive a reload.
  }
};

/** Where a selection sits inside one line, in characters, or null if it spans lines. */
const selectionIn = (container: HTMLElement): { elementId: string; text: string; start: number; end: number } | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const lineOf = (node: Node | null): HTMLElement | null =>
    (node instanceof HTMLElement ? node : node?.parentElement)?.closest('[data-line]') ?? null;
  const startLine = lineOf(range.startContainer);
  const endLine = lineOf(range.endContainer);
  if (!startLine || startLine !== endLine || !container.contains(startLine)) return null;
  const textNode = startLine.querySelector('[data-text]') ?? startLine;
  const before = document.createRange();
  before.selectNodeContents(textNode);
  before.setEnd(range.startContainer, range.startOffset);
  const start = before.toString().length;
  const end = start + range.toString().length;
  return { elementId: startLine.dataset['line'] ?? '', text: textNode.textContent ?? '', start, end };
};

/** One line of the script, drawn with its marks. */
const MarkedLine = ({ line, marks }: { line: Line; marks: Mark[] }) => {
  const segments = segmentsFor(line.text, marks);
  const points = marks.filter((mark) => mark.end === mark.start);
  let at = 0;
  return (
    <p className={`mk-line mk-${line.type}`} data-line={line.id}>
      <span data-text>
        {segments.map((segment, index) => {
          const from = at;
          at += segment.text.length;
          if (segment.marks.length === 0) return <span key={index}>{segment.text}</span>;
          const classes = segment.marks.map((mark) => `mk-${mark.kind}`).join(' ');
          const highlight = segment.marks.find((mark) => mark.kind === 'highlight');
          const said = segment.marks.map((mark) => describeMark(mark)).join('\n');
          // A suggestion's wording is shown once, after the last run it covers.
          const ending = segment.marks.filter((mark) => mark.kind === 'suggest' && Math.min(mark.end, line.text.length) === from + segment.text.length);
          // The suggested wording sits after the struck words, not inside them,
          // so it is not struck through itself.
          return (
            <span key={index}>
              <span className={classes} style={highlight ? { background: highlight.colour } : undefined} title={said}>
                {segment.text}
              </span>
              {ending.map((mark) => (
                <ins key={mark.id} className="mk-insert" title={describeMark(mark)}>
                  {mark.replacement}
                </ins>
              ))}
            </span>
          );
        })}
      </span>
      {points.map((mark) => (
        <span key={mark.id} className="mk-pin" title={mark.note}>
          ✎
        </span>
      ))}
    </p>
  );
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `m${Date.now()}${Math.random()}`;

/** One pane: a version, its marks, and (where allowed) the tools to add more. */
const Pane = ({
  roomId,
  versions,
  versionId,
  onPick,
  canMark,
}: {
  roomId: string;
  versions: VersionChoice[];
  versionId: string;
  onPick(id: string): void;
  canMark: boolean;
}) => {
  const { lines, error } = useVersionLines(roomId, versionId);
  const choice = versions.find((one) => one.id === versionId) ?? null;
  const [marks, setMarks] = useState<Mark[]>([]);
  const [colour, setColour] = useState<string>(MARK_COLOURS[0]);
  const [asking, setAsking] = useState<null | { kind: 'note' | 'suggest'; at: ReturnType<typeof selectionIn> }>(null);
  const [words, setWords] = useState('');
  const [note, setNote] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pageEl, setPageEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (versionId) setMarks(loadDraft(roomId, versionId));
    setSaid(null);
  }, [roomId, versionId]);

  const keep = useCallback(
    (next: Mark[]) => {
      setMarks(next);
      saveDraft(roomId, versionId, next);
    },
    [roomId, versionId],
  );

  const apply = (kind: MarkKind) => {
    if (!pageEl) return;
    const at = selectionIn(pageEl);
    if (!at) {
      setSaid('Select some words on one line of this version first.');
      return;
    }
    if (kind === 'note' || kind === 'suggest') {
      setAsking({ kind, at });
      setWords(kind === 'suggest' ? at.text.slice(at.start, at.end) : '');
      setSaid(null);
      return;
    }
    const made = markFromSelection({ id: newId(), ...at, kind, colour });
    if ('reason' in made) {
      setSaid('Select some words first.');
      return;
    }
    keep([...marks, made]);
    window.getSelection()?.removeAllRanges();
    setSaid(null);
  };

  const finishAsking = () => {
    if (!asking?.at) return;
    const made = markFromSelection({
      id: newId(),
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
    keep([...marks, made]);
    setAsking(null);
    setWords('');
    window.getSelection()?.removeAllRanges();
  };

  const send = async () => {
    setBusy(true);
    setSaid(null);
    const response = await fetch(`/api/rooms/${roomId}/markups`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ versionId, marks, note }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setSaid(body.error ?? 'The markup could not be sent.');
      return;
    }
    keep([]);
    setNote('');
    setSaid(`Sent to ${choice?.writer ?? 'the writer'}.`);
  };

  return (
    <section className="mk-pane" style={{ '--writer': choice?.colour ?? '#c9a45c' } as React.CSSProperties}>
      <header className="mk-pane-head">
        <select value={versionId} onChange={(event) => onPick(event.target.value)} aria-label="Version">
          {versions.map((one) => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </select>
      </header>

      {canMark ? (
        <div className="mk-tools" role="toolbar" aria-label="Markup tools">
          {(['highlight', 'strike', 'underline', 'note', 'suggest'] as MarkKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`mk-tool mk-tool-${kind}`}
              // Keep the selection: a press on the button must not clear it.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => apply(kind)}
              title={MARK_KIND_NAMES[kind]}
            >
              {kind === 'highlight' ? 'Highlight' : kind === 'strike' ? 'Strike' : kind === 'underline' ? 'Underline' : kind === 'note' ? 'Note' : 'Suggest'}
            </button>
          ))}
          <span className="mk-swatches">
            {MARK_COLOURS.map((one) => (
              <button
                key={one}
                type="button"
                className={`mk-swatch${one === colour ? ' on' : ''}`}
                style={{ background: one }}
                aria-label={`${COLOUR_NAMES[one] ?? 'This'} highlighter`}
                title={`${COLOUR_NAMES[one] ?? 'This'} highlighter`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setColour(one)}
              />
            ))}
          </span>
        </div>
      ) : null}

      {asking ? (
        <div className="mk-ask">
          <label className="field">
            <span>{asking.kind === 'note' ? 'Your note' : 'Suggested wording'}</span>
            <textarea rows={2} value={words} autoFocus onChange={(event) => setWords(event.target.value)} />
          </label>
          <span className="mk-ask-row">
            <button type="button" className="button small secondary" onClick={() => setAsking(null)}>
              Cancel
            </button>
            <button type="button" className="button small" onClick={finishAsking}>
              Add
            </button>
          </span>
        </div>
      ) : null}

      <div className="mk-page" ref={setPageEl}>
        {error ? <p className="error small">{error}</p> : null}
        {!lines && !error ? <p className="small muted">Opening…</p> : null}
        {lines?.length === 0 ? <p className="small muted">This version has no script yet.</p> : null}
        {lines?.map((line) => <MarkedLine key={line.id} line={line} marks={marksOn(marks, line.id)} />)}
      </div>

      {canMark ? (
        <footer className="mk-foot">
          {marks.length > 0 ? (
            <ol className="mk-list">
              {marks.map((mark) => (
                <li key={mark.id}>
                  <span className={`mk-kind mk-kind-${mark.kind}`} style={mark.kind === 'highlight' ? { background: mark.colour } : undefined}>
                    {MARK_KIND_NAMES[mark.kind]}
                  </span>
                  <span className="mk-said">{describeMark(mark)}</span>
                  <button type="button" className="mk-remove" onClick={() => keep(marks.filter((one) => one.id !== mark.id))}>
                    Remove
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="small muted">Select words in the version, then pick a tool.</p>
          )}
          <label className="field">
            <span>A note with it (optional)</span>
            <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button
            type="button"
            className="button"
            disabled={busy || (marks.length === 0 && !note.trim()) || !choice?.authorId}
            onClick={() => void send()}
          >
            {busy ? 'Sending…' : `Send markup to ${choice?.writer ?? 'the writer'}`}
          </button>
          {said ? <p className="small" role="status">{said}</p> : null}
        </footer>
      ) : said ? (
        <p className="small" role="status">
          {said}
        </p>
      ) : null}
    </section>
  );
};

export function Compare({
  roomId,
  versions,
  canMark,
  startWith,
}: {
  roomId: string;
  versions: VersionChoice[];
  canMark: boolean;
  /** A version to open in the first pane: the one an assignment's Mark up pressed (§28). */
  startWith?: string;
}) {
  const [count, setCount] = useState<1 | 2 | 3>(startWith ? 1 : versions.length >= 2 ? 2 : 1);
  const initial = useMemo(
    () => (startWith ? [startWith, ...versions.filter((one) => one.id !== startWith).map((one) => one.id)] : versions.map((one) => one.id)).slice(0, 3),
    [versions, startWith],
  );
  const [picked, setPicked] = useState<string[]>(() => {
    const out = [...initial];
    while (out.length < 3) out.push(versions[0]?.id ?? '');
    return out;
  });

  if (versions.length === 0) {
    return (
      <p>
        There is nothing to compare yet. Versions appear here once a writer submits or saves a named version, and once the
        room agrees on a master.
      </p>
    );
  }

  const goFull = () => {
    const box = document.querySelector('.mk-compare');
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.requestFullscreen?.();
  };

  return (
    <div className="mk-compare">
      <div className="mk-layout" role="radiogroup" aria-label="How many side by side">
        <span className="small muted">Side by side:</span>
        {([1, 2, 3] as const).map((one) => (
          <button
            key={one}
            type="button"
            role="radio"
            aria-checked={count === one}
            className={`button small${count === one ? '' : ' secondary'}`}
            onClick={() => setCount(one)}
          >
            {one}
          </button>
        ))}
        <button type="button" className="button small secondary mk-full" onClick={goFull}>
          Full screen
        </button>
      </div>
      <div className={`mk-panes mk-panes-${count}`}>
        {picked.slice(0, count).map((versionId, index) => (
          <Pane
            key={index}
            roomId={roomId}
            versions={versions}
            versionId={versionId}
            canMark={canMark}
            onPick={(id) => setPicked((now) => now.map((one, at) => (at === index ? id : one)))}
          />
        ))}
      </div>
    </div>
  );
}

/** A markup as it was sent, read by the writer it went to (or whoever sent it). */
export function MarkupView({
  roomId,
  versionId,
  marks,
  markupId,
  mine,
}: {
  roomId: string;
  versionId: string;
  marks: Mark[];
  markupId: string;
  /** True for the writer it was sent to: opening it says it has been seen. */
  mine: boolean;
}) {
  const { lines, error } = useVersionLines(roomId, versionId);
  useEffect(() => {
    if (!mine) return;
    void fetch(`/api/rooms/${roomId}/markups/${markupId}`, { method: 'PATCH' });
  }, [roomId, markupId, mine]);

  return (
    <div className="mk-review">
      <div className="mk-page">
        {error ? <p className="error small">{error}</p> : null}
        {!lines && !error ? <p className="small muted">Opening…</p> : null}
        {lines?.map((line) => <MarkedLine key={line.id} line={line} marks={marksOn(marks, line.id)} />)}
      </div>
      <ol className="mk-list">
        {marks.map((mark) => (
          <li key={mark.id}>
            <span className={`mk-kind mk-kind-${mark.kind}`} style={mark.kind === 'highlight' ? { background: mark.colour } : undefined}>
              {MARK_KIND_NAMES[mark.kind]}
            </span>
            <span className="mk-said">{describeMark(mark)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
