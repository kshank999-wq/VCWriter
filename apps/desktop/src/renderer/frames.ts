/**
 * Getting a storyboard frame into the document (addendum 05 §3c).
 *
 * A frame arrives from a drawing, a photograph or a still, and it goes into
 * the project file as a data URI so it travels with the document. Which means
 * it has to be **made the right size on the way in**: what a board needs is a
 * legible frame, not the twelve megapixels somebody's camera produced, and a
 * file with forty of those in it is a file nobody can send.
 *
 * Scaled to fit a box no bigger than `MAX_EDGE` on its longest side and
 * encoded as JPEG, which is what a photograph or a pencil scan wants. The
 * original is never kept: the board is the deliverable, not the archive.
 */

/** The longest side a frame is kept at. A storyboard is read, not projected. */
export const MAX_EDGE = 960;

/** Good enough for a board, small enough to send. */
const QUALITY = 0.82;

export interface Frame {
  name: string;
  data: string;
  width: number;
  height: number;
}

/** Whether a dropped or chosen file is something a plate can hold. */
export const isPicture = (file: File): boolean => file.type.startsWith('image/');

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('The picture could not be read'));
    reader.readAsDataURL(file);
  });

const load = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That does not look like a picture'));
    image.src = src;
  });

/**
 * A file turned into a frame the document can carry.
 *
 * Where the browser cannot draw it — no canvas, an image it will not decode —
 * the picture goes in as it came, which is worse than scaled but better than
 * refused.
 */
export const frameFrom = async (file: File): Promise<Frame> => {
  const source = await readAsDataUrl(file);
  try {
    const image = await load(source);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { name: file.name, data: source, width, height };
    context.drawImage(image, 0, 0, width, height);
    return { name: file.name, data: canvas.toDataURL('image/jpeg', QUALITY), width, height };
  } catch {
    return { name: file.name, data: source, width: 0, height: 0 };
  }
};

/** The first picture among what was dropped, or null if none of it was one. */
export const pictureFrom = (list: FileList | null): File | null => {
  if (!list) return null;
  for (const file of Array.from(list)) if (isPicture(file)) return file;
  return null;
};
