/**
 * Whether this account has a password, and what the account page says about it
 * (addendum 09 §14c).
 *
 * From Ken: *once you get your email login, that you set a password, and that
 * it says password set in your account settings… especially for doing teams in
 * writer's room, so you can log into your account with your credentials.*
 *
 * **§14 said this could not be known and was right about the evidence it
 * looked at.** Its conclusion — one heading reading `Password` for everybody —
 * came from `auth.users` carrying no honest signal, and that is true and is in
 * fact worse than it claimed: Supabase writes a bcrypt hash at **signup**, so
 * every account has one whether or not anybody ever chose it (measured: 295 of
 * 295 accounts, one of which has ever signed in). A page that read that column
 * would not have been a feature, it would have been a lie told to everybody.
 *
 * What was missing is not a column in somebody else's table but **the
 * program's record of its own act**. Setting a password is something a writer
 * did, not something derivable from the work — which is exactly what earns a
 * stored field here (addendum 08's `retired`, addendum 24's `deletedAt`),
 * against the twenty-odd facts this project refuses to store because they can
 * be read. Migration 0065 writes it from a trigger on the row the password
 * lives in, so no screen can forget and no client can claim one.
 *
 * **The one rule in this file is that no record is not proof of no password.**
 * The stamp began the day it shipped, so somebody who set theirs before that
 * has one and is not recorded, and the wording says *no record* rather than
 * *you have none* — a page that told a writer they had no password while their
 * password worked would be the one failure that makes them distrust the rest.
 */

/** What the account knows about a password. Never more than it knows. */
export type PasswordStanding = 'set' | 'unrecorded';

/**
 * Read off the stamp alone.
 *
 * There is deliberately no third state for *definitely none*: nothing can tell
 * a writer who never set one from a writer who set one before this was
 * recorded, and inventing the difference is how the page starts lying.
 */
export const passwordStanding = (passwordSetAt: string | null | undefined): PasswordStanding =>
  passwordSetAt ? 'set' : 'unrecorded';

/** The label, in one place, so the account page and anything after it agree. */
export const PASSWORD_STANDING_WORDS: Record<PasswordStanding, string> = {
  set: 'Password set',
  unrecorded: 'No password set',
};

/**
 * What the line under the label says.
 *
 * The `set` sentence names **where it works**, which is the point of having
 * one: a collaborator in a Writers Room signs in on whatever machine the work
 * is on, and an emailed link only ever works in the browser that asked for it.
 *
 * The `unrecorded` sentence carries the caveat rather than hiding it, and
 * **offers rather than warns** — somebody signing in by link is not doing
 * anything wrong, they simply cannot do it from a phone.
 */
export const describePasswordStanding = (standing: PasswordStanding): string =>
  standing === 'set'
    ? 'You can sign in with your email and password on any device — this site, the Writers Room and Notes on your phone.'
    : 'You sign in with an emailed link. Set a password to sign in with your email and password anywhere, which is what a phone and a shared Writers Room need. If you set one before we began recording this, it still works — save it again here and the date will show.';
