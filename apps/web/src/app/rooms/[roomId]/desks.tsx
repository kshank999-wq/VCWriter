import { deskNote, describeVersion, seatInitials, seatName, type Desk, type Version } from '@vcwriter/domain';

/**
 * The room, desk by desk (addendum 07 §10, stage 5).
 *
 * The dashboard the showrunner lands on, and the same board a writer sees of
 * their own line. **It shows that a writer is working and nothing of what they
 * wrote** — which is not a gap: a room where everyone can read everyone's
 * unfinished draft is a room where nobody drafts (§7). The note under each
 * desk says so in the room's own words, so a showrunner meets the promise here
 * rather than discovering it later.
 *
 * Each version opens in a window of its own, and several may be open at once
 * (§3.4). That is the point of the colour and the name on the row: three
 * windows showing the same scene are indistinguishable without them.
 */
export const Desks = ({ roomId, desks }: { roomId: string; desks: Desk[] }) => (
  <ul className="desks">
    {desks.map((desk) => (
      <li key={desk.seat.id} className="desk">
        {/* The same chip the seats table wears, so one writer looks like one
            writer wherever the room draws them. */}
        <span className="room-chip" style={{ background: desk.seat.colour || '#666' }} aria-hidden>
          {seatInitials(desk.seat) || '—'}
        </span>

        <span className="desk-who">
          <strong>{seatName(desk.seat)}</strong>
          {desk.seat.title ? <span className="small"> · {desk.seat.title}</span> : null}
          <span className="small block">{deskNote(desk)}</span>
        </span>

        <span className="desk-points">
          {desk.versions.length > 0 ? (
            desk.versions.map((version: Version) => (
              <a
                key={version.id}
                className="button small"
                href={`/preview?room=${roomId}&version=${version.id}`}
                // A window of its own, so two of them sit side by side.
                target="_blank"
                rel="noreferrer"
              >
                {describeVersion(version)}
              </a>
            ))
          ) : (
            <span className="small">—</span>
          )}
        </span>
      </li>
    ))}
  </ul>
);
