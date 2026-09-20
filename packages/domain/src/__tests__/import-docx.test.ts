import { describe, expect, it } from 'vitest';
import {
  bookBlocks,
  bookSettingsOf,
  buildProjectFromImport,
  chapterName,
  chapterPageStyleSchema,
  createProjectFile,
  geometryOf,
  manuscriptElementSchema,
  newId,
  renderBookBlock,
  type BookBlock,
  type BookRenderContext,
  type BookSettings,
  docxToImport,
  docxToLines,
  docxToMarkdown,
  docxToProse,
  docxToScript,
  opensChapter,
  beatsFrom,
  readDocx,
  readLaidOutLines,
  walkXml,
  type DocxParts,
} from '../index.js';

/**
 * Reading a Word document (addendum 21): the host unzips, the domain reads.
 * These fixtures are the XML parts a `.docx` holds, written by hand the way
 * Word writes them, so that what a paragraph *becomes* is tested with a
 * string and no zip anywhere.
 */

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

const document = (body: string): string =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}<w:sectPr/></w:body></w:document>`;

interface ParaOptions {
  style?: string;
  align?: string;
  indent?: number;
  firstLine?: number;
  face?: string;
  size?: number;
  pageBreak?: boolean;
  list?: boolean;
}

const run = (text: string, marks: { b?: boolean; i?: boolean; u?: boolean; face?: string; size?: number } = {}): string => {
  const props = [
    marks.face ? `<w:rFonts w:ascii="${marks.face}" w:hAnsi="${marks.face}"/>` : '',
    marks.b ? '<w:b/>' : '',
    marks.i ? '<w:i/>' : '',
    marks.u ? '<w:u w:val="single"/>' : '',
    marks.size ? `<w:sz w:val="${marks.size * 2}"/>` : '',
  ].join('');
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
};

const para = (content: string, options: ParaOptions = {}): string => {
  const props = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.pageBreak ? '<w:pageBreakBefore/>' : '',
    options.list ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : '',
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.indent !== undefined || options.firstLine !== undefined
      ? `<w:ind${options.indent !== undefined ? ` w:left="${Math.round(options.indent * 1440)}"` : ''}${options.firstLine !== undefined ? ` w:firstLine="${Math.round(options.firstLine * 1440)}"` : ''}/>`
      : '',
    options.face || options.size
      ? `<w:rPr>${options.face ? `<w:rFonts w:ascii="${options.face}"/>` : ''}${options.size ? `<w:sz w:val="${options.size * 2}"/>` : ''}</w:rPr>`
      : '',
  ].join('');
  const body = content.startsWith('<w:r') ? content : run(content);
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${body}</w:p>`;
};

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${W}>
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi"/><w:sz w:val="56"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi"/><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Heading1"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:sz w:val="26"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Shout"><w:name w:val="Shout"/><w:basedOn w:val="Normal"/><w:rPr><w:caps/></w:rPr></w:style>
  <w:style w:type="character" w:styleId="Emphasis"><w:name w:val="Emphasis"/><w:rPr><w:i/></w:rPr></w:style>
</w:styles>`;

const theme = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements><a:fontScheme name="Office">
  <a:majorFont><a:latin typeface="Garamond"/><a:ea typeface=""/></a:majorFont>
  <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/></a:minorFont>
</a:fontScheme></a:themeElements></a:theme>`;

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const picture = (rId: string, cx = 2857500, cy = 1905000): string =>
  `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><a:graphic><a:graphicData><pic:pic xmlns:pic="x"><pic:blipFill><a:blip r:embed="${rId}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

const novel = (): DocxParts => ({
  document: document(
    [
      para('The Lighthouse', { style: 'Title' }),
      para('by K. Shank', { align: 'center' }),
      para('Chapter One: The Road', { style: 'Heading1' }),
      para(`${run('The kettle ')}${run('would not', { i: true })}${run(' boil. She ')}${run('waited', { b: true })}${run('.')}`),
      para(run('Everything she owned was in the car.', { u: true })),
      para('Or on the road.', { face: 'Garamond', size: 14 }),
      para('The Morning', { style: 'Heading2' }),
      para('* * *', { align: 'center' }),
      para('It was not a good time to leave. It was the only time.', { style: 'Quote' }),
      picture('rId7'),
      para('First thing', { list: true }),
      para('Chapter Two', { style: 'Heading1' }),
      para('The road went north.'),
    ].join(''),
  ),
  styles,
  theme,
  rels,
  media: new Map([['word/media/image1.png', PNG]]),
});

describe('reading a Word document', () => {
  it('refuses a part with no document body', () => {
    expect(() => readDocx({ document: '<html><body>Not Word</body></html>' })).toThrow(/not a Word document/);
  });

  it('reads each paragraph with its style, its marks, its face and its size', () => {
    const doc = readDocx(novel());
    const [title, by, chapter, kettle, owned, road, morning] = doc.paragraphs;

    expect(title?.styleName).toBe('title');
    expect(title?.outline).toBe(0);
    expect(title?.align).toBe('center');
    // The theme's major face, resolved through the style.
    expect(title?.face).toBe('Garamond');
    expect(title?.size).toBe(28);

    expect(by?.plain).toBe('by K. Shank');
    // The document default: the theme's minor face at eleven point.
    expect(by?.face).toBe('Calibri');
    expect(by?.size).toBe(11);

    expect(chapter?.outline).toBe(0);
    expect(chapter?.plain).toBe('Chapter One: The Road');

    // Marks around the words, never around the spaces beside them.
    expect(kettle?.text).toBe('The kettle *would not* boil. She **waited**.');
    expect(kettle?.plain).toBe('The kettle would not boil. She waited.');
    expect(owned?.text).toBe('_Everything she owned was in the car._');

    // The paragraph's own run properties win over the style's.
    expect(road?.face).toBe('Garamond');
    expect(road?.size).toBe(14);

    // A heading 2 is based on heading 1 and inherits its face and weight.
    expect(morning?.outline).toBe(1);
    expect(morning?.face).toBe('Garamond');
    expect(morning?.size).toBe(13);
  });

  it('reads a picture through the relationships into a data URL with its size', () => {
    const doc = readDocx(novel());
    const withPicture = doc.paragraphs.find((paragraph) => paragraph.pictures.length > 0);
    expect(withPicture?.pictures[0]).toEqual({ dataUrl: PNG, width: 300, height: 200, name: 'image1.png' });
  });

  it('reads a run set in a character style, without taking the document defaults for its face', () => {
    const doc = readDocx({
      document: document(
        `<w:p>${run('She ')}<w:r><w:rPr><w:rStyle w:val="Emphasis"/></w:rPr><w:t>never</w:t></w:r>${run(' drives.')}</w:p>`,
      ),
      styles,
      theme,
    });
    expect(doc.paragraphs[0]?.text).toBe('She *never* drives.');
    // The paragraph's face is the paragraph's, not something the character style reset.
    expect(doc.paragraphs[0]?.face).toBe('Calibri');
  });

  it('turns an inherited underline off where the run says none', () => {
    const doc = readDocx({
      document: document(
        `<w:p><w:pPr><w:rPr><w:u w:val="single"/></w:rPr></w:pPr>${run('plain')}<w:r><w:rPr><w:u w:val="none"/></w:rPr><w:t> off</w:t></w:r></w:p>`,
      ),
    });
    expect(doc.paragraphs[0]?.text).toBe('_plain_ off');
  });

  it('sets a paragraph in capitals where its style says so, and counts page breaks', () => {
    const doc = readDocx({
      document: document(`${para('shouted', { style: 'Shout' })}<w:p><w:r><w:br w:type="page"/></w:r></w:p>${para('after')}`),
      styles,
    });
    expect(doc.paragraphs[0]?.plain).toBe('SHOUTED');
    expect(doc.paragraphs[0]?.caps).toBe(true);
    expect(doc.pages).toBe(2);
  });
});

describe('a Word document as a book', () => {
  it('splits chapters at the headings and keeps the title and the author', () => {
    const script = docxToProse(readDocx(novel()));
    expect(script.title).toBe('The Lighthouse');
    expect(script.author).toBe('K. Shank');
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['Chapter One: The Road', 'Chapter Two']);
    expect(script.source).toBe('docx');
  });

  it('makes each paragraph what its style made it, and keeps the face and size as data', () => {
    const script = docxToProse(readDocx(novel()));
    const first = script.scenes[0]!;
    expect(first.elements.map((element) => element.type)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
      'heading',
      'scene_break',
      'blockquote',
      'figure',
      'paragraph',
    ]);
    expect(first.elements[0]?.text).toBe('The kettle *would not* boil. She **waited**.');
    expect(first.elements[0]?.attributes).toEqual({ face: 'Calibri', size: 11 });
    expect(first.elements[2]?.attributes).toEqual({ face: 'Garamond', size: 14 });
    expect(first.elements[6]?.picture?.dataUrl).toBe(PNG);
    expect(first.elements[7]?.text).toBe('• First thing');
  });

  it('says so when there are no chapter headings, and imports the whole thing as one', () => {
    const script = docxToProse(readDocx({ document: document(`${para('One.')}${para('Two.')}`) }));
    expect(script.scenes).toHaveLength(1);
    expect(script.scenes[0]?.elements).toHaveLength(2);
    expect(script.warnings.join(' ')).toMatch(/No chapter headings/);
  });

  it('opens a chapter on a heading, on "Chapter N", or on a page break with a short centred line', () => {
    const base = {
      text: '',
      plain: '',
      styleId: '',
      styleName: '',
      outline: null,
      align: 'left' as const,
      indentLeft: 0,
      firstLine: 0,
      face: null,
      size: null,
      caps: false,
      pageBreakBefore: false,
      list: false,
      pictures: [],
    };
    expect(opensChapter({ ...base, plain: 'Anything', text: 'Anything', outline: 0 })).toBe(true);
    expect(opensChapter({ ...base, plain: 'Chapter Twenty-One', text: 'Chapter Twenty-One' })).toBe(true);
    expect(opensChapter({ ...base, plain: 'PART II', text: 'PART II' })).toBe(true);
    expect(opensChapter({ ...base, plain: 'Part of the plan was to wait.', text: 'Part of the plan was to wait.' })).toBe(false);
    expect(opensChapter({ ...base, plain: 'Winter', text: 'Winter', pageBreakBefore: true, align: 'center' })).toBe(true);
    expect(opensChapter({ ...base, plain: 'Winter came slowly that year.', text: 'Winter came slowly that year.', pageBreakBefore: true })).toBe(false);
  });

  it('names a chapter marker by what follows the number, since the number is derived', () => {
    expect(chapterName('Chapter One: The Road')).toBe('The Road');
    expect(chapterName('Chapter 3')).toBe('');
    expect(chapterName('PART II — Winter')).toBe('Winter');
    expect(chapterName('The Road')).toBe('The Road');
  });
});

describe('a Word document as a script', () => {
  // A screenplay typed in Word: sluglines at the margin, dialogue indented an
  // inch, cues centred, transitions to the right.
  const screenplay = (): DocxParts => ({
    document: document(
      [
        para('INT. SANCHEZ HOME - KITCHEN - MORNING'),
        para('He waits for the kettle.'),
        para('MAEVE', { align: 'center' }),
        para('(not looking up)', { indent: 1.5 }),
        para('You were out.', { indent: 1 }),
        para('LUIS', { align: 'center' }),
        para('For a while.', { indent: 1 }),
        para('MAEVE', { align: 'center' }),
        para('Not tonight.', { indent: 1 }),
        para('CUT TO:', { align: 'right' }),
        para('EXT. HARBOUR - NIGHT'),
        para('Rain on the water.'),
      ].join(''),
    ),
  });

  it('lays each paragraph out by its indent so the PDF reader can read it', () => {
    const lines = docxToLines(readDocx(screenplay()));
    expect(lines[0]?.x).toBe(72);
    expect(lines[2]?.x).toBeCloseTo(72 + 2.2 * 72);
    expect(lines[4]?.x).toBe(144);
    expect(lines[9]?.x).toBe(72 + 3.5 * 72);
    // Each paragraph on its own line, never rejoined with the one above.
    expect(new Set(lines.map((line) => line.y)).size).toBe(lines.length);
  });

  it('classifies a Word screenplay the way a PDF is classified', () => {
    const script = docxToScript(readDocx(screenplay()));
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['INT. SANCHEZ HOME - KITCHEN - MORNING', 'EXT. HARBOUR - NIGHT']);
    expect(script.scenes[0]?.elements.map((element) => element.type)).toEqual([
      'action',
      'character',
      'parenthetical',
      'dialogue',
      'character',
      'dialogue',
      'character',
      'dialogue',
      'transition',
    ]);
    expect(script.characters.map((person) => person.name)).toEqual(['MAEVE', 'LUIS']);
    expect(script.source).toBe('docx');
    expect(script.warnings.join(' ')).not.toMatch(/PDF/);
    // The same reading the PDF path gives, through the same lines.
    expect(readLaidOutLines(docxToLines(readDocx(screenplay()))).scenes).toHaveLength(2);
  });

  it('reads by geometry for a script and by headings for a book', () => {
    const doc = readDocx(screenplay());
    expect(docxToImport(doc, 'screenplay').scenes).toHaveLength(2);
    expect(docxToImport(doc, 'novel').scenes).toHaveLength(1);
  });
});

describe('building a project from a Word document', () => {
  it('makes a novel with a chapter marker per heading, the settings kept and the picture in the library', () => {
    const script = docxToProse(readDocx(novel()));
    const built = buildProjectFromImport(script, { format: 'novel' });
    const { file } = built;

    expect(file.project.title).toBe('The Lighthouse');
    expect(file.project.author).toBe('K. Shank');
    expect(file.project.notes).toMatch(/Imported from a Word document/);
    expect(file.units.map((unit) => unit.title)).toEqual(['Chapter One: The Road', 'Chapter Two']);

    // A chapter heading is a marker, not a line of the manuscript.
    expect(file.markers.map((marker) => marker.title)).toEqual(['The Road', '']);
    expect(file.markers.every((marker) => marker.kind === 'chapter')).toBe(true);
    // The section arrives as passages now (§10): read them together.
    const elements = file.beats.flatMap((beat) => beat.manuscript.elements);
    expect(elements.some((element) => element.type === 'scene_heading')).toBe(false);

    // The face and size travel into the element.
    expect(elements[2]?.attributes).toEqual({ face: 'Garamond', size: 14 });

    // The picture is one asset, named by the figure.
    expect(file.assets).toHaveLength(1);
    expect(file.assets[0]?.data).toBe(PNG);
    expect(file.assets[0]?.width).toBe(300);
    const figure = elements.find((element) => element.type === 'figure');
    expect(figure?.attributes.assetId).toBe(file.assets[0]?.id);
  });

  it('makes a screenplay with sluglines and no markers', () => {
    const doc = readDocx({
      document: document(`${para('INT. ROOM - DAY')}${para('A room.')}${para('MAEVE', { align: 'center' })}${para('Hello.', { indent: 1 })}`),
    });
    const { file } = buildProjectFromImport(docxToImport(doc, 'screenplay'), { format: 'screenplay' });
    expect(file.markers).toHaveLength(0);
    expect(file.beats[0]?.manuscript.elements[0]?.type).toBe('scene_heading');
  });
});

describe('a Word document as notes', () => {
  it('writes the headings as markdown so the note importer splits on them', () => {
    const markdown = docxToMarkdown(readDocx(novel()));
    expect(markdown).toContain('# The Lighthouse');
    expect(markdown).toContain('# Chapter One: The Road');
    expect(markdown).toContain('## The Morning');
    expect(markdown).toContain('- First thing');
    expect(markdown).toContain('The kettle *would not* boil.');
  });
});

describe('the XML walker', () => {
  it('reports a self-closing tag as an open and a close, skips comments, and unescapes text', () => {
    const seen: string[] = [];
    walkXml('<a x="1 &amp; 2"><!-- no --><b/>Hi &lt;there&gt;<![CDATA[<raw>]]></a>', {
      open: (tag) => seen.push(`+${tag.name}${tag.attributes['x'] ? `[${tag.attributes['x']}]` : ''}`),
      close: (name) => seen.push(`-${name}`),
      text: (chunk) => seen.push(`"${chunk}"`),
    });
    expect(seen).toEqual(['+a[1 & 2]', '+b', '-b', '"Hi <there>"', '"<raw>"', '-a']);
  });
});

describe('the book set as imported', () => {
  const contextFor = (face: 'imported' | 'old_style') => {
    const file = createProjectFile({ title: 'Set', format: 'novel' });
    const settings = { ...bookSettingsOf(file), face } as BookSettings;
    return {
      settings,
      geometry: geometryOf(settings, 'novel', 100),
      chapterStyle: chapterPageStyleSchema.parse({}),
      paragraphStyle: 'indented' as const,
      pictures: new Map(),
      names: { title: 'Set', author: 'K. Shank', imprint: '' },
      titlePage: null,
      contents: [],
      index: null,
    } as unknown as BookRenderContext;
  };
  const paragraph = (extra: Partial<BookBlock>): BookBlock => ({
    id: 'p1',
    kind: 'paragraph',
    numbering: 'arabic',
    starts: 'none',
    display: false,
    folio: true,
    keepWithNext: false,
    unbreakable: false,
    text: 'Words.',
    spans: [],
    chapterTitle: '',
    ...extra,
  });

  it('sets a paragraph in the face and size the document gave it, snapped to whole lines', () => {
    const html = renderBookBlock(paragraph({ face: 'Garamond', size: 24, align: 'center' }), contextFor('imported'));
    expect(html).toContain("font-family:'Garamond',");
    expect(html).toContain('font-size:32.000px');
    // Twenty-four point on eleven-point type is three lines of the book's leading.
    expect(html).toContain('line-height:calc(var(--bk-lead) * 3)');
    expect(html).toContain('text-align:center');
  });

  it('keeps only the alignment under any other face', () => {
    const html = renderBookBlock(paragraph({ face: 'Garamond', size: 24, align: 'center' }), contextFor('old_style'));
    expect(html).not.toContain('font-family');
    expect(html).not.toContain('font-size');
    expect(html).toContain('text-align:center');
  });

  it('reads the face, the size and the alignment off the element into the block', () => {
    let file = createProjectFile({ title: 'Set', format: 'novel' });
    const beat = file.beats[0]!;
    file = {
      ...file,
      beats: [
        {
          ...beat,
          manuscript: {
            elements: [
              manuscriptElementSchema.parse({ id: newId(), type: 'paragraph', text: 'Plain.' }),
              manuscriptElementSchema.parse({ id: newId(), type: 'paragraph', text: 'Set.', attributes: { face: 'Garamond', size: 14, align: 'right' } }),
            ],
          },
        },
      ],
    };
    const blocks = bookBlocks(file).filter((block) => block.kind === 'paragraph');
    expect(blocks[0]?.face).toBeUndefined();
    expect(blocks[1]).toMatchObject({ face: 'Garamond', size: 14, align: 'right' });
  });
});

describe('a manuscript with typed page numbers and bare labels (§10)', () => {
  const body = (words: number, seed: string) => Array.from({ length: words }, (_, i) => `${seed}${i}`).join(' ');

  it('drops the page numbers that count up a page apart, and keeps the chapter numbers that do not', () => {
    const doc = document(
      [
        para('One', { align: 'center' }),
        para(body(300, 'a')),
        para('1', { align: 'center' }),
        para(body(300, 'b')),
        para('2', { align: 'center' }),
        para(body(300, 'c')),
        para('3'),
        para('Two'),
        para(body(300, 'd')),
        para('4', { align: 'center' }),
        para(body(50, 'e')),
      ].join(''),
    );
    const read = readDocx({ document: doc });
    const script = docxToProse(read);
    expect(script.warnings.some((warning) => /4 typed page numbers were left out/.test(warning))).toBe(true);
    // Two chapters, labelled One and Two, and no chapter called 3.
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['One', 'Two']);
    const texts = script.scenes.flatMap((scene) => scene.elements.map((element) => element.text));
    expect(texts.some((text) => /^[0-9]+$/.test(text))).toBe(false);
    // The words on either side of a page number are still there.
    expect(texts.some((text) => text.startsWith('b0 '))).toBe(true);
  });

  it('reads a numeral, a roman numeral or a number word alone on a line as a chapter, centred or not', () => {
    const base = { text: '', plain: '', styleId: '', styleName: '', outline: null, align: 'left' as const, indentLeft: 0, firstLine: 0, face: null, size: null, caps: false, pageBreakBefore: false, list: false, pictures: [] };
    for (const label of ['II', '3', '3.', 'Seven', 'Twenty-one', 'twelve']) {
      expect(opensChapter({ ...base, plain: label, text: label }), label).toBe(true);
    }
    expect(opensChapter({ ...base, plain: 'Seven ships', text: 'Seven ships' })).toBe(false);
    // Three chapters numbered 1, 2, 3 with a chapter's worth of words between are chapters, not pages.
    const doc = document([para('1'), para(body(1200, 'a')), para('2'), para(body(1200, 'b')), para('3'), para(body(1200, 'c'))].join(''));
    const script = docxToProse(readDocx({ document: doc }));
    expect(script.scenes.map((scene) => scene.heading)).toEqual(['1', '2', '3']);
    expect(script.warnings.some((warning) => /page numbers/.test(warning))).toBe(false);
  });

  it('builds a bare label into a chapter whose number is derived and whose title is empty, a beat per paragraph', () => {
    const doc = document(
      [para('One', { align: 'center' }), para(body(500, 'a')), para(body(500, 'b')), para('* * *', { align: 'center' }), para(body(100, 'c')), para('Two'), para(body(30, 'd'))].join(''),
    );
    const built = buildProjectFromImport(docxToProse(readDocx({ document: doc })), { format: 'novel' });
    expect(built.file.markers.map((marker) => marker.title)).toEqual(['', '']);
    const first = built.file.units.find((unit) => unit.id === built.file.markers[0]!.unitId)!;
    const beats = built.file.beats.filter((beat) => beat.unitId === first.id);
    // A beat per paragraph; the scene break rides at the end of the one before it.
    expect(beats.map((beat) => beat.manuscript.elements.map((element) => element.type))).toEqual([['paragraph'], ['paragraph', 'scene_break'], ['paragraph']]);
    expect(beats[0]?.title).toBe('a0 a1 a2 a3 a4 a5…');
  });
});

describe('beats from a section’s elements', () => {
  const p = (text: string) => ({ id: newId(), type: 'paragraph' as const, text, characterId: null, attributes: {} });
  const brk = () => ({ id: newId(), type: 'scene_break' as const, text: '', characterId: null, attributes: {} });
  const h = (text: string) => ({ id: newId(), type: 'heading' as const, text, characterId: null, attributes: {} });

  it('makes a beat of every paragraph, a heading opening the beat after it and a break ending the one before', () => {
    const cut = beatsFrom([p('The lamp had been in the family longer than anyone said.'), p('She had never trusted the wiring.'), brk(), h('Later'), p('It was dark.'), p('Then it was not.')]);
    expect(cut.map((beat) => beat.elements.map((element) => element.type))).toEqual([
      ['paragraph'],
      ['paragraph', 'scene_break'],
      ['heading', 'paragraph'],
      ['paragraph'],
    ]);
    expect(cut[0]?.title).toBe('The lamp had been in the…');
    expect(cut[2]?.title).toBe('Later');
    // A break before anything opens the first beat rather than being lost.
    expect(beatsFrom([brk(), p('a')]).map((beat) => beat.elements.map((element) => element.type))).toEqual([['scene_break'], ['paragraph']]);
    expect(beatsFrom([])).toEqual([{ elements: [], title: '' }]);
  });
});
