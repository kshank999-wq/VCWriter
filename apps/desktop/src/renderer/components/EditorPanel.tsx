import { useMemo, useState } from 'react';
import {
  applyFinding,
  isProseFormat,
  runDailyEditor,
  runFinalEditor,
  sceneTextForReview,
  summariseFindings,
  type EditorFinding,
  type ProjectFile,
  type SceneVerdict,
  type StructuralUnitId,
} from '@vcwriter/domain';

interface EditorPanelProps {
  file: ProjectFile;
  currentUnitId: StructuralUnitId | null;
  signedIn: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
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
export function EditorPanel({ file, currentUnitId, signedIn, onUpdate }: EditorPanelProps) {
  const [tab, setTab] = useState<Tab>('daily');
  const [scope, setScope] = useState<'project' | 'scene'>('project');
  const [includeStyle, setIncludeStyle] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [verdicts, setVerdicts] = useState<Record<string, SceneVerdict>>({});
  const [reading, setReading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="findings">
          {visible.length === 0 ? (
            <p className="muted empty">
              {findings.length === 0
                ? 'Nothing to flag. '
                : 'Everything here has been considered. '}
              {summary.errors === 0 ? 'No mechanical errors found.' : ''}
            </p>
          ) : (
            <ul>
              {visible.map((finding) => (
                <li key={finding.id} className={`finding ${finding.severity}`}>
                  <span className={finding.severity === 'error' ? 'chip' : 'chip suggested'}>
                    {finding.severity === 'error' ? 'error' : 'style'}
                  </span>
                  <div className="finding-body">
                    <p className="finding-message">{finding.message}</p>
                    <p className="finding-excerpt muted">“{finding.excerpt.trim() || '␣'}”</p>
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
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => setDismissed((current) => new Set(current).add(keyOf(finding)))}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
