'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  INTEGRATION_KIND_NAMES,
  applyIntegrations,
  contributorsOn,
  integrationAuthors,
  integrationRefusalText,
  locate,
  passageText,
  segmentText,
  wordDiff,
  type IntegrationKind,
  type IntegrationOp,
  type ManuscriptSegment,
  type PassageAnchor,
} from '@vcwriter/domain';

/**
 * The integration workspace (addendum 07 §30; spec v1.1 §6.3).
 *
 * The current master beat on the left, editable only through the four
 * operations; one to three writers' versions of the same beat on the right.
 * Highlight a passage in a writer's version, highlight where it goes in the
 * master, choose Replace, Insert before, Insert after or Delete. Each step is
 * applied to a working draft that is not the master; Commit makes it the
 * beat's next version.
 */

export interface IntegrateSource {
  versionId: string;
  submissionId: string | null;
  authorId: string;
  label: string;
  /** The writer's beat, or null where their version has no such beat. */
  segment: ManuscriptSegment | null;
}

export interface Person {
  name: string;
  initials: string;
  colour: string;
}

interface Selected {
  anchor: PassageAnchor;
  quote: string;
}

/** Where the selection sits in a pane, by element id and character offset. */
export const selectionIn = (pane: HTMLElement): Selected | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const elementOf = (node: Node | null): HTMLElement | null =>
    (node instanceof HTMLElement ? node : node?.parentElement)?.closest('[data-el]') ?? null;
  const a = elementOf(range.startContainer);
  const b = elementOf(range.endContainer);
  if (!a || !b || !pane.contains(a) || !pane.contains(b)) return null;
  const offsetIn = (element: HTMLElement, node: Node, offset: number) => {
    const before = document.createRange();
    before.selectNodeContents(element);
    before.setEnd(node, offset);
    return before.toString().length;
  };
  return {
    anchor: {
      startElementId: a.dataset['el'] ?? '',
      startOffset: offsetIn(a, range.startContainer, range.startOffset),
      endElementId: b.dataset['el'] ?? '',
      endOffset: offsetIn(b, range.endContainer, range.endOffset),
    },
    quote: '',
  };
};

function Pane({
  id,
  segment,
  chosen,
  onPick,
  people,
  showCredits,
}: {
  id: string;
  segment: ManuscriptSegment;
  chosen: Selected | null;
  onPick(selected: Selected): void;
  people?: Record<string, Person>;
  showCredits?: boolean;
}) {
  const range = chosen ? locate(segment.elements, chosen.anchor) : null;
  return (
    <div
      className="ig-page"
      data-pane={id}
      onMouseUp={(event) => {
        const picked = selectionIn(event.currentTarget);
        if (!picked) return;
        const quote = passageText(segment, picked.anchor) ?? '';
        onPick({ anchor: picked.anchor, quote });
      }}
    >
      {segment.elements.length === 0 ? <p className="muted small">This beat has no text yet.</p> : null}
      {segment.elements.map((element, index) => {
        const inside = range && index >= range.start.index && index <= range.end.index;
        const from = inside ? (index === range!.start.index ? range!.start.offset : 0) : 0;
        const to = inside ? (index === range!.end.index ? range!.end.offset : element.text.length) : 0;
        const credits = showCredits ? contributorsOn(element) : [];
        return (
          <div key={element.id as string} className={`ig-line ig-${element.type}`}>
            {credits.length > 0 ? (
              <span className="ig-credits" aria-label="Contributed by">
                {credits.map((who) => (
                  <span
                    key={who}
                    className="tk-who sm"
                    style={{ background: people?.[who]?.colour ?? '#888' }}
                    title={people?.[who]?.name ?? 'A writer'}
                  >
                    {people?.[who]?.initials ?? '?'}
                  </span>
                ))}
              </span>
            ) : null}
            <p data-el={element.id as string}>
              {inside ? (
                <>
                  {element.text.slice(0, from)}
                  {to > from ? <mark className="ig-sel">{element.text.slice(from, to)}</mark> : <span className="ig-caret" />}
                  {element.text.slice(to)}
                </>
              ) : (
                element.text || ' '
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function Integrate({
  roomId,
  beatId,
  beatLabel,
  baseHash,
  master,
  revisionName,
  history,
  sources,
  people,
}: {
  roomId: string;
  beatId: string;
  beatLabel: string;
  baseHash: string;
  master: ManuscriptSegment;
  revisionName: string;
  /** The beat's earlier versions, by name. */
  history: string[];
  sources: IntegrateSource[];
  people: Record<string, Person>;
}) {
  const router = useRouter();
  const key = `vcw-integrate:${roomId}:${beatId}:${baseHash}`;
  const [ops, setOps] = useState<IntegrationOp[]>([]);
  const [source, setSource] = useState<(Selected & { versionId: string }) | null>(null);
  const [dest, setDest] = useState<Selected | null>(null);
  const [preview, setPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);

  // A saved working draft for this beat, as it stood when it was opened.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved) setOps(JSON.parse(saved) as IntegrationOp[]);
    } catch {
      // Nothing saved, or storage is off: start clean.
    }
  }, [key]);

  const sourceMap = useMemo(
    () => new Map(sources.filter((one) => one.segment).map((one) => [one.versionId, one.segment!])),
    [sources],
  );
  const replayed = useMemo(() => applyIntegrations(master, ops, sourceMap), [master, ops, sourceMap]);
  const working = 'reason' in replayed ? master : replayed;
  const brokenStep = 'reason' in replayed ? replayed : null;

  const reasonFor = (kind: IntegrationKind): string | null => {
    if (kind === 'delete') return dest && dest.quote ? null : 'Select master text to delete.';
    if (!source || !source.quote.trim()) return 'Select the writer’s passage first.';
    if (!dest) return kind === 'replace' ? 'Select the master text it replaces.' : 'Click or select where it goes in the master.';
    if (kind === 'replace' && !dest.quote) return 'Select the master text it replaces.';
    return null;
  };

  const apply = (kind: IntegrationKind) => {
    const why = reasonFor(kind);
    if (why) {
      setSaid(why);
      return;
    }
    const from = kind === 'delete' ? null : sources.find((one) => one.versionId === source!.versionId)!;
    const op: IntegrationOp = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `op${Date.now()}`,
      kind,
      source: from
        ? { submissionId: from.submissionId, versionId: from.versionId, authorId: from.authorId, beatId, anchor: source!.anchor, quote: source!.quote }
        : null,
      dest: { beatId, anchor: dest!.anchor, quote: dest!.quote },
      actorId: '',
      at: new Date().toISOString(),
    };
    const next = applyIntegrations(working, [op], sourceMap);
    if ('reason' in next) {
      setSaid(integrationRefusalText(next));
      return;
    }
    setOps((now) => [...now, op]);
    setSource(null);
    setDest(null);
    setSaid(`${INTEGRATION_KIND_NAMES[kind]} applied to the working draft. The master is unchanged until you commit.`);
    window.getSelection()?.removeAllRanges();
  };

  const save = () => {
    try {
      window.localStorage.setItem(key, JSON.stringify(ops));
      setSaid('Working draft saved on this computer.');
    } catch {
      setSaid('This browser would not save it.');
    }
  };

  const commit = async () => {
    setBusy(true);
    setSaid(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/integrate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          beatId,
          baseHash,
          ops: ops.map((op) => ({ id: op.id, kind: op.kind, source: op.source && { ...op.source, authorId: undefined }, dest: op.dest })),
        }),
      });
      const answer = (await response.json().catch(() => ({}))) as { error?: string; stale?: boolean; to?: string; from?: string };
      if (!response.ok) {
        setStale(Boolean(answer.stale));
        setSaid(answer.error ?? 'That did not go through.');
        return;
      }
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Already gone.
      }
      setOps([]);
      setSaid(`Committed: ${beatLabel} is now ${answer.to}. ${answer.from} is kept in its version history.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const authors = integrationAuthors(ops);
  const kinds: IntegrationKind[] = ['replace', 'insert_before', 'insert_after', 'delete'];

  return (
    <div className="ig">
      <div className="ig-bar" role="toolbar" aria-label="Integration">
        <span className="ig-state small">
          <strong>Source:</strong> {source ? `“${source.quote.slice(0, 40)}${source.quote.length > 40 ? '…' : ''}”` : 'none'} ·{' '}
          <strong>Master:</strong> {dest ? (dest.quote ? `“${dest.quote.slice(0, 40)}${dest.quote.length > 40 ? '…' : ''}”` : 'a point') : 'none'}
        </span>
        {kinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`button small${kind === 'replace' ? '' : ' secondary'}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => apply(kind)}
            aria-disabled={reasonFor(kind) !== null}
            title={reasonFor(kind) ?? INTEGRATION_KIND_NAMES[kind]}
          >
            {INTEGRATION_KIND_NAMES[kind]}
          </button>
        ))}
        <span className="ig-sep" />
        <button type="button" className="button small secondary" disabled={ops.length === 0} onClick={() => setOps((now) => now.slice(0, -1))}>
          Undo last
        </button>
        <button type="button" className="button small secondary" onClick={() => setPreview((now) => !now)}>
          {preview ? 'Hide diff' : 'Preview diff'}
        </button>
        <button type="button" className="button small secondary" onClick={save}>
          Save draft
        </button>
        <button type="button" className="button small secondary" onClick={() => setShowHistory((now) => !now)}>
          Version history
        </button>
        <button
          type="button"
          className="button small secondary"
          disabled={ops.length === 0}
          onClick={() => {
            if (window.confirm('Throw away the working draft? The master is not touched.')) {
              setOps([]);
              try {
                window.localStorage.removeItem(key);
              } catch {
                // Nothing to remove.
              }
            }
          }}
        >
          Cancel
        </button>
        <button type="button" className="button small" disabled={busy || ops.length === 0 || brokenStep !== null} onClick={() => void commit()}>
          Commit new beat version
        </button>
      </div>

      {said ? (
        <p className={stale ? 'error small' : 'small'} role="status">
          {said}{' '}
          {stale ? (
            <button
              type="button"
              className="button small secondary"
              onClick={() => {
                setOps([]);
                setStale(false);
                router.refresh();
              }}
            >
              Start again from the current master
            </button>
          ) : null}
        </p>
      ) : null}
      {brokenStep ? (
        <p className="error small" role="alert">
          A saved step no longer fits: {integrationRefusalText(brokenStep)} Undo it or cancel the draft.
        </p>
      ) : null}

      <p className="small muted">
        {ops.length === 0
          ? 'Highlight a passage in a writer’s version, then highlight (or click) the place in the master, then choose what to do.'
          : `${ops.length} ${ops.length === 1 ? 'step' : 'steps'} in the working draft${authors.length > 0 ? `, from ${authors.map((id) => people[id]?.name ?? 'a writer').join(', ')}` : ''}. Committing makes this the beat’s next version after ${revisionName}.`}
      </p>

      {showHistory ? (
        <div className="ig-history small">
          <strong>{beatLabel}</strong>: {[...history, `${revisionName} (current)`].join(' → ')}. Every earlier version stays in the beat’s draft list and in the room’s master history.
        </div>
      ) : null}

      {preview ? (
        <div className="ig-diff">
          {wordDiff(segmentText(master), segmentText(working)).map((part, index) =>
            part.kind === 'same' ? (
              <span key={index}>{part.text}</span>
            ) : part.kind === 'added' ? (
              <ins key={index}>{part.text}</ins>
            ) : (
              <del key={index}>{part.text}</del>
            ),
          )}
        </div>
      ) : null}

      <div className={`ig-panes ig-panes-${Math.min(sources.length, 3) + 1}`}>
        <section className="ig-pane ig-master">
          <h3>
            Master · {beatLabel} · {revisionName}
            {ops.length > 0 ? <span className="ig-tag">working draft</span> : null}
          </h3>
          <Pane id="master" segment={working} chosen={dest} onPick={(picked) => setDest(picked)} people={people} showCredits />
        </section>
        {sources.map((one) => {
          const who = people[one.authorId];
          return (
            <section key={one.versionId} className="ig-pane" style={{ borderTopColor: who?.colour ?? '#888' }}>
              <h3>
                <span className="tk-who sm" style={{ background: who?.colour ?? '#888' }}>
                  {who?.initials ?? '?'}
                </span>{' '}
                {one.label}
              </h3>
              {one.segment ? (
                <Pane
                  id={one.versionId}
                  segment={one.segment}
                  chosen={source && source.versionId === one.versionId ? source : null}
                  onPick={(picked) => (picked.quote ? setSource({ ...picked, versionId: one.versionId }) : undefined)}
                />
              ) : (
                <p className="small muted">This version has no text for this beat.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
