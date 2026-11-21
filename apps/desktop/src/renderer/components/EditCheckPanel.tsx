import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EDIT_CATEGORY_NAMES,
  POV_NAMES,
  addToEditorDictionary,
  applyFix,
  decideFinding,
  editModeOf,
  editReviewOf,
  editorProfileOf,
  findingAnchor,
  findingPlace,
  linesInScope,
  passageAround,
  runEditCheck,
  setEditorProfile,
  setEditorRule,
  FINDING_LABELS,
  statusOf,
  switchOffRule,
  tallyReview,
  updateBeat,
  type EditCategory,
  type EditFinding,
  type EditScope,
  type EditStatus,
  type NarrativeTense,
  type PointOfView,
  type ProjectFile,
} from '@vcwriter/domain';
import { grammarHits, type GrammarProgress } from '../grammar-check';
import { AiCheckPanel } from './AiCheckPanel';

/**
 * **The Edit Check** — the Editors' first tab, refined to the VC Writer Editor
 * Refinement spec v1.0 (from Ken, 19 November: *we want to have a limited
 * editor… help in all the basic editing with point of view, grammar, let you
 * know when things are a little bit off*).
 *
 * Run it at the end of a session; work the review at the start of the next.
 * The queue down the left, the passage the finding sits in across the middle
 * (editable where it stands), and down the right why it was flagged and what
 * to do: **Accept fix** for a narrow mechanical slip, **Edit** by hand,
 * **Dismiss**, **Intentional** or **Defer**. Nothing changes until the writer
 * says so, and nothing here writes a sentence (spec §2).
 *
 * Spelling and grammar are Harper's, running in the app; the rest are the
 * Edit Check's own rules and the Daily Editor's. No AI.
 */

interface Props {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  currentUnitId: string | null;
  currentBeatId: string | null;
  /** Go to the finding's place in the manuscript. */
  onGoTo(beatId: string): void;
  /** Absent in a window of its own, where there is no Write page behind it. */
  onReturnToWriting?(): void;
  /** Bumped by Editor → AI check…, to open the AI check. */
  aiCheckAsked?: number;
}

type Show = 'open' | 'new' | 'deferred' | 'done' | 'all';
type Weight = 'all' | 'error' | 'concern' | 'info';

const SEVERITY_WORDS = { error: 'Error', concern: 'Possible concern', info: 'Note' } as const;
const STATUS_WORDS: Record<EditStatus, string> = { open: 'Open', fixed: 'Fixed', dismissed: 'Dismissed', intentional: 'Intentional', deferred: 'Deferred' };
const CONFIDENCE_WORDS = { high: 'Sure', medium: 'Fairly sure', low: 'Unsure — worth a look' } as const;
const CATEGORY_ORDER: EditCategory[] = ['spelling', 'grammar', 'punctuation', 'format', 'pov', 'story', 'structure', 'clarity', 'verbs', 'style', 'pacing'];

/** Where the writer was in the review, kept for the visit so Go to manuscript and back lands on the same finding (spec §5). */
const remembered = new Map<string, string>();

export function EditCheckPanel({ file, onUpdate, currentUnitId, currentBeatId, onGoTo, onReturnToWriting, aiCheckAsked = 0 }: Props) {
  const review = useMemo(() => editReviewOf(file), [file]);
  const profile = useMemo(() => editorProfileOf(file), [file]);
  const mode = editModeOf(file);
  const tally = useMemo(() => tallyReview(review), [review]);
  const fresh = useMemo(() => new Set(review.fresh), [review]);

  const [show, setShow] = useState<Show>('open');
  const [weight, setWeight] = useState<Weight>('all');
  const [only, setOnly] = useState<EditCategory | null>(null);
  const [scopeKind, setScopeKind] = useState<EditScope['kind']>('all');
  const [running, setRunning] = useState<GrammarProgress | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wide, setWide] = useState(false);
  const [editing, setEditing] = useState(false);
  const cancel = useRef<AbortController | null>(null);
  const [aiOpen, setAiOpen] = useState(aiCheckAsked > 0);
  useEffect(() => {
    if (aiCheckAsked > 0) setAiOpen(true);
  }, [aiCheckAsked]);

  const visible = useMemo(
    () =>
      review.findings.filter((one) => {
        const status = statusOf(review, one);
        if (only && one.category !== only) return false;
        if (weight !== 'all' && one.severity !== weight) return false;
        if (show === 'open') return status === 'open';
        if (show === 'new') return status === 'open' && fresh.has(one.key);
        if (show === 'deferred') return status === 'deferred';
        if (show === 'done') return status !== 'open' && status !== 'deferred';
        return true;
      }),
    [review, only, weight, show, fresh],
  );

  const projectKey = file.project.id as string;
  const [selectedKey, setSelectedKey] = useState<string | null>(() => remembered.get(projectKey) ?? null);
  const selected = visible.find((one) => one.key === selectedKey) ?? visible[0] ?? null;
  useEffect(() => {
    if (selected) remembered.set(projectKey, selected.key);
  }, [selected, projectKey]);
  useEffect(() => setEditing(false), [selected?.key]);

  const indexOf = selected ? visible.findIndex((one) => one.key === selected.key) : -1;
  const step = (by: number) => {
    const next = visible[Math.min(visible.length - 1, Math.max(0, indexOf + by))];
    if (next) setSelectedKey(next.key);
  };
  /** After a decision, the next one still waiting. */
  const advance = () => {
    const after = visible.slice(indexOf + 1).find((one) => statusOf(review, one) === 'open') ?? visible[indexOf + 1] ?? null;
    if (after) setSelectedKey(after.key);
  };

  const decide = (finding: EditFinding, status: EditStatus) => {
    onUpdate((current) => decideFinding(current, finding.key, status));
    advance();
  };
  const accept = (finding: EditFinding) => {
    // Asked of the file as shown first, so a refusal can say why.
    const trial = applyFix(file, finding.key);
    if (!trial.done) {
      setNotice(trial.why ?? 'That fix could not be made.');
      return;
    }
    onUpdate((current) => applyFix(current, finding.key).file);
    advance();
  };

  // Keyboard: ↑/↓ or K/J to move; A accept, D dismiss, I intentional, F defer, E edit.
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey)) return;
      if (!target?.closest('.edit-check') && document.activeElement !== document.body) return;
      const key = event.key.toLowerCase();
      if (key === 'arrowdown' || key === 'j') step(1);
      else if (key === 'arrowup' || key === 'k') step(-1);
      else if (!selected) return;
      else if (key === 'a' && selected.fix !== null) accept(selected);
      else if (key === 'd') decide(selected, 'dismissed');
      else if (key === 'i') decide(selected, 'intentional');
      else if (key === 'f') decide(selected, 'deferred');
      else if (key === 'e') setEditing(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  });

  const scope: EditScope =
    scopeKind === 'unit' && currentUnitId ? { kind: 'unit', id: currentUnitId } : scopeKind === 'beat' && currentBeatId ? { kind: 'beat', id: currentBeatId } : { kind: 'all' };

  /** Run Edit Check (spec §6): Harper over the scope, then every rule; the manuscript is not touched. */
  const run = async () => {
    const controller = new AbortController();
    cancel.current = controller;
    setNotice(null);
    setRunning({ done: 0, total: linesInScope(file, scope).length });
    const before = new Map(linesInScope(file, scope).map((line) => [line.elementId, line.text]));
    let hits: Awaited<ReturnType<typeof grammarHits>> = [];
    let grammarWorked = true;
    try {
      hits = await grammarHits(file, scope, { onProgress: setRunning, signal: controller.signal });
    } catch {
      grammarWorked = false;
    }
    cancel.current = null;
    setRunning(null);
    if (controller.signal.aborted) {
      setNotice('Check cancelled. Nothing changed.');
      return;
    }
    onUpdate((current) => {
      // Lines edited while it ran are checked by the rules on their new words; Harper's notes on the old words are dropped.
      const now = new Map(linesInScope(current, scope).map((line) => [line.elementId, line.text]));
      return runEditCheck(current, { scope, outside: hits.filter((one) => before.get(one.elementId) === now.get(one.elementId)) });
    });
    setShow('open');
    setNotice(grammarWorked ? null : 'Spelling and grammar could not run this time; the other checks did.');
  };

  const changeProfile = (patch: Parameters<typeof setEditorProfile>[1]) => onUpdate((current) => setEditorProfile(current, patch));

  const anchor = selected ? findingAnchor(file, selected) : null;
  const passage = selected ? passageAround(file, selected, wide ? 8 : 2) : [];
  const place = selected ? findingPlace(file, selected) : null;
  const checkedAt = review.checkedAt ? new Date(review.checkedAt) : null;
  const done = tally.total - tally.open;

  const grouped = CATEGORY_ORDER.map((category) => ({ category, items: visible.filter((one) => one.category === category) })).filter((group) => group.items.length > 0);

  return (
    <div className="edit-check">
      <header className="edit-check-bar">
        <div className="edit-check-settings">
          <label>
            <span className="muted small">Rules</span>
            <select value={profile.mode} onChange={(event) => changeProfile({ mode: event.target.value as 'auto' | 'prose' | 'screenplay' })}>
              <option value="auto">{mode === 'prose' ? 'Prose' : 'Screenwriting'} (this format)</option>
              <option value="prose">Prose</option>
              <option value="screenplay">Screenwriting</option>
            </select>
          </label>
          <label>
            <span className="muted small">Spelling</span>
            <select value={profile.dialect} onChange={(event) => changeProfile({ dialect: event.target.value as typeof profile.dialect })}>
              <option value="american">American</option>
              <option value="british">British</option>
              <option value="canadian">Canadian</option>
              <option value="australian">Australian</option>
            </select>
          </label>
          {mode === 'prose' ? (
            <>
              <label>
                <span className="muted small">Point of view</span>
                <select value={profile.pov} onChange={(event) => changeProfile({ pov: event.target.value as PointOfView })}>
                  {(Object.keys(POV_NAMES) as PointOfView[]).map((one) => (
                    <option key={one} value={one}>
                      {POV_NAMES[one]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="muted small">Tense</span>
                <select value={profile.tense} onChange={(event) => changeProfile({ tense: event.target.value as NarrativeTense })}>
                  <option value="unspecified">Mixed / unspecified</option>
                  <option value="past">Past</option>
                  <option value="present">Present</option>
                </select>
              </label>
              {profile.pov === 'third_limited' || profile.pov === 'third_rotating' ? (
                <details className="edit-check-viewpoint">
                  <summary>
                    <span className="muted small">Viewpoint</span> {profile.viewpoint.length > 0 ? profile.viewpoint.join(', ') : 'Choose…'}
                  </summary>
                  <div>
                    {file.characters.length === 0 ? <p className="muted small">No characters in this project yet.</p> : null}
                    {file.characters.map((one) => (
                      <label key={one.id} className="toggle">
                        <input
                          type="checkbox"
                          checked={profile.viewpoint.includes(one.name)}
                          onChange={(event) =>
                            changeProfile({
                              viewpoint: event.target.checked ? [...profile.viewpoint, one.name] : profile.viewpoint.filter((name) => name !== one.name),
                            })
                          }
                        />
                        {one.name}
                      </label>
                    ))}
                  </div>
                </details>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="edit-check-run">
          <span className="muted small">
            {checkedAt ? `Last check ${checkedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}` : 'Not checked yet'}
          </span>
          <select value={scopeKind} onChange={(event) => setScopeKind(event.target.value as EditScope['kind'])} aria-label="What to check">
            <option value="all">Whole project</option>
            <option value="unit" disabled={!currentUnitId}>
              Current section
            </option>
            <option value="beat" disabled={!currentBeatId}>
              Current beat
            </option>
          </select>
          {running ? (
            <>
              <span className="edit-check-progress" role="status">
                Checking… {running.total > 0 ? `${Math.round((running.done / running.total) * 100)}%` : ''}
              </span>
              <button type="button" className="ghost" onClick={() => cancel.current?.abort()}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="primary" onClick={() => void run()}>
                Run Edit Check
              </button>
              <button type="button" className="ghost" onClick={() => setAiOpen(true)} title="Paid with edit credits. Points out problems; never rewrites.">
                AI check…
              </button>
            </>
          )}
          {tally.total > 0 ? (
            <span className="edit-check-done muted small">
              {done} of {tally.total} reviewed
            </span>
          ) : null}
          {onReturnToWriting ? (
            <button type="button" className="ghost" onClick={onReturnToWriting}>
              Return to writing
            </button>
          ) : null}
        </div>
      </header>

      {aiOpen ? (
        <AiCheckPanel
          file={file}
          scope={scope}
          scopeName={scope.kind === 'all' ? 'The whole project' : scope.kind === 'unit' ? 'The current section' : 'The current beat'}
          onUpdate={onUpdate}
          onClose={() => setAiOpen(false)}
          onDone={(message) => {
            setNotice(message);
            setShow('new');
          }}
        />
      ) : null}

      {notice ? (
        <p className="notice banner" role="status">
          {notice}
          <button type="button" className="ghost small" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      {review.checkedAt === null ? (
        <div className="edit-check-empty">
          <h3>Check your writing</h3>
          <p className="muted">
            The Edit Check reads the manuscript for spelling, grammar, punctuation, point of view and tense, and the habits that weaken a
            page — and changes nothing. It finds; you decide. Set the point of view and tense above, then run it at the end of a session and
            work through the review when you come back.
          </p>
        </div>
      ) : (
        <div className="edit-check-body">
          <nav className="edit-check-queue" aria-label="Findings">
            <div className="edit-check-filters">
              <select value={show} onChange={(event) => setShow(event.target.value as Show)} aria-label="Which findings">
                <option value="open">Open ({tally.open})</option>
                <option value="new">New since last check</option>
                <option value="deferred">Deferred</option>
                <option value="done">Done with</option>
                <option value="all">All ({tally.total})</option>
              </select>
              <select value={weight} onChange={(event) => setWeight(event.target.value as Weight)} aria-label="How serious">
                <option value="all">Every kind</option>
                <option value="error">Errors</option>
                <option value="concern">Possible concerns</option>
                <option value="info">Notes</option>
              </select>
            </div>
            {(file.settings.editorIgnoredRules ?? []).length > 0 ? (
              <details className="rules-off">
                <summary className="muted small">{(file.settings.editorIgnoredRules ?? []).length} switched off</summary>
                {(file.settings.editorIgnoredRules ?? []).map((kind) => (
                  <button key={kind} type="button" className="ghost small" onClick={() => onUpdate((current) => setEditorRule(current, kind, true))}>
                    ↩ {(FINDING_LABELS as Record<string, string>)[kind] ?? kind.replace(/^harper-/, '').replace(/-/g, ' ')}
                  </button>
                ))}
                <p className="muted small">Switched back on, a rule is checked from the next run.</p>
              </details>
            ) : null}
            <div className="edit-check-categories">
              <button type="button" className={only === null ? 'chip on' : 'chip'} onClick={() => setOnly(null)}>
                All
              </button>
              {CATEGORY_ORDER.filter((one) => tally.byCategory[one]).map((one) => (
                <button key={one} type="button" className={only === one ? 'chip on' : 'chip'} onClick={() => setOnly(only === one ? null : one)}>
                  {EDIT_CATEGORY_NAMES[one]} <span className="count">{tally.byCategory[one]!.open}</span>
                </button>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className="muted small edit-check-none">{tally.open === 0 ? 'Nothing left to review.' : 'Nothing here with these filters.'}</p>
            ) : (
              grouped.map((group) => (
                <section key={group.category}>
                  <h4>
                    {EDIT_CATEGORY_NAMES[group.category]} <span className="muted">{group.items.length}</span>
                  </h4>
                  <ul>
                    {group.items.map((one) => {
                      const status = statusOf(review, one);
                      return (
                        <li key={one.key}>
                          <button
                            type="button"
                            className={['edit-check-item', one.severity, one.key === selected?.key ? 'current' : '', status !== 'open' ? 'decided' : ''].filter(Boolean).join(' ')}
                            aria-current={one.key === selected?.key ? 'true' : undefined}
                            onClick={() => setSelectedKey(one.key)}
                          >
                            <span className="edit-check-snippet">“{one.quote.trim().slice(0, 40) || '␣'}”</span>
                            <span className="edit-check-why muted small">{one.message}</span>
                            {status !== 'open' ? <span className="edit-check-status small">{STATUS_WORDS[status]}</span> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </nav>

          <main className="edit-check-passage" aria-label="The passage">
            {selected && place ? (
              <>
                <header>
                  <span className="muted small">
                    {[place.unitTitle, place.beatTitle].filter(Boolean).join(' · ')}
                  </span>
                  <span className="edit-check-passage-tools">
                    <button type="button" className="ghost small" onClick={() => setWide(!wide)}>
                      {wide ? 'Less context' : 'About a page of context'}
                    </button>
                    <button type="button" className="ghost small" onClick={() => onGoTo(selected.beatId)}>
                      Go to manuscript
                    </button>
                  </span>
                </header>
                <div className={`edit-check-page ${mode}`}>
                  {passage.map((line) =>
                    line.flagged ? (
                      editing ? (
                        <textarea
                          key={line.elementId}
                          className={`edit-check-line flagged ${line.type}`}
                          // Changes go straight to the manuscript, as typing there would.
                          value={line.text}
                          autoFocus
                          rows={Math.max(2, Math.ceil(line.text.length / 70))}
                          aria-label="Edit this line"
                          onChange={(event) => {
                            const text = event.target.value;
                            onUpdate((current) => {
                              const beat = current.beats.find((one) => (one.id as string) === selected.beatId);
                              if (!beat) return current;
                              return updateBeat(current, beat.id, {
                                manuscript: { elements: beat.manuscript.elements.map((one) => ((one.id as string) === line.elementId ? { ...one, text } : one)) },
                              });
                            });
                          }}
                        />
                      ) : (
                        <p key={line.elementId} className={`edit-check-line flagged ${line.type}`}>
                          {anchor && anchor.state !== 'stale' ? (
                            <>
                              {line.text.slice(0, anchor.start)}
                              <mark>{line.text.slice(anchor.start, anchor.end) || '␣'}</mark>
                              {line.text.slice(anchor.end)}
                            </>
                          ) : (
                            line.text
                          )}
                        </p>
                      )
                    ) : (
                      <p key={line.elementId} className={`edit-check-line ${line.type}`}>
                        {line.text}
                      </p>
                    ),
                  )}
                </div>
                {anchor?.state === 'stale' ? (
                  <p className="muted small">The words this was about have changed since the check. Run it again to see this passage afresh.</p>
                ) : null}
              </>
            ) : (
              <p className="muted">Choose a finding.</p>
            )}
          </main>

          <aside className="edit-check-detail" aria-label="About this finding">
            {selected ? (
              <>
                <p className={`edit-check-weight ${selected.severity}`}>{SEVERITY_WORDS[selected.severity]}</p>
                <h3>{selected.message}</h3>
                <p>{selected.rule}</p>
                <dl className="edit-check-facts">
                  <dt>Category</dt>
                  <dd>{EDIT_CATEGORY_NAMES[selected.category]}</dd>
                  <dt>How sure</dt>
                  <dd>{CONFIDENCE_WORDS[selected.confidence]}</dd>
                  <dt>Status</dt>
                  <dd>{STATUS_WORDS[statusOf(review, selected)]}</dd>
                </dl>
                <div className="edit-check-actions">
                  {selected.fix !== null ? (
                    <button type="button" className="primary" disabled={anchor?.state === 'stale'} onClick={() => accept(selected)} title="A (only this change)">
                      Accept fix: “{selected.quote || '␣'}” → “{selected.fix || 'nothing'}”
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setEditing(true)} title="E">
                    Edit it yourself
                  </button>
                  <button type="button" onClick={() => decide(selected, 'dismissed')} title="D">
                    Dismiss
                  </button>
                  <button type="button" onClick={() => decide(selected, 'intentional')} title="I">
                    Mark intentional
                  </button>
                  <button type="button" onClick={() => decide(selected, 'deferred')} title="F">
                    Defer
                  </button>
                  {statusOf(review, selected) !== 'open' ? (
                    <button type="button" className="ghost" onClick={() => onUpdate((current) => decideFinding(current, selected.key, 'open'))}>
                      Open it again
                    </button>
                  ) : null}
                  {selected.category === 'spelling' ? (
                    <button type="button" className="ghost" onClick={() => onUpdate((current) => addToEditorDictionary(current, selected.quote))}>
                      Add “{selected.quote}” to the project dictionary
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost small"
                    title="Stop checking this kind of thing in this project"
                    onClick={() => onUpdate((current) => switchOffRule(current, selected.ruleId))}
                  >
                    Stop checking this rule
                  </button>
                </div>
                <p className="muted small edit-check-keys">
                  ↑ ↓ to move · A accept · E edit · D dismiss · I intentional · F defer
                </p>
                <div className="edit-check-nav">
                  <button type="button" className="ghost" disabled={indexOf <= 0} onClick={() => step(-1)}>
                    ‹ Previous
                  </button>
                  <span className="muted small">
                    {indexOf + 1} of {visible.length}
                  </span>
                  <button type="button" className="ghost" disabled={indexOf >= visible.length - 1} onClick={() => step(1)}>
                    Next ›
                  </button>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
