import { parseInline } from './entities/inline.js';
import type { ManuscriptElement } from './entities/manuscript.js';
import { splitByline, titlePageOf, type TitlePage } from './entities/title-page.js';
import { castPageOf, castRoleLine, printsCastPage, type CastPageContent } from './cast-page.js';
import { placedMarkers } from './markers.js';
import { layoutForFile, unitElements, type ManuscriptOptions, type PageLayoutSpec } from './pagination.js';
import { isProseFormat } from './formats.js';
import { unitsInStoryOrder } from './selectors.js';
import type { ProjectFile } from './project-file.js';
import { writeZip } from './zip-write.js';

/**
 * **A Word document, a paragraph style per element** (addendum 38 §7, Ken's
 * spec §8).
 *
 * A theatre, a competition or a publisher asks for a play as a `.docx` as
 * often as a PDF, and what makes one usable rather than merely openable is
 * that **every line carries the style of what it is** — a cue is *Character*,
 * a speech is *Dialogue*, a lyric is *Lyric* — so a literary manager can
 * restyle the whole thing at once, and a production office can pull every
 * line of one style out of it.
 *
 * **Geometry from the same layout the print reads** (`layoutForFile`): each
 * style's indent and width are the layout's columns at ten characters to the
 * inch, its capitals are Word's own *all caps* rather than retyped text — so
 * the writer's words go into the file exactly as written — and a centred cue
 * is centred. The page is the layout's paper with its margins worked back
 * from the column.
 *
 * Word paginates for itself. What this file carries is everything the
 * paginator's two rules need to come out the same: *keep with next* on a
 * heading, a cue and a wryly, and the blank line between blocks written as
 * the space before a paragraph — none inside a speech — rather than as empty
 * paragraphs, which is what a document someone else will edit should have.
 *
 * Where the cue sits beside its speech (`cueBeside`), it is the speech
 * paragraph's own first word on a **hanging indent and a tab**, never padded
 * with spaces — the spec's own prohibition — and a name too long for the
 * margin is a paragraph of its own above, `attachCue`'s rule.
 */

/** Twips: twentieths of a point. Ten characters to the inch at 12pt Courier. */
const TWIPS_PER_INCH = 1440;
const TWIPS_PER_CHAR = TWIPS_PER_INCH / 10;
/** One line at six to the inch. */
const LINE = 240;

/** Whether the format exports as a Word script: a script, and not a book. */
export const exportsDocx = (format: ProjectFile['project']['format']): boolean => !isProseFormat(format);

/** What each element type is called as a Word style — the name a writer sees. */
const STYLE_NAMES: Record<string, string> = {
  scene_heading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  song_title: 'Song Title',
  lyric: 'Lyric',
  music_cue: 'Music Cue',
  dance: 'Dance',
};

const styleId = (type: string): string => (STYLE_NAMES[type] ?? 'General').replace(/\s+/g, '');

/** XML text, with what XML cannot carry at all taken out. */
const xml = (text: string): string =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** One run of text; a line break inside it is Word's own break. */
const run = (text: string, style: { bold?: boolean; italic?: boolean; underline?: boolean } = {}): string => {
  const props =
    (style.bold ? '<w:b/>' : '') + (style.italic ? '<w:i/>' : '') + (style.underline ? '<w:u w:val="single"/>' : '');
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : '';
  return text
    .split('\n')
    .map((part, at) => `<w:r>${rPr}${at > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(part)}</w:t></w:r>`)
    .join('');
};

/** The written line's runs, its bold and italic kept. */
const runsOf = (text: string): string => parseInline(text).map((span) => run(span.text, span)).join('');

/** A paragraph in a style, with its own space before where it differs. */
const paragraph = (style: string, body: string, extra = ''): string =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extra}</w:pPr>${body}</w:p>`;

const spaceBefore = (lines: number): string => `<w:spacing w:before="${lines * LINE}"/>`;

/** The page's margins, worked back from the layout's column. */
const pageOf = (layout: PageLayoutSpec) => {
  const a4 = layout.paper === 'a4';
  const width = a4 ? 11906 : 12240;
  const height = a4 ? 16838 : 15840;
  const column = layout.columns * TWIPS_PER_CHAR;
  const right = TWIPS_PER_INCH;
  const left = Math.max(TWIPS_PER_INCH, width - right - column);
  return { width, height, left, right, column, top: TWIPS_PER_INCH, bottom: TWIPS_PER_INCH };
};

const stylesXml = (layout: PageLayoutSpec): string => {
  const types = Object.keys(STYLE_NAMES).filter((type) => layout.indent[type] !== undefined || type === 'general');
  const elementStyles = types
    .map((type) => {
      const indent = layout.indent[type] ?? 0;
      // Beside its speech a cue's width is the margin's; set as a paragraph
      // of its own — the long cue — it has the whole line (addendum 38 §6).
      const width = layout.cueBeside && type === 'character' ? layout.columns : (layout.width[type] ?? layout.columns);
      const right = Math.max(0, layout.columns - indent - width);
      const keep = type === 'scene_heading' || type === 'character' || type === 'parenthetical' ? '<w:keepNext/>' : '';
      const centred = layout.centred?.has(type) ? '<w:jc w:val="center"/>' : '';
      const doubled = layout.doubleSpacedTypes?.has(type) ? 480 : LINE;
      const caps = layout.uppercase.has(type) ? '<w:rPr><w:caps/></w:rPr>' : '';
      return (
        `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${styleId(type)}">` +
        `<w:name w:val="${STYLE_NAMES[type]}"/><w:basedOn w:val="Normal"/><w:qFormat/>` +
        `<w:pPr>${keep}<w:spacing w:before="${LINE}" w:after="0" w:line="${doubled}" w:lineRule="auto"/>` +
        `<w:ind w:left="${indent * TWIPS_PER_CHAR}" w:right="${right * TWIPS_PER_CHAR}"/>${centred}</w:pPr>${caps}</w:style>`
      );
    })
    .join('');
  const front = (id: string, name: string, pPr: string, rPr = '') =>
    `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/>` +
    `<w:basedOn w:val="Normal"/><w:pPr>${pPr}</w:pPr>${rPr}</w:style>`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>' +
    '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault>' +
    `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${LINE}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    elementStyles +
    front('TitlePageTitle', 'Title Page Title', '<w:jc w:val="center"/>', '<w:rPr><w:b/><w:caps/><w:sz w:val="48"/></w:rPr>') +
    front('TitlePageLine', 'Title Page Line', '<w:jc w:val="center"/>') +
    front('TitlePageFoot', 'Title Page Foot', '') +
    front('CastHeading', 'Cast Heading', `<w:jc w:val="center"/><w:spacing w:after="${LINE * 2}"/>`, '<w:rPr><w:caps/><w:u w:val="single"/></w:rPr>') +
    front('CastRole', 'Cast Role', `<w:spacing w:after="${LINE}"/><w:ind w:left="${3 * TWIPS_PER_CHAR}" w:hanging="${3 * TWIPS_PER_CHAR}"/>`) +
    front('CastLine', 'Cast Line', `<w:spacing w:before="${LINE}"/>`) +
    front('ActHeading', 'Act Heading', `<w:jc w:val="center"/><w:keepNext/><w:spacing w:after="${LINE}"/>`, '<w:rPr><w:caps/><w:u w:val="single"/></w:rPr>') +
    front('PageNumber', 'Page Number', '<w:jc w:val="right"/>') +
    '</w:styles>'
  );
};

const PAGE_BREAK = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/** The title page, as paragraphs: the same lines `renderTitleSheet` prints. */
const titlePageXml = (page: TitlePage): string => {
  const line = (text: string, before = 0) =>
    text.trim().length > 0 ? paragraph('TitlePageLine', run(text), before ? spaceBefore(before) : '') : '';
  const credit = (words: string, name: string, before: number) => {
    const { lead, by } = splitByline(words);
    return line(lead, before) + line(by, lead ? 0 : before) + line(name);
  };
  const foot = [page.contact, page.draftDate, page.revision, page.notes]
    .filter((one) => one.trim().length > 0)
    .map((one, at) => paragraph('TitlePageFoot', run(one.trim()), at === 0 ? spaceBefore(12) : ''))
    .join('');
  return (
    paragraph('TitlePageTitle', run(page.title || 'Untitled'), spaceBefore(16)) +
    line(page.episode, 1) +
    line(page.descriptor, 1) +
    (page.author ? credit(page.byline || 'Written by', page.author, 4) : '') +
    page.credits.map((one) => credit(one.role, one.name, 2)).join('') +
    line(page.source, 3) +
    (page.sourceAuthor ? line('by') + line(page.sourceAuthor) : '') +
    foot
  );
};

/** The cast page, as paragraphs: the same page `renderCastSheet` prints. */
const castPageXml = (page: CastPageContent): string =>
  paragraph('CastHeading', run(page.heading)) +
  page.roles
    .map((role) => {
      const line = castRoleLine(role);
      return paragraph('CastRole', run(role.name) + (line ? run(`, ${line}`) : ''));
    })
    .join('') +
  (page.doubling.length > 0
    ? paragraph('CastLine', run('DOUBLING')) +
      page.doubling.map((chain) => paragraph('TitlePageFoot', run(chain.join(' / ')))).join('')
    : '') +
  (page.time ? paragraph('CastLine', run(`TIME: ${page.time}`)) : '') +
  (page.place ? paragraph('CastLine', run(`PLACE: ${page.place}`)) : '') +
  (page.notes ? paragraph('CastLine', run(page.notes)) : '');

/** The script itself: a paragraph per element, in the paginator's order. */
const bodyXml = (file: ProjectFile, layout: PageLayoutSpec, options: ManuscriptOptions): string => {
  const acts = new Map(
    placedMarkers(file)
      .filter((placed) => placed.marker.kind === 'act')
      .map((placed) => [placed.marker.unitId as string, placed.label]),
  );
  const out: string[] = [];
  let previous: ManuscriptElement | null = null;
  let cue: ManuscriptElement | null = null;

  const emit = (element: ManuscriptElement, body: string, beside = false) => {
    const follows = previous !== null && (layout.follows?.[element.type]?.has(previous.type) ?? false) && !beside;
    const blanks =
      previous === null || follows
        ? 0
        : element.type === 'scene_heading' && layout.blanksBeforeHeading
          ? layout.blanksBeforeHeading
          : 1;
    const indent = layout.indent[element.type] ?? 0;
    // The cue in the margin: a hanging indent back to the page's edge, and a
    // tab to the speech's column — never spaces (addendum 37 §3).
    const hang = beside
      ? `<w:tabs><w:tab w:val="left" w:pos="${indent * TWIPS_PER_CHAR}"/></w:tabs>` +
        `<w:ind w:left="${indent * TWIPS_PER_CHAR}" w:hanging="${indent * TWIPS_PER_CHAR}"/>`
      : '';
    const spacing = blanks === 1 ? '' : spaceBefore(blanks);
    out.push(paragraph(styleId(element.type), body, hang + spacing));
    previous = element;
  };

  const units = unitsInStoryOrder(file).filter((unit) => unit.inScript);
  units.forEach((unit, index) => {
    const act = acts.get(unit.id as string);
    if (act) {
      // An act starts on a page of its own where the play breaks for one.
      out.push(paragraph('ActHeading', run(act), out.length > 0 ? '<w:pageBreakBefore/>' : ''));
      previous = null;
    }
    for (const element of unitElements(file, unit.id, options, String(index + 1))) {
      if (element.text.trim().length === 0) continue;
      if (layout.cueBeside && element.type === 'character') {
        cue = element;
        continue;
      }
      if (cue) {
        const name = cue.text.trim().toUpperCase();
        const margin = layout.indent[element.type] ?? 0;
        if (name.length < margin) {
          emit(element, run(name) + '<w:r><w:tab/></w:r>' + runsOf(element.text), true);
          cue = null;
          continue;
        }
        // Too long for the margin: its own paragraph above (addendum 38 §6).
        emit(cue, run(name));
        cue = null;
      }
      emit(element, runsOf(element.text));
    }
  });
  if (cue) emit(cue, run((cue as ManuscriptElement).text.trim().toUpperCase()));
  return out.join('');
};

export interface DocxOptions extends ManuscriptOptions {
  includeTitlePage?: boolean;
  includeCastPage?: boolean;
  includePageNumbers?: boolean;
}

/** The document's XML: the front pages, then the script, on the layout's paper. */
export const docxDocumentXml = (file: ProjectFile, options: DocxOptions = {}): string => {
  const layout = layoutForFile(file);
  const page = pageOf(layout);
  const fronts = [
    options.includeTitlePage === false ? '' : titlePageXml(titlePageOf(file.project, file.settings)),
    options.includeCastPage !== false && printsCastPage(file) ? castPageXml(castPageOf(file)) : '',
  ].filter((one) => one.length > 0);
  const numbers = options.includePageNumbers !== false;
  const geometry =
    `<w:pgSz w:w="${page.width}" w:h="${page.height}"/>` +
    `<w:pgMar w:top="${page.top}" w:right="${page.right}" w:bottom="${page.bottom}" w:left="${page.left}" ` +
    `w:header="720" w:footer="720" w:gutter="0"/>`;
  /*
    The front pages are a section of their own, with no header: a title page
    and a cast page take no number, and the script counts from one after them
    as the printed one does. The script's section numbers from 1 and leaves
    its first page bare, `pageNumber`'s rule in the print.
  */
  const front =
    fronts.length > 0 ? fronts.join(PAGE_BREAK) + `<w:p><w:pPr><w:sectPr>${geometry}</w:sectPr></w:pPr></w:p>` : '';
  const sectPr =
    '<w:sectPr>' +
    (numbers ? '<w:headerReference w:type="default" r:id="rIdHeader"/>' : '') +
    geometry +
    '<w:pgNumType w:start="1"/>' +
    (numbers ? '<w:titlePg/>' : '') +
    '</w:sectPr>';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<w:body>${front}${bodyXml(file, layout, options)}${sectPr}</w:body></w:document>`
  );
};

const HEADER_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:p><w:pPr><w:pStyle w:val="PageNumber"/></w:pPr>' +
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>' +
  '<w:r><w:t>.</w:t></w:r></w:p></w:hdr>';

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
  '</Relationships>';

const DOCUMENT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '<Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
  '</Relationships>';

const coreXml = (file: ProjectFile): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
  'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
  `<dc:title>${xml(file.project.title || 'Untitled')}</dc:title>` +
  `<dc:creator>${xml(file.project.author ?? '')}</dc:creator>` +
  '</cp:coreProperties>';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);

/** The whole `.docx`, as bytes. */
export const buildDocx = async (file: ProjectFile, options: DocxOptions = {}): Promise<Uint8Array> =>
  writeZip([
    { path: '[Content_Types].xml', data: utf8(CONTENT_TYPES) },
    { path: '_rels/.rels', data: utf8(ROOT_RELS) },
    { path: 'word/_rels/document.xml.rels', data: utf8(DOCUMENT_RELS) },
    { path: 'word/document.xml', data: utf8(docxDocumentXml(file, options)) },
    { path: 'word/styles.xml', data: utf8(stylesXml(layoutForFile(file))) },
    { path: 'word/header1.xml', data: utf8(HEADER_XML) },
    { path: 'docProps/core.xml', data: utf8(coreXml(file)) },
  ]);

export const suggestedDocxFileName = (file: ProjectFile): string => {
  const base = (file.project.title || 'Untitled').replace(/[^\w\-. ]+/g, '').trim() || 'Untitled';
  return `${base}.docx`;
};

export const DOCX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
