import { describe, expect, it } from 'vitest';
import { describeProjectFolder, freeName, suggestedFileName } from '../index.js';

/**
 * Where new projects go (addendum 34).
 *
 * Two things are worth pinning here and neither is the folder itself, which is
 * the host's. The first is that **nothing already in it is replaced** — the
 * one rule about this a writer would not forgive being wrong once, the file in
 * that folder being somebody's book. The second is that the sentence under the
 * row has **two states and no third**, because a host that keeps no folders
 * has to say so rather than leave the row out: a panel that quietly omitted it
 * reads as the feature not being there.
 */

describe('a name nothing already there answers to', () => {
  const folder = (...names: string[]) => (candidate: string) => names.includes(candidate);

  it('is the name asked for where nothing has it', () => {
    expect(freeName('The Lamp', folder(), '.vcw')).toBe('The Lamp.vcw');
  });

  it('numbers rather than replacing', () => {
    expect(freeName('The Lamp', folder('The Lamp.vcw'), '.vcw')).toBe('The Lamp 2.vcw');
    expect(freeName('The Lamp', folder('The Lamp.vcw', 'The Lamp 2.vcw'), '.vcw')).toBe('The Lamp 3.vcw');
  });

  it('numbers before the extension, where a file name carries its number', () => {
    expect(freeName('The Lamp', folder('The Lamp.vcw'), '.vcw')).not.toContain('.vcw 2');
  });

  it('is the rule the browser library already used, so both hosts ask one', () => {
    // `pathFor` numbered its own keys this way before there was a desktop
    // folder to name a file in; this is that rule said once.
    const taken = new Set(['browser://The Lamp.vcw']);
    expect(freeName('browser://The Lamp', (one) => taken.has(one), '.vcw')).toBe('browser://The Lamp 2.vcw');
  });

  it('works with no suffix at all', () => {
    expect(freeName('Folder', folder('Folder'))).toBe('Folder 2');
  });

  it('names the file from the title the writer typed', () => {
    expect(suggestedFileName('The Lamp & the Lighthouse', 'as')).toBe('The Lamp _ the Lighthouse');
    expect(suggestedFileName('   ', 'as')).toBe('Untitled');
  });
});

describe('what the panel says under the folder', () => {
  it('names a cloud drive as what it is — a folder', () => {
    const said = describeProjectFolder({ path: '/Users/ken/Dropbox/Scripts', canChoose: true });
    expect(said).toMatch(/cloud drive/i);
    expect(said).toMatch(/Dropbox/);
    // The promise that makes the act safe is on the screen, not only in code.
    expect(said).toMatch(/nothing already in the folder is replaced/i);
  });

  it('says where they go instead where there are no folders', () => {
    // The browser. Said rather than left out (addendum 09 §15).
    const said = describeProjectFolder({ path: null, canChoose: false });
    expect(said).toMatch(/browser/i);
    expect(said).not.toMatch(/cloud drive/i);
  });
});
