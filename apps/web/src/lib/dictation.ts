'use client';

/**
 * Browser dictation for hands-free capture (spec §9, §11).
 *
 * This is the Web Speech API, which is a real capability on Android Chrome and
 * a limited one on iOS Safari — where the system keyboard's own dictation
 * button is usually the better path, and the interface says so rather than
 * offering a control that will not work.
 *
 * The wake phrase ("Hey VC Writer") is deliberately not attempted here: it
 * needs background audio a web page does not get, which §18 already flags as
 * dependent on platform constraints.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionConstructor = new () => SpeechRecognitionLike;

const constructorFor = (): RecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
};

export const isDictationSupported = (): boolean => constructorFor() !== null;

export interface DictationHandlers {
  /** Text confirmed by the recogniser; append it to the note. */
  onFinal(text: string): void;
  /** The recogniser's current best guess, shown greyed until confirmed. */
  onInterim(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface DictationSession {
  stop(): void;
}

/**
 * How many times a session may restart itself having heard nothing at all
 * before it gives up.
 *
 * The restart below is what makes listening continuous on iOS; the counter is
 * what stops it becoming a loop. A recogniser that ends immediately and
 * repeatedly — a microphone taken by another app, a tab sent to the background
 * — would otherwise be restarted forever with the button still lit, which
 * looks exactly like listening and is not.
 */
const FUTILE_RESTARTS = 3;

export const startDictation = (handlers: DictationHandlers): DictationSession | null => {
  const Recognition = constructorFor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = navigator.language || 'en-US';
  // Keep listening through pauses: a writer thinking mid-sentence is normal.
  recognition.continuous = true;
  recognition.interimResults = true;

  /** Set by `stop()`. The only thing that ends a session on purpose. */
  let finished = false;
  /** Cleared by every result, so the count is of *fruitless* restarts in a row. */
  let futile = 0;

  recognition.onresult = (event) => {
    futile = 0;
    let interim = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (!result) continue;
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) handlers.onFinal(text);
      else interim += text;
    }
    handlers.onInterim(interim);
  };

  recognition.onerror = (event) => {
    const code = event.error ?? 'unknown';

    // A pause long enough to time out is not a problem on a phone in a pocket:
    // the restart below picks the session straight back up, and telling the
    // writer their silence was an error would be a lie about what happened.
    if (code === 'no-speech' || code === 'aborted') return;

    // Anything else ends the session rather than being restarted into.
    finished = true;
    handlers.onError(
      code === 'not-allowed'
        ? 'Microphone access was denied. Allow it in your browser settings to dictate.'
        : `Dictation stopped: ${code}`,
    );
  };

  /**
   * **`continuous` is a request, not a promise** — iOS Safari ends a session
   * after each utterance whatever it is set to, which turns *tap once and
   * talk* into *tap after every sentence*. So a session that nobody stopped
   * starts itself again, and the writer's tap on **Dictate** means listening
   * until they tap it a second time. On a browser that honours `continuous`
   * this never fires and costs nothing.
   */
  recognition.onend = () => {
    if (finished) {
      handlers.onEnd();
      return;
    }

    futile += 1;
    if (futile > FUTILE_RESTARTS) {
      handlers.onEnd();
      return;
    }

    try {
      recognition.start();
    } catch {
      // Some engines refuse a restart that arrives too soon after the end. That
      // is the end of the session rather than something to retry into.
      handlers.onEnd();
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      finished = true;
      recognition.stop();
    },
  };
};

/**
 * Reading a note back out loud (his §5.7, stage 4).
 *
 * The point is that a writer can **verify without looking** — the phone is in a
 * hand at a bus stop, and the one thing a recogniser gets wrong is the thing
 * they will not notice on a screen they are not watching.
 *
 * `speechSynthesis` is far better supported than recognition, including on
 * iOS — but it needs the page to have been touched first, which it always has
 * here: the tap that stopped dictation is the gesture.
 */

export const isReadBackSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export interface ReadBack {
  stop(): void;
}

export const readAloud = (
  text: string,
  handlers: { onEnd?: () => void; onError?: (message: string) => void } = {},
): ReadBack | null => {
  if (!isReadBackSupported() || text.trim().length === 0) return null;

  // Anything still being said is stale the moment there is something new to
  // say: two voices over each other is worse than none.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = navigator.language || 'en-US';
  // A shade under conversational. A note read at speaking pace is hard to check
  // a name in, which is the whole reason for reading it.
  utterance.rate = 0.95;
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onError?.('That could not be read back.');

  window.speechSynthesis.speak(utterance);
  return { stop: () => window.speechSynthesis.cancel() };
};
