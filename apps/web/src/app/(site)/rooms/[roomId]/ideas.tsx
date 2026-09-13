'use client';

import { useState } from 'react';
import {
  boxColour,
  boxName,
  filedNote,
  seatInitials,
  type IdeaBox,
  type ResearchCategory,
} from '@vcwriter/domain';

/**
 * The brainstorming room (addendum 07 §11, stage 7).
 *
 * Ken: *you can see whose ideas are what, because they're colorized and the
 * boxes are colorized.* So the box is the unit, and the box wears its writer's
 * colour — a screenful of ideas says at a glance whose room this is and where
 * the agreement is.
 *
 * **This is not a second Curation Tray.** The tray assembles a script (§12);
 * this is where a room argues about what the story is before there is one to
 * assemble. So the only action here is *filing*: taking an idea into the
 * project's own research, under a heading somebody chose.
 *
 * And filing does not consume it. A filed box stays exactly where it is,
 * marked taken up and still wearing its writer's colour, because §1 is about
 * ideas as much as it is about pages.
 */
export function Ideas({
  roomId,
  boxes,
  categories,
  canFile,
}: {
  roomId: string;
  boxes: IdeaBox[];
  categories: ResearchCategory[];
  /** Whether this reader files, or is only looking at the room's thinking. */
  canFile: boolean;
}) {
  const [into, setInto] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const file = async (box: IdeaBox) => {
    const categoryId = into[box.submission.id] ?? categories[0]?.id;
    if (!categoryId) return;

    setBusy(box.submission.id);
    setError(null);
    const response = await fetch(`/api/rooms/${roomId}/ideas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ submissionId: box.submission.id, categoryId, itemIds: [] }),
    });
    setBusy(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? 'It could not be filed.');
      return;
    }
    window.location.reload();
  };

  if (boxes.length === 0) {
    return (
      <p className="lede">
        Nothing here yet. Research, characters and ideas a writer submits arrive here, each box in their own
        colour, before anybody decides where they belong.
      </p>
    );
  }

  return (
    <>
      <div className="ideas">
        {boxes.map((box) => (
          <article
            key={box.submission.id}
            className={box.filed ? 'idea-box filed' : 'idea-box'}
            // The colour is the point: whose idea this is, at a glance.
            style={{ '--idea-colour': boxColour(box) } as React.CSSProperties}
          >
            <header>
              <span className="room-chip" style={{ background: boxColour(box) }} aria-hidden>
                {box.seat ? seatInitials(box.seat) : '—'}
              </span>
              <strong>{boxName(box)}</strong>
              {box.submission.note ? <span className="small muted">{box.submission.note}</span> : null}
              {/* Taken up, and said quietly — the box is not dimmed, because it
                  has not gone anywhere. */}
              {box.filed ? <span className="idea-filed">✓ Filed</span> : null}
            </header>

            {box.items.length > 0 ? (
              <ul className="idea-items">
                {box.items.map((item) => (
                  <li key={item.id as string}>
                    <strong>{item.title}</strong>
                    {item.body ? <span className="small block muted">{item.body}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">
                Nothing readable in it from here — open the version it was taken from to see it whole.
              </p>
            )}

            <footer>
              <span className="small muted">{filedNote(box)}</span>
              {/* The heading first, on its own line: it is the choice, and the
                  buttons underneath are what is done with it. */}
              {canFile && !box.filed ? (
                <select
                  className="idea-where"
                  aria-label={`Where to file ${boxName(box)}’s ideas`}
                  value={into[box.submission.id] ?? categories[0]?.id ?? ''}
                  onChange={(event) =>
                    setInto((current) => ({ ...current, [box.submission.id]: event.target.value }))
                  }
                >
                  {categories.map((category) => (
                    <option key={category.id as string} value={category.id as string}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <span className="idea-acts">
                <a
                  className="button small"
                  href={`/preview?room=${roomId}&version=${box.submission.versionId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open it
                </a>
                {canFile && !box.filed ? (
                  <button
                    type="button"
                    className="button small"
                    disabled={busy === box.submission.id}
                    onClick={() => void file(box)}
                  >
                    {busy === box.submission.id ? 'Filing…' : 'File it'}
                  </button>
                ) : null}
              </span>
            </footer>
          </article>
        ))}
      </div>
      {error ? (
        <p className="error small" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
