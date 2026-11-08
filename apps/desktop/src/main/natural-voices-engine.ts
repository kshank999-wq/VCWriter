import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  NATURAL_MODEL,
  fixPhonemes,
  normalizeForSpeech,
  phonemeLanguage,
  splitForPhonemes,
  splitForSynthesis,
  styleOffset,
  tokenizePhonemes,
} from '@vcwriter/domain';

/**
 * The natural-voice engine (addendum 45): text in, sound out, for the files
 * an install put in `dir`. It runs in its own utility process
 * (`natural-voices-worker.ts`) so a line being generated never holds up the
 * window; it is plain Node, so a test can drive it without Electron.
 *
 * Words become phonemes through eSpeak NG (the `phonemizer` package), the
 * phonemes become the model's symbols, and the model (ONNX Runtime) returns
 * the waveform at 24 kHz.
 */
export interface NaturalEngine {
  synthesize(text: string, voiceId: string, speed?: number): Promise<Float32Array>;
}

export const createNaturalEngine = async (dir: string): Promise<NaturalEngine> => {
  const ort = await import('onnxruntime-node');
  const { phonemize } = await import('phonemizer');

  const session = await ort.InferenceSession.create(join(dir, NATURAL_MODEL.modelFile));
  const tokenizer = JSON.parse(await readFile(join(dir, NATURAL_MODEL.tokenizerFile), 'utf8')) as {
    model: { vocab: Record<string, number> };
  };
  const vocab = tokenizer.model.vocab;
  const styles = new Map<string, Float32Array>();

  const styleFor = async (voiceId: string): Promise<Float32Array> => {
    const cached = styles.get(voiceId);
    if (cached) return cached;
    if (!/^[a-z]{2}_[a-z]+$/.test(voiceId)) throw new Error(`Unknown voice ${voiceId}`);
    const bytes = await readFile(join(dir, 'voices', `${voiceId}.bin`));
    const style = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    styles.set(voiceId, style);
    return style;
  };

  const phonemesOf = async (text: string, voiceId: string): Promise<string> => {
    const language = phonemeLanguage(voiceId);
    const pieces = await Promise.all(
      splitForPhonemes(normalizeForSpeech(text)).map(async (piece) =>
        piece.punctuation ? piece.text : (await phonemize(piece.text, language)).join(' '),
      ),
    );
    return fixPhonemes(pieces.join(''), voiceId);
  };

  const one = async (text: string, voiceId: string, speed: number): Promise<Float32Array> => {
    const tokens = tokenizePhonemes(await phonemesOf(text, voiceId), vocab);
    const style = await styleFor(voiceId);
    const offset = styleOffset(tokens.length);
    const result = await session.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(tokens.map((id) => BigInt(id))), [1, tokens.length]),
      style: new ort.Tensor('float32', style.slice(offset, offset + 256), [1, 256]),
      speed: new ort.Tensor('float32', Float32Array.of(speed), [1]),
    });
    const waveform = result['waveform'];
    if (!waveform) throw new Error('The model returned no sound');
    return waveform.data as Float32Array;
  };

  return {
    async synthesize(text, voiceId, speed = 1) {
      const pieces = splitForSynthesis(text);
      const parts: Float32Array[] = [];
      for (const piece of pieces) parts.push(await one(piece, voiceId, speed));
      // A short breath between sentences of a long passage.
      const gap = pieces.length > 1 ? Math.round(NATURAL_MODEL.sampleRate * 0.12) : 0;
      const total = parts.reduce((sum, part) => sum + part.length, 0) + gap * Math.max(parts.length - 1, 0);
      const out = new Float32Array(total);
      let at = 0;
      parts.forEach((part, index) => {
        out.set(part, at);
        at += part.length + (index < parts.length - 1 ? gap : 0);
      });
      return out;
    },
  };
};
