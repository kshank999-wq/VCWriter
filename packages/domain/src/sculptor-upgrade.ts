import { newId } from './ids.js';
import { nowIso } from './entities/common.js';
import { safeKeyBetween } from './ordering.js';
import { boardSchema, type Board, type SculptorEntity, type SculptorNode } from './entities/sculptor.js';
import { isSculptType } from './sculptor-types.js';
import type { SculptorEntityId, SculptorNodeId } from './ids.js';

/**
 * Version 1 to Story Sculptor 2.0 (addendum 03 v2 §13).
 *
 * The written mapping, which the addendum repeats:
 *
 * | Version 1                         | Version 2                                    |
 * | --------------------------------- | -------------------------------------------- |
 * | Structure column card             | Frame, top level, same order                 |
 * | Beginning / End                   | Ordinary frames with the same titles         |
 * | Scene column card                 | Scene                                        |
 * | Beat column card                  | Beat                                         |
 * | Writer's own column card          | Custom, named after the column               |
 * | A kind the writer typed           | That type if v2 has it, else Custom named so |
 * | Column field answers (by id)      | Details, by the field's name                 |
 * | People on a card (characterIds)   | Character placements under the card          |
 * | Folded card                       | A closed branch in the view state            |
 * | Binding to a scene or beat        | Kept as it is                                |
 * | Writer's links                    | Kept, as *Related to*, directed as drawn     |
 *
 * Nothing is dropped. The board as it was is kept whole in `legacy`, so the
 * upgrade can be reversed (`downgradeBoard`). Running it twice changes
 * nothing: a board already at version 2 is returned as it is.
 */

export interface UpgradeLog {
  boardId: string;
  cards: number;
  characterPlacements: number;
  details: number;
  at: string;
}

/** Characters that still exist, so a placement never points at nobody. */
export type CharacterNames = ReadonlyMap<string, string>;

export const upgradeBoard = (board: Board, characters: CharacterNames = new Map()): { board: Board; log: UpgradeLog | null } => {
  if ((board.schemaVersion ?? 1) >= 2) return { board, log: null };
  const at = nowIso();
  const columns = [...(board.columns ?? [])].sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0));
  const columnById = new Map(columns.map((column) => [column.id as string, column]));
  let details = 0;

  const typeFor = (node: SculptorNode): { kind: string; subtype: string } => {
    const column = node.columnId ? columnById.get(node.columnId as string) : undefined;
    const kind = node.kind.trim();
    if (kind === 'structure') return { kind: 'frame', subtype: '' };
    if (kind && isSculptType(kind)) return { kind, subtype: '' };
    if (kind && kind !== 'custom') return { kind: 'custom', subtype: kind };
    if (column?.kind === 'structure') return { kind: 'frame', subtype: '' };
    if (column?.kind === 'scene') return { kind: 'scene', subtype: '' };
    if (column?.kind === 'beat') return { kind: 'beat', subtype: '' };
    return { kind: 'custom', subtype: column?.name.trim() || 'Custom' };
  };

  const entities: SculptorEntity[] = [...(board.entities ?? [])];
  const entityForCharacter = (characterId: string): SculptorEntityId => {
    const found = entities.find((entity) => entity.sourceKind === 'character' && entity.sourceId === characterId);
    if (found) return found.id;
    const entity: SculptorEntity = {
      id: newId<SculptorEntityId>(),
      type: 'character',
      subtype: '',
      sourceKind: 'character',
      sourceId: characterId,
      title: characters.get(characterId) ?? '',
      description: '',
      fields: {},
      favorite: false,
      createdAt: at,
      updatedAt: at,
    };
    entities.push(entity);
    return entity.id;
  };

  const placements: SculptorNode[] = [];
  const closed: string[] = [];
  const nodes = board.nodes.map((node) => {
    const column = node.columnId ? columnById.get(node.columnId as string) : undefined;
    const named: Record<string, string> = {};
    for (const [key, value] of Object.entries(node.fields ?? {})) {
      const field = column?.fields.find((one) => (one.id as string) === key);
      named[field ? field.name.trim() || 'Detail' : key] = value;
      if (value.trim()) details += 1;
    }
    if (node.collapsed) closed.push(node.id as string);

    // The people on the card become cards under it, first among its children.
    const living = (node.characterIds ?? []).filter((one) => characters.size === 0 || characters.has(one as string));
    const firstChild = board.nodes
      .filter((other) => other.parentId === node.id)
      .reduce<string | null>((low, other) => (low === null || other.orderKey < low ? other.orderKey : low), null);
    let after: string | null = null;
    for (const characterId of living) {
      const key = safeKeyBetween(after, firstChild);
      after = key;
      placements.push({
        id: newId<SculptorNodeId>(),
        boardId: board.id,
        columnId: null,
        parentId: node.id,
        orderKey: key,
        title: '',
        note: '',
        kind: 'character',
        subtype: '',
        entityId: entityForCharacter(characterId as string),
        colour: '',
        fields: {},
        characterIds: [],
        end: null,
        collapsed: false,
        boundUnitId: null,
        boundBeatId: null,
        createdAt: at,
        updatedAt: at,
      });
    }

    const { kind, subtype } = typeFor(node);
    return { ...node, kind, subtype, fields: named, characterIds: [], end: null, collapsed: false };
  });

  const upgraded = boardSchema.parse({
    ...board,
    schemaVersion: 2,
    nodes: [...nodes, ...placements],
    links: board.links.map((link) => ({ ...link, type: link.type ?? 'related', directed: link.directed ?? true })),
    entities,
    viewState: { ...(board.viewState ?? {}), closed },
    legacy: { board, upgradedAt: at },
  });
  return {
    board: upgraded,
    log: { boardId: board.id as string, cards: board.nodes.length, characterPlacements: placements.length, details, at },
  };
};

/**
 * Put a board back the way version 1 had it: the rollback path (v2 §13).
 * A board made in v2 has nothing to go back to and is returned unchanged.
 */
export const downgradeBoard = (board: Board): Board => {
  const kept = board.legacy as { board?: unknown } | null;
  if (!kept || typeof kept !== 'object' || !kept.board) return board;
  return boardSchema.parse(kept.board);
};

/** Every board in a file brought to version 2, with a log line for each that changed. */
export const upgradeBoards = <F extends { boards?: Board[]; characters: readonly { id: unknown; name: string }[] }>(
  file: F,
): { file: F; logs: UpgradeLog[] } => {
  const boards = file.boards ?? [];
  if (boards.every((board) => (board.schemaVersion ?? 1) >= 2)) return { file, logs: [] };
  const names = new Map(file.characters.map((character) => [character.id as string, character.name]));
  const logs: UpgradeLog[] = [];
  const next = boards.map((board) => {
    const done = upgradeBoard(board, names);
    if (done.log) logs.push(done.log);
    return done.board;
  });
  return { file: { ...file, boards: next }, logs };
};
