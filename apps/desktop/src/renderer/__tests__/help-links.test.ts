import { describe, expect, it } from 'vitest';
import { guideFor, guideUrl } from '../help-links';
import { menusFor } from '../menus';

/** Help ▸ Guide for this screen (addendum 35 §9). */
describe('the guide for this screen', () => {
  it('starts at getting started with nothing open', () => {
    expect(guideFor({ format: null, view: 'write' })).toBe('getting-started');
  });

  it('is the module guide on the Write page', () => {
    expect(guideFor({ format: 'screenplay', view: 'write' })).toBe('screenplay');
    expect(guideFor({ format: 'short_story', view: 'write' })).toBe('short-stories');
    expect(guideFor({ format: 'stage_play', view: 'write' })).toBe('stage-play');
  });

  it('is the room in front, before the page', () => {
    expect(guideFor({ format: 'novel', view: 'preview', research: true })).toBe('research');
    expect(guideFor({ format: 'novel', view: 'write', research: true, layout: true })).toBe('layout');
    expect(guideFor({ format: 'screenplay', view: 'write', sculptor: true })).toBe('story-sculptor');
  });

  it('follows the page', () => {
    expect(guideFor({ format: 'novel', view: 'preview' })).toBe('preview');
    expect(guideFor({ format: 'novel', view: 'editor' })).toBe('editors');
    expect(guideFor({ format: 'instructional', view: 'outline' })).toBe('outliner');
    expect(guideFor({ format: 'novel', view: 'readback' })).toBe('read-back');
  });

  it('is the word processor in a document', () => {
    expect(guideFor({ format: 'document', view: 'write' })).toBe('document');
  });

  it('links to the site', () => {
    expect(guideUrl('research')).toBe('https://vc-writer.com/help/research');
    expect(guideUrl(null)).toBe('https://vc-writer.com/help');
  });

  it('is in the Help menu with F1', () => {
    const help = menusFor(null).find((menu) => menu.label === 'Help')!;
    const item = help.items.find((one) => one?.command === 'help.guide');
    expect(item?.label).toBe('Guide for this screen');
    expect(item?.accelerator).toBe('F1');
  });
});
