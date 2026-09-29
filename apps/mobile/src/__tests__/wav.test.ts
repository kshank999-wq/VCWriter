import { describe, expect, it } from 'vitest';

/**
 * The two tones (addendum 27 §5).
 *
 * Not much can go wrong with a beep, and exactly one thing can: a WAV whose
 * header disagrees with its own data plays as silence or as a click, and both
 * read to a writer on a walk as *the app did not hear me*. So what is pinned
 * is the header — the bytes a player reads before it decides whether to play
 * anything at all — and the shape of the sound, which is the whole of why
 * there are two: **told apart by direction rather than pitch**, because a walk
 * is not a quiet room.
 *
 * The module itself is not imported: it pulls in `expo-audio`, which is a
 * native module and has nothing to run against here. The generator is the part
 * that is arithmetic, so the arithmetic is what is tested.
 */

const RATE = 22_050;

/** The same generator `say.ts` holds, which is what this is about. */
function wave(from: number, to: number, seconds: number): Uint8Array {
  const frames = Math.floor(RATE * seconds);
  const bytes = new Uint8Array(44 + frames * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * 2, true);

  let phase = 0;
  for (let i = 0; i < frames; i += 1) {
    const through = i / frames;
    phase += (2 * Math.PI * (from + (to - from) * through)) / RATE;
    const fade = Math.min(1, through * 12, (1 - through) * 12);
    view.setInt16(44 + i * 2, Math.round(Math.sin(phase) * 0.28 * fade * 32_767), true);
  }
  return bytes;
}

const text = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.slice(at, at + length));

describe('the tones a walk is told apart by', () => {
  it('writes a header that agrees with its own data', () => {
    const bytes = wave(520, 760, 0.16);
    const view = new DataView(bytes.buffer);
    const frames = Math.floor(RATE * 0.16);

    expect(text(bytes, 0, 4)).toBe('RIFF');
    expect(text(bytes, 8, 8)).toBe('WAVEfmt ');
    expect(text(bytes, 36, 4)).toBe('data');
    // The two lengths a player reads. Either one wrong is silence.
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(view.getUint32(40, true)).toBe(bytes.length - 44);
    // Sixteen-bit mono at the rate the header claims.
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(RATE);
    expect(view.getUint16(34, true)).toBe(16);
    expect(bytes.length).toBe(44 + frames * 2);
  });

  it('starts and ends at silence, so neither tone clicks', () => {
    const bytes = wave(700, 440, 0.18);
    const view = new DataView(bytes.buffer);
    const last = bytes.length - 2;
    expect(Math.abs(view.getInt16(44, true))).toBeLessThan(400);
    expect(Math.abs(view.getInt16(last, true))).toBeLessThan(400);
  });

  it('rises to open and falls to close, which is what they are told apart by', () => {
    // Counted as zero crossings in the first tenth against the last: a rising
    // tone crosses more often at the end, a falling one at the start. Pitch
    // beside traffic is a coin toss; direction is not.
    const crossings = (bytes: Uint8Array, from: number, to: number) => {
      const view = new DataView(bytes.buffer);
      let count = 0;
      let was = view.getInt16(44 + from * 2, true);
      for (let i = from + 1; i < to; i += 1) {
        const now = view.getInt16(44 + i * 2, true);
        if ((was < 0 && now >= 0) || (was > 0 && now <= 0)) count += 1;
        was = now;
      }
      return count;
    };
    const span = Math.floor(RATE * 0.02);

    const open = wave(520, 760, 0.16);
    const openFrames = (open.length - 44) / 2;
    expect(crossings(open, openFrames - span - 1, openFrames - 1)).toBeGreaterThan(
      crossings(open, 0, span),
    );

    const close = wave(700, 440, 0.18);
    const closeFrames = (close.length - 44) / 2;
    expect(crossings(close, 0, span)).toBeGreaterThan(
      crossings(close, closeFrames - span - 1, closeFrames - 1),
    );
  });
});
