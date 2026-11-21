import { describe, expect, it } from 'vitest';
import {
  addDeepFindings,
  chargeForRun,
  createProjectFile,
  creditsLabel,
  editCreditPack,
  editReviewOf,
  estimateRuns,
  pricePerThousand,
  runEditCheck,
  splitIntoRuns,
  updateBeat,
  EDIT_CREDIT_PACKS,
  type RunLine,
} from '../index.js';

/** Edit credits for the AI deep check (addendum 47). */

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
const line = (beatId: string, n: number, id = `${beatId}-${n}-${Math.random()}`): RunLine => ({ id, beatId, text: words(n) });

describe('packs and charges', () => {
  it('are the three packs Ken set, at no less than $0.20 per 1,000 words', () => {
    expect(EDIT_CREDIT_PACKS.map((pack) => [pack.priceCents, pack.words])).toEqual([[500, 20_000], [1000, 50_000], [2000, 100_000]]);
    expect(EDIT_CREDIT_PACKS.map(pricePerThousand)).toEqual([0.25, 0.2, 0.2]);
    expect(editCreditPack('pack-10')?.words).toBe(50_000);
    expect(editCreditPack('pack-1000')).toBeNull();
  });

  it('charges a run at least 1,000 words, then in steps of 250', () => {
    expect(chargeForRun(0)).toBe(1000);
    expect(chargeForRun(398)).toBe(1000);
    expect(chargeForRun(1000)).toBe(1000);
    expect(chargeForRun(1001)).toBe(1250);
    expect(chargeForRun(1815)).toBe(2000);
  });

  it('shows words as credits', () => {
    expect(creditsLabel(20_000)).toBe('20');
    expect(creditsLabel(18_750)).toBe('18.75');
    expect(creditsLabel(1_500)).toBe('1.5');
  });
});

describe('splitting a scope into runs', () => {
  it('reads a scene whole where it fits, and splits a long one at paragraphs', () => {
    const runs = splitIntoRuns([line('a', 3000), line('a', 2000), line('b', 4000), line('b', 3000)]);
    expect(runs.map((run) => run.length)).toEqual([2, 1, 1]);
  });

  it('puts short scenes together, so a script of short scenes is not charged a thousand words each', () => {
    const lines = Array.from({ length: 8 }, (_, k) => line(`s${k}`, 100));
    const runs = splitIntoRuns(lines);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.filter((one) => one.type === 'scene_break')).toHaveLength(7);
    expect(estimateRuns(runs)).toEqual({ runs: 1, words: 800, charge: 1000 });
  });

  it('estimates a novel at about a credit per 1,000 words', () => {
    const lines = Array.from({ length: 30 }, (_, k) => line(`ch${k}`, 3000));
    const estimate = estimateRuns(splitIntoRuns(lines));
    expect(estimate.words).toBe(90_000);
    expect(estimate.charge).toBe(90_000);
  });
});

describe('deep check findings in the review', () => {
  const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });
  const ID = '00000000-0000-4000-8000-000000000001';
  const book = (text: string) => {
    const file = createProjectFile({ title: 'Book', format: 'novel' });
    return updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [para(ID, text)] } });
  };

  it('are added with no fix, and survive a re-check while their words are there', () => {
    let file = runEditCheck(book('One was to Harry. He would read it in the morning.'));
    const beatId = file.beats[0]!.id as string;
    file = addDeepFindings(file, [ID], [
      { beatId, elementId: ID, ruleId: 'ai-pronoun', category: 'clarity', severity: 'error', confidence: 'high', start: 18, end: 34, message: '“He” is unclear.', rule: 'AI deep check.', fix: 'Harry' },
    ]);
    const found = editReviewOf(file).findings.find((one) => one.source === 'ai')!;
    expect(found).toMatchObject({ quote: 'He would read it', fix: null, severity: 'concern' });
    expect(editReviewOf(file).fresh).toEqual([found.key]);

    file = runEditCheck(file);
    expect(editReviewOf(file).findings.some((one) => one.key === found.key)).toBe(true);

    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [para(ID, 'One was to Harry. Harry would read it later.')] } });
    file = runEditCheck(file);
    expect(editReviewOf(file).findings.some((one) => one.source === 'ai')).toBe(false);
  });

  it('replace the last deep check on the same lines only', () => {
    let file = book('One was to Harry. He would read it in the morning.');
    const beatId = file.beats[0]!.id as string;
    const hit = { beatId, elementId: ID, ruleId: 'ai-pronoun', category: 'clarity' as const, severity: 'concern' as const, confidence: 'high' as const, start: 18, end: 34, message: 'x', rule: 'y' };
    file = addDeepFindings(file, [ID], [hit]);
    file = addDeepFindings(file, [ID], []);
    expect(editReviewOf(file).findings.filter((one) => one.source === 'ai')).toEqual([]);
  });
});
