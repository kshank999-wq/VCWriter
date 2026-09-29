import { readDocx, docxToMarkdown } from '@vcwriter/domain';
import type { NoteSourceKind } from '@vcwriter/domain';

/**
 * A file read as **a source for the Note Sorter** (addendum 26 §3).
 *
 * The split is `read-import.ts`' own and addendum 21 §2's: the host turns bytes
 * into a string and the domain decides what the string means. Here the domain
 * decides nothing at all — a source is text, immutable, and the sorting happens
 * over character offsets in it — so this is the whole of the host's part.
 *
 * **A Word document arrives as `docxToMarkdown`**, which is the audit paying
 * again: it was written for the note importer (addendum 16 §4), it marks the
 * author's own headings with `#` and separates paragraphs with a blank line,
 * and that is exactly what a page a writer is about to read and highlight
 * should look like. A second flattening here would be a second answer to *what
 * does this document say*.
 */

/** What a file became, and what kind of thing it was. */
export interface ReadSource {
  text: string;
  kind: NoteSourceKind;
}

/** The extensions the picker offers, in one place beside the reader. */
export const NOTE_SOURCE_ACCEPT = '.txt,.md,.markdown,.text,.docx,.pdf';

/**
 * Why a file cannot be read, said with the one step that fixes it.
 *
 * `pictureRefusal`'s shape (addendum 20 §16a): a refusal that names the way out
 * is one a writer can act on, and RTF is the case that needs it — nothing here
 * can lay out rich text, and a crudely stripped RTF would arrive as a page of
 * control words with the writer's sentences buried in it, which is worse than
 * being told to save it again.
 */
export const noteSourceRefusal = (name: string): string | null => {
  if (/\.(txt|md|markdown|text|docx|pdf)$/i.test(name)) return null;
  if (/\.rtf$/i.test(name)) {
    return `${name} is rich text. Save it as .docx or .txt and it comes straight in.`;
  }
  if (/\.doc$/i.test(name)) {
    return `${name} is the old Word format. Save it as .docx and it comes straight in.`;
  }
  return `${name} is not a Word document, a text file or a PDF.`;
};

export const readSourceText = async (chosen: File): Promise<ReadSource> => {
  const refusal = noteSourceRefusal(chosen.name);
  if (refusal) throw new Error(refusal);

  if (/\.docx$/i.test(chosen.name)) {
    const { readDocxParts } = await import('./read-docx');
    return { text: docxToMarkdown(readDocx(await readDocxParts(await chosen.arrayBuffer()))), kind: 'file' };
  }
  if (/\.pdf$/i.test(chosen.name)) {
    // A PDF has no paragraphs, only laid-out lines, so the paragraph is read
    // back from the vertical gaps the same way the script importer reads one.
    const { readPdfLines } = await import('./read-pdf');
    const { lines } = await readPdfLines(await chosen.arrayBuffer());
    const out: string[] = [];
    let last: { y: number; page: number } | null = null;
    for (const line of lines) {
      const text = line.text.trim();
      if (text.length === 0) continue;
      // A gap bigger than a line and a half, or a new page, is a new paragraph.
      if (last !== null && (line.page !== last.page || Math.abs(line.y - last.y) > 18)) out.push('');
      out.push(text);
      last = { y: line.y, page: line.page };
    }
    return { text: out.join('\n'), kind: 'file' };
  }
  return { text: await chosen.text(), kind: 'file' };
};
