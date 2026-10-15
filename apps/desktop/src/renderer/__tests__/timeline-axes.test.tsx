// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANE_CEILING, LANE_FLOOR, ZOOM_CEILING, ZOOM_FLOOR, isProseFormat } from '@vcwriter/domain';

/**
 * **The two axes, and the viewer a book does not have** (addendum 02 §4e).
 *
 * These read the source, which is `late-module`'s and `store-requirements`'
 * idiom and the right one here for two reasons: both rules fail by something
 * being **absent** — a wrapped column that comes back, a viewer drawn on a
 * book — and absence looks exactly like the change never having been made.
 */

const read = (file: string): string =>
  readFileSync(join(__dirname, '..', file), 'utf8');

describe('the board has two axes', () => {
  it('never wraps beats into a second column', () => {
    const board = read('components/MasterTimeline.tsx');
    // The count and the width it was paid for are gone rather than left as a
    // second way to lay a scene out.
    expect(board).not.toContain('DEFAULT_BEATS_PER_COLUMN =');
    expect(board).not.toContain('BEAT_COLUMN_WIDTH');
    expect(board).not.toMatch(/beatsWidth\s*\(/);

    const css = read('workspace.css');
    // One column, as tall as what is in it.
    expect(css).not.toContain('--beat-rows');
    expect(css).not.toContain('--beat-cols');
    expect(css).toContain('--beat-h');
  });

  it('offers a vertical zoom beside the horizontal one', () => {
    const zoom = read('components/TimelineZoom.tsx');
    expect(zoom).toContain('Lane zoom, how tall a beat is drawn');
    // Absent rather than greyed where a host hands nothing down.
    expect(zoom).toContain('lane !== undefined && onLane');
  });

  it('has room to expand as well as to compress, in every module', () => {
    // One constant in the domain, so the screenplay, the stage play, the
    // series, the novel and the book are corrected together — which is what
    // *check all the modules* asks for.
    expect(ZOOM_CEILING / ZOOM_FLOOR).toBeGreaterThan(100);
    expect(ZOOM_CEILING).toBeGreaterThanOrEqual(360);
    expect(LANE_CEILING).toBeGreaterThan(LANE_FLOOR * 2);
  });

  it('draws no timeline viewer on a book, and keeps it on a script', () => {
    const app = read('App.tsx');
    // Read off the format rather than stored, which is what makes it reach a
    // machine that has already written an arrangement (§8a's own trap).
    expect(app).toContain('const noViewer = isProseFormat(file.project.format)');
    expect(app).toContain("arrangement[slot] === 'viewer'");
    // The pane rather than a slot, so a writer who has swapped the sections
    // still loses the viewer and keeps their tracks.
    expect(app).not.toContain("noViewer && slot === 'bottom'");

    expect(isProseFormat('novel')).toBe(true);
    expect(isProseFormat('instructional')).toBe(true);
    expect(isProseFormat('stage_play')).toBe(false);
    expect(isProseFormat('screenplay')).toBe(false);
  });

  it('opens the stage on the middle, under a key that reaches everybody', () => {
    const app = read('App.tsx');
    expect(app).toContain("key: shortForm ? 'sheetHeight' : 'stageSplit'");
    expect(app).toContain('initial: shortForm ? 0.68 : 0.5');
  });

  it('has no preference setting a number the board never reads', () => {
    const prefs = read('components/Preferences.tsx');
    expect(prefs).not.toContain('beatsPerColumn');
    expect(prefs).not.toContain('Cards before a new column');
  });
});
