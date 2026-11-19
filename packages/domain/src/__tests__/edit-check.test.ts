import { describe, expect, it } from 'vitest';
import {
  applyFix,
  checkLine,
  createProjectFile,
  decideFinding,
  editReviewOf,
  findingAnchor,
  isNarrowFix,
  runEditCheck,
  setEditorProfile,
  statusOf,
  tallyReview,
  updateBeat,
  type LineContext,
  type ProjectFile,
} from '../index.js';

/**
 * The Edit Check (VC Writer Editor Refinement spec v1.0): it notices and
 * explains, changes nothing on its own, and fixes only narrow mechanical
 * slips the writer accepts.
 */

const para = (id: string, text: string) => ({ id: id as never, type: 'paragraph' as const, text, characterId: null, attributes: {} });

const novel = (lines: string[], profile: Parameters<typeof setEditorProfile>[1] = {}): ProjectFile => {
  let file = createProjectFile({ title: 'Book', format: 'novel' });
  file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: lines.map((text, k) => para(`00000000-0000-4000-8000-00000000000${k}`, text)) } });
  file = { ...file, characters: [{ ...(file.characters[0] ?? ({} as never)), name: 'Tom' } as never, { ...(file.characters[0] ?? ({} as never)), name: 'Mara' } as never].filter((one) => (one as { name?: string }).name) };
  return setEditorProfile(file, profile);
};

const ctx = (over: Partial<LineContext> = {}): LineContext => ({
  mode: 'prose', type: 'paragraph', pov: 'unspecified', tense: 'unspecified', viewpoint: [], characters: ['Tom', 'Mara'], dictionary: new Set(), ...over,
});

const rules = (text: string, over: Partial<LineContext> = {}) => checkLine(text, ctx(over)).map((one) => one.ruleId);

describe('point of view (spec §10.9–11)', () => {
  it('flags a first-person narrator reporting another mind, but not quoted speech', () => {
    const slip = 'I watched the door. She wondered whether I would come back, and I knew it.';
    expect(rules(slip, { pov: 'first_singular' })).toContain('pov-other-mind');
    const quoted = 'I watched the door. “She wondered where you went,” Tom told me.';
    expect(rules(quoted, { pov: 'first_singular' })).not.toContain('pov-other-mind');
  });

  it('in third limited, flags another character’s thoughts without claiming certainty', () => {
    const found = checkLine('Mara opened the gate. Tom thought she was lying.', ctx({ pov: 'third_limited', viewpoint: ['Mara'] }));
    const hop = found.find((one) => one.ruleId === 'pov-head-hop');
    expect(hop).toBeDefined();
    expect(hop!.confidence).not.toBe('high');
    expect(rules('Mara thought he was lying.', { pov: 'third_limited', viewpoint: ['Mara'] })).not.toContain('pov-head-hop');
  });

  it('in omniscient, does not treat a character’s thoughts as an error', () => {
    expect(rules('Tom thought she was lying. Mara wondered if he knew.', { pov: 'third_omniscient' }).filter((id) => id.startsWith('pov'))).toEqual([]);
  });

  it('notices present tense in past-tense narration', () => {
    expect(rules('She walked to the door. She is tired and he knows it.', { tense: 'past' })).toContain('tense-present-in-past');
  });
});

describe('mechanical and craft rules', () => {
  it('offers narrow fixes for mechanical slips', () => {
    const found = checkLine('“I don’t know.” she said.  Then  nothing.', ctx());
    const tag = found.find((one) => one.ruleId === 'dialogue-tag-comma')!;
    expect(tag.fix).toBe(',');
    expect(found.some((one) => one.ruleId === 'double-space' && one.fix === ' ')).toBe(true);
  });

  it('explains craft concerns without a replacement', () => {
    const found = checkLine('The ball was thrown by Tom. He walked slowly in order to think. It was very cold.', ctx());
    for (const id of ['passive-voice', 'verb-adverb', 'wordy-phrase', 'weak-qualifier']) {
      const one = found.find((hit) => hit.ruleId === id);
      expect(one, id).toBeDefined();
      expect(one!.fix).toBeUndefined();
    }
  });

  it('never accepts a fix that would be a rewrite', () => {
    expect(isNarrowFix(',')).toBe(true);
    expect(isNarrowFix('TOM')).toBe(true);
    expect(isNarrowFix('She ran. Then she stopped and looked back')).toBe(false);
  });

  it('in screenplay mode, checks format and leaves dialogue’s fragments alone', () => {
    expect(rules('tom', { mode: 'screenplay', type: 'character' })).toContain('cue-caps');
    expect(rules('farmhouse - night', { mode: 'screenplay', type: 'scene_heading' })).toContain('scene-heading-start');
    expect(rules('Never. Not again. Not ever.', { mode: 'screenplay', type: 'dialogue' }).filter((id) => id !== 'double-space')).toEqual([]);
  });
});

describe('the review (spec §6, §10)', () => {
  it('leaves the manuscript unchanged, and keeps decisions until the words change', () => {
    const file = novel(['It was  dark. The ball was thrown by Tom.'], { pov: 'third_omniscient', tense: 'past' });
    const checked = runEditCheck(file);
    expect(checked.beats).toEqual(file.beats);
    const review = editReviewOf(checked);
    const passive = review.findings.find((one) => one.ruleId === 'passive-voice')!;
    const decided = decideFinding(checked, passive.key, 'intentional');
    const again = runEditCheck(decided);
    expect(statusOf(editReviewOf(again), editReviewOf(again).findings.find((one) => one.ruleId === 'passive-voice')!)).toBe('intentional');
    // The words change: the old decision does not carry over to new words.
    const beatId = again.beats[0]!.id;
    const edited = updateBeat(again, beatId, { manuscript: { elements: [para('00000000-0000-4000-8000-000000000000', 'It was dark. The bell was rung by Tom.')] } });
    const rechecked = editReviewOf(runEditCheck(edited));
    const now = rechecked.findings.find((one) => one.ruleId === 'passive-voice')!;
    expect(statusOf(rechecked, now)).toBe('open');
  });

  it('applies only an accepted mechanical fix, over its span, and not once the words moved on', () => {
    const file = runEditCheck(novel(['It was  dark.']));
    const review = editReviewOf(file);
    const space = review.findings.find((one) => one.ruleId === 'double-space')!;
    const fixed = applyFix(file, space.key);
    expect(fixed.done).toBe(true);
    expect(fixed.file.beats[0]!.manuscript.elements[0]!.text).toBe('It was dark.');
    expect(tallyReview(editReviewOf(fixed.file)).open).toBe(tallyReview(review).open - 1);

    const craft = runEditCheck(novel(['The ball was thrown by Tom.']));
    const passive = editReviewOf(craft).findings.find((one) => one.ruleId === 'passive-voice')!;
    expect(applyFix(craft, passive.key).done).toBe(false);

    const changed = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [para('00000000-0000-4000-8000-000000000000', 'Night came.')] } });
    expect(findingAnchor(changed, space).state).toBe('stale');
    expect(applyFix(changed, space.key).done).toBe(false);
  });
});
