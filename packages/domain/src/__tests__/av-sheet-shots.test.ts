import { describe, expect, it } from 'vitest';
import { CAMERA_MOVES, SHOT_TYPES, avSheet, createProjectFile, setRowShot, setRowVisual, shotChoices } from '../index';

describe('a shot’s framing and camera move (from Ken, 15 November)', () => {
  it('offers the shot that starts with what was typed first', () => {
    expect(shotChoices('cow', SHOT_TYPES)[0]).toBe('Cowboy shot');
    expect(shotChoices('c', SHOT_TYPES).slice(0, 2)).toEqual(['Cowboy shot', 'Close-up']);
    // A later word, and a board's short form, find it too.
    expect(shotChoices('up', SHOT_TYPES)).toContain('Close-up');
    expect(shotChoices('ecu', SHOT_TYPES)).toEqual(['Extreme close-up']);
    expect(shotChoices('push', CAMERA_MOVES)[0]).toBe('Push in');
    expect(shotChoices('', CAMERA_MOVES)).toHaveLength(CAMERA_MOVES.length);
    expect(shotChoices('zzz', SHOT_TYPES)).toEqual([]);
  });

  it('is kept on the shot, apart from its description, and read together for print', () => {
    let file = createProjectFile({ title: 'Spot', format: 'short_form' });
    const beatId = file.beats[0]!.id;
    file = setRowShot(file, beatId, { shotType: 'Close-up' });
    file = setRowShot(file, beatId, { cameraMove: 'Push in' });
    file = setRowVisual(file, beatId, 'Crust browning.');
    const row = avSheet(file).segments[0]!.rows[0]!;
    expect(row.shotType).toBe('Close-up');
    expect(row.cameraMove).toBe('Push in');
    expect(row.shot).toBe('Close-up · Push in');
    expect(row.visual).toBe('Crust browning.');
    expect(row.audio).toBe('');
  });
});
