// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../document/extensions';
import { changeCase, sortParagraphs } from '../document/Ribbon';
import { deeperListItem } from '../document/extensions';

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

describe('outline lists, as Word has them', () => {
  it('goes down a level for every Tab, even with no line above to go under, and comes back out', () => {
    const e = make('<ol><li><p>Test</p></li></ol><p>After</p>');
    e.commands.setTextSelection(7);
    e.commands.splitListItem('listItem');
    const tab = () => e.commands.sinkListItem('listItem') || deeperListItem(e.view.state, e.view.dispatch);
    tab();
    tab();
    tab();
    e.commands.insertContent('deep');
    const depth = () => {
      let levels = 0;
      for (let at = e.state.selection.$from.depth; at > 0; at -= 1) if (e.state.selection.$from.node(at).type.name === 'orderedList') levels += 1;
      return levels;
    };
    expect(depth()).toBe(4);
    for (let i = 0; i < 3; i += 1) e.commands.liftListItem('listItem');
    expect(depth()).toBe(1);
    // The holders, left empty, are gone.
    expect(e.getHTML()).not.toContain('data-bare');
  });
});

describe('AutoCorrect in a document', () => {
  const type = (e: Editor, text: string) => {
    for (const ch of text) {
      const { from, to } = e.state.selection;
      const handled = e.view.someProp('handleTextInput', (f) => f(e.view, from, to, ch, () => e.state.tr.insertText(ch, from, to)));
      if (!handled) e.view.dispatch(e.state.tr.insertText(ch, from, to));
    }
  };

  it('puts a common slip right as its word is finished, and leaves real words alone', () => {
    localStorage.removeItem('vcwriter.autocorrect');
    const e = make('<p></p>');
    e.commands.focus();
    type(e, 'teh window dont leak ');
    expect(e.state.doc.textContent).toBe("the window don't leak ");
  });

  it('does nothing when switched off', () => {
    localStorage.setItem('vcwriter.autocorrect', 'false');
    const e = make('<p></p>');
    type(e, 'teh ');
    expect(e.state.doc.textContent).toBe('teh ');
    localStorage.removeItem('vcwriter.autocorrect');
  });
});
