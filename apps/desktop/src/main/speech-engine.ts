import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BEGIN_SUPPRESSED,
  SPEECH_MODEL,
  SUPPRESSED_TOKENS,
  decodeTokens,
  vocabularyFrom,
  whisperFeatures,
} from '@vcwriter/domain';

/**
 * Whisper, run here (see `speech-recognition.ts` in the domain for why).
 *
 * The encoder reads thirty seconds of log-mel spectrogram once; the merged
 * decoder then says one token at a time, greedily, carrying its own key and
 * value cache from step to step — the encoder's half of the cache is made on
 * the first step and reused. No sampling, no beams: dictation wants the most
 * likely words, quickly.
 */
export interface SpeechEngine {
  /**
   * Sound at 16 kHz, mono, up to thirty seconds, to text. `previous` is the
   * token ids of what was said just before, given to Whisper as its prompt so
   * a short phrase after a pause is heard in context; the ids said this time
   * come back to be given next time.
   */
  transcribe(samples: Float32Array, previous?: readonly number[]): Promise<{ text: string; tokens: number[] }>;
}

export const createSpeechEngine = async (dir: string): Promise<SpeechEngine> => {
  const ort = await import('onnxruntime-node');
  const options = { graphOptimizationLevel: 'all' as const };
  const encoder = await ort.InferenceSession.create(join(dir, SPEECH_MODEL.encoderFile), options);
  const decoder = await ort.InferenceSession.create(join(dir, SPEECH_MODEL.decoderFile), options);
  const vocabulary = vocabularyFrom(JSON.parse(await readFile(join(dir, SPEECH_MODEL.tokenizerFile), 'utf8')) as never);
  const { layers, heads, headSize } = SPEECH_MODEL;

  const transcribe = async (samples: Float32Array, previous: readonly number[] = []): Promise<{ text: string; tokens: number[] }> => {
    const features = new ort.Tensor('float32', whisperFeatures(samples), [1, 80, 3000]);
    const encoded = await encoder.run({ input_features: features });
    const hidden = encoded['last_hidden_state']!;

    const empty = () => new ort.Tensor('float32', new Float32Array(0), [1, heads, 0, headSize]);
    let past: Record<string, InstanceType<typeof ort.Tensor>> = {};
    for (let layer = 0; layer < layers; layer += 1) {
      for (const half of ['decoder', 'encoder']) {
        past[`past_key_values.${layer}.${half}.key`] = empty();
        past[`past_key_values.${layer}.${half}.value`] = empty();
      }
    }

    const said: number[] = [];
    // Whisper's own prompt: up to half its window of what came before.
    const prompt = previous.slice(-Math.floor(SPEECH_MODEL.maxTokens / 2) + 1);
    let input: number[] = [
      ...(prompt.length > 0 ? [SPEECH_MODEL.startOfPrevious, ...prompt] : []),
      SPEECH_MODEL.startOfTranscript,
      SPEECH_MODEL.noTimestamps,
    ];
    for (let step = 0; step < SPEECH_MODEL.maxTokens; step += 1) {
      const out = await decoder.run({
        input_ids: new ort.Tensor('int64', BigInt64Array.from(input.map(BigInt)), [1, input.length]),
        encoder_hidden_states: hidden,
        use_cache_branch: new ort.Tensor('bool', [step > 0], [1]),
        ...past,
      });
      const logits = out['logits']!;
      const vocab = logits.dims[2]!;
      const data = logits.data as Float32Array;
      const offset = (input.length - 1) * vocab;
      let best = -1;
      let bestScore = -Infinity;
      for (let id = 0; id < vocab; id += 1) {
        if (SUPPRESSED_TOKENS.has(id) || (step === 0 && BEGIN_SUPPRESSED.has(id))) continue;
        // Timestamp tokens are never wanted with *no timestamps* set.
        if (id > SPEECH_MODEL.noTimestamps) continue;
        const score = data[offset + id]!;
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (best === SPEECH_MODEL.endOfText || best < 0) break;
      said.push(best);
      // The cache carries forward: the decoder's half grows each step; the
      // encoder's half, made on the first step, is kept as it was.
      const next: Record<string, InstanceType<typeof ort.Tensor>> = {};
      for (let layer = 0; layer < layers; layer += 1) {
        next[`past_key_values.${layer}.decoder.key`] = out[`present.${layer}.decoder.key`]!;
        next[`past_key_values.${layer}.decoder.value`] = out[`present.${layer}.decoder.value`]!;
        next[`past_key_values.${layer}.encoder.key`] =
          step === 0 ? out[`present.${layer}.encoder.key`]! : past[`past_key_values.${layer}.encoder.key`]!;
        next[`past_key_values.${layer}.encoder.value`] =
          step === 0 ? out[`present.${layer}.encoder.value`]! : past[`past_key_values.${layer}.encoder.value`]!;
      }
      past = next;
      input = [best];
    }
    return { text: decodeTokens(said, vocabulary), tokens: said };
  };

  return { transcribe };
};
