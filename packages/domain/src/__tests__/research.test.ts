import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  addResearchItem,
  addSetupPayoff,
  addSetupPoint,
  markResearchUsed,
  recordPayoff,
  restoreResearchItem,
  setSetupPayoffArchived,
} from '../mutations.js';
import { unresolvedSetupsPayoffs, unusedResearch, usedResearch } from '../selectors.js';
import { derivedSetupPayoffStatus } from '../entities/setups.js';

const projectWithIdeas = () => {
  const file = createProjectFile({ title: 'Test Feature', format: 'screenplay' });
  const ideas = file.researchCategories.find((category) => category.systemKey === 'ideas');
  if (!ideas) throw new Error('default Ideas category missing');
  return { file, ideasId: ideas.id };
};

describe('research used/unused workflow', () => {
  it('seeds the default categories', () => {
    const { file } = projectWithIdeas();
    expect(file.researchCategories.map((category) => category.systemKey)).toContain('characters');
    expect(file.researchCategories.map((category) => category.systemKey)).toContain('plot_points');
  });

  it('moves an item to used and back again without deleting it', () => {
    const { file: base, ideasId } = projectWithIdeas();
    let file = addResearchItem(base, { categoryId: ideasId, title: 'The lighthouse keeper lies' });
    const itemId = file.researchItems[0]!.id;

    expect(unusedResearch(file)).toHaveLength(1);

    file = markResearchUsed(file, { itemId, beatId: file.beats[0]!.id });
    expect(unusedResearch(file)).toHaveLength(0);
    expect(usedResearch(file)).toHaveLength(1);
    expect(file.researchItems[0]?.usedInBeatIds).toEqual([file.beats[0]!.id]);
    expect(file.researchItems[0]?.usedConfirmed).toBe(true);

    file = restoreResearchItem(file, itemId);
    expect(unusedResearch(file)).toHaveLength(1);
    // The record itself survives both transitions.
    expect(file.researchItems).toHaveLength(1);
    expect(file.researchItems[0]?.usedAt).toBeNull();
  });

  it('records an unconfirmed suggestion distinctly from a writer decision', () => {
    const { file: base, ideasId } = projectWithIdeas();
    let file = addResearchItem(base, { categoryId: ideasId, title: 'Rain motif' });
    file = markResearchUsed(file, { itemId: file.researchItems[0]!.id, confirmed: false });
    expect(file.researchItems[0]?.usedConfirmed).toBe(false);
  });
});

describe('setups and payoffs', () => {
  it('tracks several setups for one payoff and stays unresolved until paid off', () => {
    let file = createProjectFile({ title: 'Test Feature', format: 'screenplay' });
    file = addSetupPayoff(file, { title: 'The revolver in the drawer' });
    const recordId = file.setupsPayoffs[0]!.id;

    file = addSetupPoint(file, { setupPayoffId: recordId, description: 'Drawer opened in Act I', strength: 'written' });
    file = addSetupPoint(file, { setupPayoffId: recordId, description: 'Mentioned at dinner', strength: 'planned' });

    expect(file.setupsPayoffs[0]?.setups).toHaveLength(2);
    expect(derivedSetupPayoffStatus(file.setupsPayoffs[0]!)).toBe('established');
    expect(unresolvedSetupsPayoffs(file)).toHaveLength(1);

    file = recordPayoff(file, { setupPayoffId: recordId, description: 'Fired in the finale' });
    expect(derivedSetupPayoffStatus(file.setupsPayoffs[0]!)).toBe('resolved');
    expect(unresolvedSetupsPayoffs(file)).toHaveLength(0);
  });

  it('archives a resolved record reversibly, keeping its history', () => {
    let file = createProjectFile({ title: 'Test Feature', format: 'screenplay' });
    file = addSetupPayoff(file, { title: 'Locket' });
    const recordId = file.setupsPayoffs[0]!.id;
    file = addSetupPoint(file, { setupPayoffId: recordId, description: 'Shown in prologue', strength: 'written' });

    file = setSetupPayoffArchived(file, recordId, true);
    expect(unresolvedSetupsPayoffs(file)).toHaveLength(0);
    expect(file.setupsPayoffs[0]?.setups).toHaveLength(1);

    file = setSetupPayoffArchived(file, recordId, false);
    expect(unresolvedSetupsPayoffs(file)).toHaveLength(1);
  });
});
