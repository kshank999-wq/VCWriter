import { useCallback, useEffect, useState } from 'react';
import {
  approveCapture,
  deferCapture,
  rejectCapture,
  researchCategoriesInOrder,
  suggestRouting,
  unitsInStoryOrder,
  type ApprovalDecision,
  type CaptureItem,
  type ProjectFile,
  type ResearchCategoryId,
  type StructuralUnitId,
} from '@vcwriter/domain';

interface CapturesPanelProps {
  file: ProjectFile;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

/**
 * The approval queue (spec §9, §11).
 *
 * Everything captured on a phone lands here and waits. The system proposes a
 * destination — the writer's own choice when they made one, the classifier's
 * guess otherwise, and it says which — but nothing becomes project data until
 * a person approves it. Rejecting or deferring keeps the capture and its raw
 * text, so a decision is never final in the destructive sense.
 */
export function CapturesPanel({ file, onUpdate }: CapturesPanelProps) {
  const [captures, setCaptures] = useState<CaptureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, string>>({});

  const categories = researchCategoriesInOrder(file);
  const units = unitsInStoryOrder(file);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await window.vcwriter.listCaptures(file.project.id);
    setLoading(false);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'The capture queue could not be read');
      return;
    }
    setCaptures(result.data);
  }, [file.project.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** The destination selector's value for a capture, defaulting to the suggestion. */
  const choiceFor = (capture: CaptureItem): string => {
    const stored = choices[capture.id];
    if (stored) return stored;
    const suggested = suggestRouting(file, capture).decision;
    if (!suggested) return '';
    if (suggested.kind === 'character') return 'character';
    if (suggested.kind === 'beat') return `beat:${suggested.unitId}`;
    return `research:${suggested.categoryId}`;
  };

  const decisionFor = (capture: CaptureItem): ApprovalDecision | null => {
    const value = choiceFor(capture);
    if (value === 'character') return { kind: 'character' };
    if (value.startsWith('beat:')) return { kind: 'beat', unitId: value.slice(5) as StructuralUnitId };
    if (value.startsWith('research:')) {
      return { kind: 'research', categoryId: value.slice(9) as ResearchCategoryId };
    }
    return null;
  };

  const approve = async (capture: CaptureItem) => {
    const decision = decisionFor(capture);
    if (!decision) return;
    try {
      // Computed outside the state updater on purpose: an updater can run
      // asynchronously (and twice in StrictMode), so reading the result out of
      // it would sometimes skip the write-back — and always double it.
      const result = approveCapture(file, capture, decision);
      onUpdate(() => result.file);

      const written = await window.vcwriter.resolveCapture(result.capture);
      if (!written.ok) {
        // The note exists locally; only the queue entry failed to update, so
        // say so rather than pretending the capture is gone.
        setError(written.error ?? 'The note was created, but the capture could not be marked reviewed');
        return;
      }
      setCaptures((current) => current.filter((entry) => entry.id !== capture.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That capture could not be approved');
    }
  };

  const resolve = async (capture: CaptureItem, next: CaptureItem) => {
    const result = await window.vcwriter.resolveCapture(next);
    if (!result.ok) {
      setError(result.error ?? 'That decision could not be saved');
      return;
    }
    setCaptures((current) => current.filter((entry) => entry.id !== capture.id));
  };

  return (
    <div className="captures">
      <div className="panel-header">
        <h2>Captures waiting for review</h2>
        <button type="button" className="ghost" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="error banner" role="alert">
          {error}
        </p>
      ) : null}

      {captures.length === 0 && !loading ? (
        <p className="muted empty">
          Nothing waiting. Notes you capture in VC Writer Notes appear here for review.
        </p>
      ) : null}

      <ul className="capture-list">
        {captures.map((capture) => {
          const suggestion = suggestRouting(file, capture);
          return (
            <li key={capture.id} className="capture">
              <header>
                <span className="muted">
                  {new Date(capture.capturedAt).toLocaleString()} · {capture.source.replace(/_/g, ' ')}
                </span>
                {capture.requestedRouting ? (
                  <span className="chip used">your choice</span>
                ) : capture.inference ? (
                  <span className="chip suggested">
                    suggested · {Math.round((capture.inference.confidence ?? 0) * 100)}%
                  </span>
                ) : null}
              </header>

              <p className="capture-text">{capture.rawText}</p>
              <p className="muted small">{suggestion.reason}</p>

              <div className="capture-actions">
                <select
                  aria-label="Destination"
                  value={choiceFor(capture)}
                  onChange={(event) =>
                    setChoices((current) => ({ ...current, [capture.id]: event.target.value }))
                  }
                >
                  <optgroup label="Research">
                    {categories.map((category) => (
                      <option key={category.id} value={`research:${category.id}`}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Story">
                    <option value="character">New character</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={`beat:${unit.id}`}>
                        Beat in {unit.sequenceLabel || unit.kind} {unit.title || 'Untitled'}
                      </option>
                    ))}
                  </optgroup>
                </select>

                <button type="button" className="primary" onClick={() => void approve(capture)}>
                  Approve
                </button>
                <button type="button" onClick={() => void resolve(capture, deferCapture(capture))}>
                  Later
                </button>
                <button type="button" className="ghost danger" onClick={() => void resolve(capture, rejectCapture(capture))}>
                  Discard
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
