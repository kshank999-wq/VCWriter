// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createProjectFile, updateBeat, type ProjectFile } from '@vcwriter/domain';
import { ReadBackPanel } from '../components/ReadBackPanel';

/**
 * Natural voices in read-back (addendum 45): offered for download where the
 * desktop app can run them, listed first once installed, and used to read —
 * George narrating by default. The computer's own voices are not used (§8).
 */
afterEach(() => {
  cleanup();
  delete (window as unknown as { vcwriter?: unknown }).vcwriter;
  vi.unstubAllGlobals();
});

const scene = (): ProjectFile => {
  const file = createProjectFile({ title: 'Night', format: 'screenplay' });
  return updateBeat(file, file.beats[0]!.id, {
    status: 'written',
    manuscript: {
      elements: [
        { id: 'e1111111-1111-4111-8111-111111111111' as never, type: 'action', text: 'Barbra runs.', characterId: null, attributes: {} },
      ],
    },
  });
};

/** An AudioContext that plays every buffer instantly. */
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

const bridge = (installed: boolean) => {
  const speak = vi.fn(async () => ({ ok: true, data: { samples: new Float32Array(2400), sampleRate: 24000 } }));
  const install = vi.fn(async (onProgress: (p: { fraction: number; file: string }) => void) => {
    onProgress({ fraction: 0.5, file: 'onnx/model_quantized.onnx' });
    return { ok: true, data: { installed: true, installing: false } };
  });
  (window as unknown as { vcwriter: unknown }).vcwriter = {
    naturalVoices: {
      status: async () => ({ ok: true, data: { installed, installing: false } }),
      install,
      remove: async () => ({ ok: true, data: { installed: false, installing: false } }),
      speak,
    },
  };
  return { speak, install };
};

describe('natural voices in read-back', () => {
  it('offers the download, and lists the natural voices once it is done', async () => {
    const { install } = bridge(false);
    render(<ReadBackPanel file={scene()} currentUnitId={null} onUpdate={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Get natural voices' }));
    await screen.findByText('Natural voices are installed.');
    expect(install).toHaveBeenCalledOnce();
    const narrator = screen.getByLabelText('Narrator voice') as HTMLSelectElement;
    expect(narrator.options[0]!.textContent).toBe('Default voice — George (natural)');
  });

  it('reads the scene in George by default', async () => {
    vi.stubGlobal('AudioContext', InstantAudio);
    const { speak } = bridge(true);
    const file = scene();
    render(<ReadBackPanel file={file} currentUnitId={file.units[0]!.id} onUpdate={() => undefined} />);
    await screen.findByText('Natural voices are installed.');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Barbra runs.', voice: 'bm_george', speed: 1 }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('says where natural voices are to be had where the build cannot run them, and cannot play', () => {
    render(<ReadBackPanel file={scene()} currentUnitId={null} onUpdate={() => undefined} />);
    expect(screen.getByText(/run in the desktop app/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Get natural voices' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Play' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('never lists the computer’s own voices, and reads an old choice of one in George', async () => {
    vi.stubGlobal('AudioContext', InstantAudio);
    const { speak } = bridge(true);
    const base = scene();
    const file = { ...base, settings: { ...base.settings, narratorVoice: { providerId: 'system', voiceId: 'google-us', displayName: 'Google US English', accent: null, rate: 1, pitch: 0 } } };
    render(<ReadBackPanel file={file} currentUnitId={file.units[0]!.id} onUpdate={() => undefined} />);
    await screen.findByText('Natural voices are installed.');
    const names = [...(screen.getByLabelText('Narrator voice') as HTMLSelectElement).options].map((one) => one.textContent ?? '');
    expect(names.some((name) => name.includes('Google'))).toBe(false);
    expect(names.some((name) => name.includes('Heart (natural)'))).toBe(true);
    expect(screen.queryByLabelText(/Also list this computer/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await waitFor(() => expect(speak).toHaveBeenCalledWith({ text: 'Barbra runs.', voice: 'bm_george', speed: 1 }));
  });
});
