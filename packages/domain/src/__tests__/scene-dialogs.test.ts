import { describe, expect, it } from 'vitest';
import { createProjectFile } from '../project-file.js';
import {
  addBeat,
  addSetupPayoff,
  addSetupPoint,
  addUnit,
  moveBeat,
  moveUnit,
  recordPayoff,
  removeRevision,
  startRevision,
  switchRevision,
  updateBeat,
  updateUnit,
} from '../mutations.js';
import { formatSceneHeading, parseSceneHeading, sceneHeadingOf, setSceneHeading } from '../scene-heading.js';
import { promisesIn, sceneCast } from '../scene-cast.js';
import { paginateProject, manuscriptElements } from '../pagination.js';
import { storyLayout } from '../story-layout.js';
import { ref } from '../entities/links.js';
import { toRows, fromRows } from '../sync-mapping.js';
import type { ManuscriptElement } from '../entities/manuscript.js';

const el = (type: ManuscriptElement['type'], text: string): ManuscriptElement => ({
  id: crypto.randomUUID() as never,
  type,
  text,
  characterId: null,
  attributes: {},
});

describe('scene heading fields', () => {
  it('parses what writers type and formats it back the standard way', () => {
    expect(parseSceneHeading('INT. OFFICE - DAY')).toEqual({ setting: 'INT.', place: 'OFFICE', time: 'DAY' });
    expect(parseSceneHeading('ext kitchen garden - night')).toEqual({ setting: 'EXT.', place: 'KITCHEN GARDEN', time: 'NIGHT' });
    expect(parseSceneHeading('I/E CAR - CONTINUOUS')).toEqual({ setting: 'INT./EXT.', place: 'CAR', time: 'CONTINUOUS' });
    expect(parseSceneHeading('SANCHEZ HOME - KITCHEN - MORNING')).toEqual({ setting: '', place: 'SANCHEZ HOME - KITCHEN', time: 'MORNING' });
    expect(parseSceneHeading('INT. HALLWAY')).toEqual({ setting: 'INT.', place: 'HALLWAY', time: '' });
    expect(formatSceneHeading({ setting: 'INT.', place: 'office', time: 'day' })).toBe('INT. OFFICE - DAY');
    expect(formatSceneHeading({ setting: '', place: 'Later', time: '' })).toBe('LATER');
  });

  it('reads the scene’s first heading and writes it back in place, or adds one', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const unitId = file.units[0]!.id;
    expect(sceneHeadingOf(file, unitId)).toBeNull();

    file = setSceneHeading(file, unitId, { setting: 'INT.', place: 'Office', time: 'Day' });
    expect(file.beats[0]!.manuscript.elements[0]).toMatchObject({ type: 'scene_heading', text: 'INT. OFFICE - DAY' });
    expect(sceneHeadingOf(file, unitId)).toEqual({ setting: 'INT.', place: 'OFFICE', time: 'DAY' });

    file = updateBeat(file, file.beats[0]!.id, {
      manuscript: { elements: [el('action', 'Rain.'), el('scene_heading', 'EXT. STREET - NIGHT'), el('action', 'Wind.')] },
    });
    file = setSceneHeading(file, unitId, { setting: 'EXT.', place: 'Street', time: 'Dawn' });
    expect(file.beats[0]!.manuscript.elements.map((e) => e.text)).toEqual(['Rain.', 'EXT. STREET - DAWN', 'Wind.']);
  });
});

describe('a scene switched off', () => {
  it('leaves the manuscript, the pages and the layout, and stays in the structure', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const first = file.units[0]!;
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [el('action', 'ONE')] } });
    const second = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Two' });
    file = second.file;
    const beat = addBeat(file, { unitId: second.unit.id });
    file = updateBeat(beat.file, beat.beat.id, { manuscript: { elements: [el('action', 'TWO')] } });

    file = updateUnit(file, first.id, { inScript: false });
    expect(manuscriptElements(file).map((e) => e.text)).toEqual(['TWO']);
    expect(paginateProject(file).flatMap((p) => p.lines).map((l) => l.text).filter(Boolean)).toEqual(['TWO']);
    const layout = storyLayout(file);
    expect(layout.spans.map((span) => span.unit.title)).toEqual(['Opening Scene', 'Two']);
    expect(layout.spans[0]!.pages).toBe(0);
    expect(fromRows(toRows(file)).units[0]?.inScript).toBe(false);
  });
});

describe('the script follows the structure', () => {
  it('moves a beat’s text with the beat, and a scene’s text with the scene', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const unitId = file.units[0]!.id;
    file = updateBeat(file, file.beats[0]!.id, { manuscript: { elements: [el('action', 'FIRST')] } });
    const second = addBeat(file, { unitId });
    file = updateBeat(second.file, second.beat.id, { manuscript: { elements: [el('action', 'SECOND')] } });
    const text = (current: typeof file) => manuscriptElements(current).map((element) => element.text);
    expect(text(file)).toEqual(['FIRST', 'SECOND']);

    // Move the second beat above the first: the script reads in the new order.
    file = moveBeat(file, { beatId: second.beat.id, toUnitId: unitId, index: 0 });
    expect(text(file)).toEqual(['SECOND', 'FIRST']);

    // The same for a whole scene moved along the story.
    const added = addUnit(file, { laneId: file.lanes[0]!.id, title: 'Two' });
    file = added.file;
    const third = addBeat(file, { unitId: added.unit.id });
    file = updateBeat(third.file, third.beat.id, { manuscript: { elements: [el('action', 'THIRD')] } });
    expect(text(file)).toEqual(['SECOND', 'FIRST', 'THIRD']);

    file = moveUnit(file, { unitId: added.unit.id, toLaneId: file.lanes[0]!.id, index: 0 });
    expect(text(file)).toEqual(['THIRD', 'SECOND', 'FIRST']);
  });
});

describe('beat revisions', () => {
  it('starts a new revision as a copy, switches between them, and drops one', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const beatId = file.beats[0]!.id;
    file = updateBeat(file, beatId, { manuscript: { elements: [el('action', 'First pass.')] } });

    file = startRevision(file, beatId, 'Tighter');
    let beat = file.beats[0]!;
    expect(beat.revisionName).toBe('Tighter');
    expect(beat.manuscript.elements[0]?.text).toBe('First pass.');
    expect(beat.revisions.map((r) => r.name)).toEqual(['Draft 1']);

    file = updateBeat(file, beatId, { manuscript: { elements: [el('action', 'Second pass.')] } });
    const kept = file.beats[0]!.revisions[0]!;
    file = switchRevision(file, beatId, kept.id);
    beat = file.beats[0]!;
    expect(beat.revisionName).toBe('Draft 1');
    expect(beat.manuscript.elements[0]?.text).toBe('First pass.');
    expect(beat.revisions.map((r) => [r.name, r.manuscript.elements[0]?.text])).toEqual([['Tighter', 'Second pass.']]);

    expect(fromRows(toRows(file)).beats[0]?.revisions).toHaveLength(1);
    file = removeRevision(file, beatId, file.beats[0]!.revisions[0]!.id);
    expect(file.beats[0]!.revisions).toHaveLength(0);
  });

  it('keeps a colour and syncs it', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    file = updateBeat(file, file.beats[0]!.id, { color: '#8b1c1c' });
    expect(fromRows(toRows(file)).beats[0]?.color).toBe('#8b1c1c');
  });
});

describe('what a scene contains', () => {
  it('lists the cast and the promises made or kept in it', () => {
    let file = createProjectFile({ title: 'T', format: 'screenplay' });
    const unitId = file.units[0]!.id;
    const first = file.beats[0]!.id;
    file = updateBeat(file, first, { manuscript: { elements: [el('character', 'MIKE'), el('dialogue', 'Hi.')] } });
    const second = addBeat(file, { unitId, title: 'Later' });
    file = updateBeat(second.file, second.beat.id, { manuscript: { elements: [el('character', 'CELESTE'), el('dialogue', 'Hello.')] } });

    file = addSetupPayoff(file, { title: 'The envelope' });
    file = addSetupPoint(file, { setupPayoffId: file.setupsPayoffs[0]!.id, description: 'On the counter', location: ref('beat', first) });
    file = addSetupPayoff(file, { title: 'The corner' });
    file = recordPayoff(file, { setupPayoffId: file.setupsPayoffs[1]!.id, description: 'He goes', location: ref('unit', unitId) });

    expect(sceneCast(file, unitId)).toEqual(['MIKE', 'CELESTE']);
    expect(promisesIn(file, { unitId }).map((p) => [p.record.title, p.role])).toEqual([
      ['The envelope', 'setup'],
      ['The corner', 'payoff'],
    ]);
    expect(promisesIn(file, { beatId: second.beat.id })).toEqual([]);
    expect(promisesIn(file, { beatId: first }).map((p) => p.role)).toEqual(['setup']);
  });
});
