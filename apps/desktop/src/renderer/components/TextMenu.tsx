import { useEffect, useState } from 'react';
import { ContextMenu, type MenuEntry } from './ContextMenu';
import { addToDictionary, checkWord, ignoreWord, setProjectWords, synonymsOf, warmSpelling } from '../spelling';
import { offsetAtPoint, wordAt } from '../writing-edit';

/** `document.execCommand`, where the browser has it (a test DOM does not). */
const exec = (name: string, value?: string): boolean =>
  typeof document.execCommand === 'function' ? document.execCommand(name, false, value) : false;

/**
 * The spelling and thesaurus part of a right-click menu over a word (from Ken:
 * *when you right click, it should give you suggestions, thesaurus, and all
 * that… across every module*). Used by the program-wide text menu below and by
 * the Write page's own menu, so the two always offer the same.
 */
export const wordEntries = (word: string, replace: (text: string) => void, options: { spelling?: boolean } = {}): MenuEntry[] => {
  if (!word.trim()) return [];
  const entries: MenuEntry[] = [];
  const checked = options.spelling === false ? { misspelled: false, suggestions: [] } : checkWord(word);
  if (checked.misspelled) {
    if (checked.suggestions.length === 0) entries.push({ label: 'No spelling suggestions', disabled: 'The dictionary has nothing close', onPick: () => undefined });
    for (const suggestion of checked.suggestions) entries.push({ label: suggestion, onPick: () => replace(suggestion) });
    entries.push(
      { label: 'Add to Dictionary', note: `“${word}” is not marked again.`, onPick: () => addToDictionary(word) },
      { label: 'Ignore', onPick: () => ignoreWord(word) },
      'rule',
    );
    return entries;
  }
  const alike = synonymsOf(word, 8);
  if (alike.length > 0) {
    entries.push({ heading: `Synonyms for “${word}”` });
    for (const one of alike) entries.push({ label: one, onPick: () => replace(one) });
    entries.push('rule');
  }
  return entries;
};

type Editable = HTMLTextAreaElement | HTMLInputElement | HTMLElement;

interface Caught {
  x: number;
  y: number;
  element: Editable;
  word: string;
  /** Put a word in place of the one under the pointer. */
  replace(text: string): void;
  /** Give the field its focus and selection back before an editing command. */
  restore(): void;
  hasSelection: boolean;
  spelling: boolean;
  readOnly: boolean;
}

const TEXT_INPUTS = new Set(['', 'text', 'search']);
const isTextBox = (element: Element): element is HTMLTextAreaElement | HTMLInputElement =>
  element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && TEXT_INPUTS.has(element.type));

const mac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

/** The keyboard shortcut, sent to the field, so undo goes wherever the keys would send it. */
const press = (element: Editable, key: string, shift = false) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ctrlKey: !mac, metaKey: mac, shiftKey: shift }));
};

const catchAt = (event: MouseEvent): Caught | null => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return null;
  const box = target.closest('textarea, input');
  if (box && isTextBox(box)) {
    const value = box.value;
    const from = box.selectionStart ?? 0;
    const to = box.selectionEnd ?? from;
    const point = offsetAtPoint(box, event.clientX, event.clientY);
    // Inside a selection, the selection is the word; otherwise the word under the pointer.
    const inside = point !== null && to > from && point >= from && point <= to;
    const at = point === null || inside ? { from, to } : { from: point, to: point };
    const found = wordAt(value, at.from, at.to);
    return {
      x: event.clientX,
      y: event.clientY,
      element: box,
      word: found?.word ?? '',
      replace: (text) => {
        if (!found) return;
        box.focus();
        box.setSelectionRange(found.from, found.to);
        // As if typed: the field's own undo, and React hears the change.
        if (!exec('insertText', text)) {
          box.setRangeText(text, found.from, found.to, 'end');
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      restore: () => {
        box.focus();
        box.setSelectionRange(from, to);
      },
      hasSelection: to > from,
      // Offered on every word a writer right-clicks, whether or not the box
      // draws the underline (the Outliner's titles do not), but not in a search.
      spelling: !(box instanceof HTMLInputElement && box.type === 'search'),
      readOnly: box.readOnly || box.disabled,
    };
  }
  const editor = target.closest('[contenteditable=""], [contenteditable="true"]') as HTMLElement | null;
  if (!editor) return null;
  const selection = window.getSelection();
  const kept = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
  const caret = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;
  let word = '';
  let range: Range | null = null;
  if (kept && !kept.collapsed && caret && kept.isPointInRange(caret.startContainer, caret.startOffset)) {
    word = kept.toString().trim();
    range = kept;
  } else if (caret && caret.startContainer.nodeType === Node.TEXT_NODE) {
    const node = caret.startContainer as Text;
    const found = wordAt(node.data, caret.startOffset, caret.startOffset);
    if (found) {
      word = found.word;
      range = document.createRange();
      range.setStart(node, found.from);
      range.setEnd(node, found.to);
    }
  }
  return {
    x: event.clientX,
    y: event.clientY,
    element: editor,
    word: word.includes(' ') ? '' : word,
    replace: (text) => {
      if (!range) return;
      editor.focus();
      const live = window.getSelection();
      live?.removeAllRanges();
      live?.addRange(range);
      exec('insertText', text);
    },
    restore: () => {
      editor.focus();
      if (kept) {
        const live = window.getSelection();
        live?.removeAllRanges();
        live?.addRange(kept);
      }
    },
    hasSelection: Boolean(kept && !kept.collapsed),
    spelling: true,
    readOnly: false,
  };
};

/**
 * The right-click menu over any text in the program: spelling suggestions,
 * Add to Dictionary, synonyms, then Undo, Redo, Cut, Copy, Paste and Select
 * All. Mounted once; a screen that draws its own menu (the Write page, a card,
 * a timeline beat) handles the right-click first and this stays out of its way.
 */
export function TextMenu({ words = [] }: { words?: readonly string[] }) {
  const [caught, setCaught] = useState<Caught | null>(null);
  // The project's own names are words: the cast, the places.
  const key = words.join('\u0001');
  useEffect(() => {
    setProjectWords(words);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    warmSpelling();
    const open = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const found = catchAt(event);
      if (!found) return;
      event.preventDefault();
      setCaught(found);
    };
    window.addEventListener('contextmenu', open);
    return () => window.removeEventListener('contextmenu', open);
  }, []);

  if (!caught) return null;
  const { element } = caught;
  const nothing = caught.hasSelection ? null : 'Select some words first';
  const command = (name: string) => () => {
    caught.restore();
    exec(name);
  };
  const entries: MenuEntry[] = [
    ...(caught.readOnly ? [] : wordEntries(caught.word, caught.replace, { spelling: caught.spelling })),
    ...(caught.readOnly
      ? []
      : ([
          { label: 'Undo', onPick: () => press(element, 'z') },
          { label: 'Redo', onPick: () => press(element, 'z', true) },
          'rule',
          { label: 'Cut', disabled: nothing, onPick: command('cut') },
        ] as MenuEntry[])),
    { label: 'Copy', disabled: nothing, onPick: command('copy') },
    ...(caught.readOnly
      ? []
      : ([
          {
            label: 'Paste',
            onPick: () => {
              caught.restore();
              if (exec('paste')) return;
              void navigator.clipboard
                ?.readText()
                .then((text) => {
                  caught.restore();
                  exec('insertText', text);
                })
                .catch(() => undefined);
            },
          },
        ] as MenuEntry[])),
    {
      label: 'Select All',
      onPick: () => {
        element.focus();
        if (isTextBox(element)) element.select();
        else exec('selectAll');
      },
    },
  ];
  return <ContextMenu x={caught.x} y={caught.y} label="Editing" entries={entries} onClose={() => setCaught(null)} />;
}
