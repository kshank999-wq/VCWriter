import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  assignmentsOn,
  attributionsOf,
  isSigned,
  stampFor,
  type Assignment,
  type AssignmentTarget,
  type Attribution,
  type PageStamp,
} from '@vcwriter/domain';
import type { RoomIdentity } from '../preload/index';

/**
 * The room, as the interface reads it (addendum 07 §6).
 *
 * A context rather than a prop, for one reason: **a colour is a fact about the
 * room, not about a scene**. Threading an author's colour down through the
 * workspace, the script, the lanes and the inspector would put a room into
 * every component that draws a beat, and every one of them would have to keep
 * passing it on to the next. Nothing here knows there is a room until it wants
 * to draw a colour, and outside a room the context is empty and every one of
 * these answers is the quiet one.
 *
 * **Read through, never copied across.** `byAuthor` is rebuilt from the seats,
 * so the colour a badge draws is the colour the seat has now.
 */

export interface RoomState {
  /** Null everywhere but a Writers Room — on the desktop, and in the plain preview. */
  identity: RoomIdentity | null;
  /** The seats, as the one map every badge, bar and stamp reads through. */
  byAuthor: ReadonlyMap<string, Attribution>;
  /** The reader — this writer, where the room knows them. */
  you: Attribution | null;
  /**
   * Whose draft this window holds.
   *
   * The reader's own on their desk, and somebody else's in a window opened on
   * a recorded version (§3.4). The stamp and the bar read this, never `you`: a
   * page of Jo's draft is stamped JC whoever is looking at it (§6.1).
   */
  author: Attribution | null;
  /** A recorded version cannot be changed; the bar says so before anyone types. */
  readOnly: boolean;
  /**
   * Whose work is being picked out, or null for everybody's.
   *
   * A choice of one contributor **marks** their work rather than hiding the
   * rest: a script with four writers' scenes taken out of it is not a script.
   */
  only: string | null;
  setOnly(authorId: string | null): void;
  /** Reading the draft as it will be read outside the room: no colour at all. */
  cleanReading: boolean;
  setCleanReading(on: boolean): void;
  /** Whether this window draws attribution at all (§6.3). */
  signed: boolean;
  /** What goes in the corner of a printed page, where this draft is signed. */
  stamp: PageStamp | null;
  /**
   * What the room has asked of whom (§8).
   *
   * **Read and drawn, never consulted before a write.** An assignment is not a
   * lock: it says who is expected to write something, and a room where two
   * writers took a run at the same scene is a room working properly.
   */
  assignments: readonly Assignment[];
}

const EMPTY: ReadonlyMap<string, Attribution> = new Map();

const NOBODY: RoomState = {
  identity: null,
  byAuthor: EMPTY,
  you: null,
  author: null,
  readOnly: false,
  only: null,
  setOnly: () => undefined,
  cleanReading: false,
  setCleanReading: () => undefined,
  signed: false,
  stamp: null,
  assignments: [],
};

const RoomContext = createContext<RoomState>(NOBODY);

export const useRoom = (): RoomState => useContext(RoomContext);

export const RoomProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [identity, setIdentity] = useState<RoomIdentity | null>(null);
  const [only, setOnly] = useState<string | null>(null);
  const [cleanReading, setCleanReading] = useState(false);

  useEffect(() => {
    let live = true;
    const ask = window.vcwriter?.roomIdentity;
    if (!ask) return undefined;

    void ask
      .call(window.vcwriter)
      .then((result) => {
        if (live && result.ok && result.data) setIdentity(result.data);
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, []);

  const byAuthor = useMemo(() => (identity ? attributionsOf(identity.seats) : EMPTY), [identity]);
  const attributionOf = (userId: string | null | undefined): Attribution | null =>
    userId ? (byAuthor.get(userId) ?? null) : null;
  const you = useMemo(() => attributionOf(identity?.you?.userId), [identity, byAuthor]);
  const author = useMemo(() => attributionOf(identity?.author?.userId), [identity, byAuthor]);

  // The master is clean and a contribution is signed (§6.3). Clean reading
  // takes the signature off a contribution; nothing puts one on the master.
  const signed = identity ? isSigned({ showing: identity.showing, cleanReading }) : false;

  const value = useMemo<RoomState>(
    () => ({
      identity,
      byAuthor,
      you,
      author,
      readOnly: identity?.readOnly ?? false,
      only: signed ? only : null,
      setOnly,
      cleanReading,
      setCleanReading,
      signed,
      stamp: signed ? stampFor(author) : null,
      assignments: identity?.assignments ?? [],
    }),
    [identity, byAuthor, you, author, only, cleanReading, signed],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
};

/**
 * The colour to mark a record with, or nothing.
 *
 * One function so that every badge in the application agrees on when a colour
 * is drawn: never in clean reading, never on the master, never for an author
 * this room does not know, and — when a contributor is being picked out —
 * never for anyone else.
 */
export const useMark = (): ((origin: { authorId: string } | null | undefined) => Attribution | null) => {
  const { byAuthor, signed, only } = useRoom();
  return useCallback(
    (origin) => {
      if (!signed || !origin) return null;
      if (only && origin.authorId !== only) return null;
      return byAuthor.get(origin.authorId) ?? null;
    },
    [byAuthor, signed, only],
  );
};

/**
 * What the room has asked of somebody, on this record (§8).
 *
 * The third angle on the same row: the writer's landing page says what they
 * are being asked for, the dashboard says who owes what, and this puts it
 * beside the scene — where a writer is actually standing when the question
 * *is anybody already doing this?* occurs to them.
 *
 * **It never refuses anything.** Nothing calls this before an edit, and nothing
 * should: an assignment is not a lock (§8), and seeing who is expected to write
 * a scene is the information that makes a lock unnecessary rather than a
 * softer version of one.
 */
export const useAsk = (): ((
  target: { kind: AssignmentTarget; id: string } | null | undefined,
) => { assignment: Assignment; who: Attribution | null } | null) => {
  const { assignments, byAuthor } = useRoom();
  return useCallback(
    (target) => {
      if (!target || assignments.length === 0) return null;
      // The one still owed, where there is one; otherwise the most recent
      // thing said about it, so a finished ask still reads rather than
      // vanishing the moment somebody marks it done.
      const on = assignmentsOn(assignments, target);
      const found = on.find((one) => one.state !== 'done') ?? on[0];
      if (!found) return null;
      return { assignment: found, who: byAuthor.get(found.assigneeId) ?? null };
    },
    [assignments, byAuthor],
  );
};
