// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { documentExtensions } from '../document/extensions';

/**
 * Dictating into a document (from Ken, 21 November: *the dictate function
 * does not work in the document word processor*): one stretch that could not
 * be heard says so and listening goes on, and what is heard after it is
 * typed at the cursor.
 */
type Handlers = { onFinal(text: string): void; onInterim(text: string): void; onError(why: string): void; onEnd(): void };
let handlers: Handlers | null = null;
const stop = vi.fn();
vi.mock('../dictation', () => ({
  startDictation: (given: Handlers) => {
    handlers = given;
    return { stop };
  },
  systemDictationKey: () => 'Press Fn twice',
}));
vi.mock('../natural-voices', () => ({
  NaturalPlayer: class {},
  useNaturalVoices: () => ({ installed: false, available: false, progress: null, install: async () => undefined }),
}));

const noRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
Element.prototype.getClientRects ??= noRects;
Range.prototype.getClientRects ??= noRects;
Range.prototype.getBoundingClientRect ??= () => new DOMRect(0, 0, 0, 0);

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
  handlers = null;
});

describe('dictating into a document', () => {
  it('keeps listening after a stretch it could not hear, and types what it hears next', async () => {
    const { useDocumentSpeech } = await import('../document/speech');
    editor = new Editor({ extensions: documentExtensions(), content: '<p>The heron window</p>' });
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    const said: string[] = [];
    const { result } = renderHook(() => useDocumentSpeech(editor, (message) => said.push(message)));
    act(() => result.current.dictate());
    expect(result.current.dictating).toBe(true);
    act(() => handlers!.onError('That could not be heard: model warming up'));
    expect(result.current.dictating).toBe(true);
    expect(stop).not.toHaveBeenCalled();
    act(() => handlers!.onFinal('needs new lead.'));
    expect(editor.state.doc.textContent).toBe('The heron window needs new lead.');
    expect(said).toContain('That could not be heard: model warming up');
  });
});
