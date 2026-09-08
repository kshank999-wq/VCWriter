import { useEffect, useMemo, useRef, useState } from 'react';
import {
  findInManuscript,
  replaceAll,
  replaceMatches,
  type BeatId,
  type Match,
  type ProjectFile,
} from '@vcwriter/domain';

interface FindPanelProps {
  file: ProjectFile;
  open: boolean;
  /** Opened by "Find and replace" rather than plain "Find". */
  replacing: boolean;
  onClose(): void;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Stepping through the matches takes the rest of the workspace with it. */
  onGoTo(beatId: BeatId): void;
  /** Set by the Editor menu's "Find next" so the panel can step from outside. */
  step: number;
}

/**
 * Find and replace (addendum 02 §13).
 *
 * It searches the manuscript, not the screen: every beat in story order,
 * whatever is scrolled into view and whatever is switched off. Stepping to a
 * match selects its beat, so the Script scrolls to it and the timeline and
 * the inspector follow, which is what makes this useful in a document that
 * is several windows wide.
 *
 * Replacing is deliberately two buttons rather than one: **Replace** takes
 * the match in hand and leaves the rest, and **Replace all** says how many
 * it changed afterwards. Nothing here rewrites anything the writer has not
 * pressed a button for.
 */
export function FindPanel({ file, open, replacing, onClose, onUpdate, onGoTo, step }: FindPanelProps) {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [at, setAt] = useState(0);
  const [said, setSaid] = useState<string | null>(null);
  const box = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => findInManuscript(file, query, { matchCase, wholeWord }),
    [file, query, matchCase, wholeWord],
  );

  useEffect(() => {
    if (open) box.current?.focus();
  }, [open, replacing]);

  // The search moved under the cursor: keep the position in range.
  useEffect(() => setAt((current) => (matches.length === 0 ? 0 : Math.min(current, matches.length - 1))), [matches]);

  const go = (index: number) => {
    if (matches.length === 0) return;
    const next = (index + matches.length) % matches.length;
    setAt(next);
    const match = matches[next];
    if (match) onGoTo(match.beatId);
  };

  // "Find next" from the menu, without the panel having focus.
  const stepped = useRef(step);
  useEffect(() => {
    if (step === stepped.current) return;
    stepped.current = step;
    go(at + 1);
    // `go` closes over the current matches, which is what a step wants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  if (!open) return null;
  const current = matches[at];

  const replaceOne = () => {
    if (!current) return;
    onUpdate((project) => replaceMatches(project, [current as Match], replacement));
    setSaid('Replaced one.');
  };

  const replaceEvery = () => {
    let count = 0;
    onUpdate((project) => {
      const done = replaceAll(project, query, replacement, { matchCase, wholeWord });
      count = done.replaced;
      return done.file;
    });
    setSaid(count === 0 ? 'Nothing to replace.' : `Replaced ${count}.`);
  };

  return (
    <div className="find-panel" role="search" aria-label="Find in the manuscript">
      <div className="find-row">
        <input
          ref={box}
          type="search"
          aria-label="Find"
          placeholder="Find in the manuscript"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSaid(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') go(at + (event.shiftKey ? -1 : 1));
            if (event.key === 'Escape') onClose();
          }}
        />
        <span className="find-count muted" aria-live="polite">
          {query.length === 0 ? '' : matches.length === 0 ? 'No matches' : `${at + 1} of ${matches.length}`}
        </span>
        <button type="button" className="ghost" aria-label="Previous match" disabled={matches.length === 0} onClick={() => go(at - 1)}>
          ◀
        </button>
        <button type="button" className="ghost" aria-label="Next match" disabled={matches.length === 0} onClick={() => go(at + 1)}>
          ▶
        </button>
        <label className="check">
          <input type="checkbox" aria-label="Match case" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} />
          <span>Aa</span>
        </label>
        <label className="check">
          <input type="checkbox" aria-label="Whole words" checked={wholeWord} onChange={(event) => setWholeWord(event.target.checked)} />
          <span>Word</span>
        </label>
        <button type="button" className="ghost" aria-label="Close find" onClick={onClose}>
          ×
        </button>
      </div>

      {replacing ? (
        <div className="find-row">
          <input
            aria-label="Replace with"
            placeholder="Replace with"
            value={replacement}
            onChange={(event) => {
              setReplacement(event.target.value);
              setSaid(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onClose();
            }}
          />
          <button type="button" className="ghost" disabled={!current} onClick={replaceOne}>
            Replace
          </button>
          <button type="button" className="ghost" disabled={matches.length === 0} onClick={replaceEvery}>
            Replace all
          </button>
          <span className="muted" aria-live="polite">
            {said ?? ''}
          </span>
        </div>
      ) : null}

      {/* The line each match is on, so a writer can pick the right one
          rather than stepping through forty of them. */}
      {matches.length > 0 ? (
        <ul className="find-hits" aria-label="Matches">
          {matches.slice(0, 40).map((match, index) => (
            <li key={`${match.elementId}-${match.start}`}>
              <button
                type="button"
                className={index === at ? 'find-hit on' : 'find-hit'}
                onClick={() => go(index)}
              >
                <span className="muted">…{match.before}</span>
                <mark>{match.text}</mark>
                <span className="muted">{match.after}…</span>
              </button>
            </li>
          ))}
          {matches.length > 40 ? <li className="muted find-more">…and {matches.length - 40} more</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
