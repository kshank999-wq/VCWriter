import { useState } from 'react';
import { divisionRemoval, isCollection, storiesOf, type ProjectFile, type Story } from '@vcwriter/domain';

/**
 * The stories, down the right-hand edge of a collection (addendum 22 §3).
 *
 * A collection's stories are what a series' episodes are — the divisions a
 * writer moves between and adds to — so this is the episode rail's shape
 * with a story in each row: its number where the collection numbers, its
 * name, how many sections and words it has. One click goes to it; two open
 * its own page, the leaf the story opens on, because a story in a
 * collection has a page of its own the way an episode has a title page.
 * **+ New story** starts one on a section of its own at the end, and a **×**
 * on the row takes one out again (§7, from Ken: *I added a story by accident.
 * I need the ability to remove a story also… when you hit the X, it asks you,
 * are you sure?*). It is the Layout rail's × in the workspace: hidden until
 * the row is under the pointer or holding focus, asked once inline with what
 * would go said beside it, and `divisionRemoval` is the one place that
 * sentence comes from, so the two rails cannot promise different things.
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
  onRemove(story: Story): void;
}

export function StoryRail({ file, open, onOpen, currentUnitId, onGo, onOpenPage, onNew, onRemove }: StoryRailProps) {
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
                  <StoryRow
                    key={id}
                    story={story}
                    current={current}
                    comfort={divisionRemoval(file, story.placed.marker.id)}
                    onGo={() => onGo(story)}
                    onOpenPage={() => onOpenPage(story)}
                    onRemove={() => onRemove(story)}
                  />
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

/**
 * One story. The × is hidden until the row is hovered or holds focus — Ken's
 * *a little X in the box when you hover over it* — and never removes on the
 * press: it asks, with `divisionRemoval`'s sentence beside it, because what a
 * × does to a story that has words in it is not what it does to one added by
 * accident, and the writer should read which before pressing again.
 */
function StoryRow({
  story,
  current,
  comfort,
  onGo,
  onOpenPage,
  onRemove,
}: {
  story: Story;
  current: boolean;
  comfort: string;
  onGo(): void;
  onOpenPage(): void;
  onRemove(): void;
}) {
  const [asking, setAsking] = useState(false);
  const name = story.placed.marker.title.trim() || 'Untitled';
  return (
    <li className={asking ? 'episode-item asking' : 'episode-item'}>
      <button
        type="button"
        className={current ? 'episode-row current' : 'episode-row'}
        aria-current={current ? 'true' : undefined}
        title={`Go to ${story.placed.marker.title.trim() || 'this story'} · double-click for its page`}
        onClick={onGo}
        onDoubleClick={onOpenPage}
      >
        {story.placed.label ? <span className="episode-label">{story.placed.label}</span> : null}
        <span className="episode-title">{name}</span>
        <span className="episode-figures muted">
          {story.sections.length} {story.sections.length === 1 ? 'section' : 'sections'} · {story.words.toLocaleString()}{' '}
          {story.words === 1 ? 'word' : 'words'}
        </span>
      </button>
      {asking ? (
        <div className="episode-ask">
          <p className="muted small">{comfort}</p>
          <div className="episode-ask-buttons">
            <button type="button" className="ghost small danger" onClick={onRemove}>
              Remove
            </button>
            <button type="button" className="ghost small" onClick={() => setAsking(false)}>
              Keep
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ghost small episode-remove"
          aria-label={`Remove ${name}`}
          title="Take this story out of the collection"
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      )}
    </li>
  );
}
