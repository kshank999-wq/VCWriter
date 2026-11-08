import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createNaturalEngine } from '../natural-voices-engine';

/**
 * The natural-voice engine against a real model (addendum 45). The model is
 * about 100 MB and fetched on request, so it is not in the repository: point
 * VCW_NATURAL_MODEL at an installed folder to run this, and VCW_NATURAL_OUT
 * at a folder to keep the WAVs it makes.
 */
const dir = process.env['VCW_NATURAL_MODEL'] ?? '';
const out = process.env['VCW_NATURAL_OUT'] ?? '';

const wav = (samples: Float32Array, rate: number): Buffer => {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), index * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
};

describe.skipIf(!dir || !existsSync(join(dir, 'manifest.json')))('the natural-voice engine', () => {
  it('speaks a line in the chosen voice, about as long as the words take', async () => {
    const engine = await createNaturalEngine(dir);
    const samples = await engine.synthesize("They're coming to get you, Barbra.", 'am_michael');
    const seconds = samples.length / 24000;
    expect(seconds).toBeGreaterThan(1);
    expect(seconds).toBeLessThan(5);
    const loud = samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
    expect(loud).toBeGreaterThan(0.05);
    if (out) await writeFile(join(out, 'engine-check.wav'), wav(samples, 24000));
  }, 60000);
});
