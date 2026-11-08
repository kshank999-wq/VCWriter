import { describe, expect, it } from 'vitest';
import {
  NATURAL_MAX_TOKENS,
  NATURAL_VOICES,
  fixPhonemes,
  naturalModelFiles,
  naturalVoiceDescriptors,
  normalizeForSpeech,
  phonemeLanguage,
  preferredDefaultVoice,
  sortVoices,
  splitForPhonemes,
  splitForSynthesis,
  styleOffset,
  suggestVoiceAssignments,
  tokenizePhonemes,
  describeVoice,
  wordAtFraction,
} from '../index.js';

/** Natural voices for read-back (addendum 45): the catalogue and the text preparation. */
describe('natural voices', () => {
  it('offers each voice once, with an accent and a gender, and a style file for each', () => {
    expect(new Set(NATURAL_VOICES.map((voice) => voice.id)).size).toBe(NATURAL_VOICES.length);
    for (const voice of naturalVoiceDescriptors()) {
      expect(voice.providerId).toBe('natural');
      expect(voice.accent).toMatch(/British|American/);
      expect(voice.gender).not.toBe('unknown');
    }
    expect(naturalModelFiles()).toContain('voices/bm_george.bin');
    expect(naturalModelFiles()).toContain('onnx/model_quantized.onnx');
  });

  it('lists natural voices first and makes George the default where they are installed', () => {
    const system = [describeVoice({ id: 'daniel', name: 'Daniel', lang: 'en-GB' })];
    expect(preferredDefaultVoice(system)?.id).toBe('daniel');
    const both = sortVoices([...system, ...naturalVoiceDescriptors()]);
    expect(both[0]?.providerId).toBe('natural');
    expect(preferredDefaultVoice(both)?.id).toBe('bm_george');
  });

  it('casts characters from the natural voices first', () => {
    const file = { characters: [{ id: 'c1', name: 'Barbra', voice: null, archived: false }] } as never;
    const suggestions = suggestVoiceAssignments(file, [
      describeVoice({ id: 'zira', name: 'Microsoft Zira', lang: 'en-US' }),
      ...naturalVoiceDescriptors(),
    ]);
    expect(Object.keys(suggestions)).toHaveLength(1);
    for (const assignment of Object.values(suggestions)) expect(assignment.providerId).toBe('natural');
  });

  it('says numbers, money and titles the way a reader would', () => {
    expect(normalizeForSpeech('Dr. Smith paid $5.50 in 1968.')).toBe('Doctor Smith paid 5 dollars and 50 cents in 19 68.');
    expect(normalizeForSpeech('Meet at 7:05, Mr. Cooper.')).toBe('Meet at 7 oh 5, Mister Cooper.');
    expect(normalizeForSpeech('“They’re coming,” she said.')).toBe('"They\'re coming," she said.');
  });

  it('keeps punctuation apart from the words to be sounded out', () => {
    expect(splitForPhonemes('Stop it! You are ignorant.')).toEqual([
      { punctuation: false, text: 'Stop it' },
      { punctuation: true, text: '! ' },
      { punctuation: false, text: 'You are ignorant' },
      { punctuation: true, text: '.' },
    ]);
  });

  it('chooses the accent from the voice and makes the reference corrections', () => {
    expect(phonemeLanguage('bm_george')).toBe('en');
    expect(phonemeLanguage('af_heart')).toBe('en-us');
    expect(fixPhonemes('ɹæbɪt rʌn x', 'af_heart')).toBe('ɹæbɪt ɹʌn k');
    expect(fixPhonemes('nˈaɪnti', 'af_heart')).toBe('nˈaɪndi');
    expect(fixPhonemes('nˈaɪnti', 'bm_george')).toBe('nˈaɪnti');
  });

  it('numbers the symbols, drops unknown ones and stays inside the model limit', () => {
    expect(tokenizePhonemes('ab?', { a: 43, b: 44 })).toEqual([0, 43, 44, 0]);
    expect(tokenizePhonemes('a'.repeat(2000), { a: 43 })).toHaveLength(NATURAL_MAX_TOKENS);
    expect(styleOffset(2)).toBe(0);
    expect(styleOffset(12)).toBe(2560);
    expect(styleOffset(5000)).toBe(256 * 509);
  });

  it('reads long passages a few sentences at a time', () => {
    const long = Array.from({ length: 12 }, (_, n) => `This is sentence number ${n + 1} of the passage.`).join(' ');
    const pieces = splitForSynthesis(long, 120);
    expect(pieces.length).toBeGreaterThan(3);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(120);
    expect(pieces.join(' ')).toBe(long);
    expect(splitForSynthesis('No full stop here')).toEqual(['No full stop here']);
    expect(splitForSynthesis('   ')).toEqual([]);
  });
});

describe('the word being spoken', () => {
  it('moves through the line with the sound', () => {
    const text = 'Stop it now';
    expect(wordAtFraction(text, 0)).toEqual({ from: 0, to: 4 });
    expect(wordAtFraction(text, 0.5)).toEqual({ from: 5, to: 7 });
    expect(wordAtFraction(text, 1)).toEqual({ from: 8, to: 11 });
    expect(wordAtFraction('   ', 0.5)).toBeNull();
  });
});
