/**
 * Dictating into the writing areas (spec §9).
 *
 * **Whether there is a recogniser here cannot be known by asking.** The API is
 * present in both places this renderer runs and works in only one of them: in
 * the browser preview the page is real Chrome and it listens; in Electron the
 * constructor exists but Chromium's recogniser is a client for a Google speech
 * service reached with a key only official Chrome builds carry, so a session
 * starts and dies with a network error.
 *
 * Nor may it be settled by sniffing the bridge. `window.vcwriter` is
 * deliberately the same interface in both — *the application above does not
 * know the difference, and that is the entire point of the interface*
 * (`browser-bridge.ts`) — so a check that peered at it to guess the platform
 * would be reaching around a boundary the project maintains on purpose.
 *
 * So it is not guessed at all. The button is offered, and **the first failure
 * is the answer**: a network error means this build has no speech service, and
 * from then on the app names the operating system's dictation instead. That is
 * honest about what happened rather than about what was predicted, it costs the
 * writer one press to find out, and it needs no revisiting if Electron ever
 * gains a service.
 *
 * The system's own dictation is the better tool anyway: already installed,
 * already trained, already permitted, and it types into whatever field has
 * focus — and the writing areas are ordinary text fields, so it already reaches
 * them. The work was never to build a recogniser. It is to make what arrives
 * become *typed screenplay elements* (`spoken-script.ts`).
 */

export type DictationKind =
  /** There is something to try, and nothing has said otherwise yet. */
  | 'offer'
  /** Tried, and this build has no speech service: the system's is the way. */
  | 'system'
  /** No recogniser at all. */
  | 'none';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
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

/**
 * Set by the first session that dies for want of a speech service.
 *
 * Per run of the app rather than remembered on disk: it is a fact about this
 * build, so it will be established again in a press the next time, and storing
 * it would only risk being wrong after an update.
 */
let noService = false;

export const dictationKind = (): DictationKind => {
  if (!constructorFor()) return 'none';
  return noService ? 'system' : 'offer';
};

/**
 * What to press, named for the machine the writer is actually on, in the same
 * words `App.tsx` already uses in the Script's footer.
 *
 * A feature nobody knows the key for is not a feature, and *turn dictation on
 * in settings* is not an answer either — both of these are one press on a
 * stock machine.
 */
export const systemDictationKey = (): string => {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/mac/i.test(agent)) return 'press Fn twice';
  if (/win/i.test(agent)) return 'press the Windows key + H';
  return 'use your system’s dictation';
};

export interface DictationHandlers {
  /** Text the recogniser has committed to. */
  onFinal(text: string): void;
  /** Its current guess, shown greyed until it commits. */
  onInterim(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface DictationSession {
  stop(): void;
}

/**
 * How many times a session may restart itself having heard nothing before it
 * gives up, so a microphone another app has taken cannot leave the button lit
 * for ever. The phone learned this one the hard way (addendum 09 §7).
 */
const FUTILE_RESTARTS = 3;

export const startDictation = (handlers: DictationHandlers): DictationSession | null => {
  const Recognition = constructorFor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finished = false;
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
    // A writer thinking mid-scene is the normal case, not a failure.
    if (code === 'no-speech' || code === 'aborted') return;

    finished = true;

    // What Electron does, every time: the code is there and the service is not.
    // Noting it is what stops the app offering the button again.
    if (code === 'network' || code === 'service-not-allowed') {
      noService = true;
      handlers.onError(`No speech service in this build — ${systemDictationKey()} and dictate into the line.`);
      return;
    }

    handlers.onError(
      code === 'not-allowed'
        ? 'Microphone access was denied. Allow it and try again.'
        : `Dictation stopped: ${code}`,
    );
  };

  // `continuous` is a request rather than a promise: some engines end a session
  // at every pause, which would turn one tap into a tap per sentence.
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
