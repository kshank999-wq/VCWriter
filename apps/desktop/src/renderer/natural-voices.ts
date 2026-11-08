import { useCallback, useEffect, useState } from 'react';

/**
 * Natural voices in the renderer (addendum 45): whether they are installed,
 * installing them with progress, and playing what the main process
 * generates. The bridge is absent in the browser preview, where read-back
 * keeps to the browser's own voices.
 */
interface Clip {
  samples: Float32Array;
  sampleRate: number;
}

interface NaturalBridge {
  status(): Promise<{ ok: boolean; data?: { installed: boolean; installing: boolean }; error?: string }>;
  install(onProgress: (progress: { fraction: number; file: string }) => void): Promise<{
    ok: boolean;
    data?: { installed: boolean; installing: boolean };
    error?: string;
  }>;
  remove(): Promise<{ ok: boolean; data?: { installed: boolean; installing: boolean }; error?: string }>;
  speak(input: { text: string; voice: string; speed: number }): Promise<{ ok: boolean; data?: Clip; error?: string }>;
}

export const naturalBridge = (): NaturalBridge | undefined =>
  (window as unknown as { vcwriter?: { naturalVoices?: NaturalBridge } }).vcwriter?.naturalVoices;

export interface NaturalVoicesState {
  /** This build can run natural voices at all (the desktop app, not the preview). */
  available: boolean;
  installed: boolean;
  /** 0–1 while downloading, null otherwise. */
  progress: number | null;
  error: string | null;
  install(): Promise<void>;
  remove(): Promise<void>;
}

export function useNaturalVoices(): NaturalVoicesState {
  const bridge = naturalBridge();
  const [installed, setInstalled] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void bridge?.status().then((result) => {
      if (live && result.ok && result.data) setInstalled(result.data.installed);
    });
    return () => {
      live = false;
    };
  }, [bridge]);

  const install = useCallback(async () => {
    if (!bridge) return;
    setError(null);
    setProgress(0);
    const result = await bridge.install((step) => setProgress(step.fraction));
    setProgress(null);
    if (result.ok && result.data) setInstalled(result.data.installed);
    else setError(result.error ?? 'The voices could not be downloaded.');
  }, [bridge]);

  const remove = useCallback(async () => {
    if (!bridge) return;
    const result = await bridge.remove();
    if (result.ok && result.data) setInstalled(result.data.installed);
  }, [bridge]);

  return { available: Boolean(bridge), installed, progress, error, install, remove };
}

/**
 * Plays natural-voice lines one after another. Lines are generated ahead —
 * `prepare` the next while this one plays — so a scene reads without a pause
 * between speakers once it has started.
 */
export class NaturalPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private clips = new Map<string, Promise<Clip>>();
  private stopped = false;

  private key(text: string, voice: string, speed: number): string {
    return `${voice}|${speed.toFixed(2)}|${text}`;
  }

  /** Start generating a line, if it is not already on its way. */
  prepare(text: string, voice: string, speed: number): Promise<Clip> {
    const key = this.key(text, voice, speed);
    let clip = this.clips.get(key);
    if (!clip) {
      const bridge = naturalBridge();
      clip = bridge
        ? bridge.speak({ text, voice, speed }).then((result) => {
            if (!result.ok || !result.data) throw new Error(result.error ?? 'The voice could not be generated');
            return result.data;
          })
        : Promise.reject(new Error('Natural voices are not available here'));
      // A failed line is tried again next time rather than remembered as failed.
      clip.catch(() => this.clips.delete(key));
      this.clips.set(key, clip);
      // Keep the last few dozen lines: enough to replay a scene, not a whole book.
      if (this.clips.size > 40) this.clips.delete(this.clips.keys().next().value as string);
    }
    return clip;
  }

  /**
   * Speak one line. `onProgress` hears how far through it is (0–1) about
   * twenty times a second, for the word highlight.
   */
  async play(text: string, voice: string, speed: number, onProgress?: (fraction: number) => void): Promise<void> {
    this.stopped = false;
    const clip = await this.prepare(text, voice, speed);
    if (this.stopped) return;
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    const buffer = this.context.createBuffer(1, clip.samples.length, clip.sampleRate);
    buffer.copyToChannel(new Float32Array(clip.samples), 0);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.source = source;
    const started = this.context.currentTime;
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        if (!this.context) return;
        onProgress?.(Math.min((this.context.currentTime - started) / buffer.duration, 1));
      }, 50);
      source.onended = () => {
        window.clearInterval(timer);
        resolve();
      };
      source.start();
    });
    if (this.source === source) this.source = null;
  }

  stop(): void {
    this.stopped = true;
    try {
      this.source?.stop();
    } catch {
      // Already finished.
    }
    this.source = null;
  }
}
