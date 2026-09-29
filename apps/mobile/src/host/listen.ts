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
  stop(): void;
}

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
export const startDictation = (handlers: DictationHandlers): DictationSession => {
  let running = true;
  let heardAnything = false;
  let emptyRestarts = 0;

  const results = ExpoSpeechRecognitionModule.addListener('result', (event) => {
    const said = event.results?.[0]?.transcript ?? '';
    if (said.trim().length === 0) return;
    heardAnything = true;
    if (event.isFinal) handlers.onFinal(said);
    else handlers.onInterim(said);
  });

  const errors = ExpoSpeechRecognitionModule.addListener('error', (event) => {
    // *Nothing was said* is the ordinary state of a walk between thoughts, not
    // a failure worth interrupting somebody with.
    if (event.error === 'no-speech') return;
    running = false;
    handlers.onError(event.message || String(event.error) || 'The microphone stopped');
  });

  const ends = ExpoSpeechRecognitionModule.addListener('end', () => {
    if (!running) {
      handlers.onEnd();
      return;
    }
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
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      // On the device where the device has a model: a walk out of signal is
      // exactly when somebody is most likely to be using this.
      requiresOnDeviceRecognition: true,
      // Left alone rather than filtered: a writer's note is their words, and a
      // notebook that starred them would be editing testimony.
      addsPunctuation: true,
    });
  };

  begin();

  return {
    stop() {
      running = false;
      ExpoSpeechRecognitionModule.stop();
      results.remove();
      errors.remove();
      ends.remove();
    },
  };
};
