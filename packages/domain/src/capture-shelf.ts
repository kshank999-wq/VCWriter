import { z } from 'zod';

/**
 * Which projects are on the phone (addendum 09 §13, from Ken: *it shows you
 * the projects that are available and you can go ahead and check mark those…
 * you can also uncheck it which will hide it but does not delete it*).
 *
 * Three decisions carry it, and the first is the one everything else hangs
 * off.
 *
 * **Nothing here is a copy of anything.** The phone holds no project: the list
 * is read from the account every time it opens, and what a note carries is an
 * id. So there is no *sync* to perform and, more to the point, **nothing on
 * this side that a delete could reach** — which is what makes Ken's *it does
 * not delete it from your hard drive or anything from your main* true by
 * construction rather than by a warning. Taking a project off this phone is a
 * fact about this phone and about nothing else.
 *
 * **Only what is off is written down**, which is addendum 19 §9v's rule about
 * a contents page arriving at a project list: a writer whose phone lists their
 * work expects work started tomorrow to be on it, and a stored list of what is
 * *on* would silently leave out every project made after the day they chose.
 * A project named into the phone by voice (§11) is the sharpest case — it must
 * be there the moment it exists, and it is.
 *
 * **It is per device**, like the last-used project beside it and like every
 * other arrangement in the program. A phone and a tablet are two places
 * somebody stands, and one of them deciding for the other is the fault this
 * exists to fix rather than a convenience.
 */

/** What the phone knows about a project, which is its id and what it is called. */
export interface ShelvedProject {
  id: string;
  title: string;
}

export const phoneShelfSchema = z.object({
  /**
   * The ids taken off this phone. **What is off, never what is on** — see
   * above; the absence of a list of the kept ones is the load-bearing half.
   */
  off: z.array(z.string()).default([]),
});
export type PhoneShelf = z.infer<typeof phoneShelfSchema>;

export const emptyShelf = (): PhoneShelf => ({ off: [] });

/**
 * A shelf out of whatever the device had stored.
 *
 * A browser with nothing, a browser that refused, and a browser holding
 * something this build cannot read are **one answer**: everything is on the
 * phone. There is no state in which a writer opens the app and finds their
 * work missing because a preference did not parse.
 */
export const readShelf = (stored: string | null): PhoneShelf => {
  if (!stored) return emptyShelf();
  try {
    return phoneShelfSchema.parse(JSON.parse(stored));
  } catch {
    return emptyShelf();
  }
};

/** Whether a project shows on this phone. Absent from `off` means yes. */
export const onThisPhone = (shelf: PhoneShelf, projectId: string): boolean =>
  !shelf.off.includes(projectId);

/** The projects this phone shows, in the order they were given. */
export const shownOnPhone = <T extends ShelvedProject>(shelf: PhoneShelf, projects: T[]): T[] =>
  projects.filter((one) => onThisPhone(shelf, one.id));

/** Every project the account has, each saying whether it is on this phone. */
export const shelfRows = <T extends ShelvedProject>(
  shelf: PhoneShelf,
  projects: T[],
): Array<T & { on: boolean }> =>
  projects.map((one) => ({ ...one, on: onThisPhone(shelf, one.id) }));

/**
 * Put a project on this phone, or take it off.
 *
 * **The act is one and the tick says which way**, rather than a hide and a
 * show that could disagree about what a half-ticked row means.
 */
export const setOnPhone = (shelf: PhoneShelf, projectId: string, on: boolean): PhoneShelf =>
  on
    ? { off: shelf.off.filter((id) => id !== projectId) }
    : shelf.off.includes(projectId)
      ? shelf
      : { off: [...shelf.off, projectId] };

/** Everything back, which is the state a phone that has never been told starts in. */
export const everythingOnPhone = (): PhoneShelf => emptyShelf();

/**
 * What taking this one off would do, said before it is done.
 *
 * `trackRemoval`'s shape, and the sentence is the whole feature: a writer
 * unticking a project wants to know what they are about to lose, and the
 * answer is **nothing**. Saying so is not reassurance, it is the one fact they
 * cannot check from here.
 */
export const phoneShelfOffer = (
  shelf: PhoneShelf,
  project: ShelvedProject,
): { on: boolean; act: string; says: string } => {
  const on = onThisPhone(shelf, project.id);
  return on
    ? {
        on,
        act: `Take ${project.title || 'Untitled'} off this phone`,
        says: 'It stops showing here. Nothing is deleted — not on your desk, not in the cloud — and it comes back with one tick.',
      }
    : {
        on,
        act: `Put ${project.title || 'Untitled'} back on this phone`,
        says: 'It shows here again. Notes you already made in it were never touched.',
      };
};

/**
 * What the project list says about what it is not showing.
 *
 * **Absent where nothing is off**, the glossary letters' rule: a line reading
 * *0 projects are off this phone* is a fact about nothing, standing over a
 * list that is already complete. Null means say nothing.
 */
export const describeShelf = (shelf: PhoneShelf, projects: ShelvedProject[]): string | null => {
  const off = projects.filter((one) => !onThisPhone(shelf, one.id));
  if (off.length === 0) return null;
  if (off.length === 1) {
    const one = off[0] as ShelvedProject;
    return `${one.title || 'One project'} is off this phone.`;
  }
  return `${off.length} projects are off this phone.`;
};

/**
 * The one sentence the screen that manages this must carry.
 *
 * It lives here rather than in the component for addendum 24 §5c's reason:
 * five screens writing *it goes to the graveyard* for themselves were five
 * answers waiting to disagree, and this promise is worth more than that one.
 * **Both halves are facts about the mechanism**, which is why neither may be
 * written by a screen: the phone keeps no copy, and this choice reaches no
 * further than the device it is made on.
 */
export const describePhoneShelf = (): string =>
  'This only changes what this phone shows you. The projects themselves live on your desk and in your account — nothing here can delete one, and unticking every project would leave every word of them exactly where it is.';
