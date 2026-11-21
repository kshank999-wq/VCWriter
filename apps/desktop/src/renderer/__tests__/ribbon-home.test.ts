// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../document/extensions';
import { changeCase, sortParagraphs } from '../document/Ribbon';

/**
 * The Home tab's Word commands (from Ken, 21 November): Change Case keeps
 * each word's formatting, and Sort orders the selected paragraphs.
 */
const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});
const make = (html: string) => (editor = new Editor({ extensions: documentExtensions(), content: html }));
const all = (e: Editor) => e.commands.setTextSelection({ from: 1, to: e.state.doc.content.size - 1 });

describe('Change Case', () => {
  it('re-cases the selection and keeps bold where it was', () => {
    const e = make('<p>the <strong>heron</strong> window. it is old.</p>');
    all(e);
    changeCase(e, 'sentence');
    expect(e.state.doc.textContent).toBe('The heron window. It is old.');
    expect(e.getHTML()).toContain('<strong>heron</strong>');
    all(e);
    changeCase(e, 'upper');
    expect(e.state.doc.textContent).toBe('THE HERON WINDOW. IT IS OLD.');
    all(e);
    changeCase(e, 'title');
    expect(e.state.doc.textContent).toBe('The Heron Window. It Is Old.');
    all(e);
    changeCase(e, 'toggle');
    expect(e.state.doc.textContent).toBe('tHE hERON wINDOW. iT iS oLD.');
  });
});

describe('Sort', () => {
  it('orders the selected paragraphs A to Z, and does nothing for one', () => {
    const e = make('<p>pears</p><p>Apples</p><p>figs</p>');
    all(e);
    expect(sortParagraphs(e)).toBe(true);
    expect(e.getText({ blockSeparator: '|' })).toBe('Apples|figs|pears');
    e.commands.setTextSelection(2);
    expect(sortParagraphs(e)).toBe(false);
  });
});
