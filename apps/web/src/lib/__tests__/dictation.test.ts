import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startDictation } from '../dictation';

/**
 * Continuous listening (addendum 09 §5, §6).
 *
 * **`continuous` is a request, not a promise.** iOS Safari ends a recognition
 * session after each utterance whatever the flag says, which turns *tap once
 * and talk* into *tap after every sentence* — on the platform the phone app is
 * most likely to be opened on. The restart in `startDictation` is what makes
 * the promise true, and these hold both halves of it: that it restarts, and
 * that it knows when to stop.
 */

/** A recogniser that ends after every utterance, the way Safari's does. */
class OneShotRecognition {
  static made: OneShotRecognition[] = [];

  lang = '';
  continuous = false;
  interimResults = false;
  starts = 0;

  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    OneShotRecognition.made.push(this);
  }

  start(): void {
    this.starts += 1;
  }

  stop(): void {
    this.onend?.();
  }

  /** One final result, and then the session ends on its own. */
  say(text: string): void {
    const result = Object.assign([{ transcript: text }], { isFinal: true });
    this.onresult?.({ resultIndex: 0, results: [result] });
    this.onend?.();
  }

  /** Ended having heard nothing, which is what a taken microphone looks like. */
  endEmpty(): void {
    this.onend?.();
  }
}

const handlers = () => ({
  onFinal: vi.fn(),
  onInterim: vi.fn(),
  onError: vi.fn(),
  onEnd: vi.fn(),
});

const only = () => OneShotRecognition.made[0] as OneShotRecognition;

beforeEach(() => {
  OneShotRecognition.made = [];
  vi.stubGlobal('window', { webkitSpeechRecognition: OneShotRecognition });
  vi.stubGlobal('navigator', { language: 'en-GB' });
});

describe('a dictation session nobody stopped', () => {
  it('starts itself again when the recogniser ends after an utterance', () => {
    const on = handlers();
    startDictation(on);

    only().say('She never lets anyone else drive.');

    expect(on.onFinal).toHaveBeenCalledWith('She never lets anyone else drive.');
    // The point: still listening, so the writer does not tap between sentences.
    expect(on.onEnd).not.toHaveBeenCalled();
    expect(only().starts).toBe(2);
  });

  it('keeps going across several utterances', () => {
    const on = handlers();
    startDictation(on);

    only().say('Character, Mara — she never lets anyone else drive.');
    only().say('Correction. She never lets anyone drive her car.');
    only().say('Idea. The audit lands the same week.');

    expect(on.onFinal).toHaveBeenCalledTimes(3);
    expect(on.onEnd).not.toHaveBeenCalled();
  });

  it('does not treat a long silence as an error', () => {
    // A writer thinking is the normal case, and a recogniser reports it as
    // no-speech. Saying so would be a lie about what happened.
    const on = handlers();
    startDictation(on);

    only().onerror?.({ error: 'no-speech' });
    only().endEmpty();

    expect(on.onError).not.toHaveBeenCalled();
    expect(on.onEnd).not.toHaveBeenCalled();
  });
});

describe('when it should stop', () => {
  it('stops when the writer taps the button', () => {
    const on = handlers();
    const session = startDictation(on);

    session?.stop();

    expect(on.onEnd).toHaveBeenCalledTimes(1);
    // And does not quietly start itself up again after being told to stop.
    expect(only().starts).toBe(1);
  });

  it('gives up rather than restarting for ever when it hears nothing', () => {
    // A microphone another app has taken ends the session immediately every
    // time. Restarting for ever would leave the button lit, which looks
    // exactly like listening and is not.
    const on = handlers();
    startDictation(on);

    for (let attempt = 0; attempt < 10; attempt += 1) only().endEmpty();

    expect(on.onEnd).toHaveBeenCalled();
    expect(only().starts).toBeLessThanOrEqual(5);
  });

  it('counts fruitless restarts in a row, not in total', () => {
    // Somebody dictating for an hour with pauses in it must not be cut off
    // because three of those pauses were long.
    const on = handlers();
    startDictation(on);

    only().endEmpty();
    only().endEmpty();
    only().say('She never lets anyone else drive.');
    only().endEmpty();
    only().endEmpty();

    expect(on.onEnd).not.toHaveBeenCalled();
  });

  it('ends on a refused microphone rather than asking again', () => {
    const on = handlers();
    startDictation(on);

    only().onerror?.({ error: 'not-allowed' });
    only().endEmpty();

    expect(on.onError).toHaveBeenCalledWith(expect.stringContaining('denied'));
    expect(on.onEnd).toHaveBeenCalled();
  });
});
