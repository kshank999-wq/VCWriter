import { useEffect, useMemo, useState } from 'react';
import {
  allowWord,
  applyFinding,
  applyFindings,
  findBeat,
  findUnit,
  groupFindings,
  isProseFormat,
  gridFromRead,
  runDailyEditor,
  setEditorRule,
  setSceneGrid,
  setSceneRead,
  FINDING_LABELS,
  runFinalEditor,
  sceneTextForReview,
  storyGridStatus,
  summariseFindings,
  type BeatId,
  type EditorFinding,
  type FindingKind,
  type ProjectFile,
  type SceneGrid,
  type SceneVerdict,
  type StructuralUnitId,
} from '@vcwriter/domain';
import { StoryGridPanel } from './StoryGridPanel';

interface EditorPanelProps {
  file: ProjectFile;
  currentUnitId: StructuralUnitId | null;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Going to a finding selects its beat, so the writer can see it in place. */
  onGoTo?(beatId: BeatId): void;
  /** Naming a scene in the Story Grid should be able to go and look at it. */
  onGoToUnit?(unitId: StructuralUnitId): void;
  /** Which editor to open on: the Editor menu names one, and means it. */
  openOn?: Tab;
}

/**
 * Addendum 04 §1: the Story Grid is a third tab here rather than a screen of
 * its own. It reads the manuscript and asks whether it delivers — which is
 * what the other two tabs do, so this is where a writer already comes to be
 * told what is missing.
 */
type Tab = 'daily' | 'final' | 'grid';

/**
 * When a read was made, and by what.
 *
 * Worth saying because a read goes stale: the scene it describes may have
 * been rewritten since, and the panel has no way to know that. The date is
 * how the writer knows.
 */
const readWhen = (read: { readAt: string; model: string }): string => {
  const when = read.readAt
    ? new Date(read.readAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : 'just now';
  return read.model ? `${when} · ${read.model}` : when;
};

/**
 * The two editors (spec §8).
 *
 * Both present findings for the writer to work through. Neither changes
 * anything on its own: the Daily Editor's fixes are individual buttons, and
 * the Final Editor has no button that could rewrite a scene at all.
 *
 * Dismissals live in this component rather than in the project. A finding the
 * writer has considered and rejected is a fact about this sitting, not a
 * property of the manuscript, and it should not travel to another machine.
 */
export function EditorPanel({ file, currentUnitId, onUpdate, onGoTo, onGoToUnit, openOn }: EditorPanelProps) {
  const [tab, setTab] = useState<Tab>(openOn ?? 'daily');

  // The Editor menu names an editor; choosing it opens that one.
  useEffect(() => {
    if (openOn) setTab(openOn);
  }, [openOn]);
  const [scope, setScope] = useState<'project' | 'scene'>('project');
  const [includeStyle, setIncludeStyle] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState<string | null>(null);
  /** Whether a read can be asked for at all, and what to say when it cannot. */
  const [readable, setReadable] = useState<{ available: boolean; reason: string | null }>({
    available: false,
    reason: null,
  });
  const [error, setError] = useState<string | null>(null);
  /** The rule being worked through; null shows the list of rules. */
  const [rule, setRule] = useState<FindingKind | null>(null);

  const findings = useMemo(
    () =>
      runDailyEditor(file, {
        includeStyle,
        ...(scope === 'scene' && currentUnitId ? { unitId: currentUnitId } : {}),
      }),
    [file, includeStyle, scope, currentUnitId],
  );

  // Dismissals are keyed by what the finding is about, not by its generated id,
  // so re-running the pass does not resurrect something already considered.
  const keyOf = (finding: EditorFinding) => `${finding.elementId}:${finding.kind}:${finding.excerpt}`;
  const visible = findings.filter((finding) => !dismissed.has(keyOf(finding)));
  const summary = summariseFindings(visible);

  const groups = useMemo(() => groupFindings(visible), [visible]);
  const showing = rule === null ? visible : visible.filter((finding) => finding.kind === rule);
  const fixableHere = showing.filter((finding) => finding.replacement !== undefined).length;

  /** The offending text with a little of what is around it, marked. */
  const context = (finding: EditorFinding) => {
    const beat = findBeat(file, finding.beatId);
    const element = beat?.manuscript.elements.find((candidate) => candidate.id === finding.elementId);
    if (!element) return `“${finding.excerpt.trim() || '␣'}”`;
    const before = element.text.slice(Math.max(0, finding.start - 30), finding.start);
    const after = element.text.slice(finding.end, finding.end + 30);
    return (
      <>
        {finding.start > 30 ? '…' : ''}
        {before}
        <mark>{finding.excerpt || '␣'}</mark>
        {after}
        {finding.end + 30 < element.text.length ? '…' : ''}
      </>
    );
  };

  /** Where in the script it is, in the words the writer names things by. */
  const whereIs = (finding: EditorFinding) => {
    const unit = findUnit(file, finding.unitId);
    const beat = findBeat(file, finding.beatId);
    return [unit?.sequenceLabel || unit?.title || 'Scene', beat?.title].filter(Boolean).join(' · ') || 'Go to it';
  };

  // Reads the document keeps. Nothing is held in this component: a read cost
  // money, so it belongs in the manuscript, not in a panel that closes.
  const report = useMemo(() => runFinalEditor(file), [file]);

  // The global layer, read here only for the count on the tab.
  const grid = useMemo(() => storyGridStatus(file), [file]);

  // Asked once when the Final Editor is opened, so the button can say why it
  // is greyed out instead of failing after the click.
  useEffect(() => {
    if (tab !== 'final') return;
    let current = true;
    void window.vcwriter.sceneReviewStatus().then((result) => {
      if (!current) return;
      setReadable(
        result.ok && result.data
          ? result.data
          : { available: false, reason: result.error ?? 'AI review is unavailable.' },
      );
    });
    return () => {
      current = false;
    };
  }, [tab]);

  const readScene = async (unitId: StructuralUnitId, label: string, position: number) => {
    setReading(unitId);
    setError(null);
    const result = await window.vcwriter.reviewScene({
      sceneText: sceneTextForReview(file, unitId),
      position: `${label} — scene ${position} of ${report.scenes.length}`,
      format: isProseFormat(file.project.format) ? 'prose' : 'screenplay',
    });
    setReading(null);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The structural read failed');
      return;
    }
    const verdict = result.data as SceneVerdict;
    onUpdate((current) => setSceneRead(current, unitId, verdict));
  };

  return (
    <div className="editor-panel">
      <div className="panel-header">
        <div className="tabs" role="tablist" aria-label="Editor">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'daily'}
            className={tab === 'daily' ? 'tab selected' : 'tab'}
            onClick={() => setTab('daily')}
          >
            Daily ({summary.errors + summary.style})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'final'}
            className={tab === 'final' ? 'tab selected' : 'tab'}
            onClick={() => setTab('final')}
          >
            Final ({report.findings.length})
          </button>
          {/* What the story owes, and how much of it is answered. The count is
              the one number the tab exists to show (addendum 04 §3). */}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'grid'}
            className={tab === 'grid' ? 'tab selected' : 'tab'}
            onClick={() => setTab('grid')}
          >
            Story Grid ({grid.keptObligatory + grid.keptConventions}/{grid.promises.length})
          </button>
        </div>

        {tab === 'daily' ? (
          <div className="editor-controls">
            <select value={scope} onChange={(event) => setScope(event.target.value as 'project' | 'scene')}>
              <option value="project">Whole project</option>
              <option value="scene" disabled={!currentUnitId}>
                Current scene
              </option>
            </select>
            <label className="toggle">
              <input
                type="checkbox"
                checked={includeStyle}
                onChange={(event) => setIncludeStyle(event.target.checked)}
              />
              Include style notes
            </label>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="error banner" role="alert">
          {error}
        </p>
      ) : null}

      {tab === 'daily' ? (
        <div className="editing-mode">
          {/* The rules, with what each one found. Working through a
              manuscript one rule at a time is how it is actually done: the
              eye stays on one kind of mistake instead of switching. */}
          <nav className="rule-list" aria-label="What to work through">
            <button
              type="button"
              className={rule === null ? 'rule-row current' : 'rule-row'}
              onClick={() => setRule(null)}
            >
              <span className="rule-name">Everything</span>
              <span className="count muted">{visible.length}</span>
            </button>

            {groups.length === 0 ? (
              <p className="muted small">
                {findings.length === 0 ? 'Nothing to flag.' : 'Everything here has been considered.'}
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.kind} className="rule-line">
                  <button
                    type="button"
                    className={rule === group.kind ? 'rule-row current' : 'rule-row'}
                    aria-current={rule === group.kind ? 'true' : undefined}
                    onClick={() => setRule(group.kind)}
                  >
                    <span className={group.severity === 'error' ? 'chip' : 'chip suggested'}>
                      {group.severity === 'error' ? 'error' : 'style'}
                    </span>
                    <span className="rule-name">{group.label}</span>
                    <span className="count muted">{group.findings.length}</span>
                  </button>
                  <button
                    type="button"
                    className="ghost small"
                    aria-label={`Stop checking: ${group.label}`}
                    title="Stop checking this, in this project"
                    onClick={() => {
                      onUpdate((current) => setEditorRule(current, group.kind, false));
                      if (rule === group.kind) setRule(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}

            {(file.settings.editorIgnoredRules ?? []).length > 0 ? (
              <details className="rules-off">
                <summary className="muted small">
                  {(file.settings.editorIgnoredRules ?? []).length} switched off
                </summary>
                {(file.settings.editorIgnoredRules ?? []).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="ghost small"
                    onClick={() => onUpdate((current) => setEditorRule(current, kind, true))}
                  >
                    ↩ {FINDING_LABELS[kind as FindingKind] ?? kind}
                  </button>
                ))}
              </details>
            ) : null}
          </nav>

          <div className="findings">
            {showing.length > 0 && fixableHere > 0 ? (
              <header className="findings-head">
                <span className="muted small">
                  {showing.length} {showing.length === 1 ? 'thing' : 'things'}
                  {rule ? ` · ${FINDING_LABELS[rule]}` : ''}
                </span>
                {/* Every one of a kind at once. The pass re-runs from the
                    changed document, so the offsets are never stale. */}
                <button
                  type="button"
                  className="primary"
                  onClick={() => onUpdate((current) => applyFindings(current, showing))}
                >
                  Fix all {fixableHere}
                </button>
              </header>
            ) : null}

            {showing.length === 0 ? (
              <p className="muted empty">
                {findings.length === 0 ? 'Nothing to flag.' : 'Everything here has been considered.'}
              </p>
            ) : (
              <ul>
                {showing.map((finding) => (
                  <li key={finding.id} className={`finding ${finding.severity}`}>
                    <div className="finding-body">
                      <p className="finding-message">{finding.message}</p>
                      <p className="finding-excerpt muted">
                        {context(finding)}
                      </p>
                      <button
                        type="button"
                        className="link finding-where"
                        onClick={() => onGoTo?.(finding.beatId)}
                        title="Go to it in the script"
                      >
                        {whereIs(finding)}
                      </button>
                    </div>
                    <div className="finding-actions">
                      {finding.replacement !== undefined ? (
                        <button
                          type="button"
                          className="primary"
                          onClick={() => onUpdate((current) => applyFinding(current, finding))}
                        >
                          Fix
                        </button>
                      ) : null}
                      {finding.kind === 'likely_typo' ? (
                        <button
                          type="button"
                          className="ghost"
                          title="It is a word. Never ask again."
                          onClick={() => onUpdate((current) => allowWord(current, finding.excerpt))}
                        >
                          It’s a word
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setDismissed((current) => new Set(current).add(keyOf(finding)))}
                      >
                        Leave it
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : tab === 'grid' ? (
        <StoryGridPanel file={file} onUpdate={onUpdate} {...(onGoToUnit ? { onGoToUnit } : {})} />
      ) : (
        <div className="final-review">
          <p className="muted">
            {report.totals.scenes} scenes · {report.totals.pages} pages · {report.totals.words} words ·{' '}
            {report.totals.gridded} of {report.totals.scenes} read
            {report.totals.reviewed > 0 ? ` · ${report.totals.reviewed} read structurally` : ''}
          </p>

          {report.findings.length > 0 ? (
            <ul className="findings-list">
              {report.findings.map((finding) => (
                <li key={finding.id} className={`finding ${finding.severity}`}>
                  <span className={finding.severity === 'blocking' ? 'chip used' : 'chip suggested'}>
                    {finding.severity === 'blocking' ? 'blocking' : 'question'}
                  </span>
                  <div className="finding-body">
                    <p className="finding-message">{finding.message}</p>
                    <p className="muted small">{finding.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted empty">Nothing structural to raise.</p>
          )}

          {/* The shape of the whole, where the acts have been marked. */}
          {report.acts.length > 0 ? (
            <section className="act-shape" aria-label="The shape of the acts">
              <h3>The shape</h3>
              <div className="act-bar">
                {report.acts.map((act) => (
                  <div
                    key={act.label}
                    className="act-slice"
                    style={{ flexGrow: Math.max(act.share, 0.02) }}
                    title={`${act.label}: scenes ${act.from}–${act.to}, ${act.pages} pages`}
                  >
                    <span className="act-slice-name">{act.label}</span>
                    <span className="act-slice-share muted">{Math.round(act.share * 100)}%</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Who is in the story, and where. Not a judgement — a map. */}
          {report.arcs.length > 0 ? (
            <section className="arc-map" aria-label="Where each character is">
              <h3>Who is where</h3>
              <ul>
                {report.arcs.slice(0, 10).map((arc) => (
                  <li key={arc.name}>
                    <span className="arc-name">{arc.name}</span>
                    <span className="arc-track" aria-hidden="true">
                      {report.scenes.map((scene) => (
                        <i
                          key={scene.unitId}
                          className={
                            arc.appearances.some((appearance) => appearance.unitId === scene.unitId)
                              ? 'arc-tick on'
                              : 'arc-tick'
                          }
                        />
                      ))}
                    </span>
                    <span className="muted small">
                      {arc.appearances.length} of {report.scenes.length}
                      {arc.longestGap > 0 ? ` · away ${arc.longestGap}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* The grid itself: the Story Grid's question asked of every scene,
              and answered by the writer. It works with no key and no
              connection, which is the point of it being here (§8.2). */}
          <h3>The grid</h3>
          <p className="muted small">
            What is at stake in each scene, and which way it moves. The structural read proposes an answer; this is
            yours, and it is the one the checks above are reading.
          </p>
          <table className="story-grid">
            <thead>
              <tr>
                <th scope="col">Scene</th>
                <th scope="col">At stake</th>
                <th scope="col">Moves</th>
                <th scope="col">Turns on</th>
                <th scope="col">Why it is here</th>
              </tr>
            </thead>
            <tbody>
              {report.scenes.map((scene) => {
                const set = (patch: Partial<SceneGrid>) =>
                  onUpdate((current) => setSceneGrid(current, scene.unitId, patch));
                return (
                  <tr key={scene.unitId} className={scene.grid.polarity === 'flat' ? 'grid-flat' : undefined}>
                    <th scope="row">
                      <span className="muted small">{scene.position}</span> {scene.label}
                      <span className="muted small under">
                        {scene.pages} {scene.pages === 1 ? 'page' : 'pages'} · {scene.words} words
                      </span>
                    </th>
                    <td>
                      <input
                        aria-label={`What is at stake in ${scene.label}`}
                        placeholder="trust / betrayal"
                        value={scene.grid.value}
                        onChange={(event) => set({ value: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Which way ${scene.label} moves`}
                        value={scene.grid.polarity}
                        onChange={(event) => set({ polarity: event.target.value as SceneGrid['polarity'] })}
                      >
                        <option value="">—</option>
                        <option value="up">Up</option>
                        <option value="down">Down</option>
                        <option value="mixed">Both</option>
                        <option value="flat">Not at all</option>
                      </select>
                    </td>
                    <td>
                      <input
                        aria-label={`Where ${scene.label} turns`}
                        placeholder="the line that changes it"
                        value={scene.grid.turn}
                        onChange={(event) => set({ turn: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`Why ${scene.label} is here`}
                        placeholder="what the script would lose without it"
                        value={scene.grid.purpose}
                        onChange={(event) => set({ purpose: event.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3>Scene by scene</h3>
          <ul className="scene-list">
            {report.scenes.map((scene) => {
              const read = scene.aiVerdict;
              return (
              <li key={scene.unitId} className="scene-row">
                <header>
                  <strong>
                    {scene.position}. {scene.label}
                  </strong>
                  <span className="muted small">
                    {scene.pages} {scene.pages === 1 ? 'page' : 'pages'} · {scene.words} words
                    {scene.speakers.length > 0 ? ` · ${scene.speakers.join(', ')}` : ''}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={!readable.available || reading !== null || scene.words === 0}
                    title={
                      scene.words === 0
                        ? 'There is nothing written in this scene yet'
                        : (readable.reason ?? 'Ask for a structural read of this scene')
                    }
                    onClick={() => void readScene(scene.unitId, scene.label, scene.position)}
                  >
                    {reading === scene.unitId ? 'Reading…' : read ? 'Read again' : 'Read scene'}
                  </button>
                </header>

                {read ? (
                  <dl className="verdict">
                    <dt>Opens</dt>
                    <dd>{read.opening}</dd>
                    <dt>Changes</dt>
                    <dd>{read.change}</dd>
                    <dt>Value</dt>
                    <dd>{read.valueShift}</dd>
                    <dt>Purpose</dt>
                    <dd>{read.purpose}</dd>
                    {/*
                      The five commandments at scene scale (addendum 04 §4).
                      Most scenes do not have all five, and the empty ones are
                      the useful part — a scene that raises a dilemma and ends
                      before anyone chooses says so here.
                    */}
                    <dt>Inciting incident</dt>
                    <dd>{read.inciting ?? <span className="muted">Nothing upsets the balance here.</span>}</dd>
                    <dt>Progressive complication</dt>
                    <dd>{read.turn ?? <span className="muted">No turn found.</span>}</dd>
                    <dt>Crisis</dt>
                    <dd>{read.crisis ?? <span className="muted">No dilemma is reached.</span>}</dd>
                    <dt>Climax</dt>
                    <dd>{read.climax ?? <span className="muted">Nobody chooses.</span>}</dd>
                    <dt>Resolution</dt>
                    <dd>{read.resolution ?? <span className="muted">It does not settle.</span>}</dd>
                    {read.concerns.length > 0 ? (
                      <>
                        <dt>Concerns</dt>
                        <dd>
                          <ul>
                            {read.concerns.map((concern) => (
                              <li key={concern}>{concern}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    ) : null}
                    <dt>Read</dt>
                    <dd className="muted small verdict-foot">
                      <span>{readWhen(read)}</span>
                      {/*
                        The read is a proposal until the writer says otherwise.
                        This is the one button that makes it theirs, and it
                        writes only the questions the read was asked — and, of
                        the five, only the ones it actually found (§4).
                      */}
                      <button
                        type="button"
                        className="ghost"
                        title="Copy this reading into the story grid as your own"
                        onClick={() =>
                          onUpdate((current) =>
                            setSceneGrid(current, scene.unitId, gridFromRead(read)),
                          )
                        }
                      >
                        Take this as mine
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        title="Forget this reading"
                        onClick={() => onUpdate((current) => setSceneRead(current, scene.unitId, null))}
                      >
                        Discard
                      </button>
                    </dd>
                  </dl>
                ) : (
                  <p className="muted small">
                    {/* The deterministic pass deliberately does not guess at this. */}
                    Whether this scene turns has not been read yet.
                  </p>
                )}
              </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
