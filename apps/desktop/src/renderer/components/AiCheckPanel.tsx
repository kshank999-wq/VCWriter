import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDeepFindings,
  creditsLabel,
  editModeOf,
  editorProfileOf,
  estimateRuns,
  linesInScope,
  splitIntoRuns,
  type DeepCheckFinding,
  type EditCategory,
  type EditScope,
  type EditSeverity,
  type OutsideHit,
  type ProjectFile,
} from '@vcwriter/domain';
import { openEditCredits } from '../help-links';

/**
 * **The AI check** (addendum 47): the paid half of the Edit Check. Opus reads
 * the scope a scene at a time for what rules cannot judge — whose head a
 * sentence is in, which "he" is meant, whether it is morning or night — and
 * its findings join the same review, with no fix to accept. It points; it
 * never rewrites.
 *
 * Before anything is sent the writer sees what it will cost in credits, what
 * they have, and that the passage goes to Anthropic to be read.
 */

const CATEGORY: Record<DeepCheckFinding['check'], EditCategory> = {
  pov: 'pov',
  pronoun: 'clarity',
  continuity: 'story',
  telling: 'style',
  dialogue: 'style',
  pacing: 'pacing',
  setup: 'story',
};

const CHECK_NAMES: Record<DeepCheckFinding['check'], string> = {
  pov: 'point of view',
  pronoun: 'unclear reference',
  continuity: 'continuity',
  telling: 'telling, not showing',
  dialogue: 'dialogue',
  pacing: 'pacing',
  setup: 'setup without payoff',
};

/** A finding from the server, placed in the book as the review keeps it. */
export const deepHit = (finding: DeepCheckFinding, beatId: string): OutsideHit => ({
  beatId,
  elementId: finding.elementId,
  ruleId: `ai-${finding.check}`,
  category: CATEGORY[finding.check],
  severity: (finding.severity === 'concern' ? 'concern' : 'info') as EditSeverity,
  confidence: finding.confidence,
  start: finding.start,
  end: finding.end,
  message: finding.message,
  rule: `${finding.why} (AI check: ${CHECK_NAMES[finding.check]}.)`,
});

interface Props {
  file: ProjectFile;
  scope: EditScope;
  scopeName: string;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onClose(): void;
  onDone(message: string): void;
}

export function AiCheckPanel({ file, scope, scopeName, onUpdate, onClose, onDone }: Props) {
  const bridge = typeof window === 'undefined' ? undefined : window.vcwriter;
  const [standing, setStanding] = useState<{ signedIn: boolean; configured: boolean; balance: number } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stop = useRef(false);

  const runs = useMemo(
    () =>
      splitIntoRuns(
        linesInScope(file, scope)
          .filter((line) => line.text.trim() && !['scene_break', 'figure', 'music_cue'].includes(line.type))
          .map((line) => ({ id: line.elementId, beatId: line.beatId, text: line.text, ...(editModeOf(file) === 'screenplay' ? { type: line.type } : {}) })),
      ),
    [file, scope],
  );
  const estimate = useMemo(() => estimateRuns(runs), [runs]);

  const refresh = () => {
    if (!bridge?.editCredits) {
      setProblem('The AI check needs a connection to vc-writer.com.');
      return;
    }
    void bridge.editCredits().then((result) => {
      if (result.ok && result.data) setStanding(result.data);
      else setProblem(result.error ?? 'Your edit credits could not be read.');
    });
  };
  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  const short = standing ? standing.balance < estimate.charge : false;
  const ready = standing?.signedIn && standing.configured && !short && estimate.words > 0 && !progress;

  const start = async () => {
    if (!bridge?.deepCheck) return;
    const profile = editorProfileOf(file);
    const mode = editModeOf(file);
    stop.current = false;
    setProblem(null);
    let found = 0;
    let charged = 0;
    for (let index = 0; index < runs.length; index += 1) {
      if (stop.current) break;
      setProgress({ done: index, total: runs.length });
      const run = runs[index]!;
      const result = await bridge.deepCheck({
        format: mode,
        ...(mode === 'prose' ? { pointOfView: profile.pov, tense: profile.tense, viewpoint: profile.viewpoint } : {}),
        lines: run.map((line) => ({ id: line.id, text: line.text, ...(line.type ? { type: line.type } : {}) })),
      });
      const answer = result.data;
      if (!result.ok || !answer) {
        setProblem(`${result.error ?? 'The AI check failed.'} ${index > 0 ? `The first ${index} of ${runs.length} parts were checked.` : ''}`.trim());
        break;
      }
      const beatOf = new Map(run.map((line) => [line.id, line.beatId]));
      const checked = run.map((line) => line.id).filter(Boolean);
      // Words changed while the check ran are not where it says; those findings are left out.
      onUpdate((current) => {
        const now = new Map(linesInScope(current, scope).map((line) => [line.elementId, line.text]));
        const before = new Map(run.map((line) => [line.id, line.text]));
        const hits = answer.findings
          .filter((one) => beatOf.has(one.elementId) && now.get(one.elementId) === before.get(one.elementId))
          .map((one) => deepHit(one, beatOf.get(one.elementId)!));
        return addDeepFindings(current, checked, hits);
      });
      found += answer.findings.length;
      charged += answer.charged;
      setStanding((was) => (was ? { ...was, balance: answer.balance } : was));
    }
    setProgress(null);
    if (charged > 0) {
      onDone(`AI check: ${found} ${found === 1 ? 'thing' : 'things'} to look at. ${creditsLabel(charged)} credits used.`);
    }
  };

  return (
    <section className="ai-check" aria-label="AI check">
      <header>
        <h3>AI check</h3>
        <button type="button" className="ghost small" onClick={onClose} disabled={progress !== null}>
          Close
        </button>
      </header>
      <p className="muted small">
        Reads {scopeName.toLowerCase()} for point-of-view slips, unclear pronouns, continuity, telling, dialogue, pacing and dropped
        setups, and adds what it finds to this review. <strong>It points out problems; it never rewrites a word.</strong>
      </p>
      <dl className="ai-check-figures">
        <div>
          <dt>Words</dt>
          <dd>{estimate.words.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{creditsLabel(estimate.charge)} credits</dd>
        </div>
        <div>
          <dt>You have</dt>
          <dd>{standing ? `${creditsLabel(standing.balance)} credits` : '…'}</dd>
        </div>
      </dl>
      <p className="muted small">
        One credit checks 1,000 words; each part checked is charged at least one. Your passage is sent to Anthropic&rsquo;s Claude to be
        read, and nothing else from the project goes with it.
      </p>
      {standing && !standing.signedIn ? <p className="notice">Sign in (File → Account…) to use the AI check.</p> : null}
      {standing && standing.signedIn && !standing.configured ? <p className="notice">The AI check is not available just now.</p> : null}
      {standing?.signedIn && short ? <p className="notice">You need {creditsLabel(estimate.charge - standing.balance)} more credits for this.</p> : null}
      {problem ? (
        <p className="error" role="alert">
          {problem}
        </p>
      ) : null}
      <div className="ai-check-actions">
        {progress ? (
          <>
            <span role="status">
              Checking part {progress.done + 1} of {progress.total}…
            </span>
            <button type="button" className="ghost" onClick={() => (stop.current = true)}>
              Stop after this part
            </button>
          </>
        ) : (
          <button type="button" className="primary" disabled={!ready} onClick={() => void start()}>
            Check for {creditsLabel(estimate.charge)} credits
          </button>
        )}
        <button
          type="button"
          className="ghost"
          onClick={() => {
            openEditCredits();
            setTimeout(refresh, 60_000);
          }}
        >
          Buy edit credits…
        </button>
        <button type="button" className="ghost small" onClick={refresh} disabled={progress !== null}>
          Refresh balance
        </button>
      </div>
    </section>
  );
}
