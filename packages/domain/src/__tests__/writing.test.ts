import { describe, expect, it } from 'vitest';
import {
  autoType,
  cueSuggestions,
  cycleType,
  defaultElementType,
  elementTypesFor,
  onEnter,
  onTab,
  styleShortcuts,
  typeOnEnter,
} from '../editing.js';
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

  it('moves between styles on Tab and Return the way Final Draft does', () => {
    // Tab re-types the line you are on, following Final Draft's table.
    expect(onTab('screenplay', 'scene_heading')).toEqual({ type: 'action', newLine: false });
    expect(onTab('screenplay', 'action')).toEqual({ type: 'character', newLine: false });
    expect(onTab('screenplay', 'character')).toEqual({ type: 'parenthetical', newLine: false });
    expect(onTab('screenplay', 'parenthetical')).toEqual({ type: 'dialogue', newLine: false });
    expect(onTab('screenplay', 'dialogue')).toEqual({ type: 'character', newLine: false });
    expect(onTab('screenplay', 'transition')).toEqual({ type: 'scene_heading', newLine: false });
    // Shift+Tab walks back through the styles.
    expect(onTab('screenplay', 'character', false, -1)).toEqual({ type: 'action', newLine: false });

    // Return starts the next line in the style that continues the work.
    expect(onEnter('screenplay', 'character', false)).toEqual({ type: 'dialogue', newLine: true });
    expect(onEnter('screenplay', 'dialogue', false)).toEqual({ type: 'action', newLine: true });
    expect(onEnter('screenplay', 'parenthetical', true)).toEqual({ type: 'dialogue', newLine: false });
    expect(onEnter('screenplay', 'transition', false)).toEqual({ type: 'scene_heading', newLine: true });

    // Prose keeps Return in the paragraph and walks its styles on Tab.
    expect(onEnter('novel', 'paragraph', false)).toEqual({ type: 'paragraph', newLine: true });
    expect(onTab('novel', 'paragraph')).toEqual({ type: 'heading', newLine: false });
  });

  it('types a line as what it turns out to be', () => {
    expect(autoType('screenplay', 'action', 'INT. OFFICE - DAY')).toBe('scene_heading');
    expect(autoType('screenplay', 'action', 'ext kitchen')).toBe('scene_heading');
    expect(autoType('screenplay', 'action', 'CUT TO:')).toBe('transition');
    // Only a whole line is a transition, and only action is ever re-typed.
    expect(autoType('screenplay', 'action', 'He cuts to the chase.')).toBeNull();
    expect(autoType('screenplay', 'dialogue', 'INT. OFFICE - DAY')).toBeNull();
    // Shot detection is off by default: writers use these words in action.
    expect(autoType('screenplay', 'action', 'ANGLE ON the door')).toBeNull();
    expect(autoType('screenplay', 'action', 'ANGLE ON the door', { detectShots: true })).toBe('shot');
    expect(autoType('novel', 'paragraph', 'INT. OFFICE - DAY')).toBeNull();
  });

  it('offers the cue that is most likely to speak next', () => {
    // Mike just spoke, so Celeste is offered first and Mike last.
    expect(cueSuggestions(['Mike', 'Celeste', 'Ruth'], ['CELESTE', 'MIKE'])).toEqual(['CELESTE', 'RUTH', 'MIKE']);
    // With nobody having spoken yet, the order the cast was handed over in
    // stands: the headings decide it, not the alphabet.
    expect(cueSuggestions(['Mike', 'Celeste'], [])).toEqual(['MIKE', 'CELESTE']);
  });

  it('binds the paragraph styles to the number keys', () => {
    expect(styleShortcuts('screenplay')['3']).toBe('character');
    expect(styleShortcuts('screenplay')['5']).toBe('dialogue');
    expect(styleShortcuts('novel')['1']).toBe('heading');
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
