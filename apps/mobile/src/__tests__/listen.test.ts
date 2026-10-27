import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Stopping dictation keeps the last words (from Ken: *I did a scene, but when
 * I went to save it, it wouldn't save it. And when I went to read it back, it
 * wouldn't read it back*).
 *
 * An iPhone holds a continuous sitting's words as provisional until it is told
 * to stop, and sends the final transcript after. These stand in for the
 * recogniser with a fake that does exactly that, and pin that a stop waits
 * for those words and commits them.
 */

type Listener = (event: Record<string, unknown>) => void;
const listeners = new Map<string, Set<Listener>>();
const emit = (name: string, event: Record<string, unknown> = {}) => {
  for (const one of listeners.get(name) ?? []) one(event);
};
let onStop: () => void = () => undefined;
const categories: unknown[] = [];

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    addListener: (name: string, listener: Listener) => {
      const set = listeners.get(name) ?? new Set();
      set.add(listener);
      listeners.set(name, set);
      return { remove: () => set.delete(listener) };
    },
    start: vi.fn(),
    stop: () => onStop(),
    setCategoryIOS: (options: unknown) => categories.push(options),
  },
}));

const { readyToSpeak, startDictation } = await import('../host/listen');

const handlers = () => {
  const got = { finals: [] as string[], interims: [] as string[], ended: 0 };
  return {
    got,
    handlers: {
      onFinal: (text: string) => got.finals.push(text),
      onInterim: (text: string) => got.interims.push(text),
      onError: () => undefined,
      onEnd: () => {
        got.ended += 1;
      },
    },
  };
};

beforeEach(() => {
  listeners.clear();
  categories.length = 0;
  onStop = () => undefined;
});

describe('stopping dictation', () => {
  it('waits for the final words the phone sends after the stop', async () => {
    const { got, handlers: h } = handlers();
    const session = startDictation(h);
    emit('result', { isFinal: false, results: [{ transcript: 'INT. KITCHEN' }] });
    emit('result', { isFinal: false, results: [{ transcript: 'INT. KITCHEN - NIGHT. Mara waits.' }] });
    // As iOS does: the final transcript, then the end, after the stop.
    onStop = () => {
      setTimeout(() => {
        emit('result', { isFinal: true, results: [{ transcript: 'INT. KITCHEN - NIGHT. Mara waits.' }] });
        emit('end');
      }, 50);
    };
    await session.stop();
    expect(got.finals).toEqual(['INT. KITCHEN - NIGHT. Mara waits.']);
    expect(got.ended).toBe(1);
  });

  it('commits what was still provisional when the phone sends nothing more', async () => {
    const { got, handlers: h } = handlers();
    const session = startDictation(h);
    emit('result', { isFinal: false, results: [{ transcript: 'He jumps off the bridge.' }] });
    onStop = () => setTimeout(() => emit('end'), 20);
    await session.stop();
    expect(got.finals).toEqual(['He jumps off the bridge.']);
  });

  it('does not wait forever for a recogniser that never ends', async () => {
    vi.useFakeTimers();
    const { got, handlers: h } = handlers();
    const session = startDictation(h);
    emit('result', { isFinal: false, results: [{ transcript: 'Last words.' }] });
    const stopped = session.stop();
    await vi.advanceTimersByTimeAsync(1600);
    await stopped;
    expect(got.finals).toEqual(['Last words.']);
    vi.useRealTimers();
  });

  it('does not commit the same words twice', async () => {
    const { got, handlers: h } = handlers();
    const session = startDictation(h);
    emit('result', { isFinal: true, results: [{ transcript: 'Already final.' }] });
    onStop = () => setTimeout(() => emit('end'), 10);
    await Promise.all([session.stop(), session.stop()]);
    expect(got.finals).toEqual(['Already final.']);
    expect(got.ended).toBe(1);
  });
});

describe('reading back', () => {
  it('moves the phone from recording to playback first', () => {
    readyToSpeak();
    expect(categories).toEqual([{ category: 'playback', categoryOptions: ['duckOthers'], mode: 'spokenAudio' }]);
  });
});
