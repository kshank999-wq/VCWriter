import { Extension, Mark, getMarkRange, mergeAttributes } from '@tiptap/core';
import { Fragment, Slice, type Mark as PmMark, type Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';

/**
 * **Tracked changes** (addendum 42 §21, from Ken: *go ahead with comments and
 * tracked changes*).
 *
 * While tracking is on, nothing typed or deleted changes the words outright,
 * as in Word: what is typed is an `insertion` — underlined, in colour — and
 * what is deleted stays in place as a `deletion`, struck through, until the
 * change is accepted or rejected. Each change carries who made it and when.
 *
 * It works by taking each edit as ProseMirror makes it and putting back what
 * the edit removed, marked deleted, in front of what it inserted, marked
 * inserted. Deleting words someone typed under tracking simply removes them,
 * as Word does; deleting words already struck through only moves the cursor
 * past them. Formatting is not tracked, and neither is joining or splitting a
 * paragraph: only words are.
 */

export const trackChangesKey = new PluginKey('wpTrackChanges');

/** What the workspace hands the tracking: whether it is on, and whose changes these are. */
export interface TrackChangesStorage {
  enabled: boolean;
  author: string;
}

const changeAttributes = () => ({
  author: {
    default: '',
    parseHTML: (element: HTMLElement) => element.getAttribute('data-author') ?? '',
    renderHTML: (attributes: Record<string, unknown>) => ({ 'data-author': attributes['author'], title: changeTitle(attributes) }),
  },
  date: {
    default: '',
    parseHTML: (element: HTMLElement) => element.getAttribute('data-date') ?? '',
    renderHTML: (attributes: Record<string, unknown>) => ({ 'data-date': attributes['date'] }),
  },
});

const changeTitle = (attributes: Record<string, unknown>): string => {
  const who = String(attributes['author'] ?? '') || 'Someone';
  const date = new Date(String(attributes['date'] ?? ''));
  return Number.isNaN(date.getTime()) ? who : `${who}, ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
};

/** Words typed while tracking: underlined in colour until accepted. */
export const InsertionMark = Mark.create({
  name: 'insertion',
  inclusive: false,
  excludes: 'insertion deletion',
  addAttributes: changeAttributes,
  parseHTML() {
    return [{ tag: 'ins' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes({ class: 'wp-ins' }, HTMLAttributes), 0];
  },
});

/** Words deleted while tracking: kept, struck through, until accepted. */
export const DeletionMark = Mark.create({
  name: 'deletion',
  inclusive: false,
  excludes: 'insertion deletion',
  addAttributes: changeAttributes,
  parseHTML() {
    return [{ tag: 'del' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes({ class: 'wp-del' }, HTMLAttributes), 0];
  },
});

/** A slice with the words already marked inserted taken out: deleting them deletes them. */
const withoutInsertions = (fragment: Fragment): Fragment => {
  const kept: PmNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      if (!node.marks.some((mark) => mark.type.name === 'insertion')) kept.push(node);
      return;
    }
    kept.push(node.copy(withoutInsertions(node.content)));
  });
  return Fragment.fromArray(kept);
};

const hasWords = (fragment: Fragment): boolean => {
  let found = false;
  fragment.descendants((node) => {
    if (node.isText && (node.text ?? '').length > 0) found = true;
    return !found;
  });
  return found;
};

/**
 * The edit made tracked: each word it inserted marked, each word it removed
 * put back in front of the insertion and marked deleted. Null where there is
 * nothing to track.
 */
const trackedEdit = (transactions: readonly Transaction[], oldState: EditorState, newState: EditorState, storage: TrackChangesStorage): Transaction | null => {
  if (!storage.enabled) return null;
  const edits = transactions.filter(
    (tr) =>
      tr.docChanged &&
      !tr.getMeta(trackChangesKey) &&
      // Undo and redo put back what tracking already wrote.
      !tr.getMeta('history$') &&
      tr.getMeta('addToHistory') !== false,
  );
  if (edits.length === 0 || edits.length !== transactions.filter((tr) => tr.docChanged).length) return null;
  const insertion = newState.schema.marks['insertion'];
  const deletion = newState.schema.marks['deletion'];
  if (!insertion || !deletion) return null;
  const attrs = { author: storage.author || 'Someone', date: new Date().toISOString() };

  // Every replace step, with the positions it touched mapped to the new state.
  type Piece = { at: number; insertedEnd: number; removed: Slice | null };
  const pieces: Piece[] = [];
  const steps = edits.flatMap((tr) => tr.steps.map((step, index) => ({ step, before: tr.docs[index] as PmNode })));
  steps.forEach(({ step, before }, index) => {
    if (!(step instanceof ReplaceStep)) return;
    // Positions after this step, carried through every later step.
    const later = steps.slice(index + 1);
    const mapAfter = (pos: number, assoc: number) => later.reduce((at, one) => one.step.getMap().map(at, assoc), pos);
    const at = mapAfter(step.from, -1);
    const insertedEnd = mapAfter(step.from + step.slice.size, 1);
    const removedSlice = step.to > step.from ? before.slice(step.from, step.to) : null;
    const removed = removedSlice ? new Slice(withoutInsertions(removedSlice.content), removedSlice.openStart, removedSlice.openEnd) : null;
    pieces.push({ at, insertedEnd, removed: removed && hasWords(removed.content) ? removed : null });
  });
  if (pieces.length === 0) return null;

  const tr = newState.tr;
  let cursorTo: number | null = null;
  const wasEmpty = oldState.selection.empty;
  const oldHead = oldState.selection.head;
  // Last first, so the earlier pieces' positions still hold in `tr`.
  for (const piece of [...pieces].reverse()) {
    const at = tr.mapping.map(piece.at, -1);
    const end = tr.mapping.map(piece.insertedEnd, 1);
    if (end > at) tr.addMark(at, end, insertion.create(attrs));
    if (piece.removed) {
      const before = tr.steps.length;
      tr.replace(at, at, piece.removed);
      const map = tr.mapping.slice(before);
      const start = map.map(at, -1);
      const stop = map.map(at, 1);
      // Words already struck through stay as they were; the rest are struck now.
      tr.doc.nodesBetween(start, stop, (node, pos) => {
        if (!node.isText) return true;
        if (node.marks.some((mark: PmMark) => mark.type === deletion)) return false;
        tr.addMark(Math.max(start, pos), Math.min(stop, pos + node.nodeSize), deletion.create(attrs));
        return false;
      });
      // Backspace leaves the cursor before what it struck; Delete, after.
      if (wasEmpty && pieces.length === 1) cursorTo = oldHead > piece.at ? start : stop;
    }
  }
  if (!tr.docChanged) return null;
  if (cursorTo !== null) tr.setSelection(TextSelection.create(tr.doc, cursorTo));
  tr.setMeta(trackChangesKey, true);
  return tr;
};

// ------------------------------------------------------------- reviewing

export interface ChangeRange {
  from: number;
  to: number;
  kind: 'insertion' | 'deletion';
  author: string;
  date: string;
}

/** Every tracked change in the document, in order, runs of one change joined. */
export const changesIn = (doc: PmNode): ChangeRange[] => {
  const out: ChangeRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    for (const mark of node.marks) {
      const kind = mark.type.name;
      if (kind !== 'insertion' && kind !== 'deletion') continue;
      const last = out[out.length - 1];
      const author = String(mark.attrs['author'] ?? '');
      const date = String(mark.attrs['date'] ?? '');
      if (last && last.kind === kind && last.to === pos && last.author === author) last.to = pos + node.nodeSize;
      else out.push({ from: pos, to: pos + node.nodeSize, kind, author, date });
    }
    return false;
  });
  return out;
};

/** Accept (keep an insertion, remove a deletion) or reject (the reverse) the changes in a range. */
const settle = (state: EditorState, ranges: readonly ChangeRange[], accept: boolean): Transaction | null => {
  const tr = state.tr;
  for (const range of [...ranges].sort((a, b) => b.from - a.from)) {
    const type = state.schema.marks[range.kind];
    if (!type) continue;
    const keep = (range.kind === 'insertion') === accept;
    if (keep) tr.removeMark(range.from, range.to, type);
    else tr.delete(range.from, range.to);
  }
  if (!tr.docChanged) return null;
  return tr.setMeta(trackChangesKey, true);
};

/** The changes the selection touches, or the one the cursor is in. */
const changesAtSelection = (state: EditorState): ChangeRange[] => {
  const { from, to, empty } = state.selection;
  const all = changesIn(state.doc);
  if (!empty) return all.filter((one) => one.to > from && one.from < to);
  for (const kind of ['insertion', 'deletion'] as const) {
    const type = state.schema.marks[kind];
    const range = type ? (getMarkRange(state.doc.resolve(from), type) ?? getMarkRange(state.doc.resolve(Math.max(0, from - 1)), type)) : undefined;
    if (range) return all.filter((one) => one.kind === kind && one.to > range.from && one.from < range.to);
  }
  return [];
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackChanges: {
      acceptChange: () => ReturnType;
      rejectChange: () => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
      /** The next change after the cursor (1) or before it (-1), selected. */
      goToChange: (direction: 1 | -1) => ReturnType;
    };
  }
}

export const TrackChanges = Extension.create({
  name: 'trackChanges',
  addStorage(): TrackChangesStorage {
    return { enabled: false, author: '' };
  },
  addCommands() {
    const run =
      (pick: (state: EditorState) => ChangeRange[], accept: boolean) =>
      () =>
      ({ state, dispatch }: { state: EditorState; dispatch?: (tr: Transaction) => void }) => {
        const tr = settle(state, pick(state), accept);
        if (!tr) return false;
        if (dispatch) dispatch(tr);
        return true;
      };
    return {
      acceptChange: run(changesAtSelection, true),
      rejectChange: run(changesAtSelection, false),
      acceptAllChanges: run((state) => changesIn(state.doc), true),
      rejectAllChanges: run((state) => changesIn(state.doc), false),
      goToChange:
        (direction: 1 | -1) =>
        ({ state, dispatch }) => {
          const all = changesIn(state.doc);
          if (all.length === 0) return false;
          const here = direction === 1 ? state.selection.to : state.selection.from;
          const next =
            direction === 1
              ? (all.find((one) => one.from >= here && !(one.from === state.selection.from && one.to === state.selection.to)) ?? all[0])
              : ([...all].reverse().find((one) => one.to <= here && !(one.from === state.selection.from && one.to === state.selection.to)) ?? all[all.length - 1]);
          if (!next) return false;
          if (dispatch) dispatch(state.tr.setSelection(TextSelection.create(state.doc, next.from, next.to)).scrollIntoView());
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const storage = this.storage as TrackChangesStorage;
    return [
      new Plugin({
        key: trackChangesKey,
        appendTransaction: (transactions, oldState, newState) => trackedEdit(transactions, oldState, newState, storage),
      }),
    ];
  },
});
