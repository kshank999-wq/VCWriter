import { describe, expect, it } from 'vitest';
import { createProjectFile, projectFileSchema, type ProjectFile } from '../project-file.js';
import {
  PLAN_COLLECTIONS,
  fromRows,
  planParts,
  recordsOf,
  toRows,
  withPlanParts,
  withRecords,
} from '../sync-mapping.js';
import { mergeProjects } from '../sync-merge.js';
import { canRestore, restoreDiscardedVersion } from '../sync-recovery.js';
import { addBlock, addChild, createBoard, linkNodes, updateNode } from '../sculptor.js';
import { addItem, createOutline, updateItem } from '../outline.js';
import type { Board, Outline } from '../project-file.js';

/**
 * The plans in the cloud (addendum 07 §4, stage 0).
 *
 * The Sculptor's boards and the Outliner's outlines were the two collections
 * the database had never seen: they live nested in the document, and every
 * other collection is a flat array. So what is worth testing is the seam —
 * that taking them apart and putting them back is lossless, that a merge
 * compares a node the way it compares a beat, and that nothing which cannot be
 * drawn survives the journey.
 */

const BEFORE = '2026-01-01T00:00:00.000Z';
const SYNCED = '2026-06-01T00:00:00.000Z';
const LATER = '2026-07-01T00:00:00.000Z';
const LATEST = '2026-08-01T00:00:00.000Z';

/** A project with a board and an outline in it. */
const planned = (): {
  file: ProjectFile;
  board: Board;
  outline: Outline;
} => {
  const made = createBoard(createProjectFile({ title: 'Lighthouse', format: 'screenplay' }));
  let file = made.file;
  const board = made.board;

  const block = addBlock(file, board.id, { title: 'She takes the job' });
  const scene = addChild(block.file, board.id, block.nodeId!, { title: 'The interview' });
  file = linkNodes(scene.file, board.id, block.nodeId!, scene.nodeId!, { label: 'pays off' }).file;

  const outlined = createOutline(file);
  file = outlined.file;
  const outline = outlined.outline;
  const sceneRow = addItem(file, outline.id, { kind: 'scene', title: 'Warehouse' });
  const beatRow = addItem(sceneRow.file, outline.id, {
    parentId: sceneRow.itemId,
    kind: 'beat',
    title: 'Mara enters.',
  });
  file = beatRow.file;

  return { file, board, outline };
};

/** Everything dated before the last sync, so nothing counts as changed. */
const settled = (file: ProjectFile): ProjectFile => {
  const older = <T extends { createdAt: string; updatedAt: string }>(record: T): T => ({
    ...record,
    createdAt: BEFORE,
    updatedAt: BEFORE,
  });
  return projectFileSchema.parse({
    ...file,
    project: older(file.project),
    lanes: file.lanes.map(older),
    units: file.units.map(older),
    beats: file.beats.map(older),
    researchCategories: file.researchCategories.map(older),
    boards: file.boards.map((board) => ({
      ...older(board),
      nodes: board.nodes.map(older),
      links: board.links.map(older),
    })),
    outlines: file.outlines.map((outline) => ({
      ...older(outline),
      items: outline.items.map(older),
    })),
  });
};

describe('taking the plans apart', () => {
  it('gives five flat lists and puts them back unchanged', () => {
    const { file } = planned();
    const parts = planParts(file);

    expect(parts.boards).toHaveLength(1);
    expect(parts.sculptorNodes.length).toBe(file.boards[0]!.nodes.length);
    expect(parts.sculptorLinks).toHaveLength(1);
    expect(parts.outlines).toHaveLength(1);
    expect(parts.outlineItems).toHaveLength(2);

    expect(withPlanParts(file, parts).boards).toEqual(file.boards);
    expect(withPlanParts(file, parts).outlines).toEqual(file.outlines);
  });

  it('tells a flat link which board it is on, since nesting no longer can', () => {
    const { file, board } = planned();
    expect(planParts(file).sculptorLinks[0]!.boardId).toBe(board.id);
  });

  it('answers for every collection, nested or not, through one door', () => {
    const { file } = planned();
    for (const collection of PLAN_COLLECTIONS) {
      expect(Array.isArray(recordsOf(file, collection))).toBe(true);
    }
    expect(recordsOf(file, 'beats')).toEqual(file.beats);
  });

  it('drops a node whose board has gone rather than keeping it nowhere', () => {
    const { file } = planned();
    const orphaned = withPlanParts(file, { ...planParts(file), boards: [] });
    expect(orphaned.boards).toEqual([]);
  });

  it('drops a link whose ends did not both survive', () => {
    const { file } = planned();
    const parts = planParts(file);
    const kept = parts.sculptorNodes.filter((node) => node.id !== parts.sculptorLinks[0]!.toId);
    const pruned = withPlanParts(file, { ...parts, sculptorNodes: kept });
    expect(pruned.boards[0]!.links).toEqual([]);
  });
});

describe('the plans as rows', () => {
  it('round-trips a board and an outline through the database shape', () => {
    const { file } = planned();
    const back = fromRows(toRows(file));
    expect(back.boards).toEqual(file.boards);
    expect(back.outlines).toEqual(file.outlines);
  });

  it('carries the project on every row, because the policy asks a column', () => {
    const { file } = planned();
    const rows = toRows(file);
    for (const row of [...rows.sculptorNodes, ...rows.sculptorLinks, ...rows.outlineItems]) {
      expect(row['project_id']).toBe(file.project.id);
    }
  });

  it('spells the node’s end in a column SQL will accept', () => {
    const { file } = planned();
    const ends = toRows(file).sculptorNodes.map((row) => row['node_end']);
    expect(ends).toContain('beginning');
    expect(ends).toContain('end');
  });

  it('keeps a row’s research reference, and a promoted row’s binding', () => {
    const { file, outline } = planned();
    const item = file.outlines[0]!.items[0]!;
    const marked = updateItem(file, outline.id, item.id, { status: 'written' });
    const row = toRows(marked).outlineItems.find((candidate) => candidate['id'] === item.id)!;
    expect(row['status']).toBe('written');
    expect(row['source']).toBeNull();
    expect(row['bound_unit_id']).toBeNull();
  });
});

describe('two writers and one plan', () => {
  it('merges a node the way it merges a beat: the newer edit wins, the loser is kept', () => {
    const base = settled(planned().file);
    const boardId = base.boards[0]!.id;
    const nodeId = base.boards[0]!.nodes.find((node) => node.title === 'The interview')!.id;

    const dateNode = (file: ProjectFile, at: string): ProjectFile =>
      projectFileSchema.parse({
        ...file,
        boards: file.boards.map((board) => ({
          ...board,
          nodes: board.nodes.map((node) => (node.id === nodeId ? { ...node, updatedAt: at } : node)),
        })),
      });

    const mine = dateNode(updateNode(base, boardId, nodeId, { title: 'The interview, in the rain' }), LATER);
    const theirs = dateNode(updateNode(base, boardId, nodeId, { title: 'The interview, at night' }), LATEST);

    const result = mergeProjects(mine, theirs, { lastSyncedAt: SYNCED });
    const merged = result.merged.boards[0]!.nodes.find((node) => node.id === nodeId)!;

    expect(merged.title).toBe('The interview, at night');
    const conflict = result.conflicts.find((entry) => entry.id === (nodeId as string));
    expect(conflict?.collection).toBe('sculptorNodes');
    expect(conflict?.discarded['title']).toBe('The interview, in the rain');
  });

  it('carries a new outline row across without a conflict', () => {
    const base = settled(planned().file);
    const outlineId = base.outlines[0]!.id;
    const added = addItem(base, outlineId, { kind: 'idea', title: 'Movement upstairs' });

    const result = mergeProjects(base, added.file, { lastSyncedAt: SYNCED });
    expect(result.conflicts).toEqual([]);
    expect(result.merged.outlines[0]!.items.map((item) => item.title)).toContain('Movement upstairs');
  });

  it('does not lose the plans when nothing about them changed', () => {
    const base = settled(planned().file);
    const result = mergeProjects(base, base, { lastSyncedAt: SYNCED });
    expect(result.merged.boards[0]!.nodes).toHaveLength(base.boards[0]!.nodes.length);
    expect(result.merged.outlines[0]!.items).toHaveLength(2);
  });
});

describe('putting a discarded plan record back', () => {
  it('restores a node into the board it came from', () => {
    const { file } = planned();
    const node = file.boards[0]!.nodes.find((candidate) => candidate.title === 'The interview')!;
    const conflict = {
      collection: 'sculptorNodes' as const,
      id: node.id as string,
      label: node.title,
      kept: 'remote' as const,
      localUpdatedAt: LATER,
      remoteUpdatedAt: LATEST,
      discarded: { ...node, title: 'The interview, in the rain' } as unknown as Record<string, unknown>,
    };

    expect(canRestore(file, conflict)).toBe(true);
    const back = restoreDiscardedVersion(file, conflict, LATEST);
    expect(back.boards[0]!.nodes.find((candidate) => candidate.id === node.id)?.title).toBe(
      'The interview, in the rain',
    );
  });

  it('refuses a node whose board has gone, rather than appearing to restore it', () => {
    const { file } = planned();
    const node = file.boards[0]!.nodes[0]!;
    const boardless = projectFileSchema.parse({ ...file, boards: [] });
    expect(
      canRestore(boardless, {
        collection: 'sculptorNodes',
        id: node.id as string,
        label: node.title,
        kept: 'remote',
        localUpdatedAt: LATER,
        remoteUpdatedAt: LATEST,
        discarded: { ...node } as unknown as Record<string, unknown>,
      }),
    ).toBe(false);
  });

  it('replaces one collection without disturbing the others', () => {
    const { file } = planned();
    const fewer = withRecords(file, 'outlineItems', planParts(file).outlineItems.slice(0, 1));
    expect(fewer.outlines[0]!.items).toHaveLength(1);
    expect(fewer.boards[0]!.nodes).toEqual(file.boards[0]!.nodes);
  });
});
