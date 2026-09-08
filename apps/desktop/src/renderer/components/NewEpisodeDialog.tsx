import { useEffect, useState } from 'react';
import {
  addEpisode,
  castForNewEpisode,
  characterCategoriesInOrder,
  defaultEpisodeCarry,
  episodes as episodesOf,
  type Episode,
  type EpisodeCarry,
  type ProjectFile,
} from '@vcwriter/domain';
import { useModal } from '../use-modal';

/**
 * Starting the next episode (addendum 02 §17).
 *
 * Two questions, and the second is the one that matters. The name is just a
 * name. **What comes over from the episodes before** is the decision a series
 * makes every week, so it is a list of switches rather than a guess — and the
 * answer is remembered, because next week the answer is almost always the
 * same.
 *
 * What the new episode does *not* get is any of last week's text. It is a
 * clear slate with a scene to write in; that is the point of a new episode.
 */

interface NewEpisodeDialogProps {
  file: ProjectFile;
  open: boolean;
  onClose(): void;
  onCreate(mutate: (current: ProjectFile) => ProjectFile): void;
  onGo(episode: Episode): void;
}

export function NewEpisodeDialog({ file, open, onClose, onCreate, onGo }: NewEpisodeDialogProps) {
  const dialog = useModal(open);
  const [title, setTitle] = useState('');
  const [carry, setCarry] = useState<EpisodeCarry>(() => defaultEpisodeCarry(file));

  // Opening it reads what was carried last time, which is the whole point of
  // remembering it.
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setCarry(defaultEpisodeCarry(file));
  }, [open, file]);

  const headings = characterCategoriesInOrder(file);
  const next = episodesOf(file).length + 1;
  const coming = castForNewEpisode(file, carry).length;

  const toggleHeading = (id: string, on: boolean) =>
    setCarry((current) => ({
      ...current,
      castFrom: on ? [...current.castFrom, id] : current.castFrom.filter((entry) => entry !== id),
    }));

  const create = () => {
    onCreate((current) => {
      const made = addEpisode(current, { title: title.trim(), carry });
      // Go to it: a new episode you have to hunt for is not a new episode.
      queueMicrotask(() => onGo(made.episode));
      return made.file;
    });
    onClose();
  };

  return (
    <dialog ref={dialog} className="lane-dialog new-episode" aria-label="New episode" onClose={onClose}>
      {open ? (
        <>
          <header className="lane-dialog-title">
            <span className="bar-title">Episode {next}</span>
            <button type="button" className="ghost" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="page-setup-body">
            <label className="field">
              What is it called
              <input
                autoFocus
                aria-label="Episode name"
                placeholder="Pilot"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') create();
                }}
              />
            </label>

            <h4>What comes over</h4>
            {headings.length === 0 ? (
              <p className="muted small">
                No character headings yet. Research → Characters is where the cast is filed, and the headings there
                are what an episode carries over.
              </p>
            ) : (
              headings.map((heading) => (
                <label className="check" key={heading.id}>
                  <input
                    type="checkbox"
                    aria-label={heading.name}
                    checked={carry.castFrom.includes(heading.id as string)}
                    onChange={(event) => toggleHeading(heading.id as string, event.target.checked)}
                  />
                  <span>{heading.name}</span>
                </label>
              ))
            )}

            <label className="check">
              <input
                type="checkbox"
                aria-label="Whoever spoke last episode"
                checked={carry.castWhoSpoke}
                onChange={(event) => setCarry({ ...carry, castWhoSpoke: event.target.checked })}
              />
              <span>Whoever actually spoke in the last episode</span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                aria-label="Open setups"
                checked={carry.openSetups}
                onChange={(event) => setCarry({ ...carry, openSetups: event.target.checked })}
              />
              <span>The setups still unpaid, noted on the episode</span>
            </label>

            <label className="field">
              Where it is plotted
              <select
                aria-label="Where it is plotted"
                value={carry.lanes}
                onChange={(event) => setCarry({ ...carry, lanes: event.target.value as EpisodeCarry['lanes'] })}
              >
                <option value="series">On the series&rsquo; own plot lanes</option>
                <option value="fresh">On a fresh lane for this episode</option>
              </select>
            </label>

            <p className="muted">
              {coming === 0
                ? 'Nobody carried over — the episode starts with an empty cast.'
                : `${coming} ${coming === 1 ? 'character comes' : 'characters come'} over. `}
              None of the writing does: the episode starts with a scene of its own and nothing in it.
            </p>
          </div>

          <footer className="page-setup-actions">
            <button type="button" className="ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={create}>
              Start episode {next}
            </button>
          </footer>
        </>
      ) : null}
    </dialog>
  );
}
