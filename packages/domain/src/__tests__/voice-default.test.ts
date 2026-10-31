import { describe, expect, it } from 'vitest';
import { describeVoice, preferredDefaultVoice } from '../index.js';

describe('the default read-back voice (from Ken: make Daniel the default)', () => {
  const v = (name: string, lang: string) => describeVoice({ id: name, name, lang });
  it('is Daniel where the computer has him', () => {
    expect(preferredDefaultVoice([v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Kate', 'en-GB')])?.name).toBe('Daniel');
  });
  it('is a British English voice otherwise, and nothing where there is none', () => {
    expect(preferredDefaultVoice([v('Samantha', 'en-US'), v('Microsoft Hazel Desktop', 'en-GB')])?.name).toBe('Microsoft Hazel Desktop');
    expect(preferredDefaultVoice([v('Samantha', 'en-US')])).toBeNull();
  });
});
