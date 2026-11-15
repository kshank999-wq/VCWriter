/**
 * **Dictation on this computer** (from Ken, 15 November: *select a box, either
 * the audio or the visual, click dictate, and it will type what you're
 * saying… just like you would dictate in the Notes app*).
 *
 * Chromium's speech recognition has no service in the desktop app, and the
 * computer's own dictation is a key the writer has to know — on Ken's Mac the
 * key opens the emoji picker. So VC Writer hears for itself: OpenAI's Whisper
 * (base, English; MIT licence), converted to ONNX by onnx-community and run by
 * the same onnxruntime the natural voices use, downloaded once on request and
 * never sending a word anywhere.
 *
 * What is here is the arithmetic, so it can be tested without the model: the
 * sound turned into the log-mel spectrogram Whisper reads (exactly as
 * `WhisperFeatureExtractor` makes it), and the model's tokens turned back into
 * words. The model itself runs in the desktop app (`speech-engine.ts`).
 */

export const SPEECH_MODEL = {
  id: 'whisper-base.en-q8',
  repository: 'https://huggingface.co/onnx-community/whisper-base.en/resolve/main',
  encoderFile: 'onnx/encoder_model_quantized.onnx',
  decoderFile: 'onnx/decoder_model_merged_quantized.onnx',
  tokenizerFile: 'tokenizer.json',
  /** About this much to download, said before it is fetched. */
  megabytes: 80,
  sampleRate: 16000,
  layers: 6,
  heads: 8,
  headSize: 64,
  /** Tokens: the transcript starts, with no timestamps; and it ends. */
  startOfTranscript: 50257,
  startOfPrevious: 50360,
  noTimestamps: 50362,
  endOfText: 50256,
  /** The most tokens a stretch of speech is given before it is cut. */
  maxTokens: 224,
} as const;

export const speechModelFiles = (): string[] => [SPEECH_MODEL.encoderFile, SPEECH_MODEL.decoderFile, SPEECH_MODEL.tokenizerFile];

/** Tokens Whisper is told never to say (its `generation_config.json`). */
export const SUPPRESSED_TOKENS: ReadonlySet<number> = new Set([
  1, 2, 7, 8, 9, 10, 14, 25, 26, 27, 28, 29, 31, 58, 59, 60, 61, 62, 63, 90, 91, 92, 93, 357, 366, 438, 532, 685, 705, 796, 930,
  1058, 1220, 1267, 1279, 1303, 1343, 1377, 1391, 1635, 1782, 1875, 2162, 2361, 2488, 3467, 4008, 4211, 4600, 4808, 5299, 5855,
  6329, 7203, 9609, 9959, 10563, 10786, 11420, 11709, 11907, 13163, 13697, 13700, 14808, 15306, 16410, 16791, 17992, 19203, 19510,
  20724, 22305, 22935, 27007, 30109, 30420, 33409, 34949, 40283, 40493, 40549, 47282, 49146, 50257, 50357, 50358, 50359, 50360,
  50361,
]);
/** And never as the first thing it says: a bare space, or the end. */
export const BEGIN_SUPPRESSED: ReadonlySet<number> = new Set([220, 50256]);

// ------------------------------------------------------------- the spectrogram

const N_FFT = 400;
const HOP = 160;
const N_MELS = 80;
const N_SAMPLES = 480000;
const N_FRAMES = 3000;

/** Hertz to mels and back, on the Slaney scale librosa uses by default. */
const F_SP = 200 / 3;
const MIN_LOG_HZ = 1000;
const MIN_LOG_MEL = MIN_LOG_HZ / F_SP;
const LOG_STEP = Math.log(6.4) / 27;
const hzToMel = (hz: number): number => (hz < MIN_LOG_HZ ? hz / F_SP : MIN_LOG_MEL + Math.log(hz / MIN_LOG_HZ) / LOG_STEP);
const melToHz = (mel: number): number => (mel < MIN_LOG_MEL ? mel * F_SP : MIN_LOG_HZ * Math.exp(LOG_STEP * (mel - MIN_LOG_MEL)));

let filters: Float64Array[] | null = null;
/** The 80 triangular mel filters over the 201 FFT bins, Slaney-normalised (`librosa.filters.mel`). */
export const melFilters = (): Float64Array[] => {
  if (filters) return filters;
  const bins = N_FFT / 2 + 1;
  const fftFreqs = Array.from({ length: bins }, (_, k) => (k * SPEECH_MODEL.sampleRate) / N_FFT);
  const low = hzToMel(0);
  const high = hzToMel(SPEECH_MODEL.sampleRate / 2);
  const melF = Array.from({ length: N_MELS + 2 }, (_, i) => melToHz(low + ((high - low) * i) / (N_MELS + 1)));
  filters = Array.from({ length: N_MELS }, (_, m) => {
    const row = new Float64Array(bins);
    const enorm = 2 / (melF[m + 2]! - melF[m]!);
    for (let k = 0; k < bins; k += 1) {
      const lower = (fftFreqs[k]! - melF[m]!) / (melF[m + 1]! - melF[m]!);
      const upper = (melF[m + 2]! - fftFreqs[k]!) / (melF[m + 2]! - melF[m + 1]!);
      row[k] = Math.max(0, Math.min(lower, upper)) * enorm;
    }
    return row;
  });
  return filters;
};

let tables: { cos: Float64Array; sin: Float64Array; window: Float64Array } | null = null;
const dftTables = () => {
  if (tables) return tables;
  const bins = N_FFT / 2 + 1;
  const cos = new Float64Array(bins * N_FFT);
  const sin = new Float64Array(bins * N_FFT);
  for (let k = 0; k < bins; k += 1) {
    for (let n = 0; n < N_FFT; n += 1) {
      const angle = (2 * Math.PI * k * n) / N_FFT;
      cos[k * N_FFT + n] = Math.cos(angle);
      sin[k * N_FFT + n] = Math.sin(angle);
    }
  }
  // Hann, periodic, as torch.hann_window makes it.
  const window = Float64Array.from({ length: N_FFT }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N_FFT));
  tables = { cos, sin, window };
  return tables;
};

/**
 * Sound at 16 kHz, mono, to Whisper's input: an 80 × 3000 log-mel
 * spectrogram of thirty seconds (padded with silence, or cut), as
 * `WhisperFeatureExtractor` makes it — a centred, reflect-padded STFT of 400
 * with a hop of 160, power, mel, log10, floored eight below its loudest, then
 * scaled. Only frames that touch the sound are transformed; the silence after
 * is the same value throughout.
 */
export const whisperFeatures = (samples: Float32Array): Float32Array => {
  const length = Math.min(samples.length, N_SAMPLES);
  const half = N_FFT / 2;
  // The padded signal, reflected at the start; past the sound it is silence.
  const at = (index: number): number => {
    let i = index - half;
    if (i < 0) i = -i;
    return i < length ? samples[i]! : 0;
  };
  const { cos, sin, window } = dftTables();
  const mels = melFilters();
  const bins = N_FFT / 2 + 1;
  const logSpec = new Float64Array(N_MELS * N_FRAMES);
  const power = new Float64Array(bins);
  const frame = new Float64Array(N_FFT);
  const sounding = Math.min(N_FRAMES, Math.ceil((length + half) / HOP) + 1);
  let loudest = -Infinity;
  const silentLog = Math.log10(1e-10);
  for (let t = 0; t < N_FRAMES; t += 1) {
    if (t >= sounding) {
      for (let m = 0; m < N_MELS; m += 1) logSpec[m * N_FRAMES + t] = silentLog;
      continue;
    }
    for (let n = 0; n < N_FFT; n += 1) frame[n] = at(t * HOP + n) * window[n]!;
    for (let k = 0; k < bins; k += 1) {
      let re = 0;
      let im = 0;
      const base = k * N_FFT;
      for (let n = 0; n < N_FFT; n += 1) {
        re += frame[n]! * cos[base + n]!;
        im -= frame[n]! * sin[base + n]!;
      }
      power[k] = re * re + im * im;
    }
    for (let m = 0; m < N_MELS; m += 1) {
      const row = mels[m]!;
      let sum = 0;
      for (let k = 0; k < bins; k += 1) sum += row[k]! * power[k]!;
      const value = Math.log10(Math.max(sum, 1e-10));
      logSpec[m * N_FRAMES + t] = value;
    }
  }
  for (let i = 0; i < logSpec.length; i += 1) if (logSpec[i]! > loudest) loudest = logSpec[i]!;
  const floor = loudest - 8;
  const out = new Float32Array(N_MELS * N_FRAMES);
  for (let i = 0; i < logSpec.length; i += 1) out[i] = (Math.max(logSpec[i]!, floor) + 4) / 4;
  return out;
};

// ------------------------------------------------------------------ the words

/** GPT-2's map from bytes to the printable characters its vocabulary is written in. */
const byteDecoder = (() => {
  const bs: number[] = [];
  for (let b = 33; b <= 126; b += 1) bs.push(b);
  for (let b = 161; b <= 172; b += 1) bs.push(b);
  for (let b = 174; b <= 255; b += 1) bs.push(b);
  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b += 1) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n += 1;
    }
  }
  const map = new Map<string, number>();
  bs.forEach((b, i) => map.set(String.fromCharCode(cs[i]!), b));
  return map;
})();

/** id → token, read from `tokenizer.json`'s vocabulary. */
export const vocabularyFrom = (tokenizer: { model?: { vocab?: Record<string, number> } }): string[] => {
  const out: string[] = [];
  for (const [token, id] of Object.entries(tokenizer.model?.vocab ?? {})) out[id] = token;
  return out;
};

/** The tokens Whisper said, as text: special tokens dropped, bytes put back together. */
export const decodeTokens = (ids: readonly number[], vocabulary: readonly string[]): string => {
  const bytes: number[] = [];
  for (const id of ids) {
    if (id >= SPEECH_MODEL.endOfText) continue;
    const token = vocabulary[id];
    if (!token) continue;
    for (const char of token) {
      const byte = byteDecoder.get(char);
      if (byte !== undefined) bytes.push(byte);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).trim();
};

/**
 * What a stretch of speech adds to a box: the words, with a space between
 * them and what is there already, and nothing when Whisper heard only the
 * silence it sometimes fills with *[BLANK_AUDIO]*, *(music)* or a lone *you*.
 */
export const joinDictated = (was: string, heard: string): string => {
  const words = heard
    .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words || /^(you|thank you\.?|thanks for watching!?)$/i.test(words)) return was;
  if (!was) return words;
  return `${was}${/\s$/.test(was) ? '' : ' '}${words}`;
};

/**
 * Cutting a stream of sound into the stretches Whisper hears, at the pauses.
 *
 * Whisper is not a streaming recogniser: it is given a stretch of sound and
 * says what was in it. So the microphone's sound is gathered while the writer
 * speaks and handed over when they pause — about a second of
 * quiet — or every twenty seconds if they never do. *Quiet* is measured
 * against the room: the level of the quietest recent moments, so a fan or a
 * hum does not count as speech, with a floor so a silent room does not make
 * breathing count either. A little sound from just before speech began is kept,
 * so the first syllable is not clipped.
 */
export interface SpeechSegmenter {
  /** More sound, at the segmenter's rate. Returns any stretches it finished. */
  push(chunk: Float32Array): Float32Array[];
  /** The writer stopped: whatever was being gathered, if it held speech. */
  flush(): Float32Array | null;
  /** Whether speech is being gathered now. */
  readonly hearing: boolean;
}

export const createSpeechSegmenter = ({
  sampleRate = SPEECH_MODEL.sampleRate,
  pauseSeconds = 1,
  longestSeconds = 20,
  shortestSeconds = 0.3,
}: { sampleRate?: number; pauseSeconds?: number; longestSeconds?: number; shortestSeconds?: number } = {}): SpeechSegmenter => {
  const frame = Math.round(sampleRate * 0.03);
  const before = Math.round(sampleRate * 0.3);
  let pending = new Float32Array(0);
  let preRoll: Float32Array[] = [];
  let preRollLength = 0;
  let gathered: Float32Array[] = [];
  let gatheredLength = 0;
  let spoken = 0;
  let quietFor = 0;
  let hearing = false;
  /** The room's level: drifts down at once, up slowly. */
  let room = 0.002;

  const take = (): Float32Array | null => {
    const out = new Float32Array(gatheredLength);
    let at = 0;
    for (const part of gathered) {
      out.set(part, at);
      at += part.length;
    }
    const worth = spoken >= shortestSeconds * sampleRate;
    gathered = [];
    gatheredLength = 0;
    spoken = 0;
    quietFor = 0;
    hearing = false;
    return worth ? out : null;
  };

  const push = (chunk: Float32Array): Float32Array[] => {
    const done: Float32Array[] = [];
    const joined = new Float32Array(pending.length + chunk.length);
    joined.set(pending);
    joined.set(chunk, pending.length);
    let at = 0;
    for (; at + frame <= joined.length; at += frame) {
      const piece = joined.slice(at, at + frame);
      let sum = 0;
      for (const value of piece) sum += value * value;
      const level = Math.sqrt(sum / frame);
      room = level < room ? level : room + (level - room) * 0.002;
      const threshold = Math.max(room * 3, 0.01);
      const loud = level > threshold;

      if (!hearing) {
        preRoll.push(piece);
        preRollLength += piece.length;
        while (preRollLength - (preRoll[0]?.length ?? 0) >= before) preRollLength -= preRoll.shift()!.length;
        if (loud) {
          hearing = true;
          gathered = preRoll;
          gatheredLength = preRollLength;
          preRoll = [];
          preRollLength = 0;
          spoken = piece.length;
        }
        continue;
      }

      gathered.push(piece);
      gatheredLength += piece.length;
      if (loud) {
        spoken += piece.length;
        quietFor = 0;
      } else {
        quietFor += piece.length;
      }
      if (quietFor >= pauseSeconds * sampleRate || gatheredLength >= longestSeconds * sampleRate) {
        const out = take();
        if (out) done.push(out);
      }
    }
    pending = joined.slice(at);
    return done;
  };

  return {
    push,
    flush: () => (hearing ? take() : null),
    get hearing() {
      return hearing;
    },
  };
};
