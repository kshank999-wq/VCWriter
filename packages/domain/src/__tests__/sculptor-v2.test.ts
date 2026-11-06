import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  addNode,
  boardSchema,
  canReparent,
  collapseAll,
  collapseBranch,
  collapseToLevel,
  copyBranch,
  cornerDots,
  createBoard,
  createProjectFile,
  downgradeBoard,
  drawnLinks,
  duplicatePlacement,
  enterNode,
  breadcrumbsOf,
  explodeAll,
  explodeBranch,
  findBoard,
  findNode,
  isBranchOpen,
  linkNodes,
  makeReusable,
  mapPicture,
  moveNodeTo,
  nestedSummary,
  parseProjectFile,
  pasteBranch,
  pinNode,
  autoLayout,
  placeEntity,
  placeSource,
  placementsOfEntity,
  removeEntity,
  removeNode,
  revealNode,
  searchBoard,
  serializeProjectFile,
  setNodeType,
  subtreeOf,
  titleOf,
  toRows,
  fromRows,
  updateNode,
  upgradeBoard,
  saveView,
  applyView,
  type Board,
  type ProjectFile,
  type SculptorNodeId,
} from '../index.js';

/**
 * Story Sculptor 2.0 (addendum 03 v2), against its definition of done (§14).
 */

const boardOf = (file: ProjectFile, board: Board): Board => findBoard(file, board.id) as Board;

/** A frame → scene → character → action story, Mara in two scenes. */
const story = () => {
  let file = addCharacter(createProjectFile({ title: 'Blackout', format: 'screenplay' }), { name: 'Mara' });
  const mara = file.characters.at(-1)!.id as string;
  const made = createBoard(file);
  file = made.file;
  const id = made.board.id;
  const add = (input: Parameters<typeof addNode>[2]) => {
    const r = addNode(file, id, input);
    file = r.file;
    return r.nodeId as SculptorNodeId;
  };
  const act = add({ kind: 'frame', title: 'Act one' });
  const warehouse = add({ parentId: act, kind: 'scene', title: 'Warehouse' });
  const placed = placeSource(file, id, { kind: 'character', id: mara }, warehouse);
  file = placed.file;
  const maraInWarehouse = placed.nodeId as SculptorNodeId;
  const opens = add({ parentId: maraInWarehouse, kind: 'action', title: 'Opens the case' });
  const deeper = add({ parentId: opens, kind: 'note', title: 'The lock is new' });
  const roof = add({ parentId: act, kind: 'scene', title: 'Rooftop' });
  const again = placeSource(file, id, { kind: 'character', id: mara }, roof);
  file = again.file;
  const act2 = add({ kind: 'frame', title: 'Act two' });
  return { file, board: made.board, mara, act, warehouse, maraInWarehouse, opens, deeper, roof, maraOnRoof: again.nodeId as SculptorNodeId, act2 };
};

describe('one canonical Sculptor, made of typed cards nested without limit', () => {
  it('builds frame → scene → character → action and keeps going deeper', () => {
    const s = story();
    const board = boardOf(s.file, s.board);
    expect(board.schemaVersion).toBe(2);
    expect(findNode(board, s.warehouse)!.parentId).toBe(s.act);
    expect(findNode(board, s.maraInWarehouse)!.kind).toBe('character');
    expect(findNode(board, s.opens)!.parentId).toBe(s.maraInWarehouse);
    expect(findNode(board, s.deeper)!.parentId).toBe(s.opens);
    let file = s.file;
    let parent = s.deeper;
    for (let i = 0; i < 12; i += 1) {
      const r = addNode(file, s.board.id, { parentId: parent, title: `Level ${i}` });
      file = r.file;
      parent = r.nodeId as SculptorNodeId;
    }
    expect(subtreeOf(boardOf(file, s.board), s.act).length).toBeGreaterThan(18);
  });
});

describe('definitions and placements (§4)', () => {
  it('places one character in two scenes without a second record, and renames both at once', () => {
    const s = story();
    const board = boardOf(s.file, s.board);
    const a = findNode(board, s.maraInWarehouse)!;
    const b = findNode(board, s.maraOnRoof)!;
    expect(a.entityId).toBe(b.entityId);
    expect(board.entities).toHaveLength(1);
    expect(s.file.characters.filter((one) => one.name === 'Mara')).toHaveLength(1);

    const renamed = updateNode(s.file, s.board.id, s.maraOnRoof, { title: 'Mara Kessler' });
    const after = boardOf(renamed, s.board);
    expect(titleOf(renamed, after, findNode(after, s.maraInWarehouse)!)).toBe('Mara Kessler');
    expect(renamed.characters.find((one) => (one.id as string) === s.mara)!.name).toBe('Mara Kessler');
  });

  it('keeps local context on the placement: details are per card', () => {
    const s = story();
    const board = boardOf(s.file, s.board);
    expect(findNode(board, s.maraInWarehouse)!.fields).toEqual({});
  });

  it('deleting a placement leaves the master and the other placement', () => {
    const s = story();
    const file = removeNode(s.file, s.board.id, s.maraInWarehouse);
    const board = boardOf(file, s.board);
    expect(findNode(board, s.maraInWarehouse)).toBeNull();
    expect(findNode(board, s.opens)).toBeNull();
    expect(findNode(board, s.maraOnRoof)).not.toBeNull();
    expect(board.entities).toHaveLength(1);
    expect(file.characters).toHaveLength(s.file.characters.length);
  });

  it('deleting the master on purpose removes its placements, never the cast record', () => {
    const s = story();
    const entityId = findNode(boardOf(s.file, s.board), s.maraOnRoof)!.entityId!;
    const file = removeEntity(s.file, s.board.id, entityId);
    const board = boardOf(file, s.board);
    expect(placementsOfEntity(board, entityId)).toHaveLength(0);
    expect(file.characters.some((one) => (one.id as string) === s.mara)).toBe(true);
  });

  it('a duplicate placement shares the definition; a pasted clone can be a new definition', () => {
    const s = story();
    const dup = duplicatePlacement(s.file, s.board.id, s.roof);
    const board = boardOf(dup.file, s.board);
    expect(findNode(board, dup.nodeId!)!.entityId).toBe(findNode(board, s.roof)!.entityId);

    const reusable = makeReusable(s.file, s.board.id, s.warehouse);
    const clip = copyBranch(boardOf(reusable.file, s.board), s.warehouse)!;
    const pasted = pasteBranch(reusable.file, s.board.id, clip, s.act2, { asNew: true });
    const next = boardOf(pasted.file, s.board);
    expect(findNode(next, pasted.nodeId!)!.entityId).not.toBe(reusable.entityId);
    // Mara is still Mara in the copy.
    const maraCopies = next.nodes.filter((node) => node.kind === 'character');
    expect(new Set(maraCopies.map((node) => node.entityId)).size).toBe(1);
  });

  it('places a board definition from the library under another card', () => {
    const s = story();
    const made = makeReusable(s.file, s.board.id, s.act2);
    const placed = placeEntity(made.file, s.board.id, made.entityId!, s.act);
    expect(findNode(boardOf(placed.file, s.board), placed.nodeId!)!.entityId).toBe(made.entityId);
  });
});

describe('containment never loops; cross-links may (§7)', () => {
  it('refuses a card under itself or under its own descendant', () => {
    const s = story();
    const board = boardOf(s.file, s.board);
    expect(canReparent(board, s.act, s.act)).toBe(false);
    expect(canReparent(board, s.act, s.deeper)).toBe(false);
    expect(moveNodeTo(s.file, s.board.id, s.act, { parentId: s.opens })).toBe(s.file);
  });

  it('reparenting moves the branch with it', () => {
    const s = story();
    const moved = moveNodeTo(s.file, s.board.id, s.maraInWarehouse, { parentId: s.roof });
    const board = boardOf(moved, s.board);
    expect(findNode(board, s.maraInWarehouse)!.parentId).toBe(s.roof);
    expect(findNode(board, s.opens)!.parentId).toBe(s.maraInWarehouse);
  });

  it('allows a cycle of cross-links', () => {
    const s = story();
    let file = linkNodes(s.file, s.board.id, s.act, s.roof, { type: 'causes' }).file;
    file = linkNodes(file, s.board.id, s.roof, s.act, { type: 'setup_payoff' }).file;
    expect(boardOf(file, s.board).links).toHaveLength(2);
  });

  it('will not change a bound or character card into another type', () => {
    const s = story();
    expect(setNodeType(s.file, s.board.id, s.maraOnRoof, 'scene')).toBe(s.file);
    const changed = setNodeType(s.file, s.board.id, s.deeper, 'beat');
    expect(findNode(boardOf(changed, s.board), s.deeper)!.kind).toBe('beat');
  });
});

describe('explode and collapse (§6)', () => {
  it('Collapse All shows the frames; Explode All shows everything', () => {
    const s = story();
    const collapsed = mapPicture(boardOf(collapseAll(s.file, s.board.id), s.board));
    expect(collapsed.cards.map((card) => card.node.id).sort()).toEqual([s.act, s.act2].sort());
    const exploded = mapPicture(boardOf(explodeAll(collapseAll(s.file, s.board.id), s.board.id), s.board));
    expect(exploded.cards).toHaveLength(boardOf(s.file, s.board).nodes.length);
  });

  it('Collapse to Scene shows frames and scenes and counts what is hidden', () => {
    const s = story();
    const file = collapseToLevel(s.file, s.board.id, { kind: 'type', type: 'scene' });
    const board = boardOf(file, s.board);
    const shown = mapPicture(board).cards.map((card) => card.node.kind);
    expect(new Set(shown)).toEqual(new Set(['frame', 'scene']));
    const summary = nestedSummary(board, s.warehouse);
    expect(summary.total).toBe(3);
    expect(cornerDots(summary).types).toEqual(['character', 'action', 'note']);
  });

  it('collapses to a numbered depth, root = 0', () => {
    const s = story();
    const board = boardOf(collapseToLevel(s.file, s.board.id, { kind: 'depth', depth: 1 }), s.board);
    expect(new Set(mapPicture(board).cards.map((card) => card.node.kind))).toEqual(new Set(['frame', 'scene']));
  });

  it('explodes one branch and leaves the others folded, then collapses only that one', () => {
    const s = story();
    let file = collapseAll(s.file, s.board.id);
    file = explodeBranch(file, s.board.id, s.act);
    let board = boardOf(file, s.board);
    expect(isBranchOpen(board, s.opens)).toBe(true);
    expect(mapPicture(board).visible.has(s.deeper)).toBe(true);
    file = collapseBranch(file, s.board.id, s.maraInWarehouse);
    board = boardOf(file, s.board);
    expect(mapPicture(board).visible.has(s.opens)).toBe(false);
    expect(mapPicture(board).visible.has(s.maraOnRoof)).toBe(true);
  });

  it('keeps cross-links through a fold, drawn to the card standing in for the hidden end', () => {
    const s = story();
    let file = linkNodes(s.file, s.board.id, s.deeper, s.roof, { type: 'setup_payoff' }).file;
    file = collapseBranch(file, s.board.id, s.warehouse);
    const board = boardOf(file, s.board);
    const { lines } = drawnLinks(board, mapPicture(board).visible);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fromId).toBe(s.warehouse);
    expect(lines[0]!.aggregated).toBe(true);
    expect(board.links).toHaveLength(1);
  });

  it('enters a card as its own mini map, with breadcrumbs back up', () => {
    const s = story();
    const file = enterNode(s.file, s.board.id, s.warehouse);
    const board = boardOf(file, s.board);
    expect(breadcrumbsOf(board).map((node) => node.id)).toEqual([s.act, s.warehouse]);
    expect(mapPicture(board).cards[0]!.node.id).toBe(s.warehouse);
    expect(mapPicture(board).visible.has(s.roof)).toBe(false);
    expect(mapPicture(boardOf(enterNode(file, s.board.id, null), s.board)).visible.has(s.roof)).toBe(true);
  });
});

describe('search, layout and saved views (§11)', () => {
  it('finds a card inside a fold with its path, and reveals it', () => {
    const s = story();
    const folded = collapseAll(s.file, s.board.id);
    const hits = searchBoard(folded, boardOf(folded, s.board), 'lock');
    expect(hits[0]!.path).toEqual(['Act one', 'Warehouse', 'Mara', 'Opens the case']);
    const shown = revealNode(folded, s.board.id, hits[0]!.node.id);
    expect(mapPicture(boardOf(shown, s.board)).visible.has(s.deeper)).toBe(true);
  });

  it('lays out deterministically, keeps a pinned card where it was put, and Auto Layout forgets pins', () => {
    const s = story();
    const one = mapPicture(boardOf(s.file, s.board));
    const two = mapPicture(boardOf(s.file, s.board));
    expect(one.cards.map((c) => [c.node.id, c.x, c.y])).toEqual(two.cards.map((c) => [c.node.id, c.x, c.y]));
    const pinned = pinNode(s.file, s.board.id, s.warehouse, { x: 900, y: 40 });
    const card = mapPicture(boardOf(pinned, s.board)).cards.find((c) => c.node.id === s.warehouse)!;
    expect([card.x, card.y]).toEqual([900, 40]);
    const child = mapPicture(boardOf(pinned, s.board)).cards.find((c) => c.node.id === s.maraInWarehouse)!;
    expect(child.x).toBeGreaterThan(900);
    const reset = mapPicture(boardOf(autoLayout(pinned, s.board.id), s.board));
    expect(reset.cards.map((c) => [c.node.id, c.x, c.y])).toEqual(one.cards.map((c) => [c.node.id, c.x, c.y]));
  });

  it('saves and reapplies a view without touching the story', () => {
    const s = story();
    const saved = saveView(collapseAll(s.file, s.board.id), s.board.id, 'Overview');
    const exploded = explodeAll(saved.file, s.board.id);
    const back = applyView(exploded, s.board.id, saved.viewId!);
    expect(mapPicture(boardOf(back, s.board)).cards).toHaveLength(2);
    expect(boardOf(back, s.board).nodes).toHaveLength(boardOf(s.file, s.board).nodes.length);
  });
});

describe('save and reopen (§12, §14)', () => {
  it('reopens the same after explode, collapse, links and reparenting, through the file and the database', () => {
    const s = story();
    let file = linkNodes(s.file, s.board.id, s.opens, s.roof, { type: 'causes', label: 'why she runs' }).file;
    file = collapseToLevel(file, s.board.id, { kind: 'type', type: 'scene' });
    file = explodeBranch(file, s.board.id, s.warehouse);
    file = moveNodeTo(file, s.board.id, s.roof, { parentId: s.act2 });

    const reopened = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(boardOf(reopened, s.board)).toEqual(boardOf(file, s.board));

    const synced = fromRows(toRows(file));
    const back = (synced.boards ?? []).find((one) => one.id === s.board.id)!;
    expect(back.links[0]!.type).toBe('causes');
    expect(back.viewState).toEqual(boardOf(file, s.board).viewState);
    expect(back.entities).toEqual(boardOf(file, s.board).entities);
    expect(mapPicture(back).cards.map((c) => c.node.id)).toEqual(mapPicture(boardOf(file, s.board)).cards.map((c) => c.node.id));
  });
});

describe('the version-1 board, upgraded once and reversibly (§13)', () => {
  const legacy = () => {
    let file = addCharacter(createProjectFile({ title: 'Old', format: 'screenplay' }), { name: 'Jonah' });
    const jonah = file.characters.at(-1)!.id as string;
    const at = '2026-01-01T00:00:00.000Z';
    const col = (id: string, kind: string, name: string, key: string, fields: { id: string; name: string }[] = []) => ({
      id,
      name,
      kind,
      orderKey: key,
      fields: fields.map((f, i) => ({ ...f, kind: 'line', orderKey: `a${i}` })),
    });
    const node = (id: string, columnId: string, parentId: string | null, title: string, extra: Record<string, unknown> = {}) => ({
      id,
      boardId: 'b0000000-0000-4000-8000-000000000001',
      columnId,
      parentId,
      orderKey: 'a0',
      title,
      note: '',
      kind: '',
      colour: '',
      fields: {},
      characterIds: [],
      end: null,
      collapsed: false,
      boundUnitId: null,
      boundBeatId: null,
      createdAt: at,
      updatedAt: at,
      ...extra,
    });
    const ids = {
      structure: 'c0000000-0000-4000-8000-000000000001',
      scenes: 'c0000000-0000-4000-8000-000000000002',
      beats: 'c0000000-0000-4000-8000-000000000003',
      arcs: 'c0000000-0000-4000-8000-000000000004',
      field: 'f0000000-0000-4000-8000-000000000001',
    };
    const board = boardSchema.parse({
      id: 'b0000000-0000-4000-8000-000000000001',
      projectId: file.project.id,
      name: 'Board',
      columns: [
        col(ids.structure, 'structure', 'Structure', 'a0'),
        col(ids.scenes, 'scene', 'Scenes', 'a1', [{ id: ids.field, name: 'POV' }]),
        col(ids.beats, 'beat', 'Beats', 'a2'),
        col(ids.arcs, 'custom', 'Arcs', 'a3'),
      ],
      nodes: [
        node('n0000000-0000-4000-8000-000000000001'.replace('n', 'a'), ids.structure, null, 'Beginning', { end: 'beginning', kind: 'structure' }),
        node('a0000000-0000-4000-8000-000000000002', ids.scenes, 'a0000000-0000-4000-8000-000000000001', 'Diner', {
          kind: 'scene',
          fields: { [ids.field]: 'Jonah' },
          characterIds: [jonah],
          collapsed: true,
        }),
        node('a0000000-0000-4000-8000-000000000003', ids.beats, 'a0000000-0000-4000-8000-000000000002', 'He pays'),
        node('a0000000-0000-4000-8000-000000000004', ids.arcs, 'a0000000-0000-4000-8000-000000000003', 'Guilt'),
      ],
      links: [
        {
          id: 'l0000000-0000-4000-8000-000000000001'.replace('l', 'd'),
          fromId: 'a0000000-0000-4000-8000-000000000003',
          toId: 'a0000000-0000-4000-8000-000000000001',
          label: 'echo',
          createdAt: at,
          updatedAt: at,
        },
      ],
      createdAt: at,
      updatedAt: at,
    });
    file = { ...file, boards: [board] };
    return { file, board, jonah };
  };

  it('maps columns to types, fields to named details, people to placements, folds to view state', () => {
    const { file, board, jonah } = legacy();
    const names = new Map(file.characters.map((c) => [c.id as string, c.name]));
    const { board: up, log } = upgradeBoard(board, names);
    expect(up.schemaVersion).toBe(2);
    const by = (title: string) => up.nodes.find((n) => n.title === title)!;
    expect(by('Beginning').kind).toBe('frame');
    expect(by('Beginning').end).toBeNull();
    expect(by('Diner').kind).toBe('scene');
    expect(by('Diner').fields).toEqual({ POV: 'Jonah' });
    expect(by('He pays').kind).toBe('beat');
    expect(by('Guilt').kind).toBe('custom');
    expect(by('Guilt').subtype).toBe('Arcs');
    const person = up.nodes.find((n) => n.kind === 'character')!;
    expect(person.parentId).toBe(by('Diner').id);
    expect(up.entities[0]!.sourceId).toBe(jonah);
    expect(up.viewState.closed).toContain(by('Diner').id);
    expect(up.links[0]!.type).toBe('related');
    expect(up.links[0]!.label).toBe('echo');
    expect(log!.characterPlacements).toBe(1);
  });

  it('is idempotent and reversible, and runs on load', () => {
    const { file, board } = legacy();
    const once = upgradeBoard(board).board;
    expect(upgradeBoard(once).board).toBe(once);
    expect(downgradeBoard(once)).toEqual(board);
    const loaded = parseProjectFile(JSON.parse(serializeProjectFile(file)));
    expect(loaded.boards![0]!.schemaVersion).toBe(2);
  });
});

describe('large maps (§12)', () => {
  it('lays out 5,000 cards, their summaries and links quickly', () => {
    let file = createProjectFile({ title: 'Big', format: 'screenplay' });
    const made = createBoard(file);
    file = made.file;
    const board = findBoard(file, made.board.id)!;
    const at = '2026-01-01T00:00:00.000Z';
    const nodes = [] as Board['nodes'];
    const ids: string[] = [];
    for (let i = 0; i < 5000; i += 1) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      ids.push(id);
      const parentId = i < 20 ? null : ids[Math.floor((i - 20) / 5)]!;
      nodes.push({
        id: id as SculptorNodeId, boardId: board.id, columnId: null, parentId: parentId as SculptorNodeId | null,
        orderKey: `a${String(i).padStart(5, '1')}`, title: `Card ${i}`, note: '', kind: 'note', subtype: '', entityId: null,
        colour: '', fields: {}, characterIds: [], end: null, collapsed: false, boundUnitId: null, boundBeatId: null, createdAt: at, updatedAt: at,
      });
    }
    const links = Array.from({ length: 800 }, (_, i) => ({
      id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, fromId: ids[i * 3]!, toId: ids[4999 - i]!, label: '', type: 'related', directed: false, createdAt: at, updatedAt: at,
    })) as unknown as Board['links'];
    const big = { ...board, nodes, links };
    const started = performance.now();
    const picture = mapPicture(big);
    nestedSummary(big, ids[0]!);
    drawnLinks(big, picture.visible);
    expect(picture.cards).toHaveLength(5000);
    expect(performance.now() - started).toBeLessThan(1500);
  });
});

describe('links leaving a mini map', () => {
  it('are counted on the card that is shown, not lost', () => {
    const s = story();
    let file = linkNodes(s.file, s.board.id, s.opens, s.act2, { type: 'causes' }).file;
    file = enterNode(file, s.board.id, s.warehouse);
    const board = boardOf(file, s.board);
    const { lines, outside } = drawnLinks(board, mapPicture(board).visible);
    expect(lines).toHaveLength(0);
    expect(outside.get(s.opens)).toBe(1);
  });
});

describe('exporting the map (PNG and PDF)', () => {
  it('draws what is shown, or everything exploded, as an SVG with every card and link', async () => {
    const { sculptMapSvg, sculptMapHtml, suggestedMapFileName } = await import('../index.js');
    const s = story();
    let file = linkNodes(s.file, s.board.id, s.opens, s.roof, { type: 'causes', label: 'why <she> runs' }).file;
    file = collapseAll(file, s.board.id);
    const board = boardOf(file, s.board);
    const shown = sculptMapSvg(file, board, 'shown');
    expect(shown.svg).toContain('Act one');
    expect(shown.svg).not.toContain('Opens the case');
    const all = sculptMapSvg(file, board, 'everything');
    expect(all.svg).toContain('Opens the case');
    expect(all.svg).toContain('why &lt;she&gt; runs');
    expect(all.svg).toContain('marker-end');
    expect(all.width).toBeGreaterThan(shown.width);
    const pdf = sculptMapHtml(file, all);
    expect(pdf.html).toContain('@page');
    expect(pdf.paper.width).toBeGreaterThanOrEqual(11);
    expect(suggestedMapFileName(file, 'png')).toBe('Blackout story map.png');
    // The story itself is untouched by exporting everything.
    expect(boardOf(file, s.board).viewState).toEqual(board.viewState);
  });
});
