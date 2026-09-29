/**
 * The sound the phone makes when it starts and finishes a note
 * (addendum 09 §10, from Ken: *and then it'll beep and you'll start that note*).
 *
 * **It is the whole of the feedback when the phone is in a pocket.** A
 * hands-free notebook has to say *I heard that and I am listening now* without
 * being looked at, and a tone does it in a tenth of the time a spoken
 * confirmation takes — which matters, because the writer is about to talk and
 * anything still speaking is something they will talk over.
 *
 * Two sounds, and they are **told apart by direction rather than by pitch**:
 * opening rises, closing falls. A listener who cannot say which note is higher
 * can always say which way a pair moved, and a walk is not a quiet room.
 *
 * Synthesised rather than a file: two short tones are a few lines of
 * oscillator, where an audio file would be a network request that must arrive
 * before the first note can be taken.
 */

let context: AudioContext | null = null;

/** The one context, made on the first sound — before that a page has no right to. */
const audio = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  return context;
};

const tone = (at: AudioContext, hz: number, start: number, length: number): void => {
  const osc = at.createOscillator();
  const gain = at.createGain();
  osc.type = 'sine';
  osc.frequency.value = hz;
  // Eased in and out: a square-edged tone clicks, and a click on a phone in a
  // pocket reads as something going wrong.
  gain.gain.setValueAtTime(0.0001, at.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.18, at.currentTime + start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at.currentTime + start + length);
  osc.connect(gain).connect(at.destination);
  osc.start(at.currentTime + start);
  osc.stop(at.currentTime + start + length + 0.02);
};

/**
 * Make a sound, or quietly do nothing.
 *
 * **Never throws and never blocks.** A browser that will not give a page audio
 * until it has been touched, a device on silent, a build with no `AudioContext`
 * — none of those is a reason a note should fail to open, so every one of them
 * is a sound that did not happen rather than an error a writer has to read.
 */
export const beep = (which: 'open' | 'close'): void => {
  try {
    const at = audio();
    if (!at) return;
    // Suspended until the page has been touched, which is the ordinary state
    // on a phone; resuming is free and the first beep follows a press anyway.
    if (at.state === 'suspended') void at.resume();
    if (which === 'open') {
      tone(at, 660, 0, 0.09);
      tone(at, 990, 0.1, 0.11);
    } else {
      tone(at, 560, 0, 0.08);
      tone(at, 400, 0.09, 0.12);
    }
  } catch {
    // See above: a sound is never worth an error.
  }
};
