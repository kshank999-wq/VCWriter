import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import { outlineSchema, type Outline, type OutlineItem } from './entities/outline.js';
import type { ProjectFile } from './project-file.js';
import type { OutlineId, OutlineItemId } from './ids.js';

/**
 * The Outliner (addendum 06), stage 1: the document and the shape rules.
 *
 * **A tree of typed rows.** A row's *type* says what it is and its *parent*
 * says how deep it is, and neither constrains the other (§4) — which is what
 * lets a Character sit under a beat, a Note under that Character, and an Idea
 * under the Note, without any of it being a special case.
 *
 * Everything here is pure and returns a new `ProjectFile`, like the rest of
 * the domain. Nothing in this file knows what an outline looks like.
 */

// -------------------------------------------------------- the document

/**
 * A new outline: a name and nothing in it.
 *
 * **No template** — the Sculptor refuses to offer a paradigm (addendum 03
 * §11) and this refuses for the same reason. A writer who wants three acts
 * types three rows.
 */
export const createOutline = (
  file: ProjectFile,
  input: { name?: string } = {},
): { file: ProjectFile; outline: Outline } => {
  const at = nowIso();
  const outline = outlineSchema.parse({
    id: newId<OutlineId>(),
    projectId: file.project.id,
    name: input.name ?? 'Outline',
    items: [],
    createdAt: at,
    updatedAt: at,
  });
  return { file: { ...file, outlines: [...(file.outlines ?? []), outline] }, outline };
};

export const outlinesOf = (file: ProjectFile): Outline[] => file.outlines ?? [];

export const findOutline = (file: ProjectFile, outlineId: OutlineId): Outline | null =>
  outlinesOf(file).find((outline) => outline.id === outlineId) ?? null;

const touch = <T extends { updatedAt: string }>(row: T): T => ({ ...row, updatedAt: nowIso() });

const withOutline = (
  file: ProjectFile,
  outlineId: OutlineId,
  change: (outline: Outline) => Outline,
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  if (!outline) return file;
  const next = touch(change(outline));
  return {
    ...file,
    outlines: outlinesOf(file).map((candidate) => (candidate.id === outlineId ? next : candidate)),
    project: { ...file.project, updatedAt: nowIso() },
  };
};

// --------------------------------------------------------- reading it

const byOrder = (a: { orderKey: string }, b: { orderKey: string }): number =>
  a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0;

/** The rows directly under one, or the top of the outline when null. */
export const outlineChildren = (outline: Outline, parentId: OutlineItemId | null): OutlineItem[] =>
  outline.items.filter((item) => item.parentId === parentId).sort(byOrder);

export const findOutlineItem = (outline: Outline, itemId: OutlineItemId): OutlineItem | null =>
  outline.items.find((item) => item.id === itemId) ?? null;

/** A row's parent, or null where it is at the top. */
export const outlineParent = (outline: Outline, item: OutlineItem): OutlineItem | null =>
  item.parentId === null ? null : findOutlineItem(outline, item.parentId);

export interface OutlineRow {
  item: OutlineItem;
  /** How far in it is drawn: zero at the top. */
  depth: number;
  /** How many rows hang under it, so a folded one can say what it hides. */
  childCount: number;
}

/**
 * The outline as it reads, top to bottom, with the depth of each row.
 *
 * **Depth is computed, never stored** (§4). A folded row's children are left
 * out entirely — the writer folded them — and their order is untouched, so
 * unfolding puts everything back exactly as it was.
 */
export const outlineRows = (outline: Outline): OutlineRow[] => {
  const rows: OutlineRow[] = [];
  const walk = (parentId: OutlineItemId | null, depth: number): void => {
    for (const item of outlineChildren(outline, parentId)) {
      const children = outlineChildren(outline, item.id);
      rows.push({ item, depth, childCount: children.length });
      if (!item.collapsed) walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
};

/** Every row under this one, at any depth, itself included. */
export const outlineSubtree = (outline: Outline, itemId: OutlineItemId): OutlineItem[] => {
  const held = new Set<string>([itemId as string]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const item of outline.items) {
      if (item.parentId !== null && held.has(item.parentId as string) && !held.has(item.id as string)) {
        held.add(item.id as string);
        grew = true;
      }
    }
  }
  return outline.items.filter((item) => held.has(item.id as string));
};

/** Whether one row is somewhere under another: the check every move needs. */
export const isUnder = (outline: Outline, itemId: OutlineItemId, ancestorId: OutlineItemId): boolean => {
  let walk = findOutlineItem(outline, itemId);
  for (let step = 0; walk && step <= outline.items.length; step += 1) {
    if (walk.id === ancestorId) return step > 0;
    walk = walk.parentId ? findOutlineItem(outline, walk.parentId) : null;
  }
  return false;
};

/** How deep a row sits, counted from its parents rather than stored. */
export const depthOf = (outline: Outline, item: OutlineItem): number => {
  let depth = 0;
  let walk = outlineParent(outline, item);
  for (; walk && depth <= outline.items.length; depth += 1) walk = outlineParent(outline, walk);
  return depth;
};

// --------------------------------------------------------- writing it

/** A key that puts a row after the one named, or at the end of its siblings. */
const keyAfter = (siblings: readonly OutlineItem[], afterId: OutlineItemId | null): string => {
  if (siblings.length === 0) return initialOrderKeys(1)[0] as string;
  if (afterId === null) return orderKeyBetween(siblings[siblings.length - 1]?.orderKey ?? null, null);
  const at = siblings.findIndex((item) => item.id === afterId);
  if (at === -1) return orderKeyBetween(siblings[siblings.length - 1]?.orderKey ?? null, null);
  return orderKeyBetween(siblings[at]?.orderKey ?? null, siblings[at + 1]?.orderKey ?? null);
};

const madeItem = (input: {
  outlineId: OutlineId;
  parentId: OutlineItemId | null;
  orderKey: string;
  kind: string;
  title: string;
}): OutlineItem => {
  const at = nowIso();
  return {
    id: newId<OutlineItemId>(),
    outlineId: input.outlineId,
    parentId: input.parentId,
    orderKey: input.orderKey,
    kind: input.kind,
    title: input.title,
    body: '',
    status: '',
    collapsed: false,
    boundUnitId: null,
    boundBeatId: null,
    source: null,
    createdAt: at,
    updatedAt: at,
  };
};

/**
 * A row, of any type, anywhere in the tree.
 *
 * There is one function rather than one per type, because **the type is a
 * word and the position is the position** (§4). `addScene` and `addCharacter`
 * would be the same function twice with the hierarchy baked into their names.
 */
export const addItem = (
  file: ProjectFile,
  outlineId: OutlineId,
  input: { parentId?: OutlineItemId | null; afterId?: OutlineItemId | null; kind?: string; title?: string } = {},
): { file: ProjectFile; itemId: OutlineItemId | null } => {
  const outline = findOutline(file, outlineId);
  if (!outline) return { file, itemId: null };

  const parentId = input.parentId ?? null;
  if (parentId !== null && !findOutlineItem(outline, parentId)) return { file, itemId: null };

  const item = madeItem({
    outlineId,
    parentId,
    orderKey: keyAfter(outlineChildren(outline, parentId), input.afterId ?? null),
    kind: input.kind ?? 'note',
    title: input.title ?? '',
  });

  return {
    file: withOutline(file, outlineId, (current) => ({ ...current, items: [...current.items, item] })),
    itemId: item.id,
  };
};

/** What a row says, and what it is. Anything not given is left alone. */
export const updateItem = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  patch: Partial<Pick<OutlineItem, 'title' | 'body' | 'kind' | 'status' | 'collapsed'>>,
): ProjectFile =>
  withOutline(file, outlineId, (outline) => ({
    ...outline,
    items: outline.items.map((item) => (item.id === itemId ? touch({ ...item, ...patch }) : item)),
  }));

/**
 * A row and everything under it, taken out of the outline.
 *
 * **Nothing in the script is touched** — a row is a plan until it is promoted,
 * and even a promoted one only loses its plan here (§10). The scene stays.
 */
export const removeItem = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile => {
  const outline = findOutline(file, outlineId);
  if (!outline || !findOutlineItem(outline, itemId)) return file;
  const doomed = new Set(outlineSubtree(outline, itemId).map((item) => item.id as string));
  return withOutline(file, outlineId, (current) => ({
    ...current,
    items: current.items.filter((item) => !doomed.has(item.id as string)),
  }));
};

/**
 * A row moved to a new parent and a new place among its siblings, **with
 * everything under it**.
 *
 * The one rule that makes a tree a tree: **a row cannot be moved inside
 * itself.** Dropping a scene onto one of its own beats would cut the branch
 * off from the trunk and leave a ring of rows that is no longer reachable from
 * the top, so it is refused rather than repaired.
 */
export const moveItem = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  to: { parentId: OutlineItemId | null; afterId?: OutlineItemId | null },
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item) return file;
  if (to.parentId !== null && !findOutlineItem(outline, to.parentId)) return file;
  if (to.parentId === itemId) return file;
  if (to.parentId !== null && isUnder(outline, to.parentId, itemId)) return file;

  const siblings = outlineChildren(outline, to.parentId).filter((candidate) => candidate.id !== itemId);
  const orderKey = keyAfter(siblings, to.afterId ?? null);

  return withOutline(file, outlineId, (current) => ({
    ...current,
    items: current.items.map((candidate) =>
      candidate.id === itemId ? touch({ ...candidate, parentId: to.parentId, orderKey }) : candidate,
    ),
  }));
};

/**
 * One step deeper: under the row above it, as its last child.
 *
 * **The row above is the only place it can go.** A row indented past a
 * sibling it is not next to would be under something that is not above it on
 * the screen, which is not what the key means. The first row of a group has
 * nothing above it at its own level, and nothing happens.
 */
export const indentItem = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item) return file;

  const siblings = outlineChildren(outline, item.parentId);
  const at = siblings.findIndex((candidate) => candidate.id === itemId);
  const above = at > 0 ? siblings[at - 1] : null;
  if (!above) return file;

  return moveItem(file, outlineId, itemId, { parentId: above.id, afterId: null });
};

/**
 * One step out: a sibling of its parent, directly after it.
 *
 * **Directly after, rather than at the end**, because a row outdented out of
 * the middle of a scene belongs where the scene is, not at the bottom of the
 * outline. Rows that were under it come with it; rows that were *after* it
 * stay where they were, under the parent — outdenting moves one branch, not
 * the rest of the trunk.
 */
export const outdentItem = (file: ProjectFile, outlineId: OutlineId, itemId: OutlineItemId): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  const parent = outline && item ? outlineParent(outline, item) : null;
  if (!outline || !item || !parent) return file;

  return moveItem(file, outlineId, itemId, { parentId: parent.parentId, afterId: parent.id });
};

/** A row moved one place among its siblings, keeping everything under it. */
export const nudgeItem = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  direction: -1 | 1,
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item) return file;

  const siblings = outlineChildren(outline, item.parentId);
  const at = siblings.findIndex((candidate) => candidate.id === itemId);
  const to = at + direction;
  if (at === -1 || to < 0 || to >= siblings.length) return file;

  const before = direction === 1 ? siblings[to]?.orderKey ?? null : siblings[to - 1]?.orderKey ?? null;
  const after = direction === 1 ? siblings[to + 1]?.orderKey ?? null : siblings[to]?.orderKey ?? null;

  return withOutline(file, outlineId, (current) => ({
    ...current,
    items: current.items.map((candidate) =>
      candidate.id === itemId ? touch({ ...candidate, orderKey: orderKeyBetween(before, after) }) : candidate,
    ),
  }));
};

/** Fold or unfold everything at once (§8). */
export const foldAll = (file: ProjectFile, outlineId: OutlineId, collapsed: boolean): ProjectFile =>
  withOutline(file, outlineId, (outline) => ({
    ...outline,
    items: outline.items.map((item) =>
      // Only rows that hold something can be folded; folding a leaf would
      // leave a disclosure arrow with nothing behind it.
      item.collapsed === collapsed || outlineChildren(outline, item.id).length === 0
        ? item
        : touch({ ...item, collapsed }),
    ),
  }));

export const renameOutline = (file: ProjectFile, outlineId: OutlineId, name: string): ProjectFile =>
  withOutline(file, outlineId, (outline) => ({ ...outline, name }));

/** How much of the outline is in the script, for the header (§6). */
export const outlineTally = (outline: Outline): { rows: number; scenes: number; promoted: number } => ({
  rows: outline.items.length,
  scenes: outline.items.filter((item) => item.kind === 'scene').length,
  promoted: outline.items.filter((item) => item.boundUnitId !== null || item.boundBeatId !== null).length,
});
