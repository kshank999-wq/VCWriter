/**
 * A font file read into a data URI, for the book's own fonts (addendum 20
 * §6b, from Ken: *put an option to import a font … download a font, select
 * it from a browse, and add it to your fonts*).
 *
 * `readPicture`'s sibling and deliberately the same shape: **one reader**, so
 * the Book settings dialog and anything else that takes a font in cannot
 * disagree about what a file becomes. The byte count comes off the `File`
 * rather than off the data URI — base64 is a third longer than the file, and
 * a writer told their 300 KB font is 400 KB has been told about the encoding
 * rather than about their font.
 */
export const readFont = (file: File): Promise<{ data: string; bytes: number }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve({ data: String(reader.result ?? ''), bytes: file.size });
    reader.readAsDataURL(file);
  });
