import { randomBytes } from 'node:crypto';

/**
 * License serials.
 *
 * Format: `VCW-XXXXX-XXXXX-XXXXX-XXXXX` using an unambiguous alphabet (no
 * I/O/0/1) so a customer can read one over the phone to support without
 * transcription errors. The serial identifies a license row; it is not a
 * secret and carries no entitlement of its own — activation always checks the
 * database (spec §3.3).
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUPS = 4;
const GROUP_LENGTH = 5;

export const generateSerial = (): string => {
  const bytes = randomBytes(GROUPS * GROUP_LENGTH);
  const characters = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]);
  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group += 1) {
    groups.push(characters.slice(group * GROUP_LENGTH, (group + 1) * GROUP_LENGTH).join(''));
  }
  return `VCW-${groups.join('-')}`;
};

const SERIAL_PATTERN = /^VCW(-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}){4}$/;

export const isWellFormedSerial = (serial: string): boolean => SERIAL_PATTERN.test(serial.trim().toUpperCase());
