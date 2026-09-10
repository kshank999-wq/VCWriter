/**
 * Getting a storyboard frame into the document (addendum 05 §3c, §4b).
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
 *
 * **A clip is the same picture, moving.** It cannot be re-encoded in a
 * browser, so it goes in as it came and brings one fact with it — its own
 * length, which the shot reads rather than asks for (§4b). Because it is not
 * scaled, it is the one thing here that can make a project file too big to
 * send, so a clip over `MAX_CLIP` is refused with a reason rather than
 * quietly swallowed.
 */

/** The longest side a frame is kept at. A storyboard is read, not projected. */
export const MAX_EDGE = 960;

/** Good enough for a board, small enough to send. */
const QUALITY = 0.82;

/**
 * The most a clip may weigh. A video cannot be shrunk on the way in, and the
 * project has to stay one document somebody can attach to an email.
 */
export const MAX_CLIP = 24 * 1024 * 1024;

export interface Frame {
  name: string;
  data: string;
  width: number;
  height: number;
  kind: 'image' | 'video';
  /** A clip's own length. Zero for a still, which has none. */
  seconds: number;
}

/** Whether a dropped or chosen file is something a plate can hold. */
export const isPicture = (file: File): boolean => file.type.startsWith('image/');

/** Whether it is the moving kind. */
export const isMoving = (file: File): boolean => file.type.startsWith('video/');

/** Either — a plate takes a still or a clip, and the sheet says which it got. */
export const isMedia = (file: File): boolean => isPicture(file) || isMoving(file);

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
 * What a clip says about itself: how long it runs, and how big it is.
 *
 * Read from the file rather than typed, because a clip's length is a fact
 * about the clip. Where the browser will not tell us — a container it can
 * hold but not measure — the length comes back as zero and the shot is timed
 * by its head, line and tail like any other.
 */
const measure = (src: string): Promise<{ seconds: number; width: number; height: number }> =>
  new Promise((resolve) => {
    const video = document.createElement('video');
    const done = (seconds: number) =>
      resolve({
        seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      });
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => resolve({ seconds: 0, width: 0, height: 0 });
    video.src = src;
  });

/**
 * A file turned into a frame the document can carry.
 *
 * Where the browser cannot draw it — no canvas, an image it will not decode —
 * the picture goes in as it came, which is worse than scaled but better than
 * refused.
 */
export const frameFrom = async (file: File): Promise<Frame> => {
  if (isMoving(file)) {
    if (file.size > MAX_CLIP) {
      throw new Error(
        `That clip is ${Math.round(file.size / (1024 * 1024))}MB. A board travels inside the project, so clips have to stay under ${Math.round(MAX_CLIP / (1024 * 1024))}MB.`,
      );
    }
    const source = await readAsDataUrl(file);
    const measured = await measure(source);
    return {
      name: file.name,
      data: source,
      width: measured.width,
      height: measured.height,
      kind: 'video',
      seconds: measured.seconds,
    };
  }

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
    if (!context) return { name: file.name, data: source, width, height, kind: 'image', seconds: 0 };
    context.drawImage(image, 0, 0, width, height);
    return {
      name: file.name,
      data: canvas.toDataURL('image/jpeg', QUALITY),
      width,
      height,
      kind: 'image',
      seconds: 0,
    };
  } catch {
    return { name: file.name, data: source, width: 0, height: 0, kind: 'image', seconds: 0 };
  }
};

/** The first picture among what was dropped, or null if none of it was one. */
export const pictureFrom = (list: FileList | null): File | null => {
  if (!list) return null;
  for (const file of Array.from(list)) if (isPicture(file)) return file;
  return null;
};

/** The first still or clip among what was dropped. A plate takes either. */
export const mediaFrom = (list: FileList | null): File | null => {
  if (!list) return null;
  for (const file of Array.from(list)) if (isMedia(file)) return file;
  return null;
};
