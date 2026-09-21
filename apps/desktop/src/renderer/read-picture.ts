/**
 * A picture file read into a data URI and its own dimensions, for the
 * graphics library (addendum 16 §9). The size is read from the picture
 * rather than asked for: a figure's height on the page follows from its
 * aspect ratio, and a plate's from the trim. One reader for the library
 * panel, the Layout room's plate and anywhere else a picture comes in, so
 * they cannot disagree about what a file becomes.
 */
export const readPicture = (file: File): Promise<{ data: string; width: number; height: number }> =>
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
