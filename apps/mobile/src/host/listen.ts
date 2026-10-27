import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Hearing, on a phone (addendum 27 §5).
 *
 * **This is the reason the app is native rather than a wrapped web page.** The
 * browser's `SpeechRecognition` is a real capability on Android Chrome and a
 * limited one in Safari, and inside an iOS web view it needs the network,
 * stops when the screen locks, and cannot be relied on at all — which would be
 * fine for a page somebody reads and is fatal for a notebook used on a walk,
 * where the phone is in a pocket and the whole feature is that nobody is
 * looking at it. `SFSpeechRecognizer` and Android's `SpeechRecognizer` do
 * continuous recognition, on the device where the device can, with an audio
 * session that survives the screen going dark.
 *
 * The interface is deliberately `startDictation`'s, because **what is heard is
 * not what it means**: `hear` and `readSpoken` in the domain decide that, and
 * they are the same functions the website calls. This file does what its name
 * says and nothing else.
 */

export interface DictationHandlers {
  /** Text the recogniser has committed to; hand it to the domain. */
  onFinal(text: string): void;
  /** Its current guess, drawn greyed until it is confirmed. */
  onInterim(text: string): void;
  onError(message: string): void;
  onEnd(): void;
}

export interface DictationSession {
  /**
   * Stop, **and wait for the last words** (from Ken: *I did a scene, but when I
   * went to save it, it wouldn't save it*). An iPhone sends its final
   * transcript *after* it is told to stop, so the listeners stay until the
   * recogniser says it has ended (or a moment has passed), and whatever was
   * still provisional is committed then.
   */
  stop(): Promise<void>;
  /**
   * **Stop listening while the phone speaks** (addendum 27 §17–18). The
   * microphone heard the phone's own questions and wrote them into Ken's note,
   * and a recogniser left running under the speech is the likeliest cause of
   * the walk's crash. `pause` ends the recognition outright; `resume` starts a
   * fresh one. Nothing said in between is kept.
   */
  pause(): void;
  resume(): void;
}

/** How long a stop waits for the recogniser's last words before going on. */
const STOP_WAIT_MS = 1500;

/**
 * How many times a sitting may restart itself having heard nothing before it
 * gives up — a microphone taken by a phone call would otherwise be grabbed at
 * forever with the button still lit.
 */
const EMPTY_RESTARTS = 8;
/**
 * A recognition that ended this soon after starting, having heard nothing, is
 * a microphone that will not listen. One that ran longer simply heard silence,
 * and restarting it is the point (addendum 27 §17: Ken's walk *shut down*).
 */
const QUICK_END_MS = 1200;
/** How close a repeat has to follow the words it repeats to be read as one. */
const REPEAT_WINDOW_MS = 4000;

/** Whether this device can hear for itself. */
export const canHear = async (): Promise<boolean> => {
  try {
    const locales = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    return locales.locales.length > 0 || locales.installedLocales.length > 0;
  } catch {
    // A device with no recogniser at all answers by throwing. Absent rather
    // than a button that can only refuse (addendum 09 §8a).
    return false;
  }
};

/** Ask for the microphone and speech, which iOS wants separately. */
export const mayHear = async (): Promise<boolean> => {
  const said = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  return said.granted;
};

/** A word as it is compared: no case, no punctuation. */
const plainWord = (word: string): string => word.toLowerCase().replace(/[^a-z0-9']/g, '');

/**
 * A phrase as it is compared — its words in plain form, a lone dash or full
 * stop left out — and where each of those words stands among the words as
 * they were said, so what is handed on keeps the writer's own punctuation.
 */
const wordsOf = (said: string): { said: string[]; plain: string[]; at: number[] } => {
  const all = said.trim().split(/\s+/).filter(Boolean);
  const plain: string[] = [];
  const at: number[] = [];
  all.forEach((word, index) => {
    const one = plainWord(word);
    if (one.length === 0) return;
    plain.push(one);
    at.push(index);
  });
  return { said: all, plain, at };
};

const startsWithWords = (whole: readonly string[], start: readonly string[]): boolean =>
  start.length > 0 && start.length <= whole.length && start.every((one, at) => whole[at] === one);
const endsWithWords = (whole: readonly string[], end: readonly string[]): boolean =>
  end.length > 0 && end.length <= whole.length && end.every((one, at) => whole[whole.length - end.length + at] === one);

/**
 * Listen until told to stop.
 *
 * **Continuous and on-device where it can be**, which is the walk's whole
 * requirement: `requiresOnDeviceRecognition` falls back by itself where a
 * device has no local model.
 */
export const startDictation = (
  handlers: DictationHandlers,
  options: {
    /**
     * **Commit a phrase once it has stopped changing for this long** (addendum
     * 27 §18). A walk is answered phrase by phrase, and an iPhone before iOS 18
     * confirms nothing until it is stopped; a guess that has sat unchanged
     * this long is what the writer said. Off for the typed screen, where the
     * guess is drawn and committed at the stop.
     */
    commitAfterMs?: number;
  } = {},
): DictationSession => {
  let running = true;
  let paused = false;
  let live = false;
  let heardAnything = false;
  let emptyRestarts = 0;
  let startedAt = 0;
  let stoppingNow = false;
  /** The recogniser's latest guess not yet committed: what a stop must not lose. */
  let pending = '';
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let ended: (() => void) | null = null;
  /** A resume that came before the paused recognition had finished ending. */
  let restartOnEnd = false;

  /**
   * **The repeat** (addendum 27 §17–18, from Ken: *when I stop the
   * dictation, it doubles my last sentence… this is an Amber Alert, this is
   * an Amber Alert*). On iOS 18 a phrase arrives as final when the speaker
   * pauses, and again when the recogniser stops — and the second copy can
   * differ in its capitals and punctuation, which is why comparing the text
   * exactly let it through. Words are compared plain:
   *
   * - every word committed in this recognition, to recognise a transcript
   *   that carries all of them and more (older iPhones send the whole sitting
   *   each time) and give only the more;
   * - the last phrase committed, to drop it said again, or take only what
   *   follows it when it comes back longer.
   */
  let committed: string[] = [];
  let lastPhrase: string[] = [];
  let lastAt = 0;
  /** The last phrase was committed early, from a guess that had stopped changing. */
  let lastEarly = false;

  /**
   * The two moments a phone sends words it has already sent, and the only two
   * where a repeat is dropped — a writer who says *erase word* twice means it
   * twice:
   *
   * - **at the stop**, when the final transcript repeats what was committed;
   * - **after an early commit**, when the recogniser confirms the phrase this
   *   file already took from its guess.
   */
  const commit = (said: string, early = false) => {
    const words = wordsOf(said);
    const plain = words.plain;
    if (plain.length === 0) return;
    const confirming = lastEarly && Date.now() - lastAt < REPEAT_WINDOW_MS;
    // The whole sitting sent again with more on the end — or, at a stop or an
    // early commit, sent again as it was.
    const carries = startsWithWords(plain, committed) && (plain.length > committed.length || stoppingNow || confirming);

    let from = 0;
    if (carries) from = committed.length;
    else if (stoppingNow && endsWithWords(committed, plain)) return;
    else if (confirming && startsWithWords(lastPhrase, plain)) return;
    else if (confirming && startsWithWords(plain, lastPhrase)) from = lastPhrase.length;

    if (from >= plain.length) return;
    const fresh = words.said.slice(from === 0 ? 0 : (words.at[from] ?? words.said.length));
    if (fresh.length === 0) return;
    committed = [...committed, ...plain.slice(from)];
    lastPhrase = plain;
    lastAt = Date.now();
    lastEarly = early;
    handlers.onFinal(fresh.join(' '));
  };

  const clearPendingTimer = () => {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
  };

  /** Commit what was still provisional, once. */
  const settle = (early = false) => {
    clearPendingTimer();
    const last = pending;
    pending = '';
    if (!paused) commit(last, early);
  };

  const results = ExpoSpeechRecognitionModule.addListener('result', (event) => {
    if (paused) return;
    // The library puts a space before a phrase that follows another; the words
    // are what matter.
    const said = (event.results?.[0]?.transcript ?? '').trim();
    if (said.length === 0) return;
    heardAnything = true;
    if (event.isFinal) {
      clearPendingTimer();
      pending = '';
      commit(said);
    } else {
      pending = said;
      handlers.onInterim(said);
      if (options.commitAfterMs) {
        clearPendingTimer();
        pendingTimer = setTimeout(() => settle(true), options.commitAfterMs);
      }
    }
  });

  const errors = ExpoSpeechRecognitionModule.addListener('error', (event) => {
    // *Nothing was said* is the ordinary state of a walk between thoughts, and
    // an abort is this file pausing on purpose.
    if (event.error === 'no-speech' || event.error === 'aborted' || paused) return;
    running = false;
    handlers.onError(event.message || String(event.error) || 'The microphone stopped');
  });

  const ends = ExpoSpeechRecognitionModule.addListener('end', () => {
    live = false;
    if (!running) {
      ended?.();
      return;
    }
    if (paused) return;
    if (restartOnEnd) {
      restartOnEnd = false;
      begin();
      return;
    }
    // A sitting that ends by itself keeps its last guess too.
    settle();
    // A new recognition starts from nothing.
    committed = [];
    lastPhrase = [];
    lastEarly = false;
    if (heardAnything || Date.now() - startedAt > QUICK_END_MS) {
      heardAnything = false;
      emptyRestarts = 0;
    } else if ((emptyRestarts += 1) > EMPTY_RESTARTS) {
      running = false;
      handlers.onError('The microphone stopped listening');
      handlers.onEnd();
      return;
    }
    begin();
  });

  const begin = () => {
    startedAt = Date.now();
    live = true;
    committed = [];
    try {
      ExpoSpeechRecognitionModule.start({
        // Playback stays possible while listening, at a normal volume: the
        // library's default mode is *measurement*, which turns speech down to
        // a whisper or to nothing.
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'default',
        },
        lang: 'en-US',
        interimResults: true,
        // One recognition for the whole sitting: restarting at every pause
        // lost whatever was said in the gap (addendum 27 §18, from Ken: *it
        // missed a bunch of sentences*).
        continuous: true,
        // On the device where the device has a model: a walk out of signal is
        // exactly when somebody is most likely to be using this.
        requiresOnDeviceRecognition: true,
        // Left alone rather than filtered: a writer's note is their words.
        addsPunctuation: true,
      });
    } catch (error) {
      live = false;
      running = false;
      handlers.onError(error instanceof Error ? error.message : 'The microphone would not start');
      handlers.onEnd();
    }
  };

  begin();

  let stopping: Promise<void> | null = null;
  return {
    stop() {
      stopping ??= new Promise<void>((resolve) => {
        running = false;
        stoppingNow = true;
        clearPendingTimer();
        const finish = () => {
          ended = null;
          clearTimeout(timer);
          settle();
          results.remove();
          errors.remove();
          ends.remove();
          handlers.onEnd();
          resolve();
        };
        const timer = setTimeout(finish, STOP_WAIT_MS);
        ended = finish;
        if (!live) {
          finish();
          return;
        }
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          finish();
        }
      });
      return stopping;
    },
    pause() {
      if (paused || !running) return;
      // What was being said is the writer's, and goes in before the pause.
      settle();
      paused = true;
      handlers.onInterim('');
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // Already ended is the same thing.
      }
    },
    resume() {
      if (!paused || !running) return;
      paused = false;
      pending = '';
      // The abort may not have finished ending yet; then it starts once it has.
      if (!live) begin();
      else restartOnEnd = true;
    },
  };
};

/**
 * Get the phone ready to speak (iOS): out of the recording session and into
 * playback, so *Read it back* is heard at full volume — and heard at all,
 * since a session left recording can silence speech entirely. Nothing to do
 * on Android, where speech and the microphone do not share a session.
 */
export const readyToSpeak = (): void => {
  if (Platform.OS !== 'ios') return;
  try {
    ExpoSpeechRecognitionModule.setCategoryIOS({ category: 'playback', categoryOptions: ['duckOthers'], mode: 'spokenAudio' });
  } catch {
    // A phone that will not change it still tries to speak.
  }
};
