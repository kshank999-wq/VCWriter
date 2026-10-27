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
   * went to save it, it wouldn't save it. And when I went to read it back, it
   * wouldn't read it back*). An iPhone holds every word of a continuous sitting
   * as provisional until it is told to stop, and sends the final transcript
   * *after* that. Stop used to take its listeners away in the same breath, so
   * the final words arrived to nobody and the scene on the screen was never
   * committed: Save and Read it back both found nothing. Now the listeners
   * stay until the recogniser says it has ended (or a moment has passed), and
   * whatever was still provisional is committed then.
   */
  stop(): Promise<void>;
}

/** How long a stop waits for the recogniser's last words before going on. */
const STOP_WAIT_MS = 1500;

/**
 * How many times a sitting may restart itself having heard nothing before it
 * gives up.
 *
 * Restarting is what makes listening continuous; the counter is what stops it
 * becoming a loop — a microphone taken by a phone call would otherwise be
 * grabbed at forever with the button still lit, which reads as listening and
 * is not.
 */
const EMPTY_RESTARTS = 4;

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

/**
 * Listen until told to stop.
 *
 * **Continuous and on-device where it can be**, which is the walk's whole
 * requirement: `requiresOnDeviceRecognition` falls back by itself where a
 * device has no local model, so a phone with signal and a phone without behave
 * the same way as far as this app is concerned.
 */
export const startDictation = (
  handlers: DictationHandlers,
  /**
   * **A walk listens a phrase at a time** (addendum 27 §16). In continuous
   * mode an iPhone confirms nothing until it is stopped, so *command done*
   * said mid-walk was never acted on. Not continuous, it ends at each pause
   * with that phrase confirmed, and the restart below picks up again — which
   * is what makes a spoken command land when it is said. The typed screen
   * keeps one continuous sitting, where a pause is not an instruction.
   */
  options: { continuous?: boolean } = {},
): DictationSession => {
  let running = true;
  let heardAnything = false;
  let emptyRestarts = 0;
  /** The recogniser's latest guess not yet committed: what a stop must not lose. */
  let pending = '';
  let ended: (() => void) | null = null;

  const results = ExpoSpeechRecognitionModule.addListener('result', (event) => {
    const said = event.results?.[0]?.transcript ?? '';
    if (said.trim().length === 0) return;
    heardAnything = true;
    if (event.isFinal) {
      pending = '';
      handlers.onFinal(said);
    } else {
      pending = said;
      handlers.onInterim(said);
    }
  });

  /** Commit what was still provisional, once. */
  const settle = () => {
    const last = pending;
    pending = '';
    if (last.trim().length > 0) handlers.onFinal(last);
  };

  const errors = ExpoSpeechRecognitionModule.addListener('error', (event) => {
    // *Nothing was said* is the ordinary state of a walk between thoughts, not
    // a failure worth interrupting somebody with.
    if (event.error === 'no-speech') return;
    running = false;
    handlers.onError(event.message || String(event.error) || 'The microphone stopped');
  });

  const ends = ExpoSpeechRecognitionModule.addListener('end', () => {
    if (!running) {
      ended?.();
      return;
    }
    // A sitting that ends by itself keeps its last guess too.
    settle();
    // A recogniser ends on its own between utterances; starting it again is
    // what makes it continuous.
    if (heardAnything) {
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
    ExpoSpeechRecognitionModule.start({
      // Playback stays possible while listening, at a normal volume: the
      // library's default mode is *measurement*, which turns read-back down to
      // a whisper or to nothing.
      iosCategory: {
        category: 'playAndRecord',
        categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
        mode: 'default',
      },
      lang: 'en-US',
      interimResults: true,
      continuous: options.continuous ?? true,
      // On the device where the device has a model: a walk out of signal is
      // exactly when somebody is most likely to be using this.
      requiresOnDeviceRecognition: true,
      // Left alone rather than filtered: a writer's note is their words, and a
      // notebook that starred them would be editing testimony.
      addsPunctuation: true,
    });
  };

  begin();

  let stopping: Promise<void> | null = null;
  return {
    stop() {
      stopping ??= new Promise<void>((resolve) => {
        running = false;
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
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          finish();
        }
      });
      return stopping;
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
