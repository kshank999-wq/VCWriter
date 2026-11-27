// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { ReadAloud } from '../read-aloud';

/**
 * A book's Read back (from Ken, 27 November, on 1.0.62: *the readback function
 * doesn't do anything*). Read back switches to the page and asks it to read;
 * the ask must survive arriving before the voices' status, and must fetch the
 * voices when they are not there rather than do nothing.
 */
afterEach(() => {
  cleanup();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
  vi.unstubAllGlobals();
});

class InstantAudio {
  currentTime = 0;
  state = 'running';
  destination = {};
  resume = async () => undefined;
  createBuffer(_channels: number, length: number, rate: number) {
    return { duration: length / rate, copyToChannel: () => undefined };
  }
  createBufferSource() {
    const source: { buffer: unknown; onended: (() => void) | null; connect(): void; start(): void; stop(): void } = {
      buffer: null,
      onended: null,
      connect: () => undefined,
      start: () => setTimeout(() => source.onended?.(), 0),
      stop: () => undefined,
    };
    return source;
  }
}

const bridge = (installed: boolean, statusDelay = 0) => {
  let have = installed;
  const speak = vi.fn(async () => ({ ok: true, data: { samples: new Float32Array(2400), sampleRate: 24000 } }));
  const install = vi.fn(async () => {
    have = true;
    return { ok: true, data: { installed: true, installing: false } };
  });
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    naturalVoices: {
      status: () =>
        new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: { installed: have, installing: false } }), statusDelay)),
      install,
      remove: async () => ({ ok: true, data: { installed: false, installing: false } }),
      speak,
    },
  };
  return { speak, install };
};

const lines = () => [{ id: 'a', type: 'prose', text: 'The first chapter begins.' }];
const scope = () => document.body;

describe('Read back on a book', () => {
  it('reads when asked before the voices have answered (arriving from another page)', async () => {
    vi.stubGlobal('AudioContext', InstantAudio);
    const { speak } = bridge(true, 30);
    render(<ReadAloud lines={lines} scope={scope} autoStart={1} />);
    await waitFor(() => expect(speak).toHaveBeenCalled());
    expect((speak.mock.calls[0] as unknown as [{ text: string }])[0].text).toBe('The first chapter begins.');
  });

  it('fetches the voices when asked without them, then reads', async () => {
    vi.stubGlobal('AudioContext', InstantAudio);
    const { speak, install } = bridge(false);
    render(<ReadAloud lines={lines} scope={scope} autoStart={1} />);
    await waitFor(() => expect(install).toHaveBeenCalledOnce());
    await waitFor(() => expect(speak).toHaveBeenCalled());
  });

  it('does nothing by itself when not asked', async () => {
    const { speak, install } = bridge(false);
    render(<ReadAloud lines={lines} scope={scope} autoStart={0} />);
    await screen.findByRole('button', { name: /get the voices/i });
    expect(install).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
});
