/**
 * A picture file read into a data URI and its own dimensions, for the
 * graphics library (addendum 16 §9). The size is read from the picture
 * rather than asked for: a figure's height on the page follows from its
 * aspect ratio, and a plate's from the trim. One reader for the library
 * panel, the Layout room's plate and anywhere else a picture comes in, so
 * they cannot disagree about what a file becomes.
 */
import { isVectorPicture, readPdfPicture, vectorRefusal } from './read-vector';

/**
 * A file this reader cannot make a picture of, with the fix named (§16a).
 * Null means it can — either the browser decodes it or pdf.js draws it.
 */
export const pictureRefusal = (file: File): string | null => {
  if (isVectorPicture(file)) return null;
  const said = vectorRefusal(file);
  if (said) return said;
  return file.type.startsWith('image/') ? null : 'That is not a picture file.';
};

export const readPicture = (file: File): Promise<{ data: string; width: number; height: number }> => {
  // A PDF is **drawn once, here** (§16a), so what the library keeps is an
  // ordinary picture and nothing downstream learns that PDFs exist. It is in
  // this reader rather than beside it because this file's own promise is to
  // be the one place a file becomes a picture.
  if (isVectorPicture(file)) return readPdfPicture(file);
  return readRaster(file);
};

const readRaster = (file: File): Promise<{ data: string; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const data = String(reader.result ?? '');
      if (typeof Image === 'undefined') {
        resolve({ data, width: 0, height: 0 });
        return;
      }
      const image = new Image();
      let settled = false;
      const settle = (width: number, height: number) => {
        if (settled) return;
        settled = true;
        resolve({ data, width, height });
      };
      image.onload = () => settle(image.naturalWidth, image.naturalHeight);
      image.onerror = () => settle(0, 0);
      image.src = data;
      // A host that never decodes the picture (a test runner, a format the
      // browser cannot read) must not hold the file up: the size is a
      // nicety the figure falls back from, and the picture is what matters.
      // A real browser has fired one of the two long before this.
      setTimeout(() => settle(0, 0), 400);
    };
    reader.readAsDataURL(file);
  });

/**
 * What a file picker offers (§16a). One constant rather than `image/*` typed
 * into a dozen `accept` attributes — nine of them were already there, and a
 * picker that refuses what the reader accepts is a control that lies.
 */
export const PICTURE_ACCEPT = 'image/*,application/pdf';
