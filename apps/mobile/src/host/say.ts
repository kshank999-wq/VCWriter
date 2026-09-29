import * as Speech from 'expo-speech';
import { createAudioPlayer } from 'expo-audio';

/**
 * Speaking back, and the two tones (addendum 27 §5).
 *
 * `readAloud` answers **commands and never the writing** — reading dictation
 * back would talk over somebody mid-sentence, which addendum 09 §10 settled
 * and this app inherits rather than rediscovers.
 *
 * The beep keeps its own rule too: **two tones told apart by direction rather
 * than pitch**, because a walk is not a quiet room and an absolute pitch heard
 * beside traffic is a coin toss, where *up* and *down* are not.
 */

export const readAloud = (text: string, onError?: (message: string) => void): void => {
  const words = text.trim();
  if (words.length === 0) return;
  try {
    // A new sentence replaces the one in the air: on a walk the most recent
    // answer is the only one worth hearing, and a queue of them read out over
    // each other is worse than silence.
    Speech.stop();
    Speech.speak(words, { rate: 1.0, onError: () => onError?.('That could not be read back') });
  } catch {
    onError?.('That could not be read back');
  }
};

export const hush = (): void => {
  try {
    Speech.stop();
  } catch {
    // Nothing to stop is not a failure.
  }
};

/**
 * A note opening and a note closing.
 *
 * Synthesised rather than shipped as two files: a tone is four numbers, and
 * two sound files in the bundle would be two more things to keep in step with
 * what they are supposed to mean.
 */
type Tone = 'open' | 'close';

const TONES: Record<Tone, string> = {
  // Rising: something is now open and taking your words.
  open: wave(520, 760, 0.16),
  // Falling: it is closed and filed.
  close: wave(700, 440, 0.18),
};

export const beep = (which: Tone): void => {
  try {
    const player = createAudioPlayer({ uri: TONES[which] });
    player.play();
    // Released once it has had time to sound: a player per beep that nothing
    // ever frees is a walk's worth of them still in memory at the end of it.
    setTimeout(() => player.remove(), 600);
  } catch {
    // A phone on silent, or an audio session another app has: the note is
    // still open, and a beep is a courtesy rather than the mechanism.
  }
};

/**
 * A short WAV as a data URI: a sine sliding from one pitch to another, with a
 * ramp at each end so it does not click.
 */
function wave(from: number, to: number, seconds: number): string {
  const rate = 22_050;
  const frames = Math.floor(rate * seconds);
  const bytes = new Uint8Array(44 + frames * 2);
  const view = new DataView(bytes.buffer);

  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(at + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * 2, true);

  let phase = 0;
  for (let i = 0; i < frames; i += 1) {
    const through = i / frames;
    phase += (2 * Math.PI * (from + (to - from) * through)) / rate;
    const fade = Math.min(1, through * 12, (1 - through) * 12);
    view.setInt16(44 + i * 2, Math.round(Math.sin(phase) * 0.28 * fade * 32_767), true);
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}
