import { useMemo, useState } from 'react';
import {
  characterWorkIn,
  describeWork,
  onDeckForBeat,
  pinUsage,
  unpinUsage,
  type BeatId,
  type CharacterWork,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The Character Creator read from the scene (addendum 08 §10, stage 6).
 *
 * Everything else in the module starts from a person and asks where their work
 * landed. A writer in a beat has the opposite question — **what is this
 * carrying, and what is waiting for these people?** — and it is the same rows
 * read backwards, so there is nothing new stored to answer it.
 *
 * **The queue is the point of the stage.** §10 asks for future arc moments kept
 * on deck and assigned *when the plot creates an opportunity*, and the moment an
 * opportunity appears is the moment somebody is writing the scene. So what is
 * waiting is offered here, one press from being in the writing, rather than
 * three screens away in the Creator.
 *
 * Whoever speaks in the beat comes first and **everybody else is still offered**:
 * a scene can carry work belonging to somebody who never says a word in it.
 */

interface CharacterWorkPanelProps {
  file: ProjectFile;
  beatId: BeatId;
  onUpdate(mutate: (current: ProjectFile) => ProjectFile): void;
}

export function CharacterWorkPanel({ file, beatId, onUpdate }: CharacterWorkPanelProps) {
  const [open, setOpen] = useState(true);
  const [offering, setOffering] = useState(false);

  const here = useMemo(() => characterWorkIn(file, beatId), [file, beatId]);
  const queue = useMemo(() => onDeckForBeat(file, beatId), [file, beatId]);

  const pin = (work: CharacterWork) => {
    onUpdate((current) =>
      pinUsage(current, { ownerKind: work.kind, ownerId: work.id, beatId }).file,
    );
  };

  const unpin = (work: CharacterWork) => {
    const link = file.usageLinks.find(
      (one) =>
        (one.beatId as string) === (beatId as string) &&
        one.ownerKind === work.kind &&
        one.ownerId === work.id,
    );
    if (link) onUpdate((current) => unpinUsage(current, link.id));
  };

  const waiting = [...queue.here, ...queue.rest];

  return (
    <section className={open ? 'related open' : 'related'}>
      <header>
        <button type="button" className="ghost twisty" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? '▾' : '▸'}
        </button>
        <h3>Character work</h3>
        <span className="count muted">{here.length}</span>
      </header>

      {open ? (
        <>
          {here.length > 0 ? (
            <ul className="work-list">
              {here.map((work) => (
                <li key={`${work.kind}:${work.id}`}>
                  <span className="work-who">{work.characterName}</span>
                  <span className="work-what" title={describeWork(work)}>
                    {describeWork(work)}
                  </span>
                  <button
                    type="button"
                    className="ghost danger"
                    aria-label={`Unpin ${work.text}`}
                    title="Takes the pin. The writing itself is not touched."
                    onClick={() => unpin(work)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted empty">Nothing of anybody's plan has landed here yet.</p>
          )}

          {/* §10's unassigned queue, offered where the opportunity appears. */}
          {waiting.length > 0 ? (
            <div className="work-deck">
              <button
                type="button"
                className="ghost small"
                aria-expanded={offering}
                onClick={() => setOffering(!offering)}
              >
                {offering ? '▾' : '▸'} On deck ({waiting.length})
              </button>
              {offering ? (
                <ul className="work-list deck">
                  {waiting.map((work) => (
                    <li key={`${work.kind}:${work.id}`} className={queue.here.includes(work) ? 'in-beat' : ''}>
                      <span className="work-who">{work.characterName}</span>
                      <span className="work-what" title={describeWork(work)}>
                        {describeWork(work)}
                      </span>
                      <button
                        type="button"
                        className="ghost small"
                        aria-label={`Pin ${work.text} here`}
                        title="It lands in this beat, and turns green."
                        onClick={() => pin(work)}
                      >
                        + Here
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
