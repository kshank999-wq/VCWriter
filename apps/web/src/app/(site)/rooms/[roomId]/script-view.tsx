'use client';

import { useState } from 'react';
import { passageText, type AssignableThing, type ScriptScene, type Seat } from '@vcwriter/domain';
import { AssignForm, type FixedTarget } from './assign-form';
import { selectionIn } from './integrate';

/**
 * The script, read in the room, and given out from (addendum 07 §37).
 *
 * From Ken, 11 November: *the script can be opened and tasks assigned from
 * the writer's room by highlighting a section.* The master reads down the
 * left, scene by scene; highlighting words in a beat — or pressing *Assign*
 * beside a scene or a beat — fills the panel on the right, where the
 * showrunner says what is wanted, ticks the writers, and assigns it.
 *
 * Writers read the same script here, without the panel: giving out work is
 * the showrunner's.
 */
export function ScriptView({
  roomId,
  script,
  seats,
  things,
  canGive,
}: {
  roomId: string;
  script: ScriptScene[];
  seats: Seat[];
  things: AssignableThing[];
  canGive: boolean;
}) {
  const [fixed, setFixed] = useState<FixedTarget | null>(null);
  // A new key per choice, so the form starts clean for each new passage.
  const [round, setRound] = useState(0);
  const choose = (next: FixedTarget) => {
    setFixed(next);
    setRound((n) => n + 1);
  };

  if (script.length === 0) {
    return <p className="small">The script has no scenes yet, so there is nothing to read here.</p>;
  }

  return (
    <div className={`sv${canGive ? ' sv-giving' : ''}`}>
      <div className="sv-script">
        {script.map((scene) => (
          <section key={scene.id} className="sv-scene">
            {scene.episode ? <h3 className="sv-episode">{scene.episode}</h3> : null}
            <header className="sv-scene-head">
              <span>{scene.title}</span>
              {canGive ? (
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => choose({ kind: 'scene', id: scene.id, place: scene.title })}
                >
                  Assign this scene
                </button>
              ) : null}
            </header>
            {scene.beats.map((beat) => {
              const place = `${scene.title} › ${beat.title}`;
              const on = fixed?.kind === 'beat' && fixed.id === beat.id;
              return (
                <div key={beat.id} className={`sv-beat${on ? ' on' : ''}`}>
                  <header className="sv-beat-head">
                    <span className="small muted">{beat.title}</span>
                    {canGive ? (
                      <button
                        type="button"
                        className="linkish small"
                        onClick={() => choose({ kind: 'beat', id: beat.id, place })}
                      >
                        Assign this beat
                      </button>
                    ) : null}
                  </header>
                  <div
                    className="ig-page sv-page"
                    onMouseUp={(event) => {
                      if (!canGive) return;
                      const picked = selectionIn(event.currentTarget);
                      if (!picked) return;
                      const { startElementId, endElementId, startOffset, endOffset } = picked.anchor;
                      if (startElementId === endElementId && startOffset === endOffset) return;
                      const quote = (passageText(beat.manuscript, picked.anchor) ?? '').trim();
                      if (!quote) return;
                      choose({ kind: 'beat', id: beat.id, place, passage: { ...picked.anchor, quote } });
                    }}
                  >
                    {beat.manuscript.elements.length === 0 ? <p className="muted small">This beat has no text yet.</p> : null}
                    {beat.manuscript.elements.map((element) => (
                      <div key={element.id as string} className={`ig-line ig-${element.type}`}>
                        <p data-el={element.id as string}>{element.text || ' '}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {canGive ? (
        <aside className="sv-panel">
          <h3>Assign</h3>
          {fixed ? (
            <AssignForm
              key={round}
              roomId={roomId}
              seats={seats}
              things={things}
              fixed={fixed}
              onClearFixed={() => setFixed(null)}
            />
          ) : (
            <p className="small">
              Highlight words in the script to give that passage to a writer, or press <strong>Assign this scene</strong> or{' '}
              <strong>Assign this beat</strong>.
            </p>
          )}
        </aside>
      ) : null}
    </div>
  );
}
