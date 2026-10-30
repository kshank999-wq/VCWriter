// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../document/extensions';
import { changesIn, type TrackChangesStorage } from '../document/track-changes';

/**
 * Tracked changes (addendum 42 §21, from Ken: *go ahead with comments and
 * tracked changes*): with tracking on, typing is an insertion and deleting
 * keeps the words, struck through, until accepted or rejected.
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

const make = (text: string, tracking = true) => {
  editor = new Editor({ extensions: documentExtensions(), content: `<p>${text}</p>` });
  const storage = (editor.storage as unknown as { trackChanges: TrackChangesStorage }).trackChanges;
  storage.enabled = tracking;
  storage.author = 'Ken Shank';
  return editor;
};
const kinds = (e: Editor) => changesIn(e.state.doc).map((one) => `${one.kind}:${e.state.doc.textBetween(one.from, one.to)}:${one.author}`);

describe('tracked changes', () => {
  it('marks what is typed as an insertion, by its author', () => {
    const e = make('The bridge is out.');
    e.chain().setTextSelection(12).insertContent('old ').run();
    expect(e.state.doc.textContent).toBe('The bridge old is out.');
    expect(kinds(e)).toEqual(['insertion:old :Ken Shank']);
  });

  it('keeps what is deleted, struck through, and Backspace leaves the cursor before it', () => {
    const e = make('The bridge is out.');
    // "bridge " deleted as Backspace would, the cursor after it.
    e.chain().setTextSelection(12).run();
    e.commands.command(({ tr }) => {
      tr.delete(5, 12);
      return true;
    });
    expect(e.state.doc.textContent).toBe('The bridge is out.');
    expect(kinds(e)).toEqual(['deletion:bridge :Ken Shank']);
    expect(e.state.selection.from).toBe(5);
  });

  it('puts the deleted words before the typed ones when a selection is typed over', () => {
    const e = make('The bridge is out.');
    e.chain().setTextSelection({ from: 5, to: 11 }).insertContent('ferry').run();
    expect(e.state.doc.textContent).toBe('The bridgeferry is out.');
    expect(kinds(e)).toEqual(['deletion:bridge:Ken Shank', 'insertion:ferry:Ken Shank']);
  });

  it('removes outright words typed under tracking when they are deleted', () => {
    const e = make('The bridge is out.');
    e.chain().setTextSelection(12).insertContent('old ').run();
    e.commands.command(({ tr }) => {
      tr.delete(12, 16);
      return true;
    });
    expect(e.state.doc.textContent).toBe('The bridge is out.');
    expect(kinds(e)).toEqual([]);
  });

  it('accepts and rejects one change or all of them', () => {
    const e = make('The bridge is out.');
    e.chain().setTextSelection({ from: 5, to: 11 }).insertContent('ferry').run();
    e.chain().setTextSelection(7).acceptChange().run();
    expect(e.state.doc.textContent).toBe('The ferry is out.');
    expect(kinds(e)).toEqual(['insertion:ferry:Ken Shank']);
    e.commands.rejectAllChanges();
    expect(e.state.doc.textContent).toBe('The  is out.');
    expect(kinds(e)).toEqual([]);
  });

  it('changes nothing about editing while tracking is off', () => {
    const e = make('The bridge is out.', false);
    e.chain().setTextSelection({ from: 5, to: 11 }).insertContent('ferry').run();
    expect(e.state.doc.textContent).toBe('The ferry is out.');
    expect(kinds(e)).toEqual([]);
  });
});
