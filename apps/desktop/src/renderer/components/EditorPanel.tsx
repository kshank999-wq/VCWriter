import { useMemo, useState } from 'react';
import {
  allowWord,
  applyFinding,
  applyFindings,
  findBeat,
  findUnit,
  groupFindings,
  isProseFormat,
  runDailyEditor,
  setEditorRule,
  FINDING_LABELS,
  runFinalEditor,
  sceneTextForReview,
  summariseFindings,
  type BeatId,
  type EditorFinding,
  type FindingKind,
  type ProjectFile,
  type SceneVerdict,
  type StructuralUnitId,
} from '@vcwriter/domain';

interface EditorPanelProps {
  file: ProjectFile;
  currentUnitId: StructuralUnitId | null;
  signedIn: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /** Going to a finding selects its beat, so the writer can see it in place. */
  onGoTo?(beatId: BeatId): void;
}

type Tab = 'daily' | 'final';

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
export function EditorPanel({ file, currentUnitId, signedIn, onUpdate, onGoTo }: EditorPanelProps) {
  const [tab, setTab] = useState<Tab>('daily');
  const [scope, setScope] = useState<'project' | 'scene'>('project');
  const [includeStyle, setIncludeStyle] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [verdicts, setVerdicts] = useState<Record<string, SceneVerdict>>({});
  const [reading, setReading] = useState<string | null>(null);
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

  const report = useMemo(() => runFinalEditor(file, { verdicts }), [file, verdicts]);

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
    setVerdicts((current) => ({ ...current, [unitId]: result.data as SceneVerdict }));
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
      ) : (
        <div className="final-review">
          <p className="muted">
            {report.totals.scenes} scenes · {report.totals.pages} pages · {report.totals.words} words
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

          <h3>Scene by scene</h3>
          <ul className="scene-list">
            {report.scenes.map((scene) => (
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
                    disabled={!signedIn || reading !== null}
                    title={signedIn ? 'Ask for a structural read of this scene' : 'Sign in to use the Final Editor'}
                    onClick={() => void readScene(scene.unitId, scene.label, scene.position)}
                  >
                    {reading === scene.unitId ? 'Reading…' : scene.aiVerdict ? 'Read again' : 'Read scene'}
                  </button>
                </header>

                {scene.aiVerdict ? (
                  <dl className="verdict">
                    <dt>Opens</dt>
                    <dd>{scene.aiVerdict.opening}</dd>
                    <dt>Changes</dt>
                    <dd>{scene.aiVerdict.change}</dd>
                    <dt>Turn</dt>
                    <dd>{scene.aiVerdict.turn ?? <span className="muted">No turn found.</span>}</dd>
                    <dt>Value</dt>
                    <dd>{scene.aiVerdict.valueShift}</dd>
                    <dt>Purpose</dt>
                    <dd>{scene.aiVerdict.purpose}</dd>
                    {scene.aiVerdict.concerns.length > 0 ? (
                      <>
                        <dt>Concerns</dt>
                        <dd>
                          <ul>
                            {scene.aiVerdict.concerns.map((concern) => (
                              <li key={concern}>{concern}</li>
                            ))}
                          </ul>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                ) : (
                  <p className="muted small">
                    {/* The deterministic pass deliberately does not guess at this. */}
                    Whether this scene turns has not been read yet.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
