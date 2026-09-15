import { oneSheet, oneSheetGaps, type OneSheet } from './project-home.js';
import type { ProjectFile } from './project-file.js';

/**
 * The one-sheet as a document (master spec §4, addendum 17 §3).
 *
 * One page, and the shape of a one-sheet everybody already knows: the key art
 * down one side, the title and the logline large, the pitch and the synopsis
 * under them. It exists to be printed, exported or attached to an email, and
 * it is **assembled from the project's own fields every time it is asked for**
 * — there is nothing stored and nothing to regenerate.
 *
 * **A field the writer has not filled in is simply absent.** The alternative is
 * a page of empty headings, which looks like the software failed rather than
 * like a sheet that is not finished yet; the screen names the gaps instead,
 * where the writer can do something about them.
 */

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Blank-line-separated paragraphs, which is how a synopsis is written. */
const paragraphs = (text: string): string =>
  text
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, '<br />')}</p>`)
    .join('');

const STYLES = `
  @page { size: letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2f2f4;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #111;
  }
  .one-sheet {
    width: 8.5in;
    min-height: 11in;
    padding: 0.7in 0.75in;
    margin: 0 auto;
    background: #fff;
    display: grid;
    grid-template-columns: 2.4in minmax(0, 1fr);
    /* The art and the words take the page; the foot is held at the foot,
       where a printed page puts one. */
    grid-template-rows: 1fr auto;
    gap: 0.4in;
    align-content: stretch;
  }
  .one-art, .one-body { align-self: start; }
  /* No art is not a hole: the text simply takes the width. */
  .one-sheet.no-art { grid-template-columns: minmax(0, 1fr); }
  .one-art img { width: 100%; border: 1px solid #ddd; }
  .one-body { min-width: 0; }
  .one-standfirst {
    margin: 0 0 4pt;
    font-size: 9pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #777;
  }
  h1 { margin: 0 0 2pt; font-size: 26pt; line-height: 1.1; }
  .one-author { margin: 0 0 14pt; font-size: 11pt; color: #444; }
  .one-logline {
    margin: 0 0 16pt;
    font-size: 13.5pt;
    line-height: 1.4;
    font-style: italic;
    border-left: 2pt solid #111;
    padding-left: 10pt;
  }
  h2 {
    margin: 14pt 0 4pt;
    font-size: 9pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #777;
  }
  .one-body p { margin: 0 0 8pt; }
  .one-foot {
    grid-column: 1 / -1;
    align-self: end;
    margin-top: 18pt;
    padding-top: 8pt;
    border-top: 1px solid #ddd;
    font-size: 9pt;
    color: #777;
    display: flex;
    justify-content: space-between;
    gap: 16pt;
  }
`;

/**
 * The sheet's markup, from a plain `OneSheet` value.
 *
 * Takes the **value** rather than the file because the email route on the
 * server has to render the sheet itself: a request carrying ready-made HTML
 * would make vc-writer.com send whatever markup anybody posted to it, over its
 * own domain. Everything here is escaped, so there is no field in a sheet that
 * can carry a tag.
 *
 * `withArt` is off for email. A poster is a few hundred kilobytes of data URI,
 * which is most of a message-size limit spent on something half the clients
 * will refuse to show anyway.
 */
export const renderOneSheetBody = (sheet: OneSheet, withArt = true): string => {
  const art = withArt && sheet.poster
    ? `<aside class="one-art"><img src="${escapeHtml(sheet.poster.data)}" alt="" /></aside>`
    : '';

  const section = (heading: string, text: string): string =>
    text.trim().length > 0 ? `<h2>${escapeHtml(heading)}</h2>${paragraphs(text)}` : '';

  return (
    `<article class="one-sheet${art ? '' : ' no-art'}">` +
    art +
    '<div class="one-body">' +
    (sheet.standfirst.length > 0 ? `<p class="one-standfirst">${escapeHtml(sheet.standfirst)}</p>` : '') +
    `<h1>${escapeHtml(sheet.title)}</h1>` +
    (sheet.author.trim().length > 0 ? `<p class="one-author">${escapeHtml(sheet.author)}</p>` : '') +
    (sheet.logline.trim().length > 0 ? `<p class="one-logline">${escapeHtml(sheet.logline)}</p>` : '') +
    section('The pitch', sheet.elevatorPitch) +
    section('Synopsis', sheet.synopsis) +
    section('Notes', sheet.notes) +
    '</div>' +
    `<footer class="one-foot"><span>${escapeHtml(sheet.status)}</span>` +
    `<span>${escapeHtml(sheet.figures)}</span></footer>` +
    '</article>'
  );
};

/** The sheet, ready to print, export or save. */
export const renderOneSheetHtml = (file: ProjectFile): string => {
  const sheet = oneSheet(file);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(sheet.title)} — one-sheet</title>
<style>${STYLES}</style>
</head>
<body>
${renderOneSheetBody(sheet)}
</body>
</html>`;
};

/** The styles the body needs, for a caller embedding it somewhere of its own. */
export const ONE_SHEET_STYLES = STYLES;

/** What the file should be called when it is saved or attached. */
export const suggestedOneSheetFileName = (file: ProjectFile): string =>
  `${(file.project.title || 'Untitled').replace(/[\\/:*?"<>|]/g, '-')} — one-sheet.pdf`;

/**
 * The plain-text one-sheet, for the body of an email (§4's last bullet).
 *
 * A second rendering rather than a stripped-down HTML one, because an email
 * client that shows plain text should show something a person wrote rather
 * than a page with the tags taken out. Both come off the same `oneSheet`, so
 * they cannot disagree about what the project says.
 */
export const oneSheetText = (sheet: OneSheet): string => {
  const parts: string[] = [];

  if (sheet.standfirst.length > 0) parts.push(sheet.standfirst.toUpperCase());
  parts.push(sheet.title);
  if (sheet.author.trim().length > 0) parts.push(`by ${sheet.author}`);
  if (sheet.logline.trim().length > 0) parts.push('', sheet.logline);
  if (sheet.elevatorPitch.trim().length > 0) parts.push('', 'THE PITCH', sheet.elevatorPitch);
  if (sheet.synopsis.trim().length > 0) parts.push('', 'SYNOPSIS', sheet.synopsis);
  if (sheet.notes.trim().length > 0) parts.push('', 'NOTES', sheet.notes);
  parts.push('', `${sheet.status} · ${sheet.figures}`);

  return parts.join('\n');
};

export { oneSheet, oneSheetGaps };
