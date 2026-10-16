import { describe, expect, it } from 'vitest';
import {
  buildDocx,
  createProjectFile,
  docxDocumentXml,
  exportsDocx,
  notedCast,
  setTitlePage,
  suggestedDocxFileName,
  updateBeat,
  type ProjectFile,
  type ScriptFormat,
} from '../index.js';

/**
 * **A Word document, a paragraph style per element** (addendum 38 §7, the
 * spec's §8).
 */

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const play = (scriptFormat: ScriptFormat, ...elements: ReturnType<typeof el>[]): ProjectFile => {
  const file = createProjectFile({ title: 'The Lamp & Co', format: 'stage_play' });
  const set = { ...file, settings: { ...file.settings, scriptFormat } };
  return notedCast(updateBeat(set, set.beats[0]!.id, { manuscript: { elements } }));
};

const paragraphs = (xml: string): { style: string; text: string }[] =>
  [...xml.matchAll(/<w:p>(.*?)<\/w:p>/g)].map((match) => ({
    style: /<w:pStyle w:val="([^"]+)"/.exec(match[1] ?? '')?.[1] ?? '',
    text: [...(match[1] ?? '').matchAll(/<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\/>/g)].map((one) => one[1] ?? '\t').join(''),
  }));

describe('which formats export', () => {
  it('is every script and no book', () => {
    expect(exportsDocx('stage_play')).toBe(true);
    expect(exportsDocx('screenplay')).toBe(true);
    expect(exportsDocx('novel')).toBe(false);
  });
});

describe('the document', () => {
  it('gives every line the style of what it is, and the words exactly as written', () => {
    const file = play(
      'stage_us_musical',
      el('scene_heading', 'Scene One'),
      el('character', 'Sarah'),
      el('dialogue', 'You came.'),
      el('song_title', 'Out of the Rain'),
      el('character', 'Sarah'),
      el('lyric', 'Out of the rain\nand into the light'),
    );
    const body = paragraphs(docxDocumentXml(file, { includeTitlePage: false, includeCastPage: false }));
    expect(body.map((one) => one.style)).toEqual([
      'SceneHeading',
      'Character',
      'Dialogue',
      'SongTitle',
      'Character',
      'Lyric',
    ]);
    // Capitals are the style's, never retyped: what was written goes in.
    expect(body[1]?.text).toBe('Sarah');
  });

  it('writes no blank line inside a speech, and the blank before every other block as space', () => {
    const xml = docxDocumentXml(play('stage_us_modern', el('action', 'Rain.'), el('character', 'Sarah'), el('dialogue', 'Well.')), {
      includeTitlePage: false,
      includeCastPage: false,
    });
    const dialogue = /<w:p><w:pPr><w:pStyle w:val="Dialogue"\/>(.*?)<\/w:pPr>/.exec(xml)?.[1];
    expect(dialogue).toBe('<w:spacing w:before="0"/>');
    expect(xml).not.toMatch(/<w:p><w:pPr><w:pStyle w:val="Action"\/><\/w:pPr><\/w:p>/);
  });

  it('sets a cue beside its speech with a tab and a hanging indent, never spaces', () => {
    const xml = docxDocumentXml(play('stage_uk_bbc', el('character', 'Sarah'), el('dialogue', 'You came.')), {
      includeTitlePage: false,
      includeCastPage: false,
    });
    const body = paragraphs(xml);
    expect(body).toEqual([{ style: 'Dialogue', text: 'SARAH\tYou came.' }]);
    expect(xml).toContain('w:hanging=');
    expect(xml).not.toContain('SARAH  ');
  });

  it('drops a cue too long for the margin onto a paragraph of its own', () => {
    const body = paragraphs(
      docxDocumentXml(play('stage_uk_bbc', el('character', 'The Second Gravedigger'), el('dialogue', 'Well.')), {
        includeTitlePage: false,
        includeCastPage: false,
      }),
    );
    expect(body).toEqual([
      { style: 'Character', text: 'THE SECOND GRAVEDIGGER' },
      { style: 'Dialogue', text: 'Well.' },
    ]);
  });

  it('opens with the title page and the cast page, in a section of their own', () => {
    const file = setTitlePage(play('stage_us_modern', el('character', 'Sarah'), el('dialogue', 'Well.')), {
      author: 'Jane Doe',
      descriptor: 'A Play in One Act',
    });
    const xml = docxDocumentXml(file);
    const all = paragraphs(xml);
    expect(all[0]).toEqual({ style: 'TitlePageTitle', text: 'The Lamp &amp; Co' });
    expect(all.some((one) => one.style === 'CastHeading' && one.text === 'Characters')).toBe(true);
    // Two sections: the front, unnumbered, and the script counting from one.
    expect(xml.match(/<w:sectPr>/g)).toHaveLength(2);
    expect(xml).toContain('<w:pgNumType w:start="1"/>');
  });

  it('is cut from the layout’s paper', () => {
    const a4 = docxDocumentXml(play('stage_uk_bbc'));
    expect(a4).toContain('<w:pgSz w:w="11906" w:h="16838"/>');
    const letter = docxDocumentXml(play('stage_us_modern'));
    // Letter, with the 1.5" binding edge the sixty-character column leaves.
    expect(letter).toContain('<w:pgSz w:w="12240" w:h="15840"/>');
    expect(letter).toContain('w:left="2160"');
  });
});

describe('the file', () => {
  it('is a zip with a Word document and its styles in it', async () => {
    const bytes = await buildDocx(play('stage_us_modern', el('action', 'Rain.')));
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
    const names = new TextDecoder('latin1').decode(bytes);
    for (const part of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) {
      expect(names).toContain(part);
    }
    expect(suggestedDocxFileName(play('stage_us_modern'))).toBe('The Lamp  Co.docx');
  });
});
