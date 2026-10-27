import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The boxes a writer dictates into with the keyboard's own microphone keep
 * their own text (addendum 27 §21, from Ken: *when I use the dictate on the
 * phone… and I speak in a title, then when I stop the dictation, it repeats
 * it*). iOS finishes a dictation by replacing what it wrote, and a box whose
 * `value` is handed back on every change gets the words twice.
 */
describe('boxes the keyboard dictates into', () => {
  it.each(['Capture.tsx', 'Review.tsx', 'Projects.tsx'])('in %s take a defaultValue, never a value', (name) => {
    const source = readFileSync(join(__dirname, '..', 'screens', name), 'utf8');
    const inputs = source.split(/<TextInput\s/).slice(1).map((one) => one.slice(0, one.indexOf('/>')));
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input).toMatch(/defaultValue=/);
      expect(input).not.toMatch(/\svalue=/);
    }
  });
});
