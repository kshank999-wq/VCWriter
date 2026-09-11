import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { initialOrderKeys, orderKeyBetween } from './ordering.js';
import { outlineSchema, type Outline, type OutlineItem } from './entities/outline.js';
import { retitleScript } from './planning.js';
import type { ResearchItem } from './entities/research.js';
import type { ProjectFile } from './project-file.js';
import type { OutlineId, OutlineItemId, ResearchItemId } from './ids.js';

/**
 * The Outliner (addendum 06), stages 1 and 4: the document, its shape rules,
 * and the research dragged into it.
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

/**
 * Where a row lands among its siblings.
 *
 * `afterId` puts it directly after the row named, and **null means the end**,
 * which is where a row added with nothing selected belongs. `beforeId` is the
 * other half, and exists because "the end" cannot express *first*: dropping
 * something above the opening scene is an ordinary thing to want and there was
 * no way to say it. Where both are given, `beforeId` wins.
 */
const keyFor = (
  siblings: readonly OutlineItem[],
  at: { afterId?: OutlineItemId | null; beforeId?: OutlineItemId | null },
): string => {
  if (siblings.length === 0) return initialOrderKeys(1)[0] as string;

  if (at.beforeId !== undefined && at.beforeId !== null) {
    const index = siblings.findIndex((item) => item.id === at.beforeId);
    if (index !== -1) {
      return orderKeyBetween(siblings[index - 1]?.orderKey ?? null, siblings[index]?.orderKey ?? null);
    }
  }

  const afterId = at.afterId ?? null;
  if (afterId === null) return orderKeyBetween(siblings[siblings.length - 1]?.orderKey ?? null, null);
  const index = siblings.findIndex((item) => item.id === afterId);
  if (index === -1) return orderKeyBetween(siblings[siblings.length - 1]?.orderKey ?? null, null);
  return orderKeyBetween(siblings[index]?.orderKey ?? null, siblings[index + 1]?.orderKey ?? null);
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
    orderKey: keyFor(outlineChildren(outline, parentId), { afterId: input.afterId ?? null }),
    kind: input.kind ?? 'note',
    title: input.title ?? '',
  });

  return {
    file: withOutline(file, outlineId, (current) => ({ ...current, items: [...current.items, item] })),
    itemId: item.id,
  };
};

/**
 * What a row says, and what it is. Anything not given is left alone.
 *
 * Retitling a **promoted** row retitles the scene or beat it is (§6): they are
 * one object, so there is no version of this where the row and the script say
 * different things.
 */
export const updateItem = (
  file: ProjectFile,
  outlineId: OutlineId,
  itemId: OutlineItemId,
  patch: Partial<Pick<OutlineItem, 'title' | 'body' | 'kind' | 'status' | 'collapsed'>>,
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const before = outline ? findOutlineItem(outline, itemId) : null;
  const next = withOutline(file, outlineId, (current) => ({
    ...current,
    items: current.items.map((item) => (item.id === itemId ? touch({ ...item, ...patch }) : item)),
  }));
  if (patch.title === undefined || !before) return next;
  if (before.boundUnitId !== null) return retitleScript(next, { unitId: before.boundUnitId }, patch.title);
  if (before.boundBeatId !== null) return retitleScript(next, { beatId: before.boundBeatId }, patch.title);
  return next;
};

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
  to: { parentId: OutlineItemId | null; afterId?: OutlineItemId | null; beforeId?: OutlineItemId | null },
): ProjectFile => {
  const outline = findOutline(file, outlineId);
  const item = outline ? findOutlineItem(outline, itemId) : null;
  if (!outline || !item) return file;
  if (to.parentId !== null && !findOutlineItem(outline, to.parentId)) return file;
  if (to.parentId === itemId) return file;
  if (to.parentId !== null && isUnder(outline, to.parentId, itemId)) return file;

  // The dragged row is lifted out of the list before the key is worked out,
  // so "after the row below me" is a real move rather than a no-op.
  const siblings = outlineChildren(outline, to.parentId).filter((candidate) => candidate.id !== itemId);
  const orderKey = keyFor(siblings, to);

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

// ------------------------------------ research, dragged in (§5)

/**
 * What a research item becomes when it is dropped into the outline.
 *
 * The category it is filed under says it: a name from **Characters** arrives
 * as a Character, a place from **Locations** as a Setting. That is the whole
 * of the guess, and where the folder is the writer's own — a system key it has
 * no equivalent for — it arrives as a Note, which is the type that claims
 * least about what the thing is.
 */
const FROM_CATEGORY: Record<string, string> = {
  characters: 'character',
  locations: 'setting',
  props: 'prop',
  ideas: 'idea',
  plot_points: 'beat',
  themes: 'note',
};

export const kindForResearch = (systemKey: string | null): string =>
  (systemKey ? FROM_CATEGORY[systemKey] : undefined) ?? 'note';

/**
 * A row that **references** a research item rather than copying it (§5).
 *
 * The reference is the point. A copy would be the same words in two places,
 * and the moment the writer edits one of them the outline is telling a
 * different story from the shelf — which is exactly what §5 of the source
 * specification means by "linked reference rather than an unrelated copy".
 *
 * So the row's **name is the research item's** and is read through to it, and
 * its **body is its own**: *what this character wants in this scene* is not a
 * fact about the character, and belongs to the row.
 *
 * The same item can be dropped in more than once. A character appears in many
 * scenes, and each of those is a different thing to say about them; this is
 * not the Sculptor's one-claim rule, because a reference is not a claim.
 */
export const addResearchRow = (
  file: ProjectFile,
  outlineId: OutlineId,
  researchItemId: ResearchItemId,
  input: { parentId?: OutlineItemId | null; afterId?: OutlineItemId | null; beforeId?: OutlineItemId | null } = {},
): { file: ProjectFile; itemId: OutlineItemId | null } => {
  const outline = findOutline(file, outlineId);
  const source = file.researchItems.find((candidate) => candidate.id === researchItemId);
  if (!outline || !source) return { file, itemId: null };

  const parentId = input.parentId ?? null;
  if (parentId !== null && !findOutlineItem(outline, parentId)) return { file, itemId: null };

  const category = file.researchCategories.find((candidate) => candidate.id === source.categoryId);
  const at = nowIso();
  const item: OutlineItem = {
    id: newId<OutlineItemId>(),
    outlineId,
    parentId,
    orderKey: keyFor(outlineChildren(outline, parentId), input),
    kind: kindForResearch(category?.systemKey ?? null),
    // Kept as well as referenced, so an outline still reads if the item is
    // ever removed from the shelf — the reference is what is read, and this
    // is what is left when there is nothing to read through to.
    title: source.title,
    body: '',
    status: '',
    collapsed: false,
    boundUnitId: null,
    boundBeatId: null,
    source: { type: 'research_item', id: researchItemId as string },
    createdAt: at,
    updatedAt: at,
  };

  return {
    file: withOutline(file, outlineId, (current) => ({ ...current, items: [...current.items, item] })),
    itemId: item.id,
  };
};

/**
 * What a row is called: the research item's name where it has one.
 *
 * **Read through rather than copied across**, so renaming on the shelf renames
 * every row that references it and there is no version of this where the two
 * disagree. A row that references something no longer on the shelf falls back
 * to the name it arrived with, which is better than going blank.
 */
export const rowTitle = (file: ProjectFile, item: OutlineItem): string => {
  if (item.source?.type !== 'research_item') return item.title;
  const source = file.researchItems.find((candidate) => (candidate.id as string) === item.source?.id);
  return source ? source.title : item.title;
};

/** The research item a row references, where it still exists. */
export const rowSource = (file: ProjectFile, item: OutlineItem): ResearchItem | null => {
  if (item.source?.type !== 'research_item') return null;
  return file.researchItems.find((candidate) => (candidate.id as string) === item.source?.id) ?? null;
};

/** Every row referencing this research item, so the shelf can say it is in use. */
export const rowsUsing = (outline: Outline, researchItemId: ResearchItemId): OutlineItem[] =>
  outline.items.filter(
    (item) => item.source?.type === 'research_item' && item.source.id === (researchItemId as string),
  );
