import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extensions';

/**
 * The word processor's editor (addendum 42): TipTap's own extensions for
 * everything Word users expect, and four of ours for what TipTap does not
 * ship. Paragraph indent and spacing are Word's paragraph settings. Tab
 * behaves as in Word. A page break is a real break. Find marks every match.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockFormat: {
      /** Half an inch further in, or out, for every paragraph in the selection. */
      indentBlocks: (direction: 1 | -1) => ReturnType;
      /** One paragraph setting for every paragraph and heading in the selection. */
      setBlockAttribute: (name: 'lineHeight' | 'spaceBefore' | 'spaceAfter', value: number | null) => ReturnType;
      /** Normal, Title or Subtitle: a paragraph's place in Word's style gallery. */
      setDocStyle: (style: 'title' | 'subtitle' | null) => ReturnType;
    };
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
    search: {
      setSearch: (search: SearchState) => ReturnType;
    };
  }
}

const BLOCKS = new Set(['paragraph', 'heading']);

/** The paragraphs and headings the selection touches, with where each starts. */
const selectedBlocks = (state: EditorState): { node: PmNode; pos: number }[] => {
  const out: { node: PmNode; pos: number }[] = [];
  const { from, to } = state.selection;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (BLOCKS.has(node.type.name)) {
      out.push({ node, pos });
      return false;
    }
    return true;
  });
  return out;
};

const numberAttr = (name: string, css: (value: number) => string, read: (element: HTMLElement) => number | null) => ({
  [name]: {
    default: null,
    parseHTML: (element: HTMLElement) => read(element),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[name];
      return typeof value === 'number' && Number.isFinite(value) ? { style: css(value) } : {};
    },
  },
});

const points = (value: string): number | null => {
  const match = /^([\d.]+)pt$/.exec(value.trim());
  return match ? Number(match[1]) : null;
};

export const BlockFormat = Extension.create({
  name: 'blockFormat',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element: HTMLElement) => Number(element.getAttribute('data-indent') ?? 0) || 0,
            renderHTML: (attributes: Record<string, unknown>) => {
              const indent = Number(attributes['indent'] ?? 0);
              return indent > 0 ? { 'data-indent': indent, style: `margin-left: ${indent * 0.5}in` } : {};
            },
          },
          ...numberAttr('lineHeight', (value) => `line-height: ${value}`, (element) => Number(element.style.lineHeight) || null),
          ...numberAttr('spaceBefore', (value) => `margin-top: ${value}pt`, (element) => points(element.style.marginTop)),
          ...numberAttr('spaceAfter', (value) => `margin-bottom: ${value}pt`, (element) => points(element.style.marginBottom)),
        },
      },
      {
        types: ['paragraph'],
        attributes: {
          docStyle: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-doc-style'),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes['docStyle'] ? { 'data-doc-style': attributes['docStyle'] } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indentBlocks:
        (direction) =>
        ({ state, tr, dispatch }) => {
          const blocks = selectedBlocks(state);
          if (!blocks.length) return false;
          if (dispatch) {
            blocks.forEach(({ node, pos }) => {
              const indent = Math.max(0, Math.min(8, Number(node.attrs['indent'] ?? 0) + direction));
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
            });
          }
          return true;
        },
      setBlockAttribute:
        (name, value) =>
        ({ state, tr, dispatch }) => {
          const blocks = selectedBlocks(state);
          if (!blocks.length) return false;
          if (dispatch) blocks.forEach(({ node, pos }) => tr.setNodeMarkup(pos, undefined, { ...node.attrs, [name]: value }));
          return true;
        },
      setDocStyle:
        (style) =>
        ({ chain }) =>
          chain().setParagraph().updateAttributes('paragraph', { docStyle: style }).run(),
    };
  },

  addKeyboardShortcuts() {
    // Tab as Word has it: a list item goes down a level, a table moves to the
    // next cell (the table's own keys), and anywhere else a tab is typed.
    return {
      Tab: () => {
        if (this.editor.isActive('table')) return false;
        if (this.editor.isActive('listItem')) return this.editor.commands.sinkListItem('listItem');
        return this.editor.commands.insertContent('\t');
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('table')) return false;
        if (this.editor.isActive('listItem')) return this.editor.commands.liftListItem('listItem');
        return this.editor.commands.indentBlocks(-1);
      },
    };
  },
});

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },
  renderHTML() {
    return ['div', { 'data-page-break': '', class: 'wp-page-break' }];
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
  addKeyboardShortcuts() {
    // Word's Insert → Page Break key.
    return { 'Mod-Enter': () => this.editor.commands.setPageBreak() };
  },
});

// ------------------------------------------------------------------ find

export interface SearchState {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** The match the writer is on, highlighted more strongly than the rest. */
  current: number;
}

export interface Match {
  from: number;
  to: number;
}

const WORDISH = /[\p{L}\p{N}_]/u;

/**
 * Every place the words appear, in document order. Searched a paragraph at a
 * time, so a match may run across bold and plain text in one paragraph but
 * never across two paragraphs, which is Word's behaviour too.
 */
export const findMatches = (doc: PmNode, search: Pick<SearchState, 'query' | 'caseSensitive' | 'wholeWord'>): Match[] => {
  const out: Match[] = [];
  if (!search.query) return out;
  const needle = search.caseSensitive ? search.query : search.query.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = '';
    const at: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        const value = child.text ?? '';
        for (let index = 0; index < value.length; index += 1) at.push(pos + 1 + offset + index);
        text += value;
      } else {
        // A picture or a break stands in as one character nothing matches.
        at.push(pos + 1 + offset);
        text += '￼';
      }
    });
    const hay = search.caseSensitive ? text : text.toLowerCase();
    let index = hay.indexOf(needle);
    while (index >= 0) {
      const end = index + needle.length;
      const whole =
        !search.wholeWord || (!WORDISH.test(hay[index - 1] ?? ' ') && !WORDISH.test(hay[end] ?? ' '));
      if (whole) out.push({ from: at[index] as number, to: (at[end - 1] as number) + 1 });
      index = hay.indexOf(needle, index + Math.max(1, needle.length));
    }
    return false;
  });
  return out;
};

export const searchKey = new PluginKey<SearchState>('wpSearch');

export const Search = Extension.create({
  name: 'search',
  addCommands() {
    return {
      setSearch:
        (search) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(searchKey, search);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: '', caseSensitive: false, wholeWord: false, current: -1 }),
          apply: (tr, value) => (tr.getMeta(searchKey) as SearchState | undefined) ?? value,
        },
        props: {
          decorations: (state) => {
            const search = searchKey.getState(state);
            if (!search?.query) return null;
            const matches = findMatches(state.doc, search);
            return DecorationSet.create(
              state.doc,
              matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class: index === search.current ? 'wp-find-current' : 'wp-find-match',
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------- extracts

/**
 * **A passage captured into a bin** (addendum 42 §8).
 *
 * A mark rather than a stored position, so it travels with the words however
 * the text around it is edited. It never changes a character: removing it
 * leaves the passage as it was. `excludes: ''` lets marks of this type
 * overlap, so one sentence can sit in Character and Description at once
 * (WP spec §5.2). `inclusive: false` means typing at its edge does not grow
 * the extract.
 */
export const ExtractMark = Mark.create({
  name: 'extract',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-extract'),
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-extract': attributes['id'] }),
      },
      color: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-extract-color'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['color'] ? { 'data-extract-color': attributes['color'], style: `--extract-color: ${String(attributes['color'])}` } : {},
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-extract-label'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['label'] ? { 'data-extract-label': attributes['label'], title: `Extracted: ${String(attributes['label'])}` } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-extract]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'wp-extract' }, HTMLAttributes), 0];
  },
});

/** Where an extract's mark is in the document: from its first character to its last. */
export const extractRange = (doc: PmNode, id: string): Match | null => {
  let from = -1;
  let to = -1;
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    if (node.marks.some((mark) => mark.type.name === 'extract' && mark.attrs['id'] === id)) {
      if (from < 0) from = pos;
      to = pos + node.nodeSize;
    }
    return false;
  });
  return from < 0 ? null : { from, to };
};

/** The words an extract's mark covers now, to compare with what was saved. */
export const extractTextNow = (doc: PmNode, id: string): string | null => {
  const range = extractRange(doc, id);
  return range ? doc.textBetween(range.from, range.to, '\n', '\uFFFC') : null;
};

/** Every extract id with a mark in the document. */
export const extractIdsIn = (doc: PmNode): Set<string> => {
  const ids = new Set<string>();
  doc.descendants((node) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === 'extract' && mark.attrs['id']) ids.add(String(mark.attrs['id']));
    });
    return true;
  });
  return ids;
};

/** Everything the document editor is built from. */
export const documentExtensions = () => [
  StarterKit.configure({
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  TextStyleKit,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Subscript,
  Superscript,
  TableKit.configure({ table: { resizable: false } }),
  Image.configure({ allowBase64: true, inline: false }),
  Placeholder.configure({ placeholder: 'Start typing…' }),
  BlockFormat,
  PageBreak,
  Search,
  ExtractMark,
];
