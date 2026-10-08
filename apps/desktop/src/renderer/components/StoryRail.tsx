import { useState } from 'react';
import {
  divisionRemoval,
  divisionStart,
  isCollection,
  storiesOf,
  unplacedSections,
  type ProjectFile,
  type Story,
} from '@vcwriter/domain';

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
  /** Give the writing ahead of the first story a break of its own (§9ab). */
  onClaim(unitId: string): void;
}

export function StoryRail({ file, open, onOpen, currentUnitId, onGo, onOpenPage, onNew, onRemove, onClaim }: StoryRailProps) {
  if (!isCollection(file.project.format)) return null;
  const stories = storiesOf(file);
  /** The sections no story claims, and what making them one would do. */
  const loose = unplacedSections(file);
  const start = divisionStart(file, (loose[0]?.id ?? null) as never);
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
                    comfort={divisionRemoval(file, story.placed.marker.id).comfort}
                    refusal={divisionRemoval(file, story.placed.marker.id).refusal}
                    onGo={() => onGo(story)}
                    onOpenPage={() => onOpenPage(story)}
                    onRemove={() => onRemove(story)}
                  />
                );
              })}
            </ul>
          )}

          {/**
           * **Writing that no story claims says so, and can be made one**
           * (§9ab, from Ken: *it no longer shows up in the tab to the right
           * but the story is still there — each story needs to be held
           * together not merged with other stories*).
           *
           * This list reads the markers, so a story whose break has gone is
           * not on it while every word of it is still in the book. The honest
           * row is not a story — it has no marker to be one — it is a line
           * saying the writing is there and a press that gives it back its
           * break, which is `divisionStart`'s act and not `+ New story`'s: one
           * gathers writing that exists, the other makes an empty section at
           * the end.
           */}
          {loose.length > 0 ? (
            <div className="episode-loose">
              <p className="muted small">
                {loose.length === 1 ? '1 section stands' : `${loose.length} sections stand`} ahead of the first story,
                in the book but in no story.
              </p>
              <button type="button" className="small" onClick={() => onClaim(loose[0]!.id as string)}>
                {start.act ?? 'Make them a story'}
              </button>
              {start.comfort ? <p className="muted small">{start.comfort}</p> : null}
            </div>
          ) : null}

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
  refusal,
  onGo,
  onOpenPage,
  onRemove,
}: {
  story: Story;
  current: boolean;
  comfort: string;
  /** Why there is nothing to take, where there is nothing (§9ac). */
  refusal: string | null;
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
      {asking && !refusal ? (
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
        /* **Disabled with the reason in its title, never absent** (addendum
           20 §9ac): a story with writing in it is never run together with
           the one before it, and §9x's own finding is that absence reads as
           the act not being there at all. */
        <button
          type="button"
          className="ghost small episode-remove"
          aria-label={`Remove ${name}`}
          disabled={refusal !== null}
          title={refusal ?? 'Take this story out of the collection'}
          onClick={() => setAsking(true)}
        >
          ×
        </button>
      )}
    </li>
  );
}
