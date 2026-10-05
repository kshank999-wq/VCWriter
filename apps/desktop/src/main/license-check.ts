import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { licenseStatusSchema, noteStanding, type DeskStanding } from '@vcwriter/domain';
import { accessToken, isCloudConfigured, SITE_URL } from './cloud';

/**
 * What this machine last heard about its licence (addendum 32 §8).
 *
 * The desktop has never held a licence standing: it activates once and every
 * feature that reaches vc-writer.com asks the server per call, which is why
 * addendum 32 §4 could say a lapse touched nothing local. Read-only needs the
 * opposite — an answer in hand, so a machine that cannot ask does not refuse
 * somebody their own manuscript — so the server's answer is written down with
 * the day it was given and the renderer reads it with the domain.
 *
 * **It is a file and not a credential.** Nothing here is secret and nothing
 * here is proof of anything: it is the day the server last said yes or no,
 * which is why it goes in plain JSON beside `recent-projects.json` rather than
 * through the keychain `session.bin` needs. Somebody who edits it has defeated
 * a subscription on their own computer, which is true of any desktop program
 * and is not what this feature is for.
 */

const standingPath = () => join(app.getPath('userData'), 'license-standing.json');

/** How often the machine asks, while it is open. */
const ASK_EVERY_MS = 6 * 60 * 60 * 1000;

const held = async (): Promise<DeskStanding | null> => {
  try {
    const raw = await readFile(standingPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<DeskStanding>;
    const status = licenseStatusSchema.safeParse(parsed.status);
    if (!status.success || typeof parsed.checkedAt !== 'string') return null;
    return {
      status: status.data,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
      checkedAt: parsed.checkedAt,
      seenLapsedAt: typeof parsed.seenLapsedAt === 'string' ? parsed.seenLapsedAt : null,
    };
  } catch {
    // Absent, unreadable or nonsense all mean the same thing: this machine has
    // heard nothing, which is the writable state (§8).
    return null;
  }
};

const keep = async (next: DeskStanding): Promise<void> => {
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(standingPath(), JSON.stringify(next), 'utf8');
};

/**
 * Ask vc-writer.com, and write down what it said.
 *
 * **A failure to reach the server changes nothing at all.** Every way this can
 * go wrong — no cloud in this build, signed out, offline, a 500, a body that
 * will not parse, a status this build cannot name — returns null and leaves the
 * record exactly as it was, because none of them is evidence that anybody has
 * stopped paying. That is the whole reason read-only is read from a record
 * rather than from the answer in front of you.
 *
 * An account with **no licence** is the one case that clears the record: there
 * is nothing to lapse, and a copy that was never activated has always been able
 * to write (§8's *read-only is a lapse, never an absence*).
 */
const ask = async (previous: DeskStanding | null): Promise<DeskStanding | null> => {
  if (!isCloudConfigured()) return null;
  try {
    const token = await accessToken();
    const response = await fetch(`${SITE_URL}/api/licenses/standing`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as
      | { standing?: { status?: unknown; expiresAt?: unknown } | null }
      | null;
    if (!payload || !('standing' in payload)) return null;

    if (!payload.standing) {
      await rm(standingPath(), { force: true }).catch(() => undefined);
      return null;
    }

    const status = licenseStatusSchema.safeParse(payload.standing.status);
    if (!status.success) return null;

    const next = noteStanding(
      previous,
      {
        status: status.data,
        expiresAt: typeof payload.standing.expiresAt === 'string' ? payload.standing.expiresAt : null,
      },
      new Date(),
    );
    await keep(next);
    return next;
  } catch {
    return null;
  }
};

/**
 * The standing, and a check where one is due.
 *
 * It answers with what is **held** rather than waiting on the network, so
 * opening a project never blocks on vc-writer.com; a due check runs behind the
 * answer and the next ask picks it up. `recheck` is the button's — somebody who
 * has just renewed is owed an answer now rather than in six hours — and is the
 * one path that waits.
 */
export const licenseStanding = async (recheck = false): Promise<DeskStanding | null> => {
  const previous = await held();
  if (recheck) return (await ask(previous)) ?? previous;

  const due = !previous || Date.now() - new Date(previous.checkedAt).getTime() > ASK_EVERY_MS;
  if (due) void ask(previous);
  return previous;
};
