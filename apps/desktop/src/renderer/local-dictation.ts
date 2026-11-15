import { SPEECH_MODEL, createSpeechSegmenter } from '@vcwriter/domain';
import { startDictation } from './dictation';

/**
 * **Dictate: click, speak, and it types** (from Ken, 15 November: *select a
 * box, either the audio or the visual, click dictate, and it will type what
 * you're saying… You shouldn't have to say visual, audio, next*).
 *
 * In the desktop app the listening is done here, on the computer: the
 * microphone's sound is cut at the pauses (`createSpeechSegmenter`) and each
 * stretch is turned into words by the speech model in the main process
 * (`main/speech.ts`), fetched once on first use. No Fn key, no system
 * dictation, no spoken commands, and the voice never leaves the machine.
 *
 * The browser preview has no such model, so there it is Chrome's own speech
 * recognition, which works in Chrome.
 */

type Result<T> = { ok: boolean; data?: T; error?: string };

interface SpeechBridge {
  status(): Promise<Result<{ installed: boolean; installing: boolean }>>;
  install(onProgress: (progress: { fraction: number; file: string }) => void): Promise<Result<{ installed: boolean; installing: boolean }>>;
  microphone(): Promise<Result<boolean>>;
  transcribe(samples: Float32Array, fresh?: boolean): Promise<Result<string>>;
}

export const speechBridge = (): SpeechBridge | undefined =>
  (window as unknown as { vcwriter?: { speech?: SpeechBridge } }).vcwriter?.speech;

export type ListeningState =
  /** Fetching the speech model, the first time only: 0–1. */
  | { kind: 'getting-ready'; fraction: number }
  | { kind: 'listening'; heard?: string }
  /** Speech heard, being turned into words. */
  | { kind: 'writing' };

export interface ListeningHandlers {
  /** Words heard, ready to add to the box. */
  onText(text: string): void;
  onState(state: ListeningState): void;
  onError(message: string): void;
  /** Listening has stopped, by Stop or by a failure. */
  onEnd(): void;
}

export interface Listening {
  stop(): void;
}

const microphoneMessage = (error: unknown): string => {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return /mac/i.test(navigator.userAgent)
      ? 'VC Writer may not use the microphone. Allow it in System Settings › Privacy & Security › Microphone, then press Dictate again.'
      : 'VC Writer may not use the microphone. Allow it in your privacy settings, then press Dictate again.';
  }
  if (name === 'NotFoundError') return 'No microphone was found. Plug one in and press Dictate again.';
  return `The microphone could not be opened${error instanceof Error && error.message ? `: ${error.message}` : '.'}`;
};

/** Listening on this computer, through the speech model. */
const listenHere = async (bridge: SpeechBridge, handlers: ListeningHandlers, stopped: () => boolean): Promise<Listening | null> => {
  const status = await bridge.status();
  if (!status.ok || !status.data?.installed) {
    handlers.onState({ kind: 'getting-ready', fraction: 0 });
    const installed = await bridge.install((progress) => handlers.onState({ kind: 'getting-ready', fraction: progress.fraction }));
    if (!installed.ok || !installed.data?.installed) {
      handlers.onError(`Dictation could not be set up: ${installed.error ?? 'the download did not finish'}. Check the internet connection and press Dictate again.`);
      return null;
    }
  }
  if (stopped()) return null;

  await bridge.microphone();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (error) {
    handlers.onError(microphoneMessage(error));
    return null;
  }
  if (stopped()) {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }

  // Chromium resamples the microphone to the rate asked for, so what arrives
  // is already what the model hears.
  const context = new AudioContext({ sampleRate: SPEECH_MODEL.sampleRate });
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const segmenter = createSpeechSegmenter({ sampleRate: context.sampleRate });
  const silent = context.createGain();
  silent.gain.value = 0;

  let queue: Promise<void> = Promise.resolve();
  let inFlight = 0;
  let ended = false;
  let first = true;
  const hear = (samples: Float32Array) => {
    const fresh = first;
    first = false;
    inFlight += 1;
    handlers.onState({ kind: 'writing' });
    queue = queue.then(async () => {
      const heard = await bridge.transcribe(samples, fresh);
      inFlight -= 1;
      if (heard.ok && heard.data) handlers.onText(heard.data);
      else if (!heard.ok) handlers.onError(`That could not be heard: ${heard.error ?? 'unknown error'}`);
      if (!ended) handlers.onState({ kind: inFlight > 0 ? 'writing' : 'listening' });
      else if (inFlight === 0) handlers.onEnd();
    });
  };

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    for (const stretch of segmenter.push(new Float32Array(input))) hear(stretch);
  };
  source.connect(processor);
  processor.connect(silent);
  silent.connect(context.destination);
  handlers.onState({ kind: 'listening' });

  return {
    stop() {
      if (ended) return;
      ended = true;
      processor.onaudioprocess = null;
      source.disconnect();
      processor.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close();
      // What was said just before Stop is still written.
      const last = segmenter.flush();
      if (last) hear(last);
      else if (inFlight === 0) handlers.onEnd();
    },
  };
};

/**
 * Start listening. Returns at once; what happens is reported through the
 * handlers. The returned `stop` may be called at any point, even while the
 * model is still being fetched.
 */
export const startListening = (handlers: ListeningHandlers): Listening => {
  const bridge = speechBridge();
  if (!bridge) {
    // The browser preview: Chrome's own recogniser.
    const session = startDictation({
      onFinal: (text) => handlers.onText(text),
      // What Chrome is hearing, before it commits: shown, so the writer can see it working.
      onInterim: (heard) => handlers.onState({ kind: 'listening', heard }),
      onError: handlers.onError,
      onEnd: handlers.onEnd,
    });
    if (!session) {
      handlers.onError(
        'This browser has no speech recognition, or it could not be reached. Use Chrome, or the VC Writer desktop app, which listens on the computer itself.',
      );
      handlers.onEnd();
      return { stop: () => undefined };
    }
    handlers.onState({ kind: 'listening' });
    return session;
  }

  let stopped = false;
  let live: Listening | null = null;
  void listenHere(bridge, handlers, () => stopped)
    .then((listening) => {
      live = listening;
      if (!listening) handlers.onEnd();
      else if (stopped) listening.stop();
    })
    .catch((error: unknown) => {
      handlers.onError(error instanceof Error ? error.message : String(error));
      handlers.onEnd();
    });
  return {
    stop() {
      stopped = true;
      live?.stop();
      // Stopped before the microphone opened: nothing more will come.
      if (!live) handlers.onEnd();
    },
  };
};
