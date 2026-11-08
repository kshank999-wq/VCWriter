import { parseInline } from './entities/inline.js';
import { titlePageOf } from './entities/title-page.js';
import { bookBlocks, partsOf, type BookBlock } from './book-plan.js';
import { bookNames, bookSettingsOf } from './book-layout.js';
import { sectionIdOf } from './book-pages.js';
import { footTextFor, headTextFor, sectionLayoutOf, type RunningNames } from './running-heads.js';
import type { BookSettings, HeadPlace, SectionLayout } from './entities/book.js';
import { bibliographyHeadingOf, bookCitationsOf, referenceBibliography, type BookCitations } from './citation-style.js';
import { citationSettingsOf } from './citations.js';
import type { CitationSettings } from './entities/reference.js';
import type { ProjectFile } from './project-file.js';
import { writeZip } from './zip-write.js';

/**
 * **A book as a Word document** (addendum 43 §9, phase 3).
 *
 * The script's Word export (`docx-export.ts`) is a script's: Courier, the
 * page's columns, one style per element. A book went nowhere in Word at all,
 * and a book that cites goes to an editor, a press or a university as a
 * `.docx` more often than as anything else. So this is the manuscript of the
 * book as Word expects one: Times at twelve on a Letter page, a chapter on a
 * new page under a heading Word's own navigation lists, the front and back
 * matter the book has, and **Word's own footnotes** — real ones, numbered by
 * Word, so an editor's added note renumbers the rest as it would in any
 * manuscript.
 *
 * - **Chicago and Custom**: each marker is a `w:footnoteReference` and its
 *   note is in `footnotes.xml`, the first citation of a source in full and
 *   the rest short, as the book prints them. Word numbers them in the book's
 *   scheme (1, 2, 3; a, b, c; or *, †, ‡) and, where the book counts per
 *   chapter, starts again at each chapter, which needs a section per chapter.
 * - **APA and MLA**: the parenthetical in the line, and no notes.
 * - **The bibliography** is the back matter's page where the book has one,
 *   made from the library as Layout makes it; where it has none and the
 *   library has entries, it is added at the end under the style's heading.
 *
 * Pictures, the contents page and the index are left out: a manuscript's
 * pictures travel as files beside it, Word builds its own contents, and an
 * index is page numbers this document does not have.
 */

const TWIPS_PER_INCH = 1440;
const LINE = 276;

const xml = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

type Style = { bold?: boolean; italic?: boolean; underline?: boolean };

const run = (text: string, style: Style = {}): string => {
  if (text.length === 0) return '';
  const props = (style.bold ? '<w:b/>' : '') + (style.italic ? '<w:i/>' : '') + (style.underline ? '<w:u w:val="single"/>' : '');
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : '';
  return text
    .split('\n')
    .map((part, at) => `<w:r>${rPr}${at > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(part)}</w:t></w:r>`)
    .join('');
};

/** Words in the inline marks, with no citations in them: a note's own text, a heading. */
const marked = (text: string): string => parseInline(text).map((span) => run(span.text, span)).join('');

const paragraph = (style: string, body: string, extra = ''): string =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${body}</w:p>`;

const PAGE_BREAK_BEFORE = '<w:pageBreakBefore/>';

/** Word's numbering for the book's markers. Its *chicago* format is *, †, ‡, § and then doubled. */
const NUMBER_FORMAT: Record<CitationSettings['markers'], string> = {
  numeric: 'decimal',
  alpha: 'lowerLetter',
  symbol: 'chicago',
};

/** The notes collected as the text is written, numbered in the order Word will meet them. */
interface Notes {
  cites: BookCitations | null;
  /** Word's footnote ids, from 1, each with its note's text. */
  made: { id: number; text: string }[];
}

/**
 * A block's words, with its citations: a footnote reference in a footnote
 * style, the parenthetical in APA and MLA. Each reference is its own note in
 * Word, even where a key was pasted twice, because Word numbers references
 * rather than sources.
 */
const words = (text: string, notes: Notes): string => {
  const spans = parseInline(text);
  let before = '';
  return spans
    .map((span) => {
      if (span.citation === undefined) {
        if (span.text.length > 0) before = span.text;
        return run(span.text, span);
      }
      const cites = notes.cites;
      const said = cites?.inText.get(span.citation);
      if (!cites || !said) return '';
      if (cites.raised) {
        const note = cites.notes.get(span.citation);
        if (!note) return '';
        const id = notes.made.length + 1;
        notes.made.push({ id, text: note.text });
        return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
      }
      const gap = before.length > 0 && !/[\s([“‘—–-]$/.test(before) ? ' ' : '';
      before = said;
      return run(gap) + marked(said);
    })
    .join('');
};

/** One block, in Word. Null for what a manuscript leaves out. */
const blockXml = (block: BookBlock, notes: Notes, title: { title: string; author: string }, breakBefore: string): string | null => {
  switch (block.kind) {
    case 'half_title':
    case 'contents':
    case 'index':
    case 'figure':
    case 'plate':
    case 'blank':
      return null;
    case 'title_page':
      return (
        paragraph('Title', run(title.title), breakBefore) +
        (title.author ? paragraph('Subtitle', run(title.author)) : '')
      );
    case 'copyright': {
      const lines = block.text.split('\n').filter((line) => line.trim().length > 0);
      if (lines.length === 0) return null;
      return lines.map((line, at) => paragraph('Copyright', marked(line), at === 0 ? PAGE_BREAK_BEFORE : '')).join('');
    }
    case 'part_opening': {
      if (block.display) {
        const lines = block.text.split('\n').filter((line) => line.trim().length > 0);
        if (lines.length === 0) return null;
        return lines.map((line, at) => paragraph('Centred', words(line, notes), at === 0 ? PAGE_BREAK_BEFORE : '')).join('');
      }
      return paragraph('Heading1', run(block.title ?? ''), breakBefore);
    }
    case 'chapter_opening': {
      const label = block.chapter?.label ?? '';
      const name = block.chapter?.title ?? block.title ?? '';
      const heading = label && name ? `${run(label)}<w:r><w:br/></w:r>${run(name)}` : run(name || label);
      const epigraph = (block.chapter?.epigraph ?? '').trim();
      return paragraph('Heading1', heading, breakBefore) + (epigraph ? paragraph('Quote', marked(epigraph)) : '');
    }
    case 'heading':
      return block.starts !== 'none'
        ? paragraph('Heading1', words(block.text, notes), breakBefore)
        : paragraph('Heading2', words(block.text, notes));
    case 'blockquote':
      return paragraph('Quote', words(block.text, notes));
    case 'scene_break':
      return paragraph('Centred', run('*'));
    case 'paragraph': {
      if (block.text.trim().length === 0) return null;
      const lead = block.lead ? run(`${block.lead.text} `, { bold: block.lead.style === 'bold', italic: block.lead.style === 'italic' }) : '';
      const style = block.role === 'source' ? 'Bibliography' : block.opensChapter || block.role ? 'FirstParagraph' : 'BodyText';
      return paragraph(style, lead + words(block.text, notes));
    }
    default:
      return null;
  }
};

// --------------------------------------------------------- headers, footers

/** A header or a footer part, by its file name, and the XML in it. */
interface BandPart {
  name: string;
  kind: 'header' | 'footer';
  xml: string;
}

/** Where a head's words sit on a side: centred, or at the outer or inner edge. */
const alignFor = (place: HeadPlace, side: 'verso' | 'recto'): string => {
  if (place === 'centre') return 'center';
  const outer = side === 'verso' ? 'left' : 'right';
  const inner = side === 'verso' ? 'right' : 'left';
  return place === 'outside' ? outer : inner;
};

const field = (code: string, shown: string): string =>
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
  `<w:r><w:instrText xml:space="preserve"> ${code} </w:instrText></w:r>` +
  `<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>${shown}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;

/**
 * Words with the page's own fields, as Word's own fields (addendum 43 §10):
 * *{page}* is PAGE, *{pages}* NUMPAGES and *{date}* DATE, so Word fills them
 * as it lays the pages, as the Layout room does.
 */
const bandRuns = (text: string): string =>
  text
    .split(/(\{page\}|\{pages\}|\{date\})/)
    .map((piece) => {
      if (piece === '{page}') return field('PAGE', '1');
      if (piece === '{pages}') return field('NUMPAGES', '1');
      if (piece === '{date}') return field('DATE \\@ "d MMMM yyyy"', '1 January 2026');
      return run(piece);
    })
    .join('');

const bandParagraph = (body: string, align: string, style: string): string =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/><w:jc w:val="${align}"/></w:pPr>${body}</w:p>`;

const bandXml = (kind: 'header' | 'footer', paragraphs: string): string => {
  const tag = kind === 'header' ? 'w:hdr' : 'w:ftr';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${paragraphs || '<w:p/>'}</${tag}>`
  );
};

/** What a division is, for its section: what its heads read, and how it is numbered. */
interface Section {
  /** The front matter takes no heads and no foot, as the printed book's title and copyright pages take none. */
  front: boolean;
  chapterTitle: string;
  layout: SectionLayout | null;
  /** Whether Word's numbering starts again here, and in what. */
  restart: boolean;
  roman: boolean;
}

/**
 * **Where a section ends** (Word's `sectPr`): the page, the division's own
 * headers and footers — a left-hand and a right-hand one, and a first page
 * of its own where the opening stands clear of them — its numbering, and the
 * footnotes'. Each band is made once and shared by every section that prints
 * the same words.
 */
const sectionXml = (
  section: Section,
  book: BookSettings,
  cites: CitationSettings,
  names: RunningNames,
  band: (kind: 'header' | 'footer', xml: string) => string,
): string => {
  const refs: string[] = [];
  let titlePg = false;
  if (!section.front) {
    const footStyle = 'Footer';
    const folioAt = book.folio;
    const page = (side: 'verso' | 'recto', align: string) => (folioAt === 'none' ? '' : bandParagraph(field('PAGE', '1'), align, footStyle));
    const sides = (['recto', 'verso'] as const).map((side) => {
      const head = headTextFor(side, book, names, section.chapterTitle, section.layout);
      const foot = footTextFor(book, names, section.chapterTitle, section.layout);
      const outer = alignFor('outside', side);
      const header =
        (head ? bandParagraph(bandRuns(head), alignFor(book.runningHeads.place, side), 'Header') : '') +
        (folioAt === 'head_outside' ? page(side, outer) : '');
      const footer =
        (foot ? bandParagraph(bandRuns(foot), alignFor(book.runningHeads.footPlace, side), footStyle) : '') +
        (folioAt === 'foot_outside' ? page(side, outer) : folioAt === 'foot_centre' ? page(side, 'center') : '');
      return { header, footer };
    });
    const [recto, verso] = sides as [{ header: string; footer: string }, { header: string; footer: string }];
    refs.push(`<w:headerReference w:type="default" r:id="${band('header', recto.header)}"/>`);
    refs.push(`<w:headerReference w:type="even" r:id="${band('header', verso.header)}"/>`);
    refs.push(`<w:footerReference w:type="default" r:id="${band('footer', recto.footer)}"/>`);
    refs.push(`<w:footerReference w:type="even" r:id="${band('footer', verso.footer)}"/>`);
    // The opening page clear of the heads and the foot, but for its number
    // where the book shows one there (spec §6's first-page-different).
    if (!section.layout?.headsOnOpening) {
      titlePg = true;
      const number = book.folio !== 'none' && book.folioOnOpening ? bandParagraph(field('PAGE', '1'), 'center', footStyle) : '';
      refs.push(`<w:headerReference w:type="first" r:id="${band('header', '')}"/>`);
      refs.push(`<w:footerReference w:type="first" r:id="${band('footer', number)}"/>`);
    }
  } else {
    // Bare bands, so the front matter does not inherit the body's.
    for (const type of ['default', 'even', 'first'] as const) {
      refs.push(`<w:headerReference w:type="${type}" r:id="${band('header', '')}"/>`);
      refs.push(`<w:footerReference w:type="${type}" r:id="${band('footer', '')}"/>`);
    }
  }
  const format = section.roman ? 'lowerRoman' : 'decimal';
  return (
    '<w:sectPr>' +
    refs.join('') +
    `<w:footnotePr><w:numFmt w:val="${NUMBER_FORMAT[cites.markers]}"/>` +
    `<w:numRestart w:val="${cites.restartEach === 'chapter' ? 'eachSect' : 'continuous'}"/></w:footnotePr>` +
    '<w:type w:val="nextPage"/>' +
    '<w:pgSz w:w="12240" w:h="15840"/>' +
    `<w:pgMar w:top="${TWIPS_PER_INCH}" w:right="${TWIPS_PER_INCH}" w:bottom="${TWIPS_PER_INCH}" w:left="${TWIPS_PER_INCH}" w:header="720" w:footer="720" w:gutter="0"/>` +
    `<w:pgNumType w:fmt="${format}"${section.restart ? ' w:start="1"' : ''}/>` +
    (titlePg ? '<w:titlePg/>' : '') +
    '</w:sectPr>'
  );
};

/** The document, its notes, and its header and footer parts, as XML. */
export const bookDocxParts = (file: ProjectFile): { document: string; footnotes: string; noteCount: number; bands: BandPart[] } => {
  const settings = citationSettingsOf(file);
  const book = bookSettingsOf(file);
  const notes: Notes = { cites: bookCitationsOf(file), made: [] };
  const page = titlePageOf(file.project, file.settings);
  const title = { title: page.title || file.project.title || 'Untitled', author: (file.project.author ?? '').trim() };
  const names = bookNames(file);

  const bands: BandPart[] = [];
  const byXml = new Map<string, string>();
  const band = (kind: 'header' | 'footer', paragraphs: string): string => {
    const xml = bandXml(kind, paragraphs);
    const key = `${kind}:${xml}`;
    const known = byXml.get(key);
    if (known) return known;
    const count = bands.filter((one) => one.kind === kind).length + 1;
    const id = `rId${kind === 'header' ? 'Header' : 'Footer'}${count}`;
    bands.push({ name: `${kind}${count}.xml`, kind, xml });
    byXml.set(key, id);
    return id;
  };

  /**
   * **A section per division** (addendum 43 §10): the front matter one, and
   * each chapter, part and page-opening heading its own, so each can carry
   * its own heads, stand its first page clear of them and restart its
   * numbers — which is how Word does what the Layout room does.
   */
  const body: string[] = [];
  let section: Section | null = null;
  let sawBody = false;
  const close = (next: Section) => {
    if (section) body.push(`<w:p><w:pPr>${sectionXml(section, book, settings, names, band)}</w:pPr></w:p>`);
    section = next;
  };
  const opening = (id: string | null, chapterTitle: string): Section => {
    const layout = sectionLayoutOf(book, id);
    const roman = layout?.numbering === 'roman';
    // The body's first section starts at 1 whatever the front matter ran to.
    const restart = !sawBody || (layout?.restart ?? false);
    sawBody = true;
    return { front: false, chapterTitle, layout, restart, roman };
  };
  for (const block of bookBlocks(file)) {
    const id = sectionIdOf(block);
    const front = block.numbering === 'roman';
    if (section === null) {
      section = front ? { front: true, chapterTitle: '', layout: null, restart: true, roman: true } : opening(id, block.chapterTitle);
    } else if (!front && (id !== null || (section as Section).front)) {
      close(opening(id, block.chapterTitle || block.title || ''));
    }
    const fresh = body.length === 0 || body[body.length - 1]!.includes('<w:sectPr>');
    const out = blockXml(block, notes, title, fresh ? '' : PAGE_BREAK_BEFORE);
    if (out) body.push(out);
  }
  // The bibliography, where the book has no page for it and the library has entries.
  if (!partsOf(file).some((part) => part.kind === 'bibliography')) {
    const entries = referenceBibliography(file);
    if (entries.length > 0) {
      const heading = bibliographyHeadingOf(settings);
      close(opening(null, heading));
      body.push(paragraph('Heading1', run(heading)));
      for (const entry of entries) body.push(paragraph('Bibliography', marked(entry.text)));
    }
  }
  const last = section ?? { front: false, chapterTitle: '', layout: null, restart: true, roman: false };
  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<w:body>${body.join('')}${sectionXml(last, book, settings, names, band)}</w:body></w:document>`;
  const footnotes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:footnote w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:footnote>' +
    '<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>' +
    notes.made
      .map(
        (note) =>
          `<w:footnote w:id="${note.id}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr>` +
          '<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>' +
          `${run(' ')}${marked(note.text)}</w:p></w:footnote>`,
      )
      .join('') +
    '</w:footnotes>';
  return { document, footnotes, noteCount: notes.made.length, bands };
};

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>' +
  '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>' +
  `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${LINE * 2}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:firstLine="432"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:customStyle="1" w:styleId="FirstParagraph"><w:name w:val="First Paragraph"/><w:basedOn w:val="BodyText"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:ind w:firstLine="0"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Subtitle"/><w:qFormat/><w:pPr><w:spacing w:before="2880" w:after="480"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="52"/><w:szCs w:val="52"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="FirstParagraph"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="1440" w:after="480"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="FirstParagraph"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="240" w:line="276" w:lineRule="auto"/><w:ind w:left="720" w:right="720"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Centred"><w:name w:val="Centred"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:customStyle="1" w:styleId="Copyright"><w:name w:val="Copyright"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="276" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Bibliography"><w:name w:val="Bibliography"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="240" w:line="276" w:lineRule="auto"/><w:ind w:left="720" w:hanging="720"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:i/><w:sz w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:line="240" w:lineRule="auto"/></w:pPr></w:style>' +
  '</w:styles>';

/** Word's settings: the separators the footnotes need, and a left-hand and a right-hand header. */
const SETTINGS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:evenAndOddHeaders/>' +
  '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>' +
  '</w:settings>';

const contentTypes = (bands: readonly BandPart[]): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
  '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' +
  bands.map((one) => `<Override PartName="/word/${one.name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${one.kind}+xml"/>`).join('') +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  '</Relationships>';

const documentRels = (bands: readonly BandPart[]): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '<Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
  '<Relationship Id="rIdFootnotes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' +
  bands
    .map((one) => {
      const id = `rId${one.kind === 'header' ? 'Header' : 'Footer'}${one.name.replace(/\D/g, '')}`;
      return `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${one.kind}" Target="${one.name}"/>`;
    })
    .join('') +
  '</Relationships>';

const coreXml = (file: ProjectFile): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
  `<dc:title>${xml(file.project.title || 'Untitled')}</dc:title>` +
  `<dc:creator>${xml(file.project.author ?? '')}</dc:creator>` +
  '</cp:coreProperties>';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The book as a `.docx`, its citations as Word footnotes. */
export const buildBookDocx = async (file: ProjectFile): Promise<Uint8Array> => {
  const parts = bookDocxParts(file);
  return writeZip([
    { path: '[Content_Types].xml', data: utf8(contentTypes(parts.bands)) },
    { path: '_rels/.rels', data: utf8(ROOT_RELS) },
    { path: 'word/_rels/document.xml.rels', data: utf8(documentRels(parts.bands)) },
    { path: 'word/document.xml', data: utf8(parts.document) },
    { path: 'word/styles.xml', data: utf8(STYLES) },
    { path: 'word/settings.xml', data: utf8(SETTINGS) },
    { path: 'word/footnotes.xml', data: utf8(parts.footnotes) },
    ...parts.bands.map((one) => ({ path: `word/${one.name}`, data: utf8(one.xml) })),
    { path: 'docProps/core.xml', data: utf8(coreXml(file)) },
  ]);
};
