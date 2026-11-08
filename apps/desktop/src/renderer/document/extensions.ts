import { Extension, Mark, Node, mergeAttributes } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { headingNumbers, type DocNode, type HeadingNumbering } from '@vcwriter/domain';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import { DeletionMark, InsertionMark, TrackChanges } from './track-changes';
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
    headingIds: {
      /** How the headings are numbered on the page: drawn, never typed (addendum 42 §9). */
      setHeadingNumbering: (scheme: HeadingNumbering) => ReturnType;
    };
    citation: {
      /** A citation at the cursor, after anything picked (addendum 43 §11). */
      insertCitation: (key: string) => ReturnType;
      /** Takes a citation out by its key, leaving the words. */
      removeCitation: (key: string) => ReturnType;
      /** What the markers say and what the bibliography lists, for the screen. */
      setCitationView: (view: CitationView) => ReturnType;
    };
    bibliography: {
      insertBibliography: () => ReturnType;
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

// ------------------------------------------------------------ headings

const newHeadingId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** A transaction giving every heading without an id, or with a second copy of one, an id of its own. */
const fixHeadingIds = (state: EditorState): Transaction | null => {
  const seen = new Set<string>();
  let tr: Transaction | null = null;
  state.doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return;
    const id = node.attrs['headingId'] as string | null;
    if (id && !seen.has(id)) {
      seen.add(id);
      return;
    }
    const fresh = newHeadingId();
    seen.add(fresh);
    tr = (tr ?? state.tr).setNodeMarkup(offset, undefined, { ...node.attrs, headingId: fresh });
  });
  return tr === null ? null : (tr as Transaction).setMeta('addToHistory', false);
};

export const headingNumbersKey = new PluginKey<{ scheme: HeadingNumbering; decorations: DecorationSet }>('wpHeadingNumbers');

const numberDecorations = (doc: PmNode, scheme: HeadingNumbering): DecorationSet => {
  if (scheme === 'none') return DecorationSet.empty;
  // Only the headings are handed over: the numbering reads nothing else.
  const offsets: number[] = [];
  const blocks: DocNode[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name !== 'heading') return;
    offsets.push(offset);
    blocks.push({ type: 'heading', attrs: { level: node.attrs['level'], headingId: node.attrs['headingId'] } });
  });
  const numbers = headingNumbers({ type: 'doc', content: blocks }, scheme);
  const decorations: Decoration[] = [];
  blocks.forEach((block, index) => {
    const number = numbers.get(String(block.attrs?.['headingId'] ?? ''));
    if (number === undefined) return;
    decorations.push(
      Decoration.widget(
        offsets[index]! + 1,
        () => {
          const span = document.createElement('span');
          span.className = 'wp-heading-number';
          span.contentEditable = 'false';
          span.textContent = number;
          return span;
        },
        { side: -1, key: `n-${number}` },
      ),
    );
  });
  return DecorationSet.create(doc, decorations);
};

/**
 * **A heading keeps one id for life** (addendum 42 §9): the document's
 * outline is bound to its headings by it, so a heading edited, moved or
 * restyled is still the same row. A heading made by Enter inside another
 * starts as a copy of its id, and the later copy is given its own.
 *
 * And the numbering (1, 1.1 or I, A, 1) is drawn in front of each heading,
 * never typed into it: the words stay the writer's.
 */
export const HeadingIds = Extension.create({
  name: 'headingIds',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          headingId: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('data-heading-id'),
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes['headingId'] ? { 'data-heading-id': attributes['headingId'] } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setHeadingNumbering:
        (scheme: HeadingNumbering) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(headingNumbersKey, scheme);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _old, state) =>
          transactions.some((tr) => tr.docChanged) ? fixHeadingIds(state) : null,
        view: (view) => {
          // A document opened or imported has headings with no ids yet.
          if (fixHeadingIds(view.state)) {
            queueMicrotask(() => {
              const fix = view.isDestroyed ? null : fixHeadingIds(view.state);
              if (fix) view.dispatch(fix);
            });
          }
          return {};
        },
      }),
      new Plugin<{ scheme: HeadingNumbering; decorations: DecorationSet }>({
        key: headingNumbersKey,
        state: {
          init: () => ({ scheme: 'none', decorations: DecorationSet.empty }),
          apply: (tr, value, _old, state) => {
            const asked = tr.getMeta(headingNumbersKey) as HeadingNumbering | undefined;
            const scheme = asked ?? value.scheme;
            if (asked === undefined && !tr.docChanged) return value;
            return { scheme, decorations: numberDecorations(state.doc, scheme) };
          },
        },
        props: {
          decorations: (state) => headingNumbersKey.getState(state)?.decorations ?? null,
        },
      }),
    ];
  },
});

/** Where a heading is, by its id: the position just inside it. */
export const headingPosition = (doc: PmNode, headingId: string): number | null => {
  let found: number | null = null;
  doc.forEach((node, offset) => {
    if (found === null && node.type.name === 'heading' && node.attrs['headingId'] === headingId) found = offset + 1;
  });
  return found;
};

// -------------------------------------------------------------- citations

/** What the page draws for the citations: each key's marker, and the bibliography's markup. */
export interface CitationView {
  /** By key: the raised marker, or the parenthetical; empty where its source has gone. */
  markers: ReadonlyMap<string, string>;
  /** Whether the markers are raised (a footnote style) or set in the line (APA, MLA). */
  raised: boolean;
  /** The bibliography block's markup, as print sets it. */
  bibliographyHtml: string;
}

/** What the workspace hands the citation node: the bibliography's markup, and what a click on a marker does. */
export interface CitationStorage {
  bibliographyHtml: string;
  onOpen: ((key: string) => void) | null;
  /** What a click on one of the writer's own notes does (addendum 42 §18). */
  onOpenNote?: ((id: string) => void) | null;
}

export const citationViewKey = new PluginKey<{ view: CitationView; decorations: DecorationSet; version: number }>('wpCitations');

const EMPTY_VIEW: CitationView = { markers: new Map(), raised: true, bibliographyHtml: '' };

/**
 * Each citation drawn as its marker, worked out from where it stands every
 * time (addendum 43 §4), and each bibliography block told the view has moved
 * on so it draws itself again.
 */
const citationDecorations = (doc: PmNode, view: CitationView, version: number): DecorationSet => {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'citation') {
      const said = view.markers.get(String(node.attrs['key'] ?? '')) ?? '';
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-marker': said || '?',
          class: `wp-cite${said ? '' : ' missing'}${view.raised ? '' : ' in-text'}`,
        }),
      );
      return false;
    }
    if (node.type.name === 'footnote') {
      // The writer's note, numbered with the citations' notes (addendum 42 §18).
      const end = node.attrs['kind'] === 'end';
      const said = view.markers.get(`${end ? 'en' : 'fn'}:${String(node.attrs['id'] ?? '')}`) ?? '';
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          'data-marker': said || '•',
          class: `wp-cite wp-writer-note${end ? ' end' : ''}`,
        }),
      );
      return false;
    }
    if (node.type.name === 'bibliography') {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-version': String(version) }));
      return false;
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
};

/**
 * **A citation in a document** (addendum 43 §11): an inline node holding the
 * key of its record, so it moves, copies and undoes with the words around it.
 * Its HTML is an empty `<sup data-cite>`; the screen draws its marker over
 * it, and print sets the marker or the parenthetical in its place.
 */
export const Citation = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      key: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-cite') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-cite': attributes['key'] }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-cite]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes({ class: 'wp-cite' }, HTMLAttributes)];
  },
  addCommands() {
    return {
      insertCitation:
        (key: string) =>
        ({ state, chain }) =>
          chain()
            .setTextSelection(state.selection.to)
            .insertContent({ type: this.name, attrs: { key } })
            .run(),
      removeCitation:
        (key: string) =>
        ({ state, dispatch }) => {
          const found: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'citation' && node.attrs['key'] === key) found.push(pos);
          });
          if (found.length === 0) return false;
          if (dispatch) {
            const tr = state.tr;
            for (const pos of found.reverse()) tr.delete(pos, pos + 1);
            dispatch(tr);
          }
          return true;
        },
      setCitationView:
        (view: CitationView) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(citationViewKey, view);
          return true;
        },
    };
  },
  addStorage(): CitationStorage {
    return { bibliographyHtml: '', onOpen: null };
  },
  addProseMirrorPlugins() {
    const storage = this.storage as CitationStorage;
    return [
      new Plugin<{ view: CitationView; decorations: DecorationSet; version: number }>({
        key: citationViewKey,
        state: {
          init: (_config, state) => ({ view: EMPTY_VIEW, decorations: citationDecorations(state.doc, EMPTY_VIEW, 0), version: 0 }),
          apply: (tr, value, _old, state) => {
            const asked = tr.getMeta(citationViewKey) as CitationView | undefined;
            if (asked === undefined && !tr.docChanged) return value;
            const view = asked ?? value.view;
            const version = asked ? value.version + 1 : value.version;
            if (asked) storage.bibliographyHtml = asked.bibliographyHtml;
            return { view, version, decorations: citationDecorations(state.doc, view, version) };
          },
        },
        props: {
          decorations: (state) => citationViewKey.getState(state)?.decorations ?? null,
          // A click on a marker opens its citation, as in the manuscript.
          handleClickOn: (_view, _pos, node) => {
            if (node.type.name === 'footnote' && storage.onOpenNote) {
              storage.onOpenNote(String(node.attrs['id'] ?? ''));
              return true;
            }
            if (node.type.name !== 'citation' || !storage.onOpen) return false;
            storage.onOpen(String(node.attrs['key'] ?? ''));
            return true;
          },
        },
      }),
    ];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /** Mark the selection as the passage of this comment. */
      setComment: (commentId: string) => ReturnType;
      /** Take a comment's mark off wherever it is. */
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

/** What a click on a commented passage does (addendum 42 §20). */
export interface CommentStorage {
  onSelect: ((commentId: string | null) => void) | null;
}

/** Where a comment's passage is: from its first marked character to its last. */
export const commentRange = (doc: PmNode, commentId: string): { from: number; to: number } | null => {
  let from = -1;
  let to = -1;
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    if (node.marks.some((mark) => mark.type.name === 'comment' && mark.attrs['commentId'] === commentId)) {
      if (from < 0) from = pos;
      to = pos + node.nodeSize;
    }
    return true;
  });
  return from < 0 ? null : { from, to };
};

/**
 * **A comment's passage** (addendum 42 §20): a mark naming the comment, so it
 * moves, copies and undoes with the words; the comment itself is kept on the
 * document. Comments may overlap, as in Word. A click inside one tells the
 * pane which to show.
 */
export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-comment-id'),
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-comment-id': attributes['commentId'] }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ class: 'wp-comment' }, HTMLAttributes), 0];
  },
  addStorage(): CommentStorage {
    return { onSelect: null };
  },
  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      unsetComment:
        (commentId: string) =>
        ({ state, dispatch }) => {
          const type = state.schema.marks['comment'];
          if (!type) return false;
          const tr = state.tr;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return true;
            for (const mark of node.marks) {
              if (mark.type === type && mark.attrs['commentId'] === commentId) tr.removeMark(pos, pos + node.nodeSize, mark);
            }
            return true;
          });
          if (!tr.docChanged) return false;
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const storage = this.storage as CommentStorage;
    return [
      new Plugin({
        props: {
          handleClick: (view, pos) => {
            if (!storage.onSelect) return false;
            const marks = view.state.doc.resolve(pos).marks();
            const comment = marks.find((mark) => mark.type.name === 'comment');
            storage.onSelect(comment ? String(comment.attrs['commentId']) : null);
            return false;
          },
        },
      }),
    ];
  },
});

/** One of the writer's own notes, as the editor holds it (addendum 42 §18). */
export interface WriterNoteAttrs {
  id: string;
  kind: 'foot' | 'end';
  text: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      /** A footnote or endnote at the cursor, after the selection. */
      insertWriterNote: (note: WriterNoteAttrs) => ReturnType;
      /** Change a note's words, or turn a footnote into an endnote. */
      updateWriterNote: (id: string, patch: Partial<Omit<WriterNoteAttrs, 'id'>>) => ReturnType;
      removeWriterNote: (id: string) => ReturnType;
    };
  }
}

/**
 * **The writer's own footnote or endnote** (addendum 42 §18, from Ken:
 * *let's get the word processor going*). An inline node holding its words, so
 * it moves, copies and undoes with the sentence it hangs on. Its HTML is an
 * empty `<sup data-footnote>`; the screen draws its number over it (numbered
 * with a footnote style's citation notes, as Word keeps one sequence), and
 * print sets the note at the foot of its page — or, for an endnote, at the end.
 */
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-footnote') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-footnote': attributes['id'] }),
      },
      kind: {
        default: 'foot',
        parseHTML: (element: HTMLElement) => (element.getAttribute('data-kind') === 'end' ? 'end' : 'foot'),
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-kind': attributes['kind'] }),
      },
      text: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-note') ?? '',
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-note': attributes['text'] }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'sup[data-footnote]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes({ class: 'wp-footnote' }, HTMLAttributes)];
  },
  addCommands() {
    const find = (doc: PmNode, id: string): number[] => {
      const found: number[] = [];
      doc.descendants((node, pos) => {
        if (node.type.name === 'footnote' && node.attrs['id'] === id) found.push(pos);
      });
      return found;
    };
    return {
      insertWriterNote:
        (note: WriterNoteAttrs) =>
        ({ state, chain }) =>
          chain()
            .setTextSelection(state.selection.to)
            .insertContent({ type: this.name, attrs: { ...note } })
            .run(),
      updateWriterNote:
        (id: string, patch: Partial<Omit<WriterNoteAttrs, 'id'>>) =>
        ({ state, dispatch }) => {
          const found = find(state.doc, id);
          if (found.length === 0) return false;
          if (dispatch) {
            const tr = state.tr;
            for (const pos of found) {
              const node = tr.doc.nodeAt(pos);
              if (node) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...patch });
            }
            dispatch(tr);
          }
          return true;
        },
      removeWriterNote:
        (id: string) =>
        ({ state, dispatch }) => {
          const found = find(state.doc, id);
          if (found.length === 0) return false;
          if (dispatch) {
            const tr = state.tr;
            for (const pos of found.reverse()) tr.delete(pos, pos + 1);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

/**
 * **A bibliography where the writer puts it** (addendum 43 §11): a block with
 * nothing typed in it, filled from the sources the document cites and drawn
 * again as they change. Print and Word set the same list in its place.
 */
export const Bibliography = Node.create({
  name: 'bibliography',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-bibliography]' }];
  },
  renderHTML() {
    return ['div', { 'data-bibliography': '', class: 'wp-bibliography-block' }];
  },
  addCommands() {
    return {
      insertBibliography:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
  addNodeView() {
    return ({ editor }) => {
      const dom = document.createElement('div');
      dom.className = 'wp-bibliography-block';
      dom.contentEditable = 'false';
      dom.setAttribute('data-bibliography', '');
      const draw = () => {
        dom.innerHTML = (editor.storage as unknown as { citation?: { bibliographyHtml: string } }).citation?.bibliographyHtml ?? '';
      };
      draw();
      return {
        dom,
        // Each new view of the citations comes as a decoration change, which
        // is what calls this: draw the list again.
        update: (node) => {
          if (node.type.name !== 'bibliography') return false;
          draw();
          return true;
        },
      };
    };
  },
});

/** What the workspace hands the table of contents (addendum 42 §19): its markup, and a way to draw it again. */
export interface ContentsStorage {
  html: string;
  /** Each table in the page draws itself again when this is called. */
  views: Set<() => void>;
  set: (html: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      insertTableOfContents: () => ReturnType;
    };
  }
}

/**
 * **A table of contents where the writer puts it** (addendum 42 §19): a block
 * with nothing typed in it, drawn from the document's headings and the page
 * each stands on, as the bibliography is drawn from the sources. A click on a
 * line goes to its heading. Print and Word set the same table in its place.
 */
export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: 'div[data-toc]' }];
  },
  renderHTML() {
    return ['div', { 'data-toc': '', class: 'wp-toc-block' }];
  },
  addStorage(): ContentsStorage {
    return {
      html: '',
      views: new Set(),
      // Through `this`: the editor keeps its own copy of what this returns,
      // and the table draws from that copy.
      set(this: ContentsStorage, html: string) {
        if (html === this.html) return;
        this.html = html;
        for (const draw of this.views) draw();
      },
    };
  },
  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
  addNodeView() {
    const storage = this.storage as ContentsStorage;
    return ({ editor }) => {
      const dom = document.createElement('div');
      dom.className = 'wp-toc-block';
      dom.contentEditable = 'false';
      dom.setAttribute('data-toc', '');
      const draw = () => {
        dom.innerHTML = storage.html || '<nav class="wp-toc"><h2 class="wp-toc-heading">Contents</h2></nav>';
      };
      draw();
      storage.views.add(draw);
      // A line goes to its heading, and puts the cursor at its start.
      const go = (event: MouseEvent) => {
        const link = (event.target as HTMLElement | null)?.closest('a[data-toc-target]');
        if (!link) return;
        event.preventDefault();
        event.stopPropagation();
        const at = headingPosition(editor.state.doc, link.getAttribute('data-toc-target') ?? '');
        if (at !== null) editor.chain().focus().setTextSelection(at).scrollIntoView().run();
      };
      dom.addEventListener('mousedown', go);
      return {
        dom,
        update: (node) => node.type.name === 'tableOfContents',
        destroy: () => {
          storage.views.delete(draw);
          dom.removeEventListener('mousedown', go);
        },
      };
    };
  },
});

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
  // Pictures and shapes take Word's corner handles: drag to resize, the shape kept (addendum 42 §15).
  Image.configure({ allowBase64: true, inline: false, resize: { enabled: true, alwaysPreserveAspectRatio: true, minWidth: 16, minHeight: 8 } }),
  Placeholder.configure({ placeholder: 'Start typing…' }),
  BlockFormat,
  PageBreak,
  Search,
  ExtractMark,
  HeadingIds,
  Citation,
  Footnote,
  Bibliography,
  TableOfContents,
  CommentMark,
  // Tracked changes (addendum 42 §21).
  InsertionMark,
  DeletionMark,
  TrackChanges,
];
