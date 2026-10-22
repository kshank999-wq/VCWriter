import { describe, expect, it } from 'vitest';
import {
  bandXml,
  createProjectFile,
  documentBodyXml,
  documentPrintHtml,
  fillFields,
  headerFooterCss,
  mainDocument,
  pageNumberPresetOf,
  setHeaderFooter,
  setPageNumbers,
  type ProjectFile,
} from '../index.js';

/**
 * Headers, footers and page numbers (addendum 42 §15): on paper as the page's
 * margin boxes, in Word as real header and footer parts with page fields.
 */

const start = (): ProjectFile => createProjectFile({ title: 'Notes', format: 'document' });
const doc = (file: ProjectFile) => mainDocument(file)!;
const VALUES = { title: 'Story Notes', date: '22 October 2026' };

describe('page numbers', () => {
  it('goes where the preset says, moves rather than doubles, and comes out cleanly', () => {
    let file = start();
    const id = doc(file).id;
    file = setHeaderFooter(file, id, { header: { left: '{title}' } });
    file = setPageNumbers(file, id, 'bottom-right-of');
    expect(doc(file).headerFooter.footer.right).toBe('Page {page} of {pages}');
    expect(pageNumberPresetOf(doc(file))).toBe('bottom-right-of');

    file = setPageNumbers(file, id, 'top-right');
    expect(doc(file).headerFooter.footer.right).toBe('');
    expect(doc(file).headerFooter.header).toEqual({ left: '{title}', center: '', right: '{page}' });

    file = setPageNumbers(file, id, 'none');
    expect(pageNumberPresetOf(doc(file))).toBe('none');
    // The running title stays.
    expect(doc(file).headerFooter.header.left).toBe('{title}');
  });

  it('fills fields for the screen', () => {
    expect(fillFields('{title} — Page {page} of {pages} · {date}', { page: 2, pages: 5, ...VALUES })).toBe(
      'Story Notes — Page 2 of 5 · 22 October 2026',
    );
  });
});

describe('on paper', () => {
  it('sets each slot in its margin box, with the page fields as counters', () => {
    let file = start();
    const id = doc(file).id;
    file = setHeaderFooter(file, id, { header: { left: '{title}', right: 'Draft "two"' }, footer: { center: 'Page {page} of {pages}' } });
    const css = headerFooterCss(doc(file), VALUES);
    expect(css).toContain('@top-left { content: "Story Notes";');
    expect(css).toContain('@top-right { content: "Draft \\"two\\"";');
    expect(css).toContain('@bottom-center { content: "Page " counter(page) " of " counter(pages);');
    expect(css).not.toContain('@page :first');
    expect(documentPrintHtml(doc(file), '<p>x</p>')).toContain('@bottom-center');
  });

  it('leaves the first page bare when asked, and prints nothing extra when there is nothing', () => {
    expect(headerFooterCss(doc(start()), VALUES)).toBe('');
    let file = start();
    file = setPageNumbers(file, doc(file).id, 'bottom-center');
    file = setHeaderFooter(file, doc(file).id, { firstPage: false });
    expect(headerFooterCss(doc(file), VALUES)).toContain('@page :first { @top-left { content: none; }');
  });
});

describe('in Word', () => {
  it('writes header and footer parts with page fields, and refers to them from the section', () => {
    let file = start();
    const id = doc(file).id;
    file = setHeaderFooter(file, id, { header: { center: '{title}' }, footer: { right: 'Page {page} of {pages}' }, firstPage: false });
    const footer = bandXml(doc(file), 'footer');
    expect(footer).toContain('<w:ftr ');
    expect(footer).toContain('<w:t xml:space="preserve">Page </w:t>');
    expect(footer).toContain('<w:fldSimple w:instr=" PAGE ">');
    expect(footer).toContain('<w:fldSimple w:instr=" NUMPAGES ">');
    expect(footer).toContain('<w:tab w:val="right" w:pos="9360"/>');
    const { xml } = documentBodyXml(doc(file));
    expect(xml).toContain('<w:headerReference w:type="default" r:id="rIdHeader1"/><w:footerReference w:type="default" r:id="rIdFooter1"/>');
    expect(xml).toContain('<w:titlePg/>');
    expect(documentBodyXml(doc(start())).xml).not.toContain('headerReference');
  });
});
