import { describe, expect, it } from 'vitest';
import { loadSample, SAMPLES } from '../samples';

/** The samples on the Welcome screen (addendum 35 §15). */
describe('loadSample', () => {
  it('lists one sample for each kind of project', () => {
    expect(new Set(SAMPLES.map((one) => one.format)).size).toBe(8);
  });

  it('opens each sample as a project, with new ids every time', async () => {
    for (const sample of SAMPLES) {
      const first = await loadSample(sample);
      const second = await loadSample(sample);
      expect(first.project.title).toBe(sample.title);
      expect(first.project.format).toBe(sample.format);
      expect(first.project.id).not.toBe(second.project.id);
    }
  });
});
