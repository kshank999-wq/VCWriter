import { useState } from 'react';
import {
  LEARNING_AID_KINDS,
  acceptSuggestion,
  aidFor,
  aidStanding,
  aidTitle,
  aidsOn,
  approveAid,
  discardSuggestion,
  sectionTextFor,
  writeAid,
  type BeatId,
  type LearningAid,
  type LearningAidKind,
  type ProjectFile,
  type ReviewQuestion,
} from '@vcwriter/domain';

/**
 * End-of-section learning aids (addendum 16 §10).
 *
 * The screen's job is to make §10's three rules **visible**, because they are
 * already kept in the domain and an interface that hid them would be the only
 * way left to break them:
 *
 *  - The author's words and the machine's offer are **side by side and never
 *    the same box**. A writer can always see which is which.
 *  - **Accepting is a press with a warning on it** when there is something to
 *    lose, and it offers the old wording back afterwards.
 *  - **Approving is its own control**, next to but separate from accepting,
 *    because *these are the right words* and *this goes in the book* are
 *    different decisions.
 */
interface LearningAidsPanelProps {
  file: ProjectFile;
  beatId: BeatId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  /**
   * Ask for a suggestion. Absent where no generator is configured, in which
   * case the panel is an ordinary editor — which is the whole of what §10
   * requires, the AI being the optional half.
   */
  onGenerate?(input: { beatId: BeatId; kind: LearningAidKind }): Promise<void>;
}

export function LearningAidsPanel({ file, beatId, onUpdate, onGenerate }: LearningAidsPanelProps) {
  const aids = aidsOn(file, beatId);
  const hasWords = sectionTextFor(file, beatId).trim().length > 0;

  return (
    <div className="aids">
      <div className="panel-header">
        <h3>End of section</h3>
        <span className="muted small">
          {hasWords ? 'Optional. Nothing here prints until you put it in the book.' : 'Write the section first.'}
        </span>
      </div>

      {LEARNING_AID_KINDS.map((kind) => {
        const aid = aids.find((one) => one.kind === kind) ?? null;
        return (
          <AidBlock
            key={kind}
            kind={kind}
            aid={aid}
            file={file}
            beatId={beatId}
            hasWords={hasWords}
            onUpdate={onUpdate}
            {...(onGenerate ? { onGenerate } : {})}
          />
        );
      })}
    </div>
  );
}

function AidBlock({
  kind,
  aid,
  file,
  beatId,
  hasWords,
  onUpdate,
  onGenerate,
}: {
  kind: LearningAidKind;
  aid: LearningAid | null;
  file: ProjectFile;
  beatId: BeatId;
  hasWords: boolean;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGenerate?(input: { beatId: BeatId; kind: LearningAidKind }): Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What accepting replaced, offered back until the writer moves on (§10). */
  const [undo, setUndo] = useState<{ text: string; questions: ReviewQuestion[] } | null>(null);

  const standing = aid ? aidStanding(aid) : null;
  const open = (mutate: (current: ProjectFile, id: LearningAid['id']) => ProjectFile) =>
    onUpdate((current) => {
      const made = aidFor(current, beatId, kind);
      return mutate(made.file, made.aid.id);
    });

  const generate = async () => {
    if (!onGenerate) return;
    setBusy(true);
    setError(null);
    try {
      await onGenerate({ beatId, kind });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not write a suggestion.');
    }
    setBusy(false);
  };

  return (
    <section className={standing?.aid.approved ? 'aid in-book' : 'aid'}>
      <header className="aid-head">
        <h4>{aidTitle(kind)}</h4>
        <span className="muted small">{standing ? standing.says : 'Nothing written yet.'}</span>
      </header>

      {/* The author's. The only thing that prints. */}
      {kind === 'quiz' ? (
        <QuestionList
          questions={aid?.questions ?? []}
          onChange={(questions) => open((current, id) => writeAid(current, id, { questions }))}
        />
      ) : (
        <textarea
          className="aid-text"
          aria-label={`${aidTitle(kind)} — your words`}
          rows={kind === 'summary' ? 4 : 5}
          placeholder={
            kind === 'summary' ? 'The summary a reader gets at the end of this section' : 'One thing learned per line'
          }
          value={aid?.text ?? ''}
          onChange={(event) => open((current, id) => writeAid(current, id, { text: event.target.value }))}
        />
      )}

      <div className="aid-actions">
        <label className="check">
          <input
            type="checkbox"
            checked={aid?.approved ?? false}
            disabled={!standing?.written}
            onChange={(event) => open((current, id) => approveAid(current, id, event.target.checked))}
          />
          {/* Its own control, deliberately separate from accepting. */}
          <span>In the book</span>
        </label>

        {onGenerate ? (
          <button type="button" className="ghost small" disabled={busy || !hasWords} onClick={() => void generate()}>
            {busy ? 'Reading the section…' : standing?.written ? 'Suggest another' : 'Suggest one'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}

      {/* The machine's, in its own box and never in the author's. */}
      {standing?.offered ? (
        <div className="aid-offer">
          <h5>Suggested</h5>
          {kind === 'quiz' ? (
            <ul className="aid-offer-questions">
              {aid!.suggestedQuestions.map((one, at) => (
                <li key={at}>
                  <strong>{one.prompt}</strong>
                  {one.answer ? <span className="muted small">{one.answer}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="aid-offer-text">{aid!.suggestion}</p>
          )}

          <div className="aid-actions">
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                onUpdate((current) => {
                  const taken = acceptSuggestion(current, aid!.id);
                  setUndo(taken.replaced);
                  return taken.file;
                })
              }
            >
              Use this
            </button>
            <button type="button" className="ghost small" onClick={() => open((current, id) => discardSuggestion(current, id))}>
              Discard
            </button>
            {/* Said plainly rather than discovered: what pressing it costs. */}
            {standing.written ? (
              <span className="muted small">Replaces what you wrote. You can put it back.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* §10's explicit action, made reversible. */}
      {undo && (undo.text.length > 0 || undo.questions.length > 0) ? (
        <div className="aid-undo">
          <span className="muted small">Your earlier wording is still here.</span>
          <button
            type="button"
            className="ghost small"
            onClick={() => {
              onUpdate((current) =>
                writeAid(current, aid!.id, { text: undo.text, questions: undo.questions }),
              );
              setUndo(null);
            }}
          >
            Put it back
          </button>
          <button type="button" className="ghost small" onClick={() => setUndo(null)}>
            Keep the new one
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** A quiz's questions: a prompt and an answer that may be left empty. */
function QuestionList({
  questions,
  onChange,
}: {
  questions: readonly ReviewQuestion[];
  onChange(questions: ReviewQuestion[]): void;
}) {
  const edit = (at: number, patch: Partial<ReviewQuestion>) =>
    onChange(questions.map((one, index) => (index === at ? { ...one, ...patch } : one)));

  return (
    <>
      <ul className="aid-questions">
        {questions.map((one, at) => (
          <li key={at}>
            <input
              aria-label={`Question ${at + 1}`}
              placeholder="The question"
              value={one.prompt}
              onChange={(event) => edit(at, { prompt: event.target.value })}
            />
            <input
              aria-label={`Answer ${at + 1}`}
              // Empty is ordinary: plenty of books put the answers at the back.
              placeholder="The answer, if the book prints one"
              value={one.answer}
              onChange={(event) => edit(at, { answer: event.target.value })}
            />
            <button
              type="button"
              className="ghost small danger"
              onClick={() => onChange(questions.filter((_one, index) => index !== at))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="ghost small"
        onClick={() => onChange([...questions, { prompt: '', answer: '' }])}
      >
        + Another question
      </button>
    </>
  );
}
