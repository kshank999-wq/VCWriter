import { app } from 'electron';
import { createHash, randomBytes } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Identifying this installation for licensing (spec §3.3).
 *
 * A licence seat is a place VC Writer is installed, not a piece of hardware, so
 * the fingerprint identifies *this installation*: a random salt generated on
 * first run, kept in the app's own data directory, hashed with the machine's
 * name. It is stable across restarts and reinstalls that keep app data, and it
 * is meaningless outside this application — there is deliberately no hardware
 * serial or MAC address in it, because a licence check is not a reason to build
 * a device identifier that could follow someone elsewhere.
 */

const saltPath = () => join(app.getPath('userData'), 'device-salt');

const readOrCreateSalt = async (): Promise<string> => {
  try {
    const existing = (await readFile(saltPath(), 'utf8')).trim();
    if (existing.length >= 32) return existing;
  } catch {
    // First run on this installation.
  }

  const salt = randomBytes(32).toString('hex');
  await mkdir(app.getPath('userData'), { recursive: true });
  await writeFile(saltPath(), salt, 'utf8');
  return salt;
};

let cached: string | null = null;

export const deviceFingerprint = async (): Promise<string> => {
  if (cached) return cached;
  const salt = await readOrCreateSalt();
  cached = createHash('sha256').update(`${salt}:${hostname()}`).digest('hex');
  return cached;
};

/** A name the owner will recognise in a list of their own devices. */
export const deviceName = (): string => {
  const machine = hostname().replace(/\.local$/i, '');
  try {
    const user = userInfo().username;
    return user && !machine.toLowerCase().includes(user.toLowerCase()) ? `${machine} (${user})` : machine;
  } catch {
    return machine;
  }
};

export const devicePlatform = (): 'windows' | 'macos' | null =>
  process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : null;
