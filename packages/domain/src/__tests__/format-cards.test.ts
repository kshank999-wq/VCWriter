import { describe, expect, it } from 'vitest';
import { FORMAT_CARDS, formatCardDetail, formatCardName, startableFormatCards } from '../format-cards.js';

/**
 * The module cards, shared by the desktop's New project screen and the site's
 * module chooser (addendum 35 §7).
 */
describe('the module cards', () => {
  it('offers the eight modules a project starts in, without the game', () => {
    expect(startableFormatCards().map((card) => card.value)).toEqual([
      'screenplay',
      'series',
      'novel',
      'instructional',
      'stage_play',
      'short_story',
      'short_form',
      'document',
    ]);
    expect(FORMAT_CARDS.some((card) => card.value === 'game')).toBe(true);
  });

  it('names each card and says what it holds', () => {
    const novel = FORMAT_CARDS.find((card) => card.value === 'novel')!;
    expect(formatCardName(novel)).toBe('Novel');
    expect(formatCardDetail(novel)).toBe('Chapters and passages, manuscript formatting');
    const document = FORMAT_CARDS.find((card) => card.value === 'document')!;
    expect(formatCardDetail(document)).toMatch(/^A word processor/);
  });
});
