import React from 'react';

/**
 * The room is talking about this (addendum 07 §14).
 *
 * **A count, and a link out — not the conversation.** The threads are read and
 * answered on the room page, where a discussion has room to be one; here the
 * question a writer actually has is *is there something I should know about this
 * scene before I rewrite it*, and a number answers that without turning the
 * script into a comment client.
 *
 * Nothing where nothing is open: a settled thread has been dealt with, and a
 * badge that never goes away stops meaning anything.
 */
export const TalkMark = ({
  count,
  roomId,
}: {
  count: number;
  /** Where the thread actually lives. Absent outside a room. */
  roomId: string | null;
}): React.ReactElement | null => {
  if (count < 1) return null;

  const said = count === 1 ? '1 thread open about this' : `${count} threads open about this`;
  const body = (
    <>
      <span aria-hidden>❝</span>
      {count > 1 ? count : null}
    </>
  );

  return roomId ? (
    <a
      className="talk-mark"
      href={`/rooms/${roomId}`}
      target="_blank"
      rel="noreferrer"
      title={`${said}. Read it in the room.`}
    >
      {body}
    </a>
  ) : (
    <span className="talk-mark" title={said}>
      {body}
    </span>
  );
};

export default TalkMark;
