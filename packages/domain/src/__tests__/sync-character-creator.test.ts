import { describe, expect, it } from 'vitest';
import {
  SYNC_COLLECTIONS,
  SYNC_TABLES,
  addBeat,
  addCharacter,
  addUnit,
  arcPointSchema,
  characterArcSchema,
  characterRelationshipSchema,
  characterTraitSchema,
  characterizationItemSchema,
  createProjectFile,
  fromRows,
  gatherRows,
  isUsed,
  newId,
  toRows,
  usageLinkSchema,
  type ProjectFile,
} from '../index.js';

/**
 * The Character Creator's collections, through the database shape and back
 * (addendum 08, stage 1).
 *
 * The claim: **nothing is lost on the journey**, which is what makes the
 * module work on a second machine at all. The one worth watching is the usage
 * link — if it does not round-trip, every item comes back red on the other
 * machine and the writer is told their work is not in the script.
 */

const AT = '2026-09-12T00:00:00.000Z';
const uid = (): string => newId() as string;

/** A project with a character, a trait, a way of showing it, and a scene. */
const peopled = (): { file: ProjectFile; ids: Record<string, string> } => {
  let file = createProjectFile({ title: 'Blackout', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };

  const scene = addUnit(file, { laneId: file.lanes[0]!.id, title: 'INT. DINER - NIGHT' });
  const beat = addBeat(scene.file, { unitId: scene.unit.id, title: 'The bill' });
  file = addCharacter(beat.file, { name: 'MARA' });
  const character = file.characters[file.characters.length - 1]!;

  const trait = characterTraitSchema.parse({
    id: uid(),
    projectId: file.project.id,
    characterId: character.id,
    name: 'Greedy',
    kind: 'under pressure',
    prominence: 4,
    tone: 'unsaid',
    notes: 'It is how she keeps score.',
    orderKey: 'a0',
    createdAt: AT,
    updatedAt: AT,
  });

  const item = characterizationItemSchema.parse({
    id: uid(),
    projectId: file.project.id,
    characterId: character.id,
    traitId: trait.id,
    text: 'Leaves a very poor tip at dinner.',
    orderKey: 'a0',
    createdAt: AT,
    updatedAt: AT,
  });

  const arc = characterArcSchema.parse({
    id: uid(),
    projectId: file.project.id,
    characterId: character.id,
    beginning: 'Keeps score.',
    need: 'To stop counting.',
    ending: '',
    createdAt: AT,
    updatedAt: AT,
  });

  const point = arcPointSchema.parse({
    id: uid(),
    projectId: file.project.id,
    arcId: arc.id,
    characterId: character.id,
    kind: 'refusal',
    text: 'She is offered the money back and takes it anyway.',
    orderKey: 'a0',
    createdAt: AT,
    updatedAt: AT,
  });

  const other = addCharacter(file, { name: 'DEAKINS' });
  const deakins = other.characters[other.characters.length - 1]!;

  const relationship = characterRelationshipSchema.parse({
    id: uid(),
    projectId: file.project.id,
    fromCharacterId: character.id,
    toCharacterId: deakins.id,
    kind: 'rival',
    label: '',
    description: 'They came up together.',
    state: 'Cold.',
    evolution: 'Colder.',
    createdAt: AT,
    updatedAt: AT,
  });

  const link = usageLinkSchema.parse({
    id: uid(),
    projectId: file.project.id,
    ownerKind: 'characterization',
    ownerId: item.id,
    unitId: scene.unit.id,
    beatId: beat.beat.id,
    elementId: null,
    quote: 'He counts out four coins.',
    createdAt: AT,
    updatedAt: AT,
  });

  return {
    file: {
      ...other,
      characterTraits: [trait],
      characterizationItems: [item],
      characterArcs: [arc],
      arcPoints: [point],
      characterRelationships: [relationship],
      usageLinks: [link],
    },
    ids: {
      character: character.id as string,
      trait: trait.id as string,
      item: item.id as string,
      arc: arc.id as string,
      point: point.id as string,
      beat: beat.beat.id as string,
    },
  };
};

describe('the collections go to the database and come back', () => {
  it('loses nothing on the journey', () => {
    const { file } = peopled();
    const back = fromRows(toRows(file));

    expect(back.characterTraits).toEqual(file.characterTraits);
    expect(back.characterizationItems).toEqual(file.characterizationItems);
    expect(back.characterArcs).toEqual(file.characterArcs);
    expect(back.arcPoints).toEqual(file.arcPoints);
    expect(back.characterRelationships).toEqual(file.characterRelationships);
    expect(back.usageLinks).toEqual(file.usageLinks);
  });

  it('keeps an item green on the other machine, which is the one that matters', () => {
    // A usage link that did not survive the trip would tell the writer on their
    // second machine that work already in the script is still on deck.
    const { file, ids } = peopled();
    const back = fromRows(toRows(file));
    expect(isUsed({ kind: 'characterization', id: ids['item']! }, back.usageLinks, back)).toBe(true);
  });

  it('carries project_id on every row, because the policy asks a column', () => {
    const { file } = peopled();
    const rows = toRows(file);
    for (const collection of [
      'characterTraits',
      'characterizationItems',
      'characterArcs',
      'arcPoints',
      'usageLinks',
      'characterRelationships',
    ] as const) {
      expect(rows[collection].length).toBeGreaterThan(0);
      for (const row of rows[collection]) expect(row['project_id']).toBe(file.project.id);
    }
  });

  it('names a table for each, so nothing hard-codes one', () => {
    expect(SYNC_TABLES.characterTraits).toBe('character_traits');
    expect(SYNC_TABLES.characterizationItems).toBe('characterization_items');
    expect(SYNC_TABLES.characterArcs).toBe('character_arcs');
    expect(SYNC_TABLES.arcPoints).toBe('arc_points');
    expect(SYNC_TABLES.usageLinks).toBe('usage_links');
    expect(SYNC_TABLES.characterRelationships).toBe('character_relationships');
  });

  it('upserts a trait before the item filed under it, and an arc before its points', () => {
    // `pushRows` writes collections in the order `SYNC_TABLES` declares them,
    // and both of these are foreign keys.
    const order = Object.keys(SYNC_TABLES);
    expect(order.indexOf('characterTraits')).toBeLessThan(order.indexOf('characterizationItems'));
    expect(order.indexOf('characterArcs')).toBeLessThan(order.indexOf('arcPoints'));
    expect(order.indexOf('characterizationItems')).toBeLessThan(order.indexOf('usageLinks'));
  });

  it('gathers every collection the table list names, and nothing is undefined', () => {
    // The two readers of a project out of the database (the desktop's
    // `cloud.ts` and the web's `project-document.ts`) walk `SYNC_TABLES` to
    // fetch and then hand the result to `gatherRows`. A collection that got
    // named in one list and forgotten in the other used to read back as
    // nothing — and `pushRows` takes nothing for the truth and deletes the
    // rows on the server.
    const { file } = peopled();
    const rows = toRows(file);
    const fetched = Object.fromEntries(
      SYNC_COLLECTIONS.map((collection) => [collection, rows[collection]]),
    );

    const gathered = gatherRows(rows.project, fetched);
    for (const collection of SYNC_COLLECTIONS) {
      expect(Array.isArray(gathered[collection])).toBe(true);
      expect(gathered[collection]).toEqual(rows[collection]);
    }
    expect(fromRows(gathered).characterizationItems).toEqual(file.characterizationItems);
  });

  it('gives a collection the fetch never mentioned an empty list, not undefined', () => {
    const { file } = peopled();
    const rows = toRows(file);
    const gathered = gatherRows(rows.project, { lanes: rows.lanes });
    expect(gathered.usageLinks).toEqual([]);
    expect(gathered.characterTraits).toEqual([]);
    expect(gathered.lanes).toEqual(rows.lanes);
  });

  it('opens a project written before the module existed', () => {
    // No migration of its own: the collections default to empty and the whole
    // module is simply not there yet, which is what most files look like.
    const plain = createProjectFile({ title: 'Older', format: 'screenplay' });
    const back = fromRows(toRows(plain));
    expect(back.characterTraits).toEqual([]);
    expect(back.usageLinks).toEqual([]);
  });
});
