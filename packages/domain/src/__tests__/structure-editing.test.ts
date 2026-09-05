import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  DomainError,
  addBeat,
  addLane,
  addResearchCategory,
  addResearchItem,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  linkEntities,
  markResearchUsed,
  moveLane,
  moveResearchCategory,
  moveResearchItem,
  recordPayoff,
  removeBeat,
  removeLane,
  removeSetupPoint,
  removeUnit,
  reopenPayoff,
  setResearchCategoryArchived,
  updateResearchCategory,
  updateUnit,
} from '../mutations.js';
import {
  lanesInOrder,
  relatedEntities,
  researchCategoriesInOrder,
  researchItemsForCategory,
  resolveRef,
  unresolvedSetupsPayoffs,
} from '../selectors.js';
import { ref } from '../entities/links.js';

const project = () => createProjectFile({ title: 'Lighthouse', format: 'screenplay' });

describe('removing structure', () => {
  it('takes a lane, its scenes, its beats and their links together', () => {
    let file = project();
    const subplot = addLane(file, { name: 'Subplot' });
    file = subplot.file;
    const created = addUnit(file, { laneId: subplot.lane.id, title: 'Doomed scene' });
    file = created.file;
    const beat = addBeat(file, { unitId: created.unit.id, title: 'Doomed beat' });
    file = beat.file;
    file = linkEntities(file, {
      from: ref('beat', beat.beat.id),
      to: ref('lane', subplot.lane.id),
      type: 'appears_in',
    });
    expect(file.links).toHaveLength(1);

    file = removeLane(file, subplot.lane.id);

    expect(file.lanes).toHaveLength(1);
    expect(file.units.some((unit) => unit.id === created.unit.id)).toBe(false);
    expect(file.beats.some((candidate) => candidate.id === beat.beat.id)).toBe(false);
    // A link to something that no longer exists would render as an unresolvable
    // row in the related-elements panel.
    expect(file.links).toHaveLength(0);
  });

  it('refuses to remove the last lane', () => {
    const file = project();
    expect(() => removeLane(file, file.lanes[0]!.id)).toThrow(DomainError);
  });

  it('removes a scene with its beats', () => {
    let file = project();
    const created = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Second' });
    file = addBeat(created.file, { unitId: created.unit.id }).file;
    expect(file.beats).toHaveLength(2);

    file = removeUnit(file, created.unit.id);
    expect(file.units).toHaveLength(1);
    expect(file.beats).toHaveLength(1);
  });

  it('keeps research marked used when the beat it was used in is removed', () => {
    let file = project();
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    file = addResearchItem(file, { categoryId: ideas.id, title: 'Rain motif' });
    const beatId = file.beats[0]!.id;
    file = markResearchUsed(file, { itemId: file.researchItems[0]!.id, beatId });

    file = removeBeat(file, beatId);

    // The decision that the idea was used stands; only the dangling
    // back-reference goes.
    expect(file.researchItems[0]?.usage).toBe('used');
    expect(file.researchItems[0]?.usedInBeatIds).toEqual([]);
  });

  it('reorders lanes', () => {
    let file = project();
    file = addLane(file, { name: 'Subplot' }).file;
    file = addLane(file, { name: 'Theme' }).file;
    expect(lanesInOrder(file).map((lane) => lane.name)).toEqual(['Main Plot', 'Subplot', 'Theme']);

    file = moveLane(file, lanesInOrder(file)[2]!.id, 0);
    expect(lanesInOrder(file).map((lane) => lane.name)).toEqual(['Theme', 'Main Plot', 'Subplot']);
  });

  it('edits scene metadata without touching its beats', () => {
    let file = project();
    const unitId = file.units[0]!.id;
    file = updateUnit(file, unitId, { title: 'Act one opens', status: 'draft_complete', collapsed: true });

    const unit = file.units[0]!;
    expect(unit.title).toBe('Act one opens');
    expect(unit.status).toBe('draft_complete');
    expect(unit.collapsed).toBe(true);
    expect(file.beats).toHaveLength(1);
  });
});

describe('research categories', () => {
  it('creates, renames, reorders and archives categories', () => {
    let file = project();
    const created = addResearchCategory(file, { name: 'Research trips' });
    file = created.file;
    expect(researchCategoriesInOrder(file).at(-1)?.name).toBe('Research trips');

    file = updateResearchCategory(file, created.category.id, { name: 'Field notes' });
    expect(researchCategoriesInOrder(file).at(-1)?.name).toBe('Field notes');

    file = moveResearchCategory(file, created.category.id, 0);
    expect(researchCategoriesInOrder(file)[0]?.name).toBe('Field notes');

    file = setResearchCategoryArchived(file, created.category.id, true);
    expect(researchCategoriesInOrder(file).some((category) => category.id === created.category.id)).toBe(false);
    // Archiving hides; it does not delete.
    expect(file.researchCategories.some((category) => category.id === created.category.id)).toBe(true);

    file = setResearchCategoryArchived(file, created.category.id, false);
    expect(researchCategoriesInOrder(file)[0]?.name).toBe('Field notes');
  });

  it('moves an item to another category', () => {
    let file = project();
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    const characters = file.researchCategories.find((category) => category.systemKey === 'characters')!;
    file = addResearchItem(file, { categoryId: ideas.id, title: 'The keeper' });
    const itemId = file.researchItems[0]!.id;

    file = moveResearchItem(file, { itemId, toCategoryId: characters.id, index: 0 });

    expect(researchItemsForCategory(file, ideas.id)).toHaveLength(0);
    expect(researchItemsForCategory(file, characters.id).map((item) => item.title)).toEqual(['The keeper']);
  });
});

describe('setups and payoffs editing', () => {
  it('reopens a payoff without losing its setups', () => {
    let file = project();
    file = addSetupPayoff(file, { title: 'The revolver' });
    const recordId = file.setupsPayoffs[0]!.id;
    file = addSetupPoint(file, { setupPayoffId: recordId, description: 'Drawer', strength: 'written' });
    file = recordPayoff(file, { setupPayoffId: recordId, description: 'Fired' });
    expect(unresolvedSetupsPayoffs(file)).toHaveLength(0);

    file = reopenPayoff(file, recordId);

    expect(unresolvedSetupsPayoffs(file)).toHaveLength(1);
    expect(file.setupsPayoffs[0]?.status).toBe('established');
    expect(file.setupsPayoffs[0]?.setups).toHaveLength(1);
  });

  it('removes a single setup point', () => {
    let file = project();
    file = addSetupPayoff(file, { title: 'The locket' });
    const recordId = file.setupsPayoffs[0]!.id;
    file = addSetupPoint(file, { setupPayoffId: recordId, description: 'Prologue' });
    file = addSetupPoint(file, { setupPayoffId: recordId, description: 'Dinner' });
    const pointId = file.setupsPayoffs[0]!.setups[0]!.id;

    file = removeSetupPoint(file, { setupPayoffId: recordId, setupPointId: pointId });

    expect(file.setupsPayoffs[0]?.setups.map((point) => point.description)).toEqual(['Dinner']);
  });
});

describe('related elements', () => {
  it('resolves each link endpoint to a current label', () => {
    let file = project();
    const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas')!;
    file = addResearchItem(file, { categoryId: ideas.id, title: 'A revolver in the drawer' });
    const itemId = file.researchItems[0]!.id;
    const beatId = file.beats[0]!.id;
    file = linkEntities(file, { from: ref('beat', beatId), to: ref('research_item', itemId), type: 'establishes' });

    const related = relatedEntities(file, ref('beat', beatId));
    expect(related).toHaveLength(1);
    expect(related[0]?.outgoing).toBe(true);
    expect(related[0]?.other.label).toBe('A revolver in the drawer');
    expect(related[0]?.other.detail).toBe('Ideas');
    expect(related[0]?.other.exists).toBe(true);
  });

  it('reads the current name rather than a copy taken when the link was made', () => {
    let file = project();
    const subplot = addLane(file, { name: 'Subplot' });
    file = subplot.file;
    file = linkEntities(file, {
      from: ref('beat', file.beats[0]!.id),
      to: ref('lane', subplot.lane.id),
    });

    file = moveLane(file, subplot.lane.id, 0);
    const renamed = { ...file, lanes: file.lanes.map((lane) => (lane.id === subplot.lane.id ? { ...lane, name: 'B story' } : lane)) };

    expect(resolveRef(renamed, ref('lane', subplot.lane.id)).label).toBe('B story');
  });

  it('marks a reference whose target is gone', () => {
    const file = project();
    const resolved = resolveRef(file, ref('character', '11111111-1111-4111-8111-111111111111'));
    expect(resolved.exists).toBe(false);
  });
});
