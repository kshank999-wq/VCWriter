import React, { useMemo, useState } from 'react';
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
export const RoomBar = ({
  file,
  looking,
}: {
  file: ProjectFile | null;
  /**
   * What the writer is looking at, which is what decides where a submission
   * goes (§10). The Script is a pass on the script; Research, the Sculptor and
   * the Outliner are ideas. The button reads this rather than asking.
   */
  looking: 'script' | 'research';
}): React.ReactElement | null => {
  const room = useRoom();
  const { identity, byAuthor, you, author, readOnly, only, setOnly, cleanReading, setCleanReading } = room;

  const contributors = useMemo(
    () => (file ? contributorsIn(file, byAuthor) : []),
    [file, byAuthor],
  );

  if (!identity) return null;

  // Whose this is. On a desk that is the reader; in a window opened on a
  // recorded version it is whoever wrote it, and saying otherwise would be the
  // one mistake §3.4 exists to prevent.
  const master = identity.showing === 'master';
  const whose = master ? 'The master' : author ? `${author.name}’s draft` : 'A draft';

  return (
    <div
      className={`room-bar${readOnly ? ' reading' : ''}`}
      style={author ? ({ '--room-colour': author.colour } as React.CSSProperties) : undefined}
    >
      <span className="room-who">
        {author && !master ? <span className="room-chip">{author.initials}</span> : null}
        <strong>{whose}</strong>
        {author?.title && !master ? <span className="muted">{author.title}</span> : null}
        <span className="muted">{identity.label || identity.roomName}</span>
        {readOnly ? (
          <span className="room-reading" title="A version cannot be changed once it exists">
            Read only
          </span>
        ) : null}
        {readOnly && you && author && you.authorId !== author.authorId ? (
          <span className="muted">Reading as {you.name}</span>
        ) : null}
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

      <SubmitWork readOnly={readOnly} looking={looking} />

      <label className="room-clean">
        <input type="checkbox" checked={cleanReading} onChange={(event) => setCleanReading(event.target.checked)} />
        Clean reading
      </label>
    </div>
  );
};

export default RoomBar;

/**
 * The one button (addendum 07 §10).
 *
 * **What you are looking at decides where it goes**, so the button asks for a
 * word and nothing else: the Script goes to the review queue, research and
 * ideas to the brainstorming room. A writer choosing between two destinations
 * from a menu would be doing the machine's job.
 *
 * It says what it did, because submitting is invisible otherwise — the draft
 * does not change, the writer stays where they are, and without a sentence
 * back the only evidence would be a page on somebody else's screen.
 */
function SubmitWork({
  readOnly,
  looking,
}: {
  readOnly: boolean;
  looking: 'script' | 'research';
}): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  // What is open decides it. Still a control rather than a silent choice,
  // because the writer is the one who knows what they meant — but it is
  // already right, which is the whole of Ken's mechanism.
  const [kind, setKind] = useState<'script' | 'research'>(looking);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = window.vcwriter?.submitWork;
  // A recorded version is somebody's past, not a draft: there is nothing here
  // to send, and the reader is very often not its author.
  if (!send || readOnly) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const result = await send.call(window.vcwriter, { kind, note: note.trim() });
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'It could not be sent.');
      return;
    }
    setOpen(false);
    setNote('');
    setSaid(
      kind === 'research'
        ? 'Sent to the room’s ideas. Your draft is untouched.'
        : 'Sent for review. Your draft is untouched — carry on.',
    );
  };

  return (
    <span className="room-submit">
      {said ? (
        <span className="room-sent" role="status" onAnimationEnd={() => setSaid(null)}>
          {said}
        </span>
      ) : null}

      <button
        type="button"
        className="room-send"
        title="Send this draft for review. Nothing is copied out of it and nothing on your desk changes."
        onClick={() => {
          if (!open) setKind(looking);
          setOpen(!open);
        }}
      >
        Submit
      </button>

      {open ? (
        <span className="room-submit-pop" role="dialog" aria-label="Submit this draft">
          <label className="field">
            <span>What is it?</span>
            <select value={kind} onChange={(event) => setKind(event.target.value as 'script' | 'research')}>
              <option value="script">A pass on the script — to the review queue</option>
              <option value="research">Research and ideas — to the room’s ideas</option>
            </select>
          </label>
          <input
            aria-label="What to call it"
            placeholder="What is this pass? (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              }
            }}
          />
          {error ? <span className="error small">{error}</span> : null}
          <span className="room-submit-row">
            <button type="button" className="ghost small" onClick={() => setOpen(false)} disabled={busy}>
              Not yet
            </button>
            <button type="button" className="button small" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Sending…' : 'Send it'}
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}
