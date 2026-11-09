import { describe, expect, it } from 'vitest';
import { addRow, beatsForUnit, createProjectFile, runDailyEditor, setRowAudio, setRowVisual, unitsInStoryOrder, updateBeat } from '../index.js';

/**
 * The Daily editor on a short-form sheet (addendum 35 §14.6). An AV sheet's
 * audio column names its speaker inside the line and has no cue above it, so
 * the screenplay's shape rules must not read it as an uncued speech.
 */
describe('the Daily editor on a short-form sheet', () => {
  it('raises no uncued-speech errors on a correct sheet', () => {
    let file = createProjectFile({ title: 'Harbour Bakery', format: 'short_form', author: 'A. Writer' });
    const unit = unitsInStoryOrder(file)[0]!;
    let after = beatsForUnit(file, unit.id)[0]!.id;
    const rows: Array<[string, string]> = [
      ['SFX: Gulls. A shop bell.', 'Dawn. A small bakery on the harbour front.'],
      ['BAKER (V.O.): We start before the boats go out.', 'Hands fold dough.'],
      ['VO: Harbour Bakery. Open at five, every day.', 'Logo over the shopfront.'],
    ];
    rows.forEach(([audio, visual], index) => {
      const made = index === 0 ? { file, beatId: after } : addRow(file, { unitId: unit.id, afterBeatId: after });
      file = setRowVisual(setRowAudio(made.file, made.beatId, audio), made.beatId, visual);
      after = made.beatId;
    });
    const findings = runDailyEditor(file);
    expect(findings.filter((one) => one.kind === 'orphan_dialogue' || one.kind === 'cue_without_speech')).toEqual([]);
  });

  it('still catches a speech with nobody saying it in a screenplay', () => {
    const file = createProjectFile({ title: 'Night', format: 'screenplay', author: 'A. Writer' });
    const beat = file.beats[0]!;
    const written = updateBeat(file, beat.id, {
      manuscript: { elements: [{ id: 'd1111111-1111-4111-8111-111111111111' as never, type: 'dialogue', text: 'They are coming to get you.', characterId: null, attributes: {} }] },
    });
    expect(runDailyEditor(written).some((one) => one.kind === 'orphan_dialogue')).toBe(true);
  });
});
