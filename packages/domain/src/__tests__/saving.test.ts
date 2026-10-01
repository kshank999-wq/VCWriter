import { describe, expect, it } from 'vitest';
import {
  SAVE_KIND_WORDS,
  copyTitle,
  createProjectFile,
  describeSavedTo,
  saveOffer,
  suggestedFileName,
} from '../index.js';

/**
 * Save as, and save a copy (addendum 29 §1).
 *
 * What is worth pinning is not that a file is written — the host does that and
 * is driven rather than tested — but **that the two acts say different things
 * and that neither promises what it does not do**, since the fault being fixed
 * is a menu item whose label and act disagreed.
 */

const book = () => createProjectFile({ title: 'The Lamp', format: 'novel' });

describe('what each act says it will do', () => {
  it('names the file left behind on a save as, and the one in hand on a copy', () => {
    const as = saveOffer(book(), 'as');
    const copy = saveOffer(book(), 'copy');

    // Save as: the fear is two files where you thought there was one.
    expect(as.sentence).toContain('the old one stays where it is');
    // A copy: the fear is that the copy becomes what you are editing.
    expect(copy.sentence).toContain('carry on writing in this one');
  });

  it('refuses with a reason when nothing is open', () => {
    for (const kind of ['as', 'copy'] as const) {
      const offer = saveOffer(null, kind);
      expect(offer.allowed).toBe(false);
      expect(offer.sentence).toBe('Nothing is open to save.');
      expect(offer.suggestedName).toBe('');
    }
  });

  it('carries the label so no screen writes its own', () => {
    expect(saveOffer(book(), 'as').label).toBe(SAVE_KIND_WORDS.as);
    expect(saveOffer(book(), 'copy').label).toBe('Save a copy…');
  });
});

describe('a copy says it is one', () => {
  it('marks the copy and never the original', () => {
    expect(copyTitle('The Lamp')).toBe('The Lamp copy');
    // Save as does not touch the title at all: it is the same book elsewhere.
    expect(saveOffer(book(), 'as').suggestedName).toBe('The Lamp');
    expect(saveOffer(book(), 'copy').suggestedName).toBe('The Lamp copy');
  });

  /**
   * A copy of a copy is not *copy copy*: the second word says nothing the
   * first did not, and the writer renames it on the Home page if they want
   * to tell three apart.
   */
  it('does not stack', () => {
    expect(copyTitle('The Lamp copy')).toBe('The Lamp copy');
    expect(copyTitle('The Lamp COPY')).toBe('The Lamp COPY');
  });

  it('never answers with nothing', () => {
    expect(copyTitle('   ')).toBe('Untitled copy');
    expect(suggestedFileName('', 'as')).toBe('Untitled');
    // Only what a file name cannot carry is replaced; the extension is the
    // host's to add, since this names the document and does not build a path.
    expect(suggestedFileName('Act 2: The Lamp/Light', 'as')).toBe('Act 2_ The Lamp_Light');
    expect(suggestedFileName('The Lamp', 'as')).not.toContain('.vcw');
  });
});

describe('what it says afterwards', () => {
  /**
   * The whole of Ken's third sentence is about finding it again, so *Saved* on
   * its own is not the answer — the place is.
   */
  it('names the place, as the host gave it', () => {
    const said = describeSavedTo({ kind: 'copy', path: '/Users/ken/Books/The Lamp copy.vcw', working: false });
    expect(said).toContain('/Users/ken/Books/The Lamp copy.vcw');
    expect(said).toContain('recent list');
    expect(said).toContain('still writing in the one you were');
  });

  it('says you have moved when you have', () => {
    const said = describeSavedTo({ kind: 'as', path: 'D:\\Work\\Lamp.vcw', working: true });
    expect(said).toContain('writing in D:\\Work\\Lamp.vcw from now on');
  });
});
