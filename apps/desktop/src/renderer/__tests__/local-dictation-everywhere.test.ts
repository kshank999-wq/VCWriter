// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dictationKind, startDictation } from '../dictation';

/**
 * Every Dictate in the desktop app goes to the computer's own listening
 * (from Ken, 15 November: the writing screen's Dictate told him to press Fn,
 * which opens the emoji picker on his Mac).
 */

afterEach(() => {
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
});

describe('Dictate in the desktop app', () => {
  it('is offered, and listens through the speech model rather than the system’s Fn key', async () => {
    const transcribe = vi.fn();
    (window as unknown as { vcwriter: unknown }).vcwriter = {
      speech: {
        status: async () => ({ ok: true, data: { installed: true, installing: false } }),
        install: async () => ({ ok: true, data: { installed: true, installing: false } }),
        microphone: async () => ({ ok: true, data: true }),
        transcribe,
      },
    };
    expect(dictationKind()).toBe('offer');

    const errors: string[] = [];
    const ended = new Promise<void>((resolve) => {
      const session = startDictation({
        onFinal: () => undefined,
        onInterim: () => undefined,
        onError: (message) => errors.push(message),
        onEnd: resolve,
      });
      expect(session).not.toBeNull();
    });
    await ended;
    // There is no microphone here, and it says so in words rather than naming a key.
    expect(errors.join(' ')).toMatch(/microphone/i);
    expect(errors.join(' ')).not.toMatch(/Fn/);
  });
});
