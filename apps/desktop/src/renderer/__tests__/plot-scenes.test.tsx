// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  addBeat,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  createProjectFile,
  linkEntities,
  updateBeat,
  updateUnit,
  type ProjectFile,
} from '@vcwriter/domain';
import { LaneDialog } from '../components/LaneDialog';

/**
 * The plot pop-up's scene rail (addendum 02 §19): the same rail the episodes
 * have, listing scenes, and what is in the one you choose.
 */

afterEach(cleanup);

const el = (type: string, text: string) => ({
  id: crypto.randomUUID() as never,
  type: type as never,
  text,
  characterId: null,
  attributes: {},
});

const project = () => {
  let file = createProjectFile({ title: 'The Lighthouse', format: 'screenplay' });
  file = { ...file, units: [], beats: [] };
  const lane = file.lanes[0]!.id;

  const first = addUnit(file, { laneId: lane, title: 'The stair' });
  file = updateUnit(first.file, first.unit.id, { summary: 'She finds the lamp out.' });
  const beat = addBeat(file, { unitId: first.unit.id });
  file = updateBeat(beat.file, beat.beat.id, {
    manuscript: { elements: [el('character', 'MAEVE'), el('dialogue', 'Forty years.')] },
  });

  const second = addUnit(file, { laneId: lane, title: 'The harbour' });
  file = second.file;
  file = addBeat(file, { unitId: second.unit.id }).file;

  // Something owed in the first scene, and a link out of it.
  file = addSetupPayoff(file, { title: 'The locket' });
  const promise = file.setupsPayoffs[file.setupsPayoffs.length - 1]!;
  file = addSetupPoint(file, {
    setupPayoffId: promise.id,
    description: 'She palms it.',
    location: { type: 'unit', id: first.unit.id },
  });
  file = linkEntities(file, {
    from: { type: 'unit', id: first.unit.id },
    to: { type: 'unit', id: second.unit.id },
    type: 'pays_off',
  });

  return { file, laneId: lane };
};

const show = (file: ProjectFile, laneId: string) =>
  render(<LaneDialog file={file} laneId={laneId as never} onClose={() => {}} onUpdate={() => {}} />);

/** Click a row of the rail. The name is also in the facts panel once open. */
const chooseScene = (title: string) => {
  const row = [...document.querySelectorAll('.scene-rail-row')].find((node) => node.textContent?.includes(title));
  fireEvent.click(row as HTMLElement);
};

describe('the plot pop-up', () => {
  it('lists this plot’s scenes in story order, with what is in each', () => {
    const { file, laneId } = project();
    show(file, laneId);

    const rows = document.querySelectorAll('.scene-rail-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('The stair');
    expect(rows[1]?.textContent).toContain('The harbour');
    expect(rows[0]?.textContent).toContain('1 beats');
  });

  it('opens a scene to its characters, its promises and its links', () => {
    const { file, laneId } = project();
    show(file, laneId);

    // Nothing is shown until a scene is chosen.
    expect(document.querySelector('.scene-facts')).toBeNull();

    chooseScene('The stair');
    const facts = document.querySelector('.scene-facts');
    expect(facts).toBeTruthy();
    expect(facts?.textContent).toContain('She finds the lamp out.');
    expect(facts?.textContent).toContain('MAEVE');
    expect(facts?.textContent).toContain('The locket');
    expect(facts?.textContent).toContain('pays off');
  });

  it('says plainly when a scene has nobody and owes nothing', () => {
    const { file, laneId } = project();
    show(file, laneId);

    chooseScene('The harbour');
    const facts = document.querySelector('.scene-facts');
    expect(facts?.textContent).toContain('Nobody speaks in it yet');
    expect(facts?.textContent).toContain('Nothing set up or paid here');
    // A link is a link from either end, so the scene it was made from shows.
    expect(facts?.textContent).toContain('The stair');
  });

  it('closes the scene again when the same row is chosen', () => {
    const { file, laneId } = project();
    show(file, laneId);

    chooseScene('The stair');
    expect(document.querySelector('.scene-facts')).toBeTruthy();
    chooseScene('The stair');
    expect(document.querySelector('.scene-facts')).toBeNull();
  });

  it('keeps the arc where it was: the scene appears under it', () => {
    const { file, laneId } = project();
    const { container } = show(file, laneId);
    chooseScene('The stair');

    const main = container.querySelector('.lane-dialog-main');
    const html = main?.innerHTML ?? '';
    // The arc is what the scene is being read against, so it comes first.
    expect(html.indexOf('How it develops')).toBeLessThan(html.indexOf('scene-facts'));
  });
});
