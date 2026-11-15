import { describe, expect, it } from 'vitest';
import {
  SPEECH_MODEL,
  createSpeechSegmenter,
  decodeTokens,
  joinDictated,
  melFilters,
  speechModelFiles,
  whisperFeatures,
} from '../speech-recognition';

const tone = (seconds: number, amplitude: number): Float32Array => {
  const out = new Float32Array(Math.round(seconds * 16000));
  for (let i = 0; i < out.length; i += 1) out[i] = amplitude * Math.sin((2 * Math.PI * 220 * i) / 16000);
  return out;
};

describe('dictation heard on the computer', () => {
  it('fetches the three files of the model', () => {
    expect(speechModelFiles()).toEqual([SPEECH_MODEL.encoderFile, SPEECH_MODEL.decoderFile, SPEECH_MODEL.tokenizerFile]);
  });

  it('makes eighty mel bands over thirty seconds', () => {
    expect(melFilters()).toHaveLength(80);
    expect(melFilters()[0]).toHaveLength(201);
    const features = whisperFeatures(tone(1, 0.3));
    expect(features.length).toBe(80 * 3000);
    expect(features.every(Number.isFinite)).toBe(true);
  });

  it('turns tokens back into words, leaving the special ones out', () => {
    const vocabulary: string[] = [];
    vocabulary[100] = 'Hello';
    vocabulary[101] = 'Ġworld';
    expect(decodeTokens([100, 101, 50256], vocabulary)).toBe('Hello world');
  });

  it('adds what was heard to the box with one space, and ignores Whisper’s noises', () => {
    expect(joinDictated('', ' Open on a beach.')).toBe('Open on a beach.');
    expect(joinDictated('Open on a beach.', 'The sun comes up.')).toBe('Open on a beach. The sun comes up.');
    expect(joinDictated('Line ', 'more')).toBe('Line more');
    expect(joinDictated('Kept', ' [BLANK_AUDIO] ')).toBe('Kept');
    expect(joinDictated('Kept', 'you')).toBe('Kept');
  });

  it('hands over a stretch of speech at the pause after it', () => {
    const segmenter = createSpeechSegmenter();
    expect(segmenter.push(tone(1, 0))).toEqual([]);
    expect(segmenter.push(tone(1.5, 0.2))).toEqual([]);
    expect(segmenter.hearing).toBe(true);
    const done = segmenter.push(tone(1.5, 0));
    expect(done).toHaveLength(1);
    // The speech, a little from before it, and the pause that ended it.
    expect(done[0]!.length).toBeGreaterThan(1.5 * 16000);
    expect(done[0]!.length).toBeLessThan(3.1 * 16000);
    expect(segmenter.hearing).toBe(false);
  });

  it('does not count a quiet room as speech, and hands over what is left when stopped', () => {
    const segmenter = createSpeechSegmenter();
    expect(segmenter.push(tone(2, 0.003))).toEqual([]);
    expect(segmenter.flush()).toBeNull();
    segmenter.push(tone(1, 0.2));
    expect(segmenter.flush()?.length).toBeGreaterThan(16000 * 0.9);
  });

  it('cuts a speaker who never pauses every twenty seconds', () => {
    const segmenter = createSpeechSegmenter();
    expect(segmenter.push(tone(25, 0.2))).toHaveLength(1);
  });
});
