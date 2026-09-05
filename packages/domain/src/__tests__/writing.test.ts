import { describe, expect, it } from 'vitest';
import { cycleType, defaultElementType, elementTypesFor, typeOnEnter } from '../editing.js';
import { renderPrintDocumentHtml, printedPageCount, suggestedExportFileName } from '../print-html.js';
import { createProjectFile } from '../project-file.js';
import { updateBeat } from '../mutations.js';
import { newId } from '../ids.js';
import type { ManuscriptElement, ManuscriptElementType } from '../entities/manuscript.js';
import type { ManuscriptElementId } from '../ids.js';

const element = (type: ManuscriptElementType, text: string): ManuscriptElement => ({
  id: newId<ManuscriptElementId>(),
  type,
  text,
  characterId: null,
  attributes: {},
});

describe('element flow while writing', () => {
  it('follows the screenplay convention on Return', () => {
    expect(typeOnEnter('screenplay', 'scene_heading')).toBe('action');
    expect(typeOnEnter('screenplay', 'action')).toBe('action');
    expect(typeOnEnter('screenplay', 'character')).toBe('dialogue');
    expect(typeOnEnter('screenplay', 'parenthetical')).toBe('dialogue');
    expect(typeOnEnter('screenplay', 'dialogue')).toBe('action');
    expect(typeOnEnter('screenplay', 'transition')).toBe('scene_heading');
  });

  it('keeps prose in paragraphs on Return', () => {
    expect(typeOnEnter('novel', 'paragraph')).toBe('paragraph');
    expect(typeOnEnter('novel', 'heading')).toBe('paragraph');
    expect(defaultElementType('novel')).toBe('paragraph');
  });

  it('cycles forward and backward through the element ring on Tab', () => {
    expect(cycleType('screenplay', 'action')).toBe('character');
    expect(cycleType('screenplay', 'character')).toBe('parenthetical');
    expect(cycleType('screenplay', 'action', -1)).toBe('scene_heading');
    // The ring is closed in both directions.
    expect(cycleType('screenplay', 'shot')).toBe('scene_heading');
    expect(cycleType('screenplay', 'scene_heading', -1)).toBe('shot');
  });

  it('offers the element set that belongs to the format', () => {
    expect(elementTypesFor('screenplay')).toContain('parenthetical');
    expect(elementTypesFor('novel')).toContain('paragraph');
    expect(elementTypesFor('novel')).not.toContain('parenthetical');
  });
});

describe('printable document', () => {
  const script = (title = 'Lighthouse') => {
    let file = createProjectFile({ title, format: 'screenplay', author: 'K. Shank' });
    return updateBeat(file, file.beats[0]!.id, {
      title: 'She confronts him',
      manuscript: {
        elements: [
          element('scene_heading', 'INT. LIGHTHOUSE - NIGHT'),
          element('action', 'Rain hammers the glass.'),
        ],
      },
    });
  };

  it('opens with a title page carrying the title and author', () => {
    const html = renderPrintDocumentHtml(script());
    expect(html).toContain('class="page title-page"');
    expect(html).toContain('Lighthouse');
    expect(html).toContain('K. Shank');
    expect(printedPageCount(script())).toBe(2);
  });

  it('can be produced without a title page', () => {
    const html = renderPrintDocumentHtml(script(), { includeTitlePage: false });
    // The stylesheet always defines .title-page; what must be absent is the page itself.
    expect(html).not.toContain('class="page title-page"');
    expect(printedPageCount(script(), { includeTitlePage: false })).toBe(1);
  });

  it('leaves the internal beat title out of the manuscript', () => {
    expect(renderPrintDocumentHtml(script())).not.toContain('She confronts him');
    expect(renderPrintDocumentHtml(script(), { includeBeatTitles: true })).toContain('[She confronts him]');
  });

  it('escapes manuscript text rather than letting it become markup', () => {
    let file = createProjectFile({ title: '<script>alert(1)</script>', format: 'screenplay' });
    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [element('action', 'He types <b>bold</b> & waits.')] },
    });

    const html = renderPrintDocumentHtml(file);
    expect(html).toContain('&lt;b&gt;bold&lt;/b&gt; &amp; waits.');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('carries a watermark when a draft goes out for notes', () => {
    expect(renderPrintDocumentHtml(script(), { watermark: 'DRAFT' })).toContain('>DRAFT<');
  });

  it('suggests a file name from the project title', () => {
    expect(suggestedExportFileName(script('The Keeper: Part One'))).toBe('The Keeper Part One.pdf');
    expect(suggestedExportFileName(script('///'))).toBe('Untitled.pdf');
  });
});
