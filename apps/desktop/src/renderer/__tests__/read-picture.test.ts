import { describe, expect, it } from 'vitest';
import { PICTURE_ACCEPT, pictureRefusal } from '../read-picture';
import { isVectorPicture, vectorRefusal } from '../read-vector';

/**
 * **What may become a picture** (addendum 20 §16a, from Ken: *the ISBN
 * barcode needs to be able to import a PDF, because that's how it's exported
 * from the actual vendor. Or an EPS file*).
 *
 * One reading rather than the nine hand-written `startsWith('image/')` gates
 * that were here: a gate written beside the reader goes on refusing what the
 * reader has learned to draw. And a format we cannot draw is **refused with
 * the fix named**, since a stored EPS would come out as an empty box in the
 * preview, the printed book and the eBook alike.
 */

const file = (name: string, type: string): File => new File([new Uint8Array([1, 2, 3])], name, { type });

describe('what may become a picture', () => {
  it('takes a PDF, which is how a vendor sends a barcode', () => {
    expect(pictureRefusal(file('barcode.pdf', 'application/pdf'))).toBeNull();
    expect(isVectorPicture(file('barcode.pdf', 'application/pdf'))).toBe(true);
    // Named rather than typed: some hosts hand over a PDF with no type.
    expect(isVectorPicture(file('BARCODE.PDF', ''))).toBe(true);
  });

  it('takes the pictures it always took', () => {
    expect(pictureRefusal(file('cover.png', 'image/png'))).toBeNull();
    expect(pictureRefusal(file('mark.svg', 'image/svg+xml'))).toBeNull();
  });

  it('refuses an EPS by saying what to do about it', () => {
    const said = pictureRefusal(file('barcode.eps', 'application/postscript'));
    expect(said).toMatch(/save it as a PDF/i);
    // The kinds we recognise and cannot draw each name the one-step fix,
    // rather than all reading "that is not a picture file".
    expect(vectorRefusal(file('art.ai', ''))).toMatch(/PDF/);
    expect(vectorRefusal(file('art.ps', ''))).toMatch(/PDF/);
  });

  it('still refuses what is not artwork at all', () => {
    expect(pictureRefusal(file('notes.txt', 'text/plain'))).toBe('That is not a picture file.');
  });

  it('offers in the picker exactly what the reader accepts', () => {
    // A picker that refuses what the reader takes is a control that lies.
    expect(PICTURE_ACCEPT).toBe('image/*,application/pdf');
  });
});
