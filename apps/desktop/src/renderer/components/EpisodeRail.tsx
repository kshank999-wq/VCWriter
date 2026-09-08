import {
  castOf,
  episodes as episodesOf,
  type Episode,
  type ProjectFile,
} from '@vcwriter/domain';

/**
 * The episodes, down the right-hand edge (addendum 02 §17).
 *
 * A rail rather than a panel: it is a list of what the series is made of, and
 * it should be reachable from anywhere without giving up room while it is
 * closed. Shut, it is a tab. Open, it is every episode in order — its number,
 * its name, how much is written and who is in it — and the way to start the
 * next one.
 *
 * Only a series has it. In every other format the rail is not drawn at all,
 * because there is nothing for it to list.
 */

interface EpisodeRailProps {
  file: ProjectFile;
  open: boolean;
  onOpen(open: boolean): void;
  /** The episode whose scenes the workspace is showing, if any. */
  currentUnitId: string | null;
  onGo(episode: Episode): void;
  onNew(): void;
}

export function EpisodeRail({ file, open, onOpen, currentUnitId, onGo, onNew }: EpisodeRailProps) {
  if (file.project.format !== 'series') return null;
  const episodes = episodesOf(file);
  const here = currentUnitId
    ? episodes.find((episode) => episode.units.some((unit) => (unit.id as string) === currentUnitId))
    : undefined;

  return (
    <aside className={open ? 'episode-rail open' : 'episode-rail'} aria-label="Episodes">
      <button
        type="button"
        className="episode-tab"
        aria-expanded={open}
        title={open ? 'Close the episode list' : 'Every episode in the series'}
        onClick={() => onOpen(!open)}
      >
        {open ? '›' : '‹'} <span className="episode-tab-name">Episodes</span>
        {episodes.length > 0 ? <span className="count">{episodes.length}</span> : null}
      </button>

      {open ? (
        <div className="episode-rail-body">
          {episodes.length === 0 ? (
            <p className="muted small">
              No episodes yet. Starting one marks where it begins in the story and gives it a scene to write in.
            </p>
          ) : (
            <ul className="episode-list">
              {episodes.map((episode) => {
                const cast = castOf(file, episode);
                return (
                  <li key={episode.marker.id}>
                    <button
                      type="button"
                      className={here?.marker.id === episode.marker.id ? 'episode-row current' : 'episode-row'}
                      aria-current={here?.marker.id === episode.marker.id ? 'true' : undefined}
                      onClick={() => onGo(episode)}
                    >
                      <span className="episode-label">{episode.label}</span>
                      <span className="episode-title">{episode.title || 'Untitled'}</span>
                      <span className="episode-figures muted">
                        {episode.units.length} {episode.units.length === 1 ? 'scene' : 'scenes'} ·{' '}
                        {episode.words.toLocaleString()} {episode.words === 1 ? 'word' : 'words'}
                      </span>
                      {cast.length > 0 ? (
                        <span className="episode-cast muted">
                          {cast
                            .slice(0, 4)
                            .map((person) => person.name)
                            .join(' · ')}
                          {cast.length > 4 ? ` +${cast.length - 4}` : ''}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" className="primary episode-new" onClick={onNew}>
            + New episode
          </button>
        </div>
      ) : null}
    </aside>
  );
}
