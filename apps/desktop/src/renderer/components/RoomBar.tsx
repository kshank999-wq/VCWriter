import React, { useMemo } from 'react';
import { contributorsIn, type ProjectFile } from '@vcwriter/domain';
import { useRoom } from '../room';

/**
 * Whose draft this is, above the work (addendum 07 §6.2).
 *
 * The bar answers the question a writer in a room asks before any other: *am I
 * looking at mine?* Four writers' windows of one script are otherwise
 * identical, and a note typed into the wrong one is the mistake this exists to
 * prevent.
 *
 * It carries two controls and no more. **Clean reading** takes every colour off
 * the page, because a draft has to be read at some point as it will be read
 * outside the room. **Picking a contributor** marks their work rather than
 * hiding everyone else's — a script with the other three writers' scenes taken
 * out of it is not a script, it is a pile of fragments.
 *
 * Nothing here when there is no room, which is the desktop and the plain
 * preview: a script with one author has nothing to attribute.
 */
export const RoomBar = ({ file }: { file: ProjectFile | null }): React.ReactElement | null => {
  const room = useRoom();
  const { identity, byAuthor, you, only, setOnly, cleanReading, setCleanReading } = room;

  const contributors = useMemo(
    () => (file ? contributorsIn(file, byAuthor) : []),
    [file, byAuthor],
  );

  if (!identity) return null;

  const mine = identity.showing === 'contribution';

  return (
    <div className="room-bar" style={you ? ({ '--room-colour': you.colour } as React.CSSProperties) : undefined}>
      <span className="room-who">
        {you ? <span className="room-chip">{you.initials}</span> : null}
        <strong>{mine ? (you ? `${you.name}’s draft` : 'Your draft') : 'The master'}</strong>
        {you?.title ? <span className="muted">{you.title}</span> : null}
        <span className="muted">{identity.roomName}</span>
      </span>

      {contributors.length > 0 ? (
        <span className="room-people">
          {contributors.map((who) => (
            <button
              key={who.authorId}
              type="button"
              className={`room-person${only === who.authorId ? ' picked' : ''}`}
              style={{ '--room-colour': who.colour } as React.CSSProperties}
              title={`${who.name}${who.title ? ` — ${who.title}` : ''}`}
              aria-pressed={only === who.authorId}
              // The same press again is how a writer stops picking somebody
              // out: there is no separate 'everyone' to hunt for.
              onClick={() => setOnly(only === who.authorId ? null : who.authorId)}
            >
              {who.initials}
            </button>
          ))}
        </span>
      ) : null}

      <label className="room-clean">
        <input type="checkbox" checked={cleanReading} onChange={(event) => setCleanReading(event.target.checked)} />
        Clean reading
      </label>
    </div>
  );
};

export default RoomBar;
