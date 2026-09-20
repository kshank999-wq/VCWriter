import { isCollection, storiesOf, type ProjectFile, type Story } from '@vcwriter/domain';

/**
 * The stories, down the right-hand edge of a collection (addendum 22 §3).
 *
 * A collection's stories are what a series' episodes are — the divisions a
 * writer moves between and adds to — so this is the episode rail's shape
 * with a story in each row: its number where the collection numbers, its
 * name, how many sections and words it has. One click goes to it; two open
 * its own page, the leaf the story opens on, because a story in a
 * collection has a page of its own the way an episode has a title page.
 * **+ New story** starts one on a section of its own at the end.
 *
 * Absent on every other format rather than empty: a novel has chapters and
 * a screenplay has neither.
 */

interface StoryRailProps {
  file: ProjectFile;
  open: boolean;
  onOpen(open: boolean): void;
  /** The section whose beat the workspace is showing, if any. */
  currentUnitId: string | null;
  onGo(story: Story): void;
  onOpenPage(story: Story): void;
  onNew(): void;
}

export function StoryRail({ file, open, onOpen, currentUnitId, onGo, onOpenPage, onNew }: StoryRailProps) {
  if (!isCollection(file.project.format)) return null;
  const stories = storiesOf(file);
  const here = currentUnitId ? stories.find((story) => story.sections.some((unit) => (unit.id as string) === currentUnitId)) : undefined;

  return (
    <aside className={open ? 'episode-rail open' : 'episode-rail'} aria-label="Stories">
      <button
        type="button"
        className="episode-tab"
        aria-expanded={open}
        title={open ? 'Close the story list' : 'Every story in the collection'}
        onClick={() => onOpen(!open)}
      >
        {open ? '›' : '‹'} <span className="episode-tab-name">Stories</span>
        {stories.length > 0 ? <span className="count">{stories.length}</span> : null}
      </button>

      {open ? (
        <div className="episode-rail-body">
          {stories.length === 0 ? (
            <p className="muted small">No stories yet. Starting one gives it a section of its own to write in and a page that names it.</p>
          ) : (
            <ul className="episode-list">
              {stories.map((story) => {
                const id = story.placed.marker.id as string;
                const current = here?.placed.marker.id === story.placed.marker.id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={current ? 'episode-row current' : 'episode-row'}
                      aria-current={current ? 'true' : undefined}
                      title={`Go to ${story.placed.marker.title.trim() || 'this story'} · double-click for its page`}
                      onClick={() => onGo(story)}
                      onDoubleClick={() => onOpenPage(story)}
                    >
                      {story.placed.label ? <span className="episode-label">{story.placed.label}</span> : null}
                      <span className="episode-title">{story.placed.marker.title.trim() || 'Untitled'}</span>
                      <span className="episode-figures muted">
                        {story.sections.length} {story.sections.length === 1 ? 'section' : 'sections'} · {story.words.toLocaleString()}{' '}
                        {story.words === 1 ? 'word' : 'words'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <button type="button" className="primary episode-new" onClick={onNew}>
            + New story
          </button>
        </div>
      ) : null}
    </aside>
  );
}
